import { useState, useRef, useEffect } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import Sidebar from "./Sidebar.jsx";
import TopBar from "./TopBar.jsx";
import { getSession } from "../lib/auth.js";
import {
  adjustInventoryStock,
  allocateJobStock,
  createInventoryItem,
  deleteInventoryPart,
  listInventory,
  listJobAllocationHistory,
  listJobAllocationStock,
  listPartCategories,
  listPendingJobRequests,
  restoreInventoryPart,
  savePartCategory,
  updateInventoryItem,
} from "../lib/api/inventory.js";
import ConfirmPasswordDialog from "./ConfirmPasswordDialog.jsx";
import { buildAllocationPrefill } from "../lib/allocation.js";
import { filterAllocationJobs } from "../lib/allocationHistory.js";
import {
  isCategoryNameTaken,
  isPrefixTaken,
  isValidPrefix,
  nextSku,
  normaliseCategoryName,
  normalisePrefix,
} from "../lib/inventoryCategories.js";
import {
  branchOptions,
  fetchInventoryRecords,
  mapInventoryRecord,
} from "../features/inventory/inventoryUtils.js";
import PendingJobRequestsTab from "../features/inventory/PendingJobRequestsTab.jsx";
import JobAllocationsHistoryTab from "../features/inventory/JobAllocationsHistoryTab.jsx";
import ItemDetailsDialog from "../features/inventory/ItemDetailsDialog.jsx";
import InventoryItemFormDialog from "../features/inventory/InventoryItemFormDialog.jsx";
import StockLedgerTab from "../features/inventory/StockLedgerTab.jsx";
import CategoryManagerDialog from "../features/inventory/CategoryManagerDialog.jsx";
import CategoryFormDialog from "../features/inventory/CategoryFormDialog.jsx";

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
  const [selectedCategory, setSelectedCategory] = useState("All categories");
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
      const { categories: incoming } = await listPartCategories();
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
      const result = await savePartCategory({
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
      await savePartCategory({
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

  // This effect resets the screen before a route/status-driven fetch; the
  // synchronous resets are intentional so the previous allocation view never
  // lingers while the new request is in flight. The rule flags the pattern, so
  // it is disabled for this effect only.
  /* eslint-disable react-hooks/set-state-in-effect */
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
      ? listJobAllocationStock({
          jobNumber: allocationJobNumber,
        })
      : isAllocationRoute
        ? Promise.resolve(null)
        : listInventory(inventoryStatus === "archived" ? { status: "archived" } : {});
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
    listPendingJobRequests()
      .then(({ jobs }) => {
        if (isCurrent) setPendingJobRequests(jobs || []);
      })
      .catch((error) => {
        if (isCurrent) setPendingRequestsError(error.message);
      })
      .finally(() => {
        if (isCurrent) setIsLoadingPendingRequests(false);
      });
    listJobAllocationHistory()
      .then(({ allocations }) => {
        if (isCurrent) setJobAllocationsHistory(allocations || []);
      })
      .catch((error) => {
        if (isCurrent) setJobAllocationsHistoryError(error.message);
      })
      .finally(() => {
        if (isCurrent) setIsLoadingJobAllocationsHistory(false);
      });
    listPartCategories()
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
  /* eslint-enable react-hooks/set-state-in-effect */

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
      await allocateJobStock({
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
      const result = await listJobAllocationStock({
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
      const result = await deleteInventoryPart({
        partId: selectedInventoryItem[13],
        password,
      });
      setIsDeletePartOpen(false);
      setSelectedItemCode(null);
      setPartNotice(result.message);
      const { items = [] } = await listInventory();
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
      const result = await restoreInventoryPart({ partId });
      setPartNotice(result.message);
      const { items = [] } = await listInventory({
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
      await adjustInventoryStock({
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
        await updateInventoryItem({
          stockId: selectedInventoryItem[12],
          partId: selectedInventoryItem[13],
          item,
        });
      } else {
        await createInventoryItem({ item });
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
          <div className="mb-7 flex items-end justify-between gap-5 max-[620px]:mb-4 max-[620px]:flex-col max-[620px]:items-stretch max-[620px]:gap-3">
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
            <div className="flex items-center gap-3 max-[620px]:w-full max-[620px]:gap-2">
              {!isAllocatingForJob && !isAllocationRoute && !isJobAllocation && <button
                type="button"
                onClick={openAddItem}
                className="rounded-[6px] border border-[#1250a0] bg-white px-5 py-3 text-[12px] font-bold text-[#1250a0] shadow-[0_2px_4px_rgb(18_80_160_/_12%)] hover:bg-[#f3f8ff] max-[1024px]:px-4 max-[1024px]:py-2 max-[620px]:flex-1 max-[620px]:px-2 max-[620px]:text-[11px]"
              >
                + Add New Item
              </button>}
              {!isAllocatingForJob && !isAllocationRoute && !isJobAllocation && <button
                type="button"
                onClick={() => setIsManageCategoriesOpen(true)}
                className="rounded-[6px] border border-[#d9dfe4] bg-white px-4 py-3 text-[12px] font-bold text-[#5e6b78] hover:bg-[#f4f6f8] max-[1024px]:px-3 max-[1024px]:py-2 max-[620px]:flex-1 max-[620px]:px-2 max-[620px]:text-[11px]"
              >
                Categories
              </button>}
            </div>
          </div>

          <section className="grid grid-cols-3 gap-[18px] transition-[max-height,opacity] duration-300 ease-in-out max-[620px]:grid-cols-1 max-[620px]:gap-2">
              {metricCards.map(([icon, title, value, note, alert]) => (
                <article
                  className={`relative min-h-[156px] rounded-[11px] border bg-white p-7 shadow-[0_3px_8px_rgb(31_59_82_/_14%)] max-[1024px]:min-h-[112px] max-[1024px]:p-4 max-[620px]:flex max-[620px]:min-h-[64px] max-[620px]:items-center max-[620px]:gap-3 max-[620px]:rounded-[6px] max-[620px]:p-3 ${alert ? "border-[#ff725f]" : "border-[#dfe6ec]"}`}
                  key={title}
                >
                  <div
                    className={`grid h-9 w-9 place-items-center rounded-[6px] max-[1024px]:h-7 max-[1024px]:w-7 max-[620px]:h-8 max-[620px]:w-8 max-[620px]:shrink-0 ${alert ? "bg-[#ffd5cc] text-[#ff725f]" : "bg-[#d6e6fb] text-[#1954a0]"}`}
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
                  <div className="min-w-0 flex-1 max-[620px]:grid max-[620px]:grid-cols-[minmax(0,1fr)_auto] max-[620px]:items-center max-[620px]:gap-x-3">
                    <p className="mb-0 mt-5 text-[11px] font-bold uppercase tracking-[.07em] text-[#858b90] max-[1024px]:mt-3 max-[620px]:col-start-1 max-[620px]:row-start-1 max-[620px]:mt-0 max-[620px]:text-[10px] max-[620px]:tracking-normal">
                      {title}
                    </p>
                    <strong className="mt-1 block text-[29px] font-extrabold leading-tight max-[1024px]:text-[23px] max-[620px]:col-start-2 max-[620px]:row-span-2 max-[620px]:row-start-1 max-[620px]:mt-0 max-[620px]:text-[20px]">
                      {value}
                    </strong>
                    <small className="text-[12px] text-[#8e959b] max-[1024px]:text-[9px] max-[620px]:col-start-1 max-[620px]:row-start-2 max-[620px]:block max-[620px]:text-[10px]">
                      {note}
                    </small>
                  </div>
                </article>
              ))}
          </section>

          {/* Tabbed Content Container */}
          <div className="mt-5 overflow-hidden rounded-[11px] border border-[#dfe6ec] bg-white shadow-[0_3px_8px_rgb(31_59_82_/_14%)]">
            {/* Tabs Navigation */}
            <div className="flex overflow-x-auto border-b border-[#e1e6eb] bg-white px-7 pt-4 max-[620px]:gap-5 max-[620px]:px-3 max-[620px]:pt-2">
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
                  className={`mr-8 shrink-0 whitespace-nowrap pb-3 text-[13px] font-bold transition-all max-[620px]:mr-0 max-[620px]:text-[11px] ${
                    activeTab === tab.id
                      ? "border-b-2 border-[#1250a0] text-[#1250a0]"
                      : "text-[#8b949c] hover:text-[#063b7c]"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {activeTab === "Stock Ledger" && (
              <StockLedgerTab
                accountBranchLabel={accountBranchLabel}
                actionError={actionError}
                availableQuantities={availableQuantities}
                branchOptions={branchOptions}
                categoryFilterOptions={categoryFilterOptions}
                filteredInventoryItems={filteredInventoryItems}
                handleAcceptJobStock={handleAcceptJobStock}
                handleCancelJobAllocation={handleCancelJobAllocation}
                handleQuantityChange={handleQuantityChange}
                handleRestorePart={handleRestorePart}
                handleSelectItem={handleSelectItem}
                hasQuotedDeviation={hasQuotedDeviation}
                inventoryError={inventoryError}
                inventoryStatus={inventoryStatus}
                isAdmin={isAdmin}
                isAllocatingForJob={isAllocatingForJob}
                isAllocatingStock={isAllocatingStock}
                isAllocationRoute={isAllocationRoute}
                isLoadingInventory={isLoadingInventory}
                issueQuantities={issueQuantities}
                jobAllocation={jobAllocation}
                partNotice={partNotice}
                quotationNumber={quotationNumber}
                quotedAdjustedCount={quotedAdjustedCount}
                quotedByStockId={quotedByStockId}
                quotedMatchedCount={quotedMatchedCount}
                quotedPartCount={quotedPartCount}
                quotedUnavailable={quotedUnavailable}
                searchTerm={searchTerm}
                selectedBranch={selectedBranch}
                selectedCategory={selectedCategory}
                selectedCount={selectedCount}
                selectedItems={selectedItems}
                selectedJobId={selectedJobId}
                setActionError={setActionError}
                setInventoryStatus={setInventoryStatus}
                setSearchTerm={setSearchTerm}
                setSelectedBranch={setSelectedBranch}
                setSelectedCategory={setSelectedCategory}
                setSelectedItemCode={setSelectedItemCode}
                setStockAdjustment={setStockAdjustment}
              />
            )}

            {activeTab === "Pending Job Requests" && (
              <PendingJobRequestsTab
                pendingJobRequests={pendingJobRequests}
                pendingRequestsError={pendingRequestsError}
                isLoadingPendingRequests={isLoadingPendingRequests}
                onSelectJob={handleSelectPendingJob}
              />
            )}

            {activeTab === "Job Allocations History" && (
              <JobAllocationsHistoryTab
                visibleAllocations={visibleAllocations}
                jobAllocationsHistory={jobAllocationsHistory}
                allocationSearch={allocationSearch}
                onAllocationSearchChange={setAllocationSearch}
                allocationOutcome={allocationOutcome}
                onAllocationOutcomeChange={setAllocationOutcome}
                isLoading={isLoadingJobAllocationsHistory}
                error={jobAllocationsHistoryError}
                expandedAllocationId={expandedAllocationId}
                onToggleExpanded={setExpandedAllocationId}
              />
            )}
          </div>

          <footer className="mt-6 border-t border-[#c9d4de] pt-3 text-[9px] text-[#8a9299] max-[1024px]:hidden">
            Guard-All Electronic Security Systems, Inc.
          </footer>
        </div>

        {selectedInventoryItem && (
          <ItemDetailsDialog
            selectedItem={selectedInventoryItem}
            onClose={() => setSelectedItemCode(null)}
            stockAdjustment={stockAdjustment}
            onStockAdjustmentChange={setStockAdjustment}
            onAdjustStock={handleStockAdjustment}
            isAdjustingStock={isAdjustingStock}
            actionError={actionError}
            onEdit={openEditItem}
            onRequestDelete={() => {
              setDeletePartError("");
              setIsDeletePartOpen(true);
            }}
          />
        )}

        {(isAddNewItem || isEditItem) && (
          <InventoryItemFormDialog
            isEditItem={isEditItem}
            onClose={() => {
              setIsAddNewItem(false);
              setIsEditItem(false);
            }}
            onSubmit={handleSaveInventoryItem}
            selectedItemCode={selectedItemCode}
            selectedItem={selectedInventoryItem}
            skuMode={skuMode}
            setSkuMode={setSkuMode}
            manualSku={manualSku}
            setManualSku={setManualSku}
            generatedSku={generatedSku}
            setGeneratedSku={setGeneratedSku}
            nextSkuFor={nextSkuFor}
            selectedCategoryId={selectedCategoryId}
            setSelectedCategoryId={setSelectedCategoryId}
            isAdmin={isAdmin}
            accountBranchLabel={accountBranchLabel}
            newItemQuantity={newItemQuantity}
            setNewItemQuantity={setNewItemQuantity}
            newItemUnitPrice={newItemUnitPrice}
            setNewItemUnitPrice={setNewItemUnitPrice}
            newItemTotalCost={newItemTotalCost}
            activeCategories={activeCategories}
            categoryNameById={categoryNameById}
            onNewCategory={openNewCategory}
            isLoadingCategories={isLoadingCategories}
            categoriesError={categoriesError}
            formError={formError}
            isSavingItem={isSavingItem}
          />
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
        <CategoryManagerDialog
          onClose={() => setIsManageCategoriesOpen(false)}
          categories={categories}
          categoriesError={categoriesError}
          isLoadingCategories={isLoadingCategories}
          onEdit={openEditCategory}
          onToggle={toggleCategory}
          onNew={openNewCategory}
        />
      )}

      {isCategoryDialogOpen && (
        <CategoryFormDialog
          onClose={() => setIsCategoryDialogOpen(false)}
          onSubmit={handleSaveCategory}
          editingCategory={editingCategory}
          isSavingCategory={isSavingCategory}
          categoryFormName={categoryFormName}
          setCategoryFormName={setCategoryFormName}
          categoryFormPrefix={categoryFormPrefix}
          setCategoryFormPrefix={setCategoryFormPrefix}
          categoryPrefixEdited={categoryPrefixEdited}
          setCategoryPrefixEdited={setCategoryPrefixEdited}
          categories={categories}
          inventoryRecords={inventoryRecords}
          categoryFormError={categoryFormError}
        />
      )}
    </main>
  );
}

export default Inventory;
