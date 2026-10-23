import { Fragment, useState, useRef, useEffect } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import Sidebar from "./Sidebar.jsx";
import TopBar from "./TopBar.jsx";
import { callAuthFunction, getSession } from "../lib/auth.js";
import ConfirmPasswordDialog from "./ConfirmPasswordDialog.jsx";
import { buildAllocationPrefill } from "../lib/allocation.js";
import {
  filterAllocationJobs,
  formatAllocationDate,
  formatPartsSummary,
} from "../lib/allocationHistory.js";
import {
  isCategoryNameTaken,
  isPrefixTaken,
  isValidPrefix,
  nextSku,
  normaliseCategoryName,
  normalisePrefix,
  suggestPrefix,
} from "../lib/inventoryCategories.js";

function formatCurrency(value) {
  return `₱${Number(value || 0).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function mapInventoryRecord(row) {
  const part = row.parts;
  const quantity = Number(row.quantity_on_hand) || 0;
  const quantityAvailable = Math.max(
    0,
    quantity - (Number(row.quantity_reserved) || 0),
  );
  const minimum = Number(part.reorder_threshold) || 0;
  const unitPrice = Number(part.unit_cost) || 0;
  const statusName = quantity <= minimum ? "Low stock" : "In stock";
  const icon = part.category === "Intrusion" ? "deployed_code" : "inventory_2";

  return [
    icon,
    part.name,
    part.sku,
    String(quantity),
    String(minimum),
    row.branch.replace(/^./, (letter) => letter.toUpperCase()),
    part.address || "—",
    formatCurrency(unitPrice),
    formatCurrency(unitPrice * quantity),
    part.category || "Uncategorized",
    statusName,
    statusName === "Low stock",
    row.stock_id,
    row.part_id,
    part.unit_of_measure,
    part.notes || "",
    quantityAvailable,
    part.category_id || "",
  ];
}

function isScheduleNearToday(dateValue) {
  const [year, month, day] = String(dateValue).split("-").map(Number);
  const scheduledDate = new Date(year, month - 1, day);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const daysUntilSchedule = Math.round(
    (scheduledDate.getTime() - today.getTime()) / 86400000,
  );
  return Math.abs(daysUntilSchedule) <= 3;
}

async function fetchInventoryRecords(action = "list-inventory", payload = {}) {
  const result = await callAuthFunction(action, payload);
  return (result.items || []).map(mapInventoryRecord);
}

const branchOptions = ["All branches", "Makati", "Cebu"];

// Outcome of a work order's stock: open while anything is still reserved, then
// whether the reservation was fully used, fully returned, or a mix.
const allocationOutcomeStyles = {
  "In progress": "border-[#e6b24c] bg-[#fff8e6] text-[#a56b00]",
  "Fully used": "border-[#8bdba2] bg-[#dff8e5] text-[#18823a]",
  "Partly returned": "border-[#73a9eb] bg-[#eef6ff] text-[#1762b1]",
  "Fully returned": "border-[#d7dadd] bg-[#f4f5f6] text-[#70777d]",
};
const allocationOutcomeFilters = ["All", "In progress", "Closed"];

function Inventory() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [searchParams] = useSearchParams();
  const allocationJobNumber = searchParams.get("job");
  const sessionUser = getSession()?.user;
  const isAdmin = sessionUser?.role === "Admin";
  const accountBranchLabel = sessionUser?.branch
    ? String(sessionUser.branch).replace(/^./, (letter) => letter.toUpperCase())
    : "Makati";
  const isAllocationRoute = pathname === "/inventory/allocate";
  const isJobAllocation = Boolean(allocationJobNumber);
  const [inventoryRecords, setInventoryRecords] = useState([]);
  const [allocationInventoryRecords, setAllocationInventoryRecords] = useState([]);
  const [jobAllocation, setJobAllocation] = useState(null);
  const [isLoadingInventory, setIsLoadingInventory] = useState(true);
  const [isAllocatingStock, setIsAllocatingStock] = useState(false);
  const [inventoryError, setInventoryError] = useState("");
  const [isAddNewItem, setIsAddNewItem] = useState(false);
  const [isEditItem, setIsEditItem] = useState(false);
  const [isSavingItem, setIsSavingItem] = useState(false);
  const [isAdjustingStock, setIsAdjustingStock] = useState(false);
  const [formError, setFormError] = useState("");
  const [actionError, setActionError] = useState("");
  const [selectedItemCode, setSelectedItemCode] = useState(null);
  const [stockAdjustment, setStockAdjustment] = useState("");
  const [newItemQuantity, setNewItemQuantity] = useState("");
  const [newItemUnitPrice, setNewItemUnitPrice] = useState("");

  // Navigation & Toggle States (Default to metrics view on reload)
  const [activeTab, setActiveTab] = useState(
    isAllocationRoute ? "Pending Job Requests" : "Stock Ledger",
  );
  const [showJobCards, setShowJobCards] = useState(false);
  const [selectedJobId, setSelectedJobId] = useState("");
  const [selectedItems, setSelectedItems] = useState({});
  const [issueQuantities, setIssueQuantities] = useState({});
  const [quotedByStockId, setQuotedByStockId] = useState({});
  const [quotedUnavailable, setQuotedUnavailable] = useState([]);
  const [quotedPartCount, setQuotedPartCount] = useState(0);
  const [quotationNumber, setQuotationNumber] = useState("");
  const [pendingJobRequests, setPendingJobRequests] = useState([]);
  const [isLoadingPendingRequests, setIsLoadingPendingRequests] = useState(true);
  const [pendingRequestsError, setPendingRequestsError] = useState("");
  const [jobAllocationsHistory, setJobAllocationsHistory] = useState([]);
  const [isLoadingJobAllocationsHistory, setIsLoadingJobAllocationsHistory] = useState(true);
  const [jobAllocationsHistoryError, setJobAllocationsHistoryError] = useState("");
  const [allocationSearch, setAllocationSearch] = useState("");
  const [allocationOutcome, setAllocationOutcome] = useState("All");
  const [expandedAllocationId, setExpandedAllocationId] = useState("");
  const [isDeletePartOpen, setIsDeletePartOpen] = useState(false);
  const [isDeletingPart, setIsDeletingPart] = useState(false);
  const [deletePartError, setDeletePartError] = useState("");
  const [partNotice, setPartNotice] = useState("");

  // Branch dropdown & filtering state
  const [selectedBranch, setSelectedBranch] = useState(isAdmin ? "All branches" : accountBranchLabel);
  const branchBeforeJobAllocation = useRef("All branches");
  const [isBranchDropdownOpen, setIsBranchDropdownOpen] = useState(false);
  const branchDropdownRef = useRef(null);
  const [selectedCategory, setSelectedCategory] = useState("All categories");
  const [isCategoryDropdownOpen, setIsCategoryDropdownOpen] = useState(false);
  const categoryDropdownRef = useRef(null);
  const [searchTerm, setSearchTerm] = useState("");
  // Archived parts keep their history but leave the working catalogue.
  const [inventoryStatus, setInventoryStatus] = useState("active");

  // Managed categories and the item-code state of the add/edit form.
  const [categories, setCategories] = useState([]);
  const [categoriesError, setCategoriesError] = useState("");
  const [isLoadingCategories, setIsLoadingCategories] = useState(true);
  const [selectedCategoryId, setSelectedCategoryId] = useState("");
  const [skuMode, setSkuMode] = useState("auto");
  const [manualSku, setManualSku] = useState("");
  const [generatedSku, setGeneratedSku] = useState("");
  const [isCategoryDialogOpen, setIsCategoryDialogOpen] = useState(false);
  const [isManageCategoriesOpen, setIsManageCategoriesOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [categoryFormName, setCategoryFormName] = useState("");
  const [categoryFormPrefix, setCategoryFormPrefix] = useState("");
  const [categoryPrefixEdited, setCategoryPrefixEdited] = useState(false);
  const [isSavingCategory, setIsSavingCategory] = useState(false);
  const [categoryFormError, setCategoryFormError] = useState("");

  const activeCategories = categories.filter((category) => category.active);
  const categoryFilterOptions = [
    "All categories",
    ...categories.map((category) => category.name),
  ];
  const categoryNameById = (categoryId) =>
    categories.find((category) => category.id === categoryId)?.name ?? "";

  async function loadCategories() {
    try {
      const { categories: incoming } = await callAuthFunction(
        "list-part-categories",
      );
      const next = Array.isArray(incoming) ? incoming : [];
      setCategories(next);
      setCategoriesError("");
      return next;
    } catch (error) {
      setCategoriesError(error.message);
      return [];
    } finally {
      setIsLoadingCategories(false);
    }
  }

  function nextSkuFor(categoryId) {
    const category = categories.find((entry) => entry.id === categoryId);
    if (!category) return "";
    if (category.nextSku) return category.nextSku;
    return nextSku(
      inventoryRecords.map((record) => record[2]),
      category.prefix,
    );
  }

  function openAddItem() {
    const firstCategory = activeCategories[0];
    setFormError("");
    setNewItemQuantity("");
    setNewItemUnitPrice("");
    setIsEditItem(false);
    setSelectedCategoryId(firstCategory?.id ?? "");
    setSkuMode("auto");
    setManualSku("");
    setGeneratedSku(firstCategory ? nextSkuFor(firstCategory.id) : "");
    setIsAddNewItem(true);
  }

  function openEditItem(record) {
    const categoryId =
      record[17] ||
      categories.find(
        (category) =>
          category.name.toLowerCase() === String(record[9]).toLowerCase(),
      )?.id ||
      "";
    setFormError("");
    setNewItemQuantity(record[3]);
    setNewItemUnitPrice(
      String(Number(record[7].replace(/[^0-9.]/g, ""))),
    );
    setSelectedCategoryId(categoryId);
    setSkuMode("manual");
    setManualSku(record[2]);
    setGeneratedSku(record[2]);
    setIsEditItem(true);
  }

  function openNewCategory() {
    setEditingCategory(null);
    setCategoryFormName("");
    setCategoryFormPrefix("");
    setCategoryPrefixEdited(false);
    setCategoryFormError("");
    setIsCategoryDialogOpen(true);
  }

  function openEditCategory(category) {
    setEditingCategory(category);
    setCategoryFormName(category.name);
    setCategoryFormPrefix(category.prefix);
    setCategoryPrefixEdited(true);
    setCategoryFormError("");
    setIsCategoryDialogOpen(true);
  }

  async function handleSaveCategory(event) {
    event.preventDefault();
    const name = normaliseCategoryName(categoryFormName);
    const prefix = normalisePrefix(categoryFormPrefix);
    if (!name) {
      setCategoryFormError("Enter a category name.");
      return;
    }
    if (!isValidPrefix(prefix)) {
      setCategoryFormError("Use 2–6 letters or digits for the code prefix.");
      return;
    }
    if (isCategoryNameTaken(name, categories, editingCategory?.id)) {
      setCategoryFormError("A category with that name already exists.");
      return;
    }
    if (isPrefixTaken(prefix, categories, editingCategory?.id)) {
      setCategoryFormError("Another category already uses that prefix.");
      return;
    }

    setIsSavingCategory(true);
    setCategoryFormError("");
    try {
      const result = await callAuthFunction("save-part-category", {
        categoryId: editingCategory?.id ?? "",
        name,
        prefix,
      });
      const refreshed = await loadCategories();
      setIsCategoryDialogOpen(false);
      if (!editingCategory) {
        const created = refreshed.find((entry) => entry.id === result.category.id);
        setSelectedCategoryId(result.category.id);
        if (!isEditItem) {
          setSkuMode("auto");
          setGeneratedSku(created?.nextSku ?? `${result.category.prefix}-001`);
        }
      }
    } catch (error) {
      setCategoryFormError(error.message);
    } finally {
      setIsSavingCategory(false);
    }
  }

  async function toggleCategory(category) {
    setCategoriesError("");
    try {
      await callAuthFunction("save-part-category", {
        categoryId: category.id,
        name: category.name,
        prefix: category.prefix,
        isActive: !category.active,
      });
      await loadCategories();
    } catch (error) {
      setCategoriesError(error.message);
    }
  }

  // Shared by the deep link (?job=...) and the pending-request picker so both
  // paths pre-fill the allocation list identically.
  function applyJobAllocation(result) {
    const prefill = buildAllocationPrefill(result);
    setAllocationInventoryRecords(
      (result.items || []).map(mapInventoryRecord),
    );
    setJobAllocation(result.job);
    setSelectedItems(prefill.selected);
    setIssueQuantities(prefill.quantities);
    setQuotedByStockId(prefill.quotedByStock);
    setQuotedUnavailable(prefill.unavailable);
    setQuotedPartCount(prefill.quotedCount);
    setQuotationNumber(result.quotationNumber || "");
    setActiveTab("Stock Ledger");
    setSelectedBranch(
      result.job.branch.replace(/^./, (letter) => letter.toUpperCase()),
    );
  }

  useEffect(() => {
    let isCurrent = true;
    setIsLoadingInventory(!isAllocationRoute || isJobAllocation);
    setIsLoadingPendingRequests(true);
    setJobAllocation(null);
    setInventoryError("");
    setPendingRequestsError("");
    setActionError("");
    setSelectedItems({});
    setIssueQuantities({});
    const inventoryRequest = isJobAllocation
      ? callAuthFunction("list-job-allocation-stock", {
          jobNumber: allocationJobNumber,
        })
      : isAllocationRoute
        ? Promise.resolve(null)
        : callAuthFunction(
            "list-inventory",
            inventoryStatus === "archived" ? { status: "archived" } : {},
          );
    inventoryRequest
      .then((result) => {
        if (!isCurrent) return;
        if (result) {
          if (result.job?.allocated) {
            navigate("/reports/new", { replace: true });
            return;
          }
          if (isJobAllocation) {
            applyJobAllocation(result);
            setSelectedJobId(result.job.jobNumber);
          } else {
            setInventoryRecords((result.items || []).map(mapInventoryRecord));
          }
        }
      })
      .catch((error) => {
        if (isCurrent) setInventoryError(error.message);
      })
      .finally(() => {
        if (isCurrent) setIsLoadingInventory(false);
      });
    callAuthFunction("list-pending-job-requests")
      .then(({ jobs }) => {
        if (isCurrent) setPendingJobRequests(jobs || []);
      })
      .catch((error) => {
        if (isCurrent) setPendingRequestsError(error.message);
      })
      .finally(() => {
        if (isCurrent) setIsLoadingPendingRequests(false);
      });
    callAuthFunction("list-job-allocation-history")
      .then(({ allocations }) => {
        if (isCurrent) setJobAllocationsHistory(allocations || []);
      })
      .catch((error) => {
        if (isCurrent) setJobAllocationsHistoryError(error.message);
      })
      .finally(() => {
        if (isCurrent) setIsLoadingJobAllocationsHistory(false);
      });
    callAuthFunction("list-part-categories")
      .then(({ categories: incoming }) => {
        if (!isCurrent) return;
        setCategories(Array.isArray(incoming) ? incoming : []);
        setCategoriesError("");
      })
      .catch((error) => {
        if (isCurrent) setCategoriesError(error.message);
      })
      .finally(() => {
        if (isCurrent) setIsLoadingCategories(false);
      });
    return () => {
      isCurrent = false;
    };
  }, [allocationJobNumber, isAllocationRoute, isJobAllocation, navigate, inventoryStatus]);

  // Close branch dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event) {
      if (
        branchDropdownRef.current &&
        !branchDropdownRef.current.contains(event.target) &&
        categoryDropdownRef.current &&
        !categoryDropdownRef.current.contains(event.target)
      ) {
        setIsBranchDropdownOpen(false);
        setIsCategoryDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // The deep link (/inventory/allocate?job=...) never sets showJobCards, so
  // allocation mode has to follow the route as well; otherwise the row controls
  // and the reserve action stay hidden on the path Scheduling hands off to.
  const isAllocatingForJob =
    Boolean(jobAllocation) && (showJobCards || isJobAllocation);
  const recordsToDisplay =
    isAllocatingForJob && inventoryRecords.length === 0
      ? allocationInventoryRecords
      : inventoryRecords;
  const filteredInventoryItems = recordsToDisplay.filter((item) => {
    const itemBranch = item[5];
    const itemCategory = item[9];
    const matchesBranch =
      selectedBranch === "All branches" ||
      itemBranch.toLowerCase() === selectedBranch.toLowerCase();
    const matchesCategory =
      selectedCategory === "All categories" ||
      itemCategory.toLowerCase() === selectedCategory.toLowerCase();
    const query = searchTerm.trim().toLowerCase();
    const matchesSearch =
      !query || `${item[1]} ${item[2]}`.toLowerCase().includes(query);
    return matchesBranch && matchesCategory && matchesSearch;
  });
  const availableQuantities = new Map(
    recordsToDisplay.map((item) => [item[12], item[16] ?? Number(item[3])]),
  );
  const visibleAllocations = filterAllocationJobs(jobAllocationsHistory, {
    query: allocationSearch,
    outcome: allocationOutcome,
  });
  const newItemTotalCost =
    (Number(newItemQuantity) || 0) * (Number(newItemUnitPrice) || 0);
  const selectedInventoryItem = inventoryRecords.find(
    (item) => item[12] === selectedItemCode,
  );
  const metricCards = [
    [
      "inventory_2",
      "Total tracked items",
      inventoryRecords.length.toLocaleString(),
      `Across ${new Set(inventoryRecords.map((item) => item[5])).size} branches`,
    ],
    [
      "warning",
      "Below reorder point",
      String(inventoryRecords.filter((item) => item[11]).length).padStart(
        2,
        "0",
      ),
      "Requires procurement",
      true,
    ],
    [
      "pending_actions",
      "Pending allocation",
      isLoadingPendingRequests
        ? "—"
        : String(pendingJobRequests.length).padStart(2, "0"),
      pendingRequestsError
        ? "Could not load requests"
        : "Awaiting stock reservation",
    ],
  ];

  const handleSelectItem = (stockId) => {
    setSelectedItems((prev) => ({ ...prev, [stockId]: !prev[stockId] }));
  };

  const handleQuantityChange = (stockId, qty) => {
    setIssueQuantities((prev) => ({ ...prev, [stockId]: qty }));
  };

  const selectedCount = Object.values(selectedItems).filter(Boolean).length;
  const quotedEntries = Object.entries(quotedByStockId);
  const quotedMatchedCount = quotedEntries.filter(
    ([stockId, quoted]) => Number(issueQuantities[stockId] || 1) === Number(quoted),
  ).length;
  const quotedAdjustedCount = quotedEntries.length - quotedMatchedCount;
  const hasQuotedDeviation =
    quotedAdjustedCount > 0 || quotedUnavailable.length > 0;

  async function handleAcceptJobStock() {
    const jobNumber = jobAllocation?.jobNumber || allocationJobNumber;
    if (!jobNumber || !selectedCount) return;
    const items = Object.entries(selectedItems)
      .filter(([, selected]) => selected)
      .map(([stockId]) => ({
        stockId,
        quantity: Number(issueQuantities[stockId] || 1),
      }));

    setActionError("");
    setIsAllocatingStock(true);
    try {
      await callAuthFunction("allocate-job-stock", {
        jobNumber,
        items,
      });
      navigate(`/reports/new?job=${encodeURIComponent(jobNumber)}`);
    } catch (error) {
      setActionError(error.message);
    } finally {
      setIsAllocatingStock(false);
    }
  }

  async function handleSelectPendingJob(job) {
    branchBeforeJobAllocation.current = selectedBranch;
    setSelectedJobId(job.jobNumber);
    setShowJobCards(true);
    setActiveTab("Stock Ledger");
    setIsLoadingInventory(true);
    setInventoryError("");
    setActionError("");
    setSelectedItems({});
    setIssueQuantities({});
    setAllocationInventoryRecords([]);
    try {
      const result = await callAuthFunction("list-job-allocation-stock", {
        jobNumber: job.jobNumber,
      });
      if (result.job?.allocated) {
        setPendingJobRequests((requests) =>
          requests.filter((request) => request.jobNumber !== job.jobNumber),
        );
        setShowJobCards(false);
        setActiveTab("Pending Job Requests");
        setPendingRequestsError("Stock has already been allocated to this job. Refresh the request list.");
        return;
      }
      applyJobAllocation(result);
    } catch (error) {
      setInventoryError(error.message);
      setShowJobCards(false);
      setActiveTab("Pending Job Requests");
    } finally {
      setIsLoadingInventory(false);
    }
  }

  function resetJobAllocation() {
    setShowJobCards(false);
    setJobAllocation(null);
    setSelectedJobId("");
    setSelectedItems({});
    setIssueQuantities({});
    setQuotedByStockId({});
    setQuotedUnavailable([]);
    setQuotedPartCount(0);
    setQuotationNumber("");
    setAllocationInventoryRecords([]);
    setSelectedBranch(branchBeforeJobAllocation.current);
    setActionError("");
  }

  function handleCancelJobAllocation() {
    resetJobAllocation();
    setActiveTab("Stock Ledger");
  }

  async function handleDeletePart(password) {
    if (!selectedInventoryItem) return;
    setDeletePartError("");
    setIsDeletingPart(true);
    try {
      const result = await callAuthFunction("delete-inventory-part", {
        partId: selectedInventoryItem[13],
        password,
      });
      setIsDeletePartOpen(false);
      setSelectedItemCode(null);
      setPartNotice(result.message);
      const { items = [] } = await callAuthFunction("list-inventory");
      setInventoryRecords(items.map(mapInventoryRecord));
    } catch (error) {
      setDeletePartError(error.message);
    } finally {
      setIsDeletingPart(false);
    }
  }

  async function handleRestorePart(partId) {
    setPartNotice("");
    setInventoryError("");
    try {
      const result = await callAuthFunction("restore-inventory-part", { partId });
      setPartNotice(result.message);
      const { items = [] } = await callAuthFunction("list-inventory", {
        status: "archived",
      });
      setInventoryRecords(items.map(mapInventoryRecord));
    } catch (error) {
      setInventoryError(error.message);
    }
  }

  async function handleStockAdjustment(direction) {
    const quantity = Number(stockAdjustment);
    if (!selectedItemCode || !Number.isInteger(quantity) || quantity <= 0) {
      return;
    }

    setActionError("");
    setIsAdjustingStock(true);
    try {
      await callAuthFunction("adjust-inventory-stock", {
        stockId: selectedItemCode,
        direction: direction === "add" ? "in" : "out",
        quantity,
      });
      setInventoryRecords(await fetchInventoryRecords());
      setStockAdjustment("");
    } catch (error) {
      setActionError(error.message);
    } finally {
      setIsAdjustingStock(false);
    }
  }

  async function handleSaveInventoryItem(event) {
    event.preventDefault();
    setFormError("");
    if (!selectedCategoryId) {
      setFormError("Choose a category for this item.");
      return;
    }
    setIsSavingItem(true);
    const formData = Object.fromEntries(new FormData(event.currentTarget));
    const item = {
      name: formData.partName,
      // An empty code on a create asks the server to generate one from the
      // category prefix. Editing never rewrites an existing code.
      sku: isEditItem ? manualSku : skuMode === "auto" ? "" : manualSku,
      quantity: Number(formData.quantity),
      reorderThreshold: Number(formData.minimumStock),
      branch: formData.branch,
      address: formData.address,
      unitCost: Number(formData.unitPrice),
      unitOfMeasure: formData.unitOfMeasure,
      categoryId: selectedCategoryId,
      notes: formData.notes,
    };

    try {
      if (isEditItem) {
        await callAuthFunction("update-inventory-item", {
          stockId: selectedInventoryItem[12],
          partId: selectedInventoryItem[13],
          item,
        });
      } else {
        await callAuthFunction("create-inventory-item", { item });
      }
      setInventoryRecords(await fetchInventoryRecords());
      await loadCategories();
      setNewItemQuantity("");
      setNewItemUnitPrice("");
      setIsAddNewItem(false);
      setIsEditItem(false);
    } catch (error) {
      setFormError(error.message);
    } finally {
      setIsSavingItem(false);
    }
  }

  return (
    <main className="flex h-screen overflow-hidden bg-[#1f2022] font-sans text-[#063b7c] max-[1024px]:block">
      <Sidebar />
      <section className="h-screen w-full min-w-0 flex-1 overflow-y-auto bg-[#edf7ff] max-[1024px]:h-[100dvh]">
        <TopBar />
        <div className="px-8 pb-6 pt-8 max-[1024px]:px-6 max-[1024px]:pb-20 max-[1024px]:pt-5 max-[620px]:px-3">
          {/* Header Bar */}
          <div className="mb-7 flex items-end justify-between gap-5 max-[620px]:mb-4 max-[620px]:items-start">
            <div>
              <p className="mb-1 text-[10px] font-bold uppercase tracking-[.12em] text-[#818b94] max-[620px]:text-[7px]">
                Operations / Stock ledger
              </p>
              <h1 className="m-0 text-[30px] font-bold tracking-[-.5px] max-[1024px]:text-[24px] max-[620px]:text-[19px]">
                Inventory
              </h1>
              <p className="mb-0 mt-2 text-[14px] text-[#8b949c] max-[620px]:mt-1 max-[620px]:text-[9px]">
                {isAllocatingForJob
                  ? `Select parts and quantities for ${selectedJobId}.`
                  : "Know what can leave the branch before the truck does."}
              </p>
            </div>
            <div className="flex items-center gap-3 max-[620px]:gap-2">
              {!isAllocatingForJob && !isAllocationRoute && !isJobAllocation && <button
                type="button"
                onClick={openAddItem}
                className="rounded-[6px] border border-[#1250a0] bg-white px-5 py-3 text-[12px] font-bold text-[#1250a0] shadow-[0_2px_4px_rgb(18_80_160_/_12%)] hover:bg-[#f3f8ff] max-[1024px]:px-4 max-[1024px]:py-2 max-[620px]:text-[9px]"
              >
                + Add New Item
              </button>}
              {!isAllocatingForJob && !isAllocationRoute && !isJobAllocation && <button
                type="button"
                onClick={() => setIsManageCategoriesOpen(true)}
                className="rounded-[6px] border border-[#d9dfe4] bg-white px-4 py-3 text-[12px] font-bold text-[#5e6b78] hover:bg-[#f4f6f8] max-[1024px]:px-3 max-[1024px]:py-2 max-[620px]:hidden"
              >
                Categories
              </button>}
            </div>
          </div>

          <section className="grid grid-cols-3 gap-[18px] transition-[max-height,opacity] duration-300 ease-in-out max-[620px]:gap-1">
              {metricCards.map(([icon, title, value, note, alert]) => (
                <article
                  className={`relative min-h-[156px] rounded-[11px] border bg-white p-7 shadow-[0_3px_8px_rgb(31_59_82_/_14%)] max-[1024px]:min-h-[112px] max-[1024px]:p-4 max-[620px]:min-h-[58px] max-[620px]:rounded-[6px] max-[620px]:p-2 ${alert ? "border-[#ff725f]" : "border-[#dfe6ec]"}`}
                  key={title}
                >
                  <div
                    className={`grid h-9 w-9 place-items-center rounded-[6px] max-[1024px]:h-7 max-[1024px]:w-7 max-[620px]:hidden ${alert ? "bg-[#ffd5cc] text-[#ff725f]" : "bg-[#d6e6fb] text-[#1954a0]"}`}
                  >
                    <span className="material-symbols-outlined text-[21px]">
                      {icon}
                    </span>
                  </div>
                  <span
                    className={`absolute right-7 top-7 material-symbols-outlined text-[21px] max-[1024px]:right-4 max-[1024px]:top-4 max-[620px]:hidden ${alert ? "text-[#ff725f]" : "text-[#16bc56]"}`}
                  >
                    north_east
                  </span>
                  <p className="mb-0 mt-5 text-[11px] font-bold uppercase tracking-[.07em] text-[#858b90] max-[1024px]:mt-3 max-[620px]:mt-0 max-[620px]:text-[6px] max-[620px]:tracking-normal">
                    {title}
                  </p>
                  <strong className="mt-1 block text-[29px] font-extrabold leading-tight max-[1024px]:text-[23px] max-[620px]:text-[15px]">
                    {value}
                  </strong>
                  <small className="text-[12px] text-[#8e959b] max-[1024px]:text-[9px] max-[620px]:hidden">
                    {note}
                  </small>
                </article>
              ))}
          </section>

          {/* Tabbed Content Container */}
          <div className="mt-5 overflow-hidden rounded-[11px] border border-[#dfe6ec] bg-white shadow-[0_3px_8px_rgb(31_59_82_/_14%)]">
            {/* Tabs Navigation */}
            <div className="flex border-b border-[#e1e6eb] bg-white px-7 pt-4">
              {[
                { id: "Stock Ledger", label: "Stock Ledger" },
                { id: "Pending Job Requests", label: "Pending Job Requests" },
                {
                  id: "Job Allocations History",
                  label: "Job Allocations History",
                },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`mr-8 pb-3 text-[13px] font-bold transition-all ${
                    activeTab === tab.id
                      ? "border-b-2 border-[#1250a0] text-[#1250a0]"
                      : "text-[#8b949c] hover:text-[#063b7c]"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* TAB 1: STOCK LEDGER */}
            {activeTab === "Stock Ledger" && (
              <>
                <header className="flex items-center justify-between gap-4 border-b border-[#e1e6eb] px-7 py-5 max-[620px]:items-start max-[620px]:px-3 max-[620px]:py-3">
                  <div>
                    <p className="m-0 text-[10px] font-bold uppercase tracking-[.12em] text-[#777e85]">
                      {isAllocatingForJob
                        ? `ALLOCATING STOCK · ${selectedJobId}`
                        : "Stock ledger"}
                    </p>
                    <h2 className="m-0 mt-1 text-[21px] font-bold max-[620px]:text-[13px]">
                      {isAllocatingForJob
                        ? "Select items from inventory"
                        : "Parts & equipment"}
                    </h2>
                  </div>
                  <div className="flex items-center gap-3 max-[620px]:w-full">
                    <label className="flex h-9 min-w-[180px] items-center gap-2 rounded-[6px] border border-[#d9dfe4] bg-[#f8f9fa] px-3 text-[11px] text-[#174f9a] max-[620px]:min-w-0 max-[620px]:flex-1 max-[620px]:text-[9px]">
                      <span className="material-symbols-outlined text-[18px] text-[#9ba3aa]">
                        search
                      </span>
                      <input
                        className="w-full min-w-0 border-0 bg-transparent outline-none placeholder:text-[#174f9a]"
                        value={searchTerm}
                        onChange={(event) => setSearchTerm(event.target.value)}
                        placeholder="Search part or code"
                      />
                    </label>

                    {!isAllocatingForJob && !isAllocationRoute && (
                      <div className="flex rounded-full border border-[#dfe4e8] bg-[#f8fafc] p-1 text-[10px]">
                        {[
                          { id: "active", label: "Active" },
                          { id: "archived", label: "Archived" },
                        ].map((option) => (
                          <button
                            key={option.id}
                            type="button"
                            onClick={() => setInventoryStatus(option.id)}
                            className={`rounded-full px-3 py-1 ${
                              inventoryStatus === option.id
                                ? "bg-white font-bold text-[#174f9a] shadow-sm"
                                : "text-[#87929d]"
                            }`}
                          >
                            {option.label}
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Branch Selection Dropdown */}
                    {!isAdmin && (
                      <span className="flex h-9 items-center gap-2 rounded-[6px] border border-[#d9dfe4] bg-[#f8f9fa] px-3 text-[11px] font-medium text-[#174f9a] max-[620px]:hidden">
                        <span className="material-symbols-outlined text-[17px]">
                          tune
                        </span>
                        {accountBranchLabel}
                      </span>
                    )}
                    {isAdmin && (
                    <div className="relative" ref={branchDropdownRef}>
                      <button
                        type="button"
                        onClick={() => setIsBranchDropdownOpen((prev) => !prev)}
                        className="flex h-9 items-center gap-2 rounded-[6px] border border-[#d9dfe4] bg-[#f8f9fa] px-3 text-[11px] font-medium text-[#174f9a] transition-colors hover:bg-[#eff4f9] max-[620px]:hidden"
                      >
                        <span className="material-symbols-outlined text-[17px]">
                          tune
                        </span>{" "}
                        {selectedBranch}
                        <span className="material-symbols-outlined text-[16px] text-[#777e85]">
                          arrow_drop_down
                        </span>
                      </button>

                      {isBranchDropdownOpen && (
                        <div className="absolute right-0 z-30 mt-1.5 w-44 rounded-[8px] border border-[#d9dfe4] bg-white p-1 shadow-[0_8px_20px_rgba(0,0,0,0.12)]">
                          {branchOptions.map((branch) => (
                            <button
                              key={branch}
                              type="button"
                              onClick={() => {
                                setSelectedBranch(branch);
                                setIsBranchDropdownOpen(false);
                              }}
                              className={`flex w-full items-center justify-between rounded-[5px] px-3 py-2 text-left text-[11px] transition-colors ${
                                selectedBranch === branch
                                  ? "bg-[#e8f1fd] font-bold text-[#1250a0]"
                                  : "text-[#3a434d] hover:bg-[#f1f5f9]"
                              }`}
                            >
                              <span>{branch}</span>
                              {selectedBranch === branch && (
                                <span className="material-symbols-outlined text-[14px]">
                                  check
                                </span>
                              )}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    )}
                    <div className="relative" ref={categoryDropdownRef}>
                      <button
                        type="button"
                        onClick={() =>
                          setIsCategoryDropdownOpen((prev) => !prev)
                        }
                        className="flex h-9 items-center gap-2 rounded-[6px] border border-[#d9dfe4] bg-[#f8f9fa] px-3 text-[11px] font-medium text-[#174f9a] transition-colors hover:bg-[#eff4f9] max-[620px]:hidden"
                      >
                        <span className="material-symbols-outlined text-[17px]">
                          tune
                        </span>{" "}
                        {selectedCategory}
                        <span className="material-symbols-outlined text-[16px] text-[#777e85]">
                          arrow_drop_down
                        </span>
                      </button>

                      {isCategoryDropdownOpen && (
                        <div className="absolute right-0 z-30 mt-1.5 w-44 rounded-[8px] border border-[#d9dfe4] bg-white p-1 shadow-[0_8px_20px_rgba(0,0,0,0.12)]">
                          {categoryFilterOptions.map((category) => (
                            <button
                              key={category}
                              type="button"
                              onClick={() => {
                                setSelectedCategory(category);
                                setIsCategoryDropdownOpen(false);
                              }}
                              className={`flex w-full items-center justify-between rounded-[5px] px-3 py-2 text-left text-[11px] transition-colors ${
                                selectedCategory === category
                                  ? "bg-[#e8f1fd] font-bold text-[#1250a0]"
                                  : "text-[#3a434d] hover:bg-[#f1f5f9]"
                              }`}
                            >
                              <span>{category}</span>
                              {selectedCategory === category && (
                                <span className="material-symbols-outlined text-[14px]">
                                  check
                                </span>
                              )}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </header>

                {/* Table Header */}
                <div className="grid grid-cols-[2fr_.8fr_.9fr_1.25fr_1fr_1fr_1fr_1fr_140px] items-center bg-[#fafafa] px-7 py-3 text-[10px] font-bold uppercase tracking-[.08em] text-[#77818a] max-[1100px]:grid-cols-[2fr_1fr_1fr_1fr_1fr_140px] max-[1100px]:[&>span:nth-child(4)]:hidden max-[1100px]:[&>span:nth-child(5)]:hidden max-[1100px]:[&>span:nth-child(6)]:hidden max-[850px]:grid-cols-[2fr_1fr_1fr_1fr_140px] max-[850px]:[&>span:nth-child(7)]:hidden max-[850px]:px-4 max-[620px]:hidden">
                    <span>Part name</span>
                    <span>Quantity</span>
                    <span>Branch</span>
                    <span>Address</span>
                    <span>Unit Price</span>
                    <span>Total Cost</span>
                    <span>Category</span>
                    <span>Status</span>
                    <span>Action</span>
                </div>

                {/* Quotation pre-fill summary — a soft flag, never a blocker */}
                {isAllocatingForJob && quotedPartCount > 0 && (
                  <div
                    className={`border-b px-7 py-3 text-[12px] ${
                      hasQuotedDeviation
                        ? "border-[#f0dcb4] bg-[#fffbf2] text-[#7a5a12]"
                        : "border-[#cfe6c8] bg-[#f4fbf2] text-[#3f6b34]"
                    }`}
                  >
                    <p className="m-0">
                      <span className="material-symbols-outlined mr-1 align-middle text-[15px]">
                        {hasQuotedDeviation ? "info" : "check_circle"}
                      </span>
                      <strong>
                        {quotedMatchedCount} of {quotedPartCount}
                      </strong>{" "}
                      quoted part{" "}
                      {quotedPartCount === 1 ? "line matches" : "lines match"}{" "}
                      {quotationNumber
                        ? `the quotation ${quotationNumber}`
                        : "the quotation"}
                      .
                      {quotedAdjustedCount > 0 &&
                        ` ${quotedAdjustedCount} adjusted for the branch.`}
                      {quotedUnavailable.length > 0 &&
                        ` ${quotedUnavailable.length} cannot be covered from stock.`}
                      <span className="ml-1 opacity-80">
                        Adjusting is allowed and does not block the reservation.
                      </span>
                    </p>
                    {quotedUnavailable.length > 0 && (
                      <ul className="m-0 mt-1 list-disc pl-5 text-[11px]">
                        {quotedUnavailable.map((line) => (
                          <li key={`${line.partId}-${line.reason}`}>
                            <strong>{line.description || "Part"}</strong>:
                            quoted {line.quoted}, available {line.available} —{" "}
                            {line.reason.toLowerCase()}.
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}

                {inventoryError && (
                  <p
                    className="m-0 border-b border-[#f1b7af] bg-[#fff3f1] px-7 py-3 text-[12px] text-[#a83a2c]"
                    role="alert"
                  >
                    {inventoryError}
                  </p>
                )}

                {partNotice && (
                  <p
                    className="m-0 border-b border-[#a8dfb7] bg-[#effaf2] px-7 py-3 text-[12px] text-[#267340]"
                    role="status"
                  >
                    {partNotice}
                  </p>
                )}

                {isLoadingInventory ? (
                  <div className="py-12 text-center text-[13px] text-[#8e959b]">
                    Loading inventory...
                  </div>
                ) : filteredInventoryItems.length === 0 ? (
                  <div className="py-12 text-center text-[13px] text-[#8e959b]">
                    {inventoryError ? (
                      "Inventory could not be loaded."
                    ) : (
                      <>
                        No inventory items found for{" "}
                        <strong>{selectedBranch}</strong> and{" "}
                        <strong>{selectedCategory}</strong>.
                      </>
                    )}
                  </div>
                ) : (
                  filteredInventoryItems.map(
                    ([
                      icon,
                      name,
                      code,
                      quantity,
                      minimum,
                      branch,
                      address,
                      unitPrice,
                      totalCost,
                      category,
                      statusName,
                      alert,
                      stockId,
                      partId,
                    ]) => {
                      const isChecked = !!selectedItems[stockId];
                      const availableQuantity = Number(
                        availableQuantities.get(stockId) ?? quantity,
                      );
                      const isJobBranch =
                        branch.toLowerCase() ===
                        String(jobAllocation?.branch || "").toLowerCase();
                      const quotedQuantity = quotedByStockId[stockId];
                      const isQuotedLine = quotedQuantity != null;
                      const deviatesFromQuote =
                        isQuotedLine &&
                        Number(issueQuantities[stockId] || 1) !==
                          Number(quotedQuantity);
                      return (
                        <Fragment key={stockId}>
                          {/* Desktop / tablet table row (unchanged layout) */}
                          <div
                            className={`grid min-h-[64px] grid-cols-[2fr_.8fr_.9fr_1.25fr_1fr_1fr_1fr_1fr_140px] items-center border-t border-[#e4e8eb] px-7 text-[11px] max-[1100px]:grid-cols-[2fr_1fr_1fr_1fr_1fr_140px] max-[1100px]:[&>*:nth-child(4)]:hidden max-[1100px]:[&>*:nth-child(5)]:hidden max-[1100px]:[&>*:nth-child(6)]:hidden max-[850px]:grid-cols-[2fr_1fr_1fr_1fr_140px] max-[850px]:[&>*:nth-child(7)]:hidden max-[850px]:px-4 max-[620px]:hidden ${
                              alert ? "bg-[#fff3f1]" : "bg-white"
                            } ${!isAllocatingForJob ? "cursor-pointer hover:bg-[#f8fbff]" : ""}`}
                            onClick={() => {
                              if (!isAllocatingForJob && inventoryStatus !== "archived") {
                                setSelectedItemCode(stockId);
                                setStockAdjustment("");
                                setActionError("");
                              }
                            }}
                          >
                            <div className="flex min-w-0 items-center gap-4">
                              <span
                                className={`grid h-9 w-9 flex-none place-items-center rounded-[6px] ${
                                  alert
                                    ? "bg-[#ffd5cc] text-[#ff5a42]"
                                    : "bg-[#d6e6fb] text-[#1954a0]"
                                }`}
                              >
                                <span className="material-symbols-outlined text-[19px]">
                                  {icon}
                                </span>
                              </span>
                              <span className="min-w-0">
                                <strong className="block truncate">{name}</strong>
                                <small className="mt-1 block text-[10px] text-[#8d969e]">
                                  {code}
                                  {isAllocatingForJob && (
                                    <span
                                      className={
                                        deviatesFromQuote
                                          ? "font-bold text-[#b57b16]"
                                          : undefined
                                      }
                                    >
                                      {" · "}
                                      {isQuotedLine
                                        ? `quoted ${quotedQuantity}`
                                        : "not in quote"}
                                    </span>
                                  )}
                                </small>
                              </span>
                            </div>
                            <strong>
                              {isAllocatingForJob ? availableQuantity : quantity}
                              <small className="font-normal text-[#8d969e]">
                                {" "}
                                / min {minimum}
                              </small>
                            </strong>
                            <strong>{branch}</strong>
                            <span className="text-[#7f8992] max-[1100px]:hidden">
                              {address}
                            </span>
                            <span className="text-[#174f9a] max-[1100px]:hidden">
                              {unitPrice}
                            </span>
                            <strong className="text-[#174f9a] max-[1100px]:hidden">
                              {totalCost}
                            </strong>
                            <span className="text-[#7f8992]">
                              {category}
                            </span>
                            <span
                              className={`w-max rounded-full border px-3 py-1 text-[10px] ${
                                inventoryStatus === "archived"
                                  ? "border-[#d7dadd] text-[#70777d]"
                                  : alert
                                    ? "border-[#ffb0a3] text-[#f05b48]"
                                    : "border-[#d7dadd] text-[#70777d]"
                              }`}
                            >
                              <span className="material-symbols-outlined mr-1 align-middle text-[13px]">
                                {inventoryStatus === "archived"
                                  ? "inventory_2"
                                  : alert
                                    ? "warning"
                                    : "check_circle"}
                              </span>
                              {inventoryStatus === "archived" ? "Archived" : statusName}
                            </span>
                            <div className="flex items-center justify-end gap-2">
                              {isAllocatingForJob ? (
                                <>
                                  <input
                                    type="checkbox"
                                    checked={isChecked}
                                    disabled={availableQuantity <= 0 || !isJobBranch}
                                    aria-label={`Select ${name} for ${selectedJobId}`}
                                    title={
                                      isJobBranch
                                        ? undefined
                                        : "Stock can only be allocated from the job's branch"
                                    }
                                    onChange={() => handleSelectItem(stockId)}
                                    className="h-4 w-4 rounded border-gray-300 text-[#1250a0] focus:ring-[#1250a0]"
                                  />
                                  <input
                                    type="number"
                                    min="1"
                                    max={availableQuantity}
                                    value={issueQuantities[stockId] || "1"}
                                    disabled={
                                      !isChecked ||
                                      availableQuantity <= 0 ||
                                      !isJobBranch
                                    }
                                    aria-label={`Quantity of ${name} to issue`}
                                    onChange={(event) =>
                                      handleQuantityChange(stockId, event.target.value)
                                    }
                                    className={`h-8 w-[68px] rounded border px-2 text-center text-[11px] text-[#1250a0] outline-none focus:border-[#1250a0] disabled:bg-[#f2f4f6] ${
                                      deviatesFromQuote
                                        ? "border-[#e0a63c] bg-[#fffaf0]"
                                        : "border-[#d9dfe4] bg-white"
                                    }`}
                                  />
                                </>
                              ) : inventoryStatus === "archived" ? (
                                <button
                                  type="button"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    handleRestorePart(partId);
                                  }}
                                  className="text-right text-[10px] font-bold text-[#1250a0] hover:underline"
                                >
                                  Restore
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedItemCode(stockId);
                                    setStockAdjustment("");
                                    setActionError("");
                                  }}
                                  className="text-right text-[10px] font-bold text-[#7573bd] hover:text-[#1250a0]"
                                >
                                  View
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Mobile card layout */}
                          <div
                            className={`hidden max-[620px]:mx-2 max-[620px]:mb-2 max-[620px]:flex max-[620px]:items-start max-[620px]:justify-between max-[620px]:gap-3 max-[620px]:rounded-[8px] max-[620px]:border max-[620px]:px-3 max-[620px]:py-3 max-[620px]:shadow-[0_2px_5px_rgb(31_59_82_/_8%)] ${
                              alert
                                ? "max-[620px]:border-[#ffb0a3] max-[620px]:bg-[#fff3f1]"
                                : "max-[620px]:border-[#dfe6ec] max-[620px]:bg-white"
                            } ${!isAllocatingForJob ? "max-[620px]:cursor-pointer" : ""}`}
                            onClick={() => {
                              if (!isAllocatingForJob && inventoryStatus !== "archived") {
                                setSelectedItemCode(stockId);
                                setStockAdjustment("");
                                setActionError("");
                              }
                            }}
                            role={isAllocatingForJob ? undefined : "button"}
                            aria-label={
                              isAllocatingForJob ? undefined : `View ${name} details`
                            }
                          >
                            <div className="min-w-0">
                              <strong className="block truncate text-[14px] text-[#174f9a]">
                                {name}
                              </strong>
                              <small className="mt-1 block truncate text-[11px] text-[#8d969e]">
                                {code} • {branch}
                                {isAllocatingForJob &&
                                  (isQuotedLine
                                    ? ` • quoted ${quotedQuantity}`
                                    : " • not in quote")}
                              </small>
                            </div>
                            <div className="flex flex-none flex-col items-end gap-1.5">
                              <span
                                className={`w-max rounded-full px-2.5 py-1 text-[10px] font-bold ${
                                  inventoryStatus === "archived"
                                    ? "bg-[#f1f2f3] text-[#70777d]"
                                    : alert
                                      ? "bg-[#ffd9d2] text-[#e05b45]"
                                      : "bg-[#e1f6e4] text-[#388b47]"
                                }`}
                              >
                                {inventoryStatus === "archived" ? "Archived" : statusName}
                              </span>
                              {isAllocatingForJob ? (
                                <div className="flex items-center gap-2">
                                  <input
                                    type="checkbox"
                                    checked={isChecked}
                                    disabled={availableQuantity <= 0 || !isJobBranch}
                                    aria-label={`Select ${name} for ${selectedJobId}`}
                                    onChange={() => handleSelectItem(stockId)}
                                    className="h-4 w-4 rounded border-gray-300 text-[#1250a0] focus:ring-[#1250a0]"
                                  />
                                  <input
                                    type="number"
                                    min="1"
                                    max={availableQuantity}
                                    value={issueQuantities[stockId] || "1"}
                                    disabled={
                                      !isChecked ||
                                      availableQuantity <= 0 ||
                                      !isJobBranch
                                    }
                                    aria-label={`Quantity of ${name} to issue`}
                                    onChange={(event) =>
                                      handleQuantityChange(stockId, event.target.value)
                                    }
                                    className={`h-8 w-[68px] rounded border px-2 text-center text-[11px] text-[#1250a0] outline-none focus:border-[#1250a0] disabled:bg-[#f2f4f6] ${
                                      deviatesFromQuote
                                        ? "border-[#e0a63c] bg-[#fffaf0]"
                                        : "border-[#d9dfe4] bg-white"
                                    }`}
                                  />
                                </div>
                              ) : inventoryStatus === "archived" ? (
                                <button
                                  type="button"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    handleRestorePart(partId);
                                  }}
                                  className="rounded-[5px] border border-[#1250a0] bg-white px-2.5 py-1 text-[9px] font-bold text-[#1250a0]"
                                >
                                  Restore
                                </button>
                              ) : (
                                <strong className="text-[13px] text-[#174f9a]">
                                  {quantity}
                                  <small className="font-normal text-[#8d969e]">
                                    {" "}
                                    /min {minimum}
                                  </small>
                                </strong>
                              )}
                            </div>
                          </div>
                        </Fragment>
                      );
                    },
                  )
                )}

                {/* Footer Action Bar when Items are Selected & Job Cards Mode is Active */}
                {isAllocatingForJob && (
                  <div className="flex items-center justify-between border-t border-[#e1e6eb] bg-[#fafafa] px-7 py-4">
                    <div>
                      <strong className="block text-[13px] text-[#063b7c]">
                        {selectedCount} items selected
                      </strong>
                      <span className="text-[11px] text-[#8b949c]">
                        for {selectedJobId} · {jobAllocation?.technicianName}
                      </span>
                    </div>

                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={handleCancelJobAllocation}
                        className="rounded-[6px] border border-[#1250a0] bg-white px-5 py-2 text-[12px] font-bold text-[#1250a0] hover:bg-[#f3f8ff]"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={handleAcceptJobStock}
                        disabled={!jobAllocation || selectedCount === 0 || isAllocatingStock}
                        className="rounded-[6px] bg-[#1250a0] px-5 py-2 text-[12px] font-bold text-white shadow-[0_2px_4px_rgb(18_80_160_/_25%)] disabled:opacity-50"
                      >
                        {isAllocatingStock ? "Reserving stock..." : "Confirm & Reserve Stock"}
                      </button>
                    </div>
                  </div>
                )}
                {actionError && isAllocatingForJob && (
                  <p className="m-0 border-t border-[#f1b7af] bg-[#fff3f1] px-7 py-3 text-[12px] text-[#a83a2c]" role="alert">
                    {actionError}
                  </p>
                )}
              </>
            )}

            {/* TAB 2: PENDING JOB REQUESTS */}
            {activeTab === "Pending Job Requests" && (
              <div className="p-7">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <p className="m-0 text-[10px] font-bold uppercase tracking-[.12em] text-[#777e85]">
                      AWAITING STOCK ALLOCATION
                    </p>
                    <h2 className="m-0 mt-1 text-[21px] font-bold text-[#063b7c]">
                      Pending Job Requests
                    </h2>
                  </div>
                  <span className="rounded-full border border-[#ffb0a3] bg-[#fff3f1] px-3 py-1 text-[11px] font-bold text-[#f05b48]">
                    {pendingJobRequests.length} awaiting allocation
                  </span>
                </div>

                {pendingRequestsError && (
                  <p className="mb-3 rounded-[6px] border border-[#f1b7af] bg-[#fff3f1] px-4 py-3 text-[12px] text-[#a83a2c]" role="alert">
                    {pendingRequestsError}
                  </p>
                )}

                <div className="overflow-hidden rounded-[8px] border border-[#dfe6ec]">
                  <div className="grid grid-cols-[1.2fr_2fr_1.5fr_1fr_1.2fr_120px] bg-[#fafafa] px-6 py-3 text-[10px] font-bold uppercase text-[#77818a] max-[850px]:grid-cols-[1.2fr_2fr_1.5fr_120px] max-[850px]:[&>span:nth-child(4)]:hidden max-[850px]:[&>span:nth-child(5)]:hidden max-[620px]:grid-cols-[1fr_1fr_100px] max-[620px]:[&>span:nth-child(2)]:hidden">
                    <span>Job</span>
                    <span>Client Location</span>
                    <span>Scheduled</span>
                    <span>Branch</span>
                    <span>Technician</span>
                    <span className="text-right">Action</span>
                  </div>

                  {isLoadingPendingRequests ? (
                    <p className="m-0 px-6 py-8 text-center text-[12px] text-[#8e959b]">
                      Loading pending job requests...
                    </p>
                  ) : pendingJobRequests.length === 0 ? (
                    <p className="m-0 px-6 py-8 text-center text-[12px] text-[#8e959b]">
                      No confirmed jobs are waiting for stock allocation.
                    </p>
                  ) : (
                    pendingJobRequests.map((req) => (
                      <div
                        key={req.jobNumber}
                        className="grid grid-cols-[1.2fr_2fr_1.5fr_1fr_1.2fr_120px] items-center border-t border-[#e4e8eb] px-6 py-4 text-[11px] max-[850px]:grid-cols-[1.2fr_2fr_1.5fr_120px] max-[850px]:[&>*:nth-child(4)]:hidden max-[850px]:[&>*:nth-child(5)]:hidden max-[620px]:grid-cols-[1fr_1fr_100px] max-[620px]:[&>*:nth-child(2)]:hidden"
                      >
                        <div>
                          <strong className="block text-[#063b7c]">
                            {req.jobNumber}
                          </strong>
                          <span className="text-[10px] text-[#8d969e]">
                            Pending
                          </span>
                        </div>
                        <span className="text-[#3a434d]">{req.location}</span>
                        <span className="text-[#3a434d]">
                          <span
                            className={
                              isScheduleNearToday(req.scheduledDate)
                                ? "font-semibold text-red-600"
                                : ""
                            }
                          >
                            {req.scheduledDate} · {req.scheduledTime}
                          </span>
                        </span>
                        <strong className="text-[#3a434d]">
                          {req.branch.replace(/^./, (letter) => letter.toUpperCase())}
                        </strong>
                        <span className="text-[#3a434d]">
                          {req.technicianName}
                        </span>
                        <div className="text-right">
                          <button
                            type="button"
                            onClick={() => handleSelectPendingJob(req)}
                            className="rounded-[6px] border border-[#1250a0] bg-white px-3 py-1.5 text-[11px] font-bold text-[#1250a0] hover:bg-[#f3f8ff]"
                          >
                            Select items
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* TAB 3: JOB ALLOCATIONS HISTORY */}
            {activeTab === "Job Allocations History" && (
              <div className="p-7">
                <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
                  <div>
                    <p className="m-0 text-[10px] font-bold uppercase tracking-[.12em] text-[#777e85]">
                      WORK ORDER ALLOCATIONS
                    </p>
                    <h2 className="m-0 mt-1 text-[21px] font-bold text-[#063b7c]">
                      Job Allocations History
                    </h2>
                    <p className="m-0 mt-1 text-[11px] text-[#8b949c]">
                      One row per work order. Expand it to see each part that was
                      reserved, used, or returned.
                    </p>
                  </div>
                  <span className="rounded-full border border-[#d7dadd] bg-[#fafafa] px-3 py-1 text-[11px] font-bold text-[#70777d]">
                    {visibleAllocations.length} of {jobAllocationsHistory.length} work orders
                  </span>
                </div>

                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <input
                    value={allocationSearch}
                    onChange={(event) => setAllocationSearch(event.target.value)}
                    placeholder="Search work order, client, or part"
                    className="h-8 w-64 rounded-[6px] border border-[#d9dfe4] bg-white px-3 text-[11px] text-[#174f9a] outline-none focus:border-[#1250a0] max-[620px]:w-full"
                  />
                  <div className="flex rounded-full border border-[#dfe4e8] bg-[#f8fafc] p-1 text-[10px]">
                    {allocationOutcomeFilters.map((filter) => (
                      <button
                        key={filter}
                        type="button"
                        onClick={() => setAllocationOutcome(filter)}
                        className={`rounded-full px-3 py-1 ${
                          allocationOutcome === filter
                            ? "bg-white font-bold text-[#174f9a] shadow-sm"
                            : "text-[#87929d]"
                        }`}
                      >
                        {filter}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="overflow-hidden rounded-[8px] border border-[#dfe6ec]">
                  <div className="grid grid-cols-[1.3fr_1.2fr_1.7fr_1fr_1fr_32px] bg-[#fafafa] px-6 py-3 text-[10px] font-bold uppercase text-[#77818a] max-[850px]:grid-cols-[1.4fr_1.2fr_1.8fr_1fr_32px] max-[850px]:[&>span:nth-child(5)]:hidden max-[620px]:grid-cols-[1.4fr_1.6fr_1fr_32px] max-[620px]:[&>span:nth-child(2)]:hidden max-[620px]:px-3">
                    <span>Work order</span>
                    <span>Client / date</span>
                    <span>Parts</span>
                    <span>Outcome</span>
                    <span>Last activity</span>
                    <span />
                  </div>

                  {isLoadingJobAllocationsHistory ? (
                    <p className="m-0 px-6 py-8 text-center text-[12px] text-[#8e959b]">
                      Loading allocation history...
                    </p>
                  ) : jobAllocationsHistoryError ? (
                    <p className="m-0 px-6 py-8 text-center text-[12px] text-[#a83a2c]" role="alert">
                      {jobAllocationsHistoryError}
                    </p>
                  ) : jobAllocationsHistory.length === 0 ? (
                    <p className="m-0 px-6 py-8 text-center text-[12px] text-[#8e959b]">
                      No stock reservations have been recorded.
                    </p>
                  ) : visibleAllocations.length === 0 ? (
                    <p className="m-0 px-6 py-8 text-center text-[12px] text-[#8e959b]">
                      No work orders match this search.
                    </p>
                  ) : (
                    visibleAllocations.map((job) => {
                      const isExpanded = expandedAllocationId === job.jobId;
                      return (
                        <div key={job.jobId} className="border-t border-[#e4e8eb]">
                          <button
                            type="button"
                            onClick={() =>
                              setExpandedAllocationId(isExpanded ? "" : job.jobId)
                            }
                            className="grid w-full grid-cols-[1.3fr_1.2fr_1.7fr_1fr_1fr_32px] items-center px-6 py-4 text-left transition-colors hover:bg-[#f8fbff] max-[850px]:grid-cols-[1.4fr_1.2fr_1.8fr_1fr_32px] max-[850px]:[&>*:nth-child(5)]:hidden max-[620px]:grid-cols-[1.4fr_1.6fr_1fr_32px] max-[620px]:[&>*:nth-child(2)]:hidden max-[620px]:px-3"
                          >
                            <div className="min-w-0">
                              <strong className="block truncate text-[12px] text-[#063b7c]">
                                {job.jobNumber}
                              </strong>
                              <span className="block truncate text-[10px] text-[#8d969e]">
                                {job.technicianNames?.join(", ") || "Unassigned"}
                              </span>
                            </div>
                            <div className="min-w-0">
                              <strong className="block truncate text-[11px] text-[#3a434d]">
                                {job.clientName}
                              </strong>
                              <span className="block text-[10px] text-[#8d969e]">
                                {formatAllocationDate(job.scheduledDate)}
                              </span>
                            </div>
                            <span className="text-[11px] text-[#3a434d]">
                              {formatPartsSummary(job.summary)}
                            </span>
                            <span
                              className={`w-max rounded-full border px-2.5 py-1 text-[10px] font-bold ${
                                allocationOutcomeStyles[job.outcome] ??
                                allocationOutcomeStyles["In progress"]
                              }`}
                            >
                              {job.outcome}
                            </span>
                            <span className="text-[10px] text-[#8d969e]">
                              {formatAllocationDate(job.lastActivityAt)}
                            </span>
                            <span className="material-symbols-outlined text-[18px] text-[#8b949c]">
                              {isExpanded ? "expand_less" : "expand_more"}
                            </span>
                          </button>

                          {isExpanded && (
                            <div className="border-t border-dashed border-[#e4e8eb] bg-[#fbfdff] px-6 py-3 max-[620px]:px-3">
                              <div className="grid grid-cols-[2fr_.7fr_.7fr_.8fr_1fr_1fr_1fr] items-center gap-2 pb-2 text-[9px] font-bold uppercase tracking-[.06em] text-[#8b949c] max-[850px]:grid-cols-[2fr_.8fr_.8fr_1fr_1fr] max-[850px]:[&>span:nth-child(3)]:hidden max-[620px]:grid-cols-[2fr_.8fr_.8fr_1fr] max-[620px]:[&>span:nth-child(6)]:hidden">
                                <span>Item</span>
                                <span>Reserved</span>
                                <span>Used</span>
                                <span>Returned</span>
                                <span>Status</span>
                                <span>Report</span>
                                <span>Last update</span>
                              </div>
                              {job.lines.map((line) => (
                                <div
                                  key={line.jobPartId}
                                  className="grid grid-cols-[2fr_.7fr_.7fr_.8fr_1fr_1fr_1fr] items-center gap-2 border-t border-[#eef2f5] py-2 text-[11px] max-[850px]:grid-cols-[2fr_.8fr_.8fr_1fr_1fr] max-[850px]:[&>*:nth-child(3)]:hidden max-[620px]:grid-cols-[2fr_.8fr_.8fr_1fr] max-[620px]:[&>*:nth-child(6)]:hidden"
                                >
                                  <div className="min-w-0">
                                    <strong className="block truncate text-[#174f9a]">
                                      {line.name}
                                    </strong>
                                    <span className="block text-[10px] text-[#8d969e]">
                                      {line.sku}
                                      {line.unitOfMeasure ? ` · ${line.unitOfMeasure}` : ""}
                                    </span>
                                  </div>
                                  <span className="text-[#3a434d]">
                                    {line.reservedQuantity}
                                  </span>
                                  <span className="text-[#3a434d]">
                                    {line.usedQuantity}
                                  </span>
                                  <span className="text-[#3a434d]">
                                    {line.returnedQuantity}
                                  </span>
                                  <span className="capitalize text-[#607286]">
                                    {line.status}
                                  </span>
                                  <span className="truncate text-[#607286]">
                                    {line.reportNumbers?.length
                                      ? line.reportNumbers.join(", ")
                                      : "—"}
                                  </span>
                                  <span className="text-[10px] text-[#8d969e]">
                                    {formatAllocationDate(
                                      line.updatedAt ?? line.reservedAt,
                                    )}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>

          <footer className="mt-6 border-t border-[#c9d4de] pt-3 text-[9px] text-[#8a9299] max-[1024px]:hidden">
            Guard-All Electronic Security Systems, Inc.
          </footer>
        </div>

        {selectedInventoryItem && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-[#071426]/75 p-4 backdrop-blur-[2px] max-[620px]:items-end max-[620px]:p-0"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget)
                setSelectedItemCode(null);
            }}
          >
            <section
              role="dialog"
              aria-labelledby="inventory-item-details-title"
              className="w-full max-w-[620px] rounded-[17px] border border-[#263c5a] bg-[#172a44] text-[#e5edf8] shadow-[0_24px_80px_rgb(0_0_0_/_45%)]"
            >
              <header className="flex items-start justify-between border-b border-[#293d58] px-7 py-5 max-[620px]:px-5 max-[620px]:py-4">
                <div>
                  <p className="m-0 text-[12px] font-semibold uppercase tracking-[.1em] text-[#91a8c7]">
                    Stock Ledger / Item Details
                  </p>
                  <h2
                    id="inventory-item-details-title"
                    className="m-0 mt-1 text-[25px] font-bold text-white max-[620px]:text-[21px]"
                  >
                    {selectedInventoryItem[1]}
                  </h2>
                  <p className="m-0 mt-1 text-[13px] text-[#99afc9]">
                    {selectedInventoryItem[2]} · {selectedInventoryItem[9]}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedItemCode(null)}
                  className="grid h-8 w-8 place-items-center text-[27px] leading-none text-[#91a8c7] hover:text-white"
                >
                  ×
                </button>
              </header>

              <div className="px-7 py-5 max-[620px]:px-5">
                <div className="grid grid-cols-2 gap-3 text-[13px] max-[420px]:grid-cols-1">
                  <div className="rounded-[8px] bg-[#1d3351] p-3">
                    <span className="block text-[11px] text-[#91a8c7]">
                      Branch
                    </span>
                    <strong className="mt-1 block">
                      {selectedInventoryItem[5]}
                    </strong>
                  </div>
                  <div className="rounded-[8px] bg-[#1d3351] p-3">
                    <span className="block text-[11px] text-[#91a8c7]">
                      Address
                    </span>
                    <strong className="mt-1 block">
                      {selectedInventoryItem[6]}
                    </strong>
                  </div>
                  <div className="rounded-[8px] bg-[#1d3351] p-3">
                    <span className="block text-[11px] text-[#91a8c7]">
                      Unit price
                    </span>
                    <strong className="mt-1 block">
                      {selectedInventoryItem[7]}
                    </strong>
                  </div>
                  <div className="rounded-[8px] bg-[#1d3351] p-3">
                    <span className="block text-[11px] text-[#91a8c7]">
                      Total cost
                    </span>
                    <strong className="mt-1 block">
                      {selectedInventoryItem[8]}
                    </strong>
                  </div>
                </div>

                <div className="mt-4 rounded-[8px] border border-[#293f5d] bg-[#1d3351] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <span className="block text-[11px] text-[#91a8c7]">
                        Current stock
                      </span>
                      <strong className="mt-1 block text-[25px] text-white">
                        {selectedInventoryItem[3]}
                        <span className="ml-1 text-[12px] font-normal text-[#91a8c7]">
                          {selectedInventoryItem[14]}
                        </span>
                        <span className="ml-2 text-[12px] font-normal text-[#91a8c7]">
                          / minimum {selectedInventoryItem[4]}
                        </span>
                      </strong>
                    </div>
                    <span
                      className={`rounded-full border px-3 py-1 text-[11px] font-semibold ${
                        selectedInventoryItem[10] === "Low stock"
                          ? "border-[#ff8f7c] text-[#ff9d8c]"
                          : "border-[#7bc695] text-[#9be0ae]"
                      }`}
                    >
                      {selectedInventoryItem[10]}
                    </span>
                  </div>
                </div>

                <div className="mt-4 border-t border-[#293d58] pt-4">
                  <label className="block text-[13px] font-medium text-[#a9bfd9]">
                    Stock quantity
                    <input
                      type="number"
                      min="1"
                      value={stockAdjustment}
                      onChange={(event) =>
                        setStockAdjustment(event.target.value)
                      }
                      placeholder="Enter quantity"
                      className="mt-1.5 h-11 w-full rounded-[8px] border border-[#293f5d] bg-[#1d3351] px-3 text-[14px] text-white outline-none placeholder:text-[#7188a4] focus:border-[#4d88e8]"
                    />
                  </label>
                  <div className="mt-3 grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => handleStockAdjustment("add")}
                      disabled={
                        !stockAdjustment ||
                        Number(stockAdjustment) <= 0 ||
                        isAdjustingStock
                      }
                      className="h-11 rounded-[8px] bg-[#4d88e8] text-[13px] font-semibold text-white hover:bg-[#5b96f4] disabled:cursor-not-allowed disabled:opacity-45"
                    >
                      {isAdjustingStock ? "Saving..." : "+ Add stock"}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleStockAdjustment("remove")}
                      disabled={
                        !stockAdjustment ||
                        Number(stockAdjustment) <= 0 ||
                        Number(stockAdjustment) >
                          Number(selectedInventoryItem[3]) ||
                        isAdjustingStock
                      }
                      className="h-11 rounded-[8px] border border-[#ff8f7c] text-[13px] font-semibold text-[#ffad9f] hover:bg-[#3a2b35] disabled:cursor-not-allowed disabled:opacity-45"
                    >
                      - Remove stock
                    </button>
                  </div>
                  {actionError && (
                    <p className="mt-3 text-[12px] text-[#ffad9f]" role="alert">
                      {actionError}
                    </p>
                  )}
                </div>
              </div>

              <footer className="flex justify-between gap-2 border-t border-[#293d58] px-7 py-4 max-[620px]:px-5">
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => openEditItem(selectedInventoryItem)}
                    className="h-11 rounded-[8px] border border-[#4d88e8] px-5 text-[13px] font-semibold text-[#bcd4fa] hover:bg-[#1d3351]"
                  >
                    Edit details
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setDeletePartError("");
                      setIsDeletePartOpen(true);
                    }}
                    className="h-11 rounded-[8px] border border-[#7d3b34] px-4 text-[13px] font-semibold text-[#f0b8b0] hover:bg-[#3a2320] max-[620px]:px-3"
                  >
                    Delete part
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedItemCode(null)}
                  className="h-11 rounded-[8px] border border-[#293f5d] px-5 text-[13px] text-[#e5edf8] hover:bg-[#1d3351]"
                >
                  Close
                </button>
              </footer>
            </section>
          </div>
        )}

        {(isAddNewItem || isEditItem) && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-[#071426]/75 p-4 backdrop-blur-[2px] max-[620px]:items-end max-[620px]:p-0"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) {
                setIsAddNewItem(false);
                setIsEditItem(false);
              }
            }}
          >
            <section
              role="dialog"
              aria-labelledby="add-new-item-title"
              className="flex max-h-[92vh] w-full max-w-[890px] flex-col overflow-hidden rounded-[17px] border border-[#263c5a] bg-[#172a44] text-[#e5edf8] shadow-[0_24px_80px_rgb(0_0_0_/_45%)] max-[620px]:max-h-[94vh] max-[620px]:rounded-b-none max-[620px]:rounded-t-[16px]"
            >
              <header className="flex shrink-0 items-start justify-between border-b border-[#293d58] px-7 py-5 max-[620px]:px-5 max-[620px]:py-4">
                <div>
                  <p className="m-0 text-[12px] font-semibold uppercase tracking-[.1em] text-[#91a8c7]">
                    Stock Ledger / Inventory
                  </p>
                  <h2
                    id="add-new-item-title"
                    className="m-0 mt-1 text-[27px] font-bold text-[white] max-[620px]:text-[23px]"
                  >
                    {isEditItem ? "Edit Item Details" : "Add New Item"}
                  </h2>
                  <p className="m-0 mt-1 text-[15px] text-[#99afc9]">
                    Add a new part or equipment item to the stock ledger.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setIsAddNewItem(false);
                    setIsEditItem(false);
                  }}
                  className="grid h-8 w-8 place-items-center text-[27px] leading-none text-[#91a8c7] hover:text-white"
                >
                  ×
                </button>
              </header>

              <form
                id="add-new-item-form"
                key={isEditItem ? selectedItemCode : "new-item"}
                className="min-h-0 flex-1 overflow-y-auto px-7 py-5 max-[620px]:px-5"
                onSubmit={handleSaveInventoryItem}
              >
                <div className="mb-4 grid grid-cols-2 gap-4 max-[620px]:grid-cols-1 max-[620px]:gap-3">
                  <label className="text-[14px] font-medium text-[#a9bfd9]">
                    Item Code{" "}
                    <span className="text-[#9ec1f0]">
                      {isEditItem || skuMode === "manual" ? "*" : "(auto)"}
                    </span>
                    <input
                      required={isEditItem || skuMode === "manual"}
                      name="sku"
                      value={
                        isEditItem
                          ? manualSku
                          : skuMode === "auto"
                            ? generatedSku
                            : manualSku
                      }
                      onChange={(event) =>
                        setManualSku(event.target.value.toUpperCase())
                      }
                      readOnly={isEditItem || skuMode === "auto"}
                      placeholder="e.g. DMP-145"
                      className={`mt-1.5 h-12 w-full rounded-[10px] border border-[#293f5d] bg-[#1d3351] px-4 text-[15px] text-white outline-none placeholder:text-[#7188a4] focus:border-[#4d88e8] ${
                        isEditItem || skuMode === "auto" ? "opacity-80" : ""
                      }`}
                    />
                    {!isEditItem &&
                      (skuMode === "auto" ? (
                        <button
                          type="button"
                          onClick={() => {
                            setSkuMode("manual");
                            setManualSku(generatedSku);
                          }}
                          className="mt-1 border-0 bg-transparent p-0 text-[11px] font-semibold text-[#9ec1f0] underline"
                        >
                          Enter manually
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setSkuMode("auto");
                            setManualSku("");
                            setGeneratedSku(nextSkuFor(selectedCategoryId));
                          }}
                          className="mt-1 border-0 bg-transparent p-0 text-[11px] font-semibold text-[#9ec1f0] underline"
                        >
                          Use generated code
                        </button>
                      ))}
                  </label>
                  <label className="text-[14px] font-medium text-[#a9bfd9]">
                    Part Name <span className="text-[#ff6557]">*</span>
                    <input
                      required
                      autoFocus
                      name="partName"
                      defaultValue={isEditItem ? selectedInventoryItem[1] : ""}
                      placeholder="e.g. PIR Motion Detector"
                      className="mt-1.5 h-12 w-full rounded-[10px] border border-[#293f5d] bg-[#1d3351] px-4 text-[15px] text-white outline-none placeholder:text-[#7188a4] focus:border-[#4d88e8]"
                    />
                  </label>
                </div>

                <div className="mb-4 grid grid-cols-2 gap-4 max-[620px]:grid-cols-1 max-[620px]:gap-3">
                  <label className="text-[14px] font-medium text-[#a9bfd9]">
                    Quantity <span className="text-[#ff6557]">*</span>
                    <input
                      required
                      type="number"
                      min="0"
                      name="quantity"
                      value={newItemQuantity}
                      onChange={(event) =>
                        setNewItemQuantity(event.target.value)
                      }
                      readOnly={isEditItem}
                      placeholder="e.g. 8"
                      className="mt-1.5 h-12 w-full rounded-[10px] border border-[#293f5d] bg-[#1d3351] px-4 text-[15px] text-white outline-none placeholder:text-[#7188a4] focus:border-[#4d88e8]"
                    />
                  </label>
                  <label className="text-[14px] font-medium text-[#a9bfd9]">
                    Minimum Stock Threshold{" "}
                    <span className="text-[#ff6557]">*</span>
                    <input
                      required
                      type="number"
                      min="0"
                      name="minimumStock"
                      defaultValue={isEditItem ? selectedInventoryItem[4] : ""}
                      placeholder="e.g. 10"
                      className="mt-1.5 h-12 w-full rounded-[10px] border border-[#293f5d] bg-[#1d3351] px-4 text-[15px] text-white outline-none placeholder:text-[#7188a4] focus:border-[#4d88e8]"
                    />
                  </label>
                </div>

                <div className="mb-4 grid grid-cols-2 gap-4 max-[620px]:grid-cols-1 max-[620px]:gap-3">
                  <label className="text-[14px] font-medium text-[#a9bfd9]">
                    Branch <span className="text-[#ff6557]">*</span>
                    <select
                      required
                      name="branch"
                      defaultValue={
                        isEditItem ? selectedInventoryItem[5] : accountBranchLabel
                      }
                      disabled={!isAdmin}
                      className="mt-1.5 h-12 w-full rounded-[10px] border border-[#293f5d] bg-[#1d3351] px-4 text-[15px] text-white outline-none focus:border-[#4d88e8] disabled:opacity-70"
                    >
                      <option>Makati</option>
                      <option>Cebu</option>
                    </select>
                    {!isAdmin && (
                      <span className="mt-1 block text-[11px] text-[#91a8c7]">
                        Assigned to your account branch.
                      </span>
                    )}
                  </label>
                  <label className="text-[14px] font-medium text-[#a9bfd9]">
                    Address <span className="text-[#ff6557]">*</span>
                    <input
                      required
                      name="address"
                      defaultValue={isEditItem ? selectedInventoryItem[6] : ""}
                      placeholder="e.g. Room 823, 8th Floor"
                      className="mt-1.5 h-12 w-full rounded-[10px] border border-[#293f5d] bg-[#1d3351] px-4 text-[15px] text-white outline-none placeholder:text-[#7188a4] focus:border-[#4d88e8]"
                    />
                  </label>
                </div>

                <div className="mb-4 grid grid-cols-2 gap-4 max-[620px]:grid-cols-1 max-[620px]:gap-3">
                  <label className="text-[14px] font-medium text-[#a9bfd9]">
                    Unit Price <span className="text-[#ff6557]">*</span>
                    <input
                      required
                      type="number"
                      min="0"
                      step="0.01"
                      name="unitPrice"
                      value={newItemUnitPrice}
                      onChange={(event) =>
                        setNewItemUnitPrice(event.target.value)
                      }
                      placeholder="e.g. 850"
                      className="mt-1.5 h-12 w-full rounded-[10px] border border-[#293f5d] bg-[#1d3351] px-4 text-[15px] text-white outline-none placeholder:text-[#7188a4] focus:border-[#4d88e8]"
                    />
                  </label>
                  <div className="flex flex-col justify-end text-[14px] font-medium text-[#a9bfd9]">
                    <span>Calculated Total Cost</span>
                    <output className="mt-1.5 flex h-12 items-center rounded-[10px] border border-[#293f5d] bg-[#1d3351] px-4 text-[15px] font-semibold text-white">
                      {formatCurrency(newItemTotalCost)}
                    </output>
                  </div>
                </div>

                <div className="mb-4 grid grid-cols-2 gap-4 max-[620px]:grid-cols-1 max-[620px]:gap-3">
                  <label className="text-[14px] font-medium text-[#a9bfd9]">
                    Category <span className="text-[#ff6557]">*</span>
                    <select
                      required
                      value={selectedCategoryId}
                      onChange={(event) => {
                        if (event.target.value === "__new") {
                          openNewCategory();
                          return;
                        }
                        setSelectedCategoryId(event.target.value);
                        if (!isEditItem && skuMode === "auto") {
                          setGeneratedSku(nextSkuFor(event.target.value));
                        }
                      }}
                      className="mt-1.5 h-12 w-full rounded-[10px] border border-[#293f5d] bg-[#1d3351] px-4 text-[15px] text-white outline-none focus:border-[#4d88e8]"
                    >
                      {!selectedCategoryId && (
                        <option value="">Select a category…</option>
                      )}
                      {activeCategories.map((category) => (
                        <option key={category.id} value={category.id}>
                          {category.name}
                        </option>
                      ))}
                      {selectedCategoryId &&
                        !activeCategories.some(
                          (category) => category.id === selectedCategoryId,
                        ) && (
                          <option value={selectedCategoryId}>
                            {categoryNameById(selectedCategoryId) ||
                              "Current category"}{" "}
                            (inactive)
                          </option>
                        )}
                      <option value="__new">＋ New category…</option>
                    </select>
                    {isLoadingCategories && (
                      <small className="mt-1 block text-[11px] text-[#91a8c7]">
                        Loading categories…
                      </small>
                    )}
                    {categoriesError && (
                      <small className="mt-1 block text-[11px] text-[#ffad9f]">
                        {categoriesError}
                      </small>
                    )}
                  </label>
                  <label className="text-[14px] font-medium text-[#a9bfd9]">
                    Unit of Measure <span className="text-[#ff6557]">*</span>
                    <input
                      required
                      name="unitOfMeasure"
                      defaultValue={
                        isEditItem ? selectedInventoryItem[14] : "pcs"
                      }
                      placeholder="e.g. pcs, box, roll"
                      className="mt-1.5 h-12 w-full rounded-[10px] border border-[#293f5d] bg-[#1d3351] px-4 text-[15px] text-white outline-none placeholder:text-[#7188a4] focus:border-[#4d88e8]"
                    />
                  </label>
                </div>

                <label className="mt-4 block text-[14px] font-medium text-[#a9bfd9]">
                  Notes / Remarks
                  <textarea
                    name="notes"
                    rows="3"
                    defaultValue={isEditItem ? selectedInventoryItem[15] : ""}
                    placeholder="Add supplier information, specifications, or notes..."
                    className="mt-1.5 w-full resize-y rounded-[10px] border border-[#293f5d] bg-[#1d3351] px-4 py-3 text-[15px] text-white outline-none placeholder:text-[#7188a4] focus:border-[#4d88e8]"
                  />
                </label>
                {formError && (
                  <p className="mt-3 text-[12px] text-[#ffad9f]" role="alert">
                    {formError}
                  </p>
                )}
              </form>

              <footer className="flex shrink-0 items-center justify-between gap-4 border-t border-[#293d58] bg-[#172a44] px-7 py-4 max-[620px]:flex-col max-[620px]:items-stretch max-[620px]:px-5">
                <span className="text-[14px] text-[#91a8c7]">
                  {isEditItem
                    ? "Update inventory item details"
                    : "Inventory item details"}
                </span>
                <div className="flex gap-3 max-[420px]:flex-wrap">
                  <button
                    type="button"
                    onClick={() => {
                      setIsAddNewItem(false);
                      setIsEditItem(false);
                    }}
                    className="h-[50px] rounded-[10px] border border-[#293f5d] px-5 text-[14px] text-[#e5edf8] hover:bg-[#1d3351]"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    form="add-new-item-form"
                    disabled={isSavingItem}
                    className="h-[50px] rounded-[10px] bg-[#4d88e8] px-5 text-[14px] font-semibold text-white hover:bg-[#5b96f4] max-[420px]:flex-1"
                  >
                    {isSavingItem
                      ? "Saving..."
                      : isEditItem
                        ? "Save Changes"
                        : "Add New Item"}
                  </button>
                </div>
              </footer>
            </section>
          </div>
        )}

      </section>
      {isDeletePartOpen && selectedInventoryItem && (
        <ConfirmPasswordDialog
          title="Delete inventory part"
          message={`Delete ${selectedInventoryItem[1]} (${selectedInventoryItem[2]})?`}
          detail="The part must have no stock on hand. If it has any stock history it will be archived instead — hidden from the catalogue and pickers, but kept in the stock records, where it can be restored from the Archived view."
          confirmLabel="Delete part"
          busyLabel="Deleting..."
          isBusy={isDeletingPart}
          error={deletePartError}
          onCancel={() => setIsDeletePartOpen(false)}
          onConfirm={handleDeletePart}
        />
      )}
      {isManageCategoriesOpen && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-[#071426]/75 p-4 backdrop-blur-[2px] max-[620px]:items-end max-[620px]:p-0"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setIsManageCategoriesOpen(false);
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-label="Inventory categories"
            className="flex max-h-[86vh] w-full max-w-[600px] flex-col overflow-hidden rounded-[14px] border border-[#263c5a] bg-[#172a44] text-[#e5edf8] shadow-[0_24px_80px_rgb(0_0_0_/_45%)] max-[620px]:max-h-[92vh] max-[620px]:rounded-b-none max-[620px]:rounded-t-[16px]"
          >
            <header className="flex shrink-0 items-start justify-between border-b border-[#293d58] px-6 py-4">
              <div>
                <p className="m-0 text-[10px] font-bold uppercase tracking-[.1em] text-[#91a8c7]">
                  Stock Ledger / Inventory
                </p>
                <h2 className="m-0 mt-1 text-[21px] font-bold text-white">
                  Categories
                </h2>
                <p className="m-0 mt-1 text-[12px] text-[#99afc9]">
                  Each category supplies the prefix for generated item codes.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsManageCategoriesOpen(false)}
                className="grid h-8 w-8 place-items-center text-[24px] leading-none text-[#91a8c7] hover:text-white"
                aria-label="Close"
              >
                ×
              </button>
            </header>

            <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
              {categoriesError && (
                <p className="m-0 mb-3 rounded-[6px] border border-[#7d3b34] bg-[#3a2320] px-3 py-2 text-[12px] text-[#f0b8b0]" role="alert">
                  {categoriesError}
                </p>
              )}
              {isLoadingCategories ? (
                <p className="m-0 py-6 text-center text-[12px] text-[#91a8c7]">
                  Loading categories...
                </p>
              ) : categories.length === 0 ? (
                <p className="m-0 py-6 text-center text-[12px] text-[#91a8c7]">
                  No categories yet. Create the first one.
                </p>
              ) : (
                <ul className="m-0 list-none space-y-2 p-0">
                  {categories.map((category) => (
                    <li
                      key={category.id}
                      className="flex flex-wrap items-center gap-2 rounded-[8px] border border-[#293f5d] bg-[#1d3351] px-4 py-3"
                    >
                      <span className="min-w-0 flex-1">
                        <strong className="block truncate text-[14px] text-white">
                          {category.name}
                        </strong>
                        <small className="block text-[11px] text-[#91a8c7]">
                          {category.partCount}{" "}
                          {category.partCount === 1 ? "part" : "parts"} · next{" "}
                          {category.nextSku}
                        </small>
                      </span>
                      <span className="rounded-[5px] border border-[#3a5578] bg-[#22395a] px-2 py-1 font-mono text-[11px] text-[#bcd4fa]">
                        {category.prefix}
                      </span>
                      {!category.active && (
                        <span className="rounded-full border border-[#7d3b34] px-2 py-0.5 text-[9px] font-bold text-[#f0b8b0]">
                          Inactive
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => openEditCategory(category)}
                        className="h-8 rounded-[6px] border border-[#3a5578] px-3 text-[11px] font-semibold text-[#bcd4fa] hover:bg-[#22395a]"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => toggleCategory(category)}
                        className="h-8 rounded-[6px] border border-[#3a5578] px-3 text-[11px] font-semibold text-[#91a8c7] hover:bg-[#22395a]"
                      >
                        {category.active ? "Deactivate" : "Activate"}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <footer className="flex shrink-0 items-center justify-between gap-3 border-t border-[#293d58] px-6 py-4">
              <button
                type="button"
                onClick={openNewCategory}
                className="h-10 rounded-[6px] bg-[#4d88e8] px-4 text-[12px] font-semibold text-white hover:bg-[#5b96f4]"
              >
                + New category
              </button>
              <button
                type="button"
                onClick={() => setIsManageCategoriesOpen(false)}
                className="h-10 rounded-[6px] border border-[#293f5d] px-4 text-[12px] text-[#e5edf8] hover:bg-[#1d3351]"
              >
                Done
              </button>
            </footer>
          </section>
        </div>
      )}

      {isCategoryDialogOpen && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-[#071426]/75 p-4 backdrop-blur-[2px] max-[620px]:items-end max-[620px]:p-0"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !isSavingCategory) {
              setIsCategoryDialogOpen(false);
            }
          }}
        >
          <form
            onSubmit={handleSaveCategory}
            role="dialog"
            aria-modal="true"
            aria-label={editingCategory ? "Edit category" : "New category"}
            className="w-full max-w-[460px] rounded-[14px] border border-[#263c5a] bg-[#172a44] p-6 text-[#e5edf8] shadow-[0_24px_80px_rgb(0_0_0_/_45%)] max-[620px]:rounded-b-none max-[620px]:rounded-t-[16px]"
          >
            <h2 className="m-0 text-[20px] font-bold text-white">
              {editingCategory ? "Edit category" : "New category"}
            </h2>
            <p className="m-0 mt-1 text-[12px] text-[#99afc9]">
              The prefix is used to generate item codes such as DMP-001.
            </p>

            <label className="mt-4 block text-[13px] font-medium text-[#a9bfd9]">
              Name <span className="text-[#ff6557]">*</span>
              <input
                autoFocus
                required
                value={categoryFormName}
                onChange={(event) => {
                  const value = event.target.value;
                  setCategoryFormName(value);
                  if (!categoryPrefixEdited) {
                    setCategoryFormPrefix(
                      suggestPrefix(
                        value,
                        categories.map((category) => category.prefix),
                      ),
                    );
                  }
                }}
                placeholder="e.g. Door Magnetic Contact"
                className="mt-1.5 h-12 w-full rounded-[10px] border border-[#293f5d] bg-[#1d3351] px-4 text-[15px] text-white outline-none placeholder:text-[#7188a4] focus:border-[#4d88e8]"
              />
            </label>

            <label className="mt-3 block text-[13px] font-medium text-[#a9bfd9]">
              Code prefix <span className="text-[#ff6557]">*</span>
              <input
                required
                value={categoryFormPrefix}
                onChange={(event) => {
                  setCategoryFormPrefix(normalisePrefix(event.target.value));
                  setCategoryPrefixEdited(true);
                }}
                maxLength={6}
                placeholder="e.g. DMP"
                className="mt-1.5 h-12 w-full rounded-[10px] border border-[#293f5d] bg-[#1d3351] px-4 text-[15px] uppercase tracking-[.08em] text-white outline-none placeholder:text-[#7188a4] focus:border-[#4d88e8]"
              />
              <small className="mt-1 block text-[11px] text-[#91a8c7]">
                2–6 letters or digits. Next code:{" "}
                <strong className="text-[#bcd4fa]">
                  {isValidPrefix(categoryFormPrefix)
                    ? nextSku(
                        inventoryRecords.map((record) => record[2]),
                        categoryFormPrefix,
                      )
                    : "—"}
                </strong>
                {editingCategory
                  ? " · existing item codes keep their number"
                  : ""}
              </small>
            </label>

            {categoryFormError && (
              <p
                className="m-0 mt-3 rounded-[6px] border border-[#7d3b34] bg-[#3a2320] px-3 py-2 text-[12px] text-[#f0b8b0]"
                role="alert"
              >
                {categoryFormError}
              </p>
            )}

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsCategoryDialogOpen(false)}
                disabled={isSavingCategory}
                className="h-10 rounded-[6px] border border-[#293f5d] px-4 text-[12px] text-[#e5edf8] hover:bg-[#1d3351] disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSavingCategory}
                className="h-10 rounded-[6px] bg-[#4d88e8] px-4 text-[12px] font-semibold text-white hover:bg-[#5b96f4] disabled:opacity-50"
              >
                {isSavingCategory
                  ? "Saving..."
                  : editingCategory
                    ? "Save category"
                    : "Create category"}
              </button>
            </div>
          </form>
        </div>
      )}
    </main>
  );
}

export default Inventory;
