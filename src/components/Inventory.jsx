import { Fragment, useState, useRef, useEffect } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import Sidebar from "./Sidebar.jsx";
import TopBar from "./TopBar.jsx";
import { callAuthFunction } from "../lib/auth.js";

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
const categoryOptions = [
  "All categories",
  "Power",
  "Intrusion",
  "Access",
  "CCTV",
];

function Inventory() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [searchParams] = useSearchParams();
  const allocationJobNumber = searchParams.get("job");
  const isAllocationRoute = pathname === "/inventory/allocate";
  const isJobAllocation = Boolean(allocationJobNumber);
  const [inventoryRecords, setInventoryRecords] = useState([]);
  const [allocationInventoryRecords, setAllocationInventoryRecords] = useState([]);
  const [jobAllocation, setJobAllocation] = useState(null);
  const [isLoadingInventory, setIsLoadingInventory] = useState(true);
  const [isAllocatingStock, setIsAllocatingStock] = useState(false);
  const [inventoryError, setInventoryError] = useState("");
  const [isCreateRequisition, setIsCreateRequisition] = useState(false);
  const [isAddNewItem, setIsAddNewItem] = useState(false);
  const [isEditItem, setIsEditItem] = useState(false);
  const [isSavingItem, setIsSavingItem] = useState(false);
  const [isAdjustingStock, setIsAdjustingStock] = useState(false);
  const [formError, setFormError] = useState("");
  const [actionError, setActionError] = useState("");
  const [selectedItemCode, setSelectedItemCode] = useState(null);
  const [stockAdjustment, setStockAdjustment] = useState("");
  const [status, setStatus] = useState("In stock");
  const [newItemQuantity, setNewItemQuantity] = useState("");
  const [newItemUnitPrice, setNewItemUnitPrice] = useState("");
  const [requisitionReference] = useState(() =>
    Math.floor(10000 + Math.random() * 90000),
  );

  // Navigation & Toggle States (Default to metrics view on reload)
  const [activeTab, setActiveTab] = useState(
    isAllocationRoute ? "Pending Job Requests" : "Stock Ledger",
  );
  const [showJobCards, setShowJobCards] = useState(false);
  const [selectedJobId, setSelectedJobId] = useState("");
  const [selectedItems, setSelectedItems] = useState({});
  const [issueQuantities, setIssueQuantities] = useState({});
  const [pendingJobRequests, setPendingJobRequests] = useState([]);
  const [isLoadingPendingRequests, setIsLoadingPendingRequests] = useState(true);
  const [pendingRequestsError, setPendingRequestsError] = useState("");
  const [jobAllocationsHistory, setJobAllocationsHistory] = useState([]);
  const [isLoadingJobAllocationsHistory, setIsLoadingJobAllocationsHistory] = useState(true);
  const [jobAllocationsHistoryError, setJobAllocationsHistoryError] = useState("");

  // Branch dropdown & filtering state
  const [selectedBranch, setSelectedBranch] = useState("All branches");
  const branchBeforeJobAllocation = useRef("All branches");
  const [isBranchDropdownOpen, setIsBranchDropdownOpen] = useState(false);
  const branchDropdownRef = useRef(null);
  const [selectedCategory, setSelectedCategory] = useState("All categories");
  const [isCategoryDropdownOpen, setIsCategoryDropdownOpen] = useState(false);
  const categoryDropdownRef = useRef(null);
  const [searchTerm, setSearchTerm] = useState("");

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
        : callAuthFunction("list-inventory");
    inventoryRequest
      .then((result) => {
        if (!isCurrent) return;
        if (result) {
          if (result.job?.allocated) {
            navigate("/reports/new", { replace: true });
            return;
          }
          const records = (result.items || []).map(mapInventoryRecord);
          if (isJobAllocation) {
            setAllocationInventoryRecords(records);
          } else {
            setInventoryRecords(records);
          }
          if (result.job) {
            setJobAllocation(result.job);
            setSelectedJobId(result.job.jobNumber);
            setSelectedBranch(
              result.job.branch.replace(/^./, (letter) => letter.toUpperCase()),
            );
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
    return () => {
      isCurrent = false;
    };
  }, [allocationJobNumber, isAllocationRoute, isJobAllocation, navigate]);

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

  const isAllocatingForJob = showJobCards && Boolean(jobAllocation);
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
      setAllocationInventoryRecords((result.items || []).map(mapInventoryRecord));
      setJobAllocation(result.job);
      setSelectedBranch(
        result.job.branch.replace(/^./, (letter) => letter.toUpperCase()),
      );
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
    setAllocationInventoryRecords([]);
    setSelectedBranch(branchBeforeJobAllocation.current);
    setActionError("");
  }

  function handleCancelJobAllocation() {
    resetJobAllocation();
    setActiveTab("Stock Ledger");
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
    setIsSavingItem(true);
    const formData = Object.fromEntries(new FormData(event.currentTarget));
    const item = {
      name: formData.partName,
      sku: formData.sku,
      quantity: Number(formData.quantity),
      reorderThreshold: Number(formData.minimumStock),
      branch: formData.branch,
      address: formData.address,
      unitCost: Number(formData.unitPrice),
      unitOfMeasure: formData.unitOfMeasure,
      category: formData.category,
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
                onClick={() => {
                  setFormError("");
                  setNewItemQuantity("");
                  setNewItemUnitPrice("");
                  setIsEditItem(false);
                  setIsAddNewItem(true);
                }}
                className="rounded-[6px] border border-[#1250a0] bg-white px-5 py-3 text-[12px] font-bold text-[#1250a0] shadow-[0_2px_4px_rgb(18_80_160_/_12%)] hover:bg-[#f3f8ff] max-[1024px]:px-4 max-[1024px]:py-2 max-[620px]:text-[9px]"
              >
                + Add New Item
              </button>}
              {!isAllocatingForJob && !isAllocationRoute && !isJobAllocation && <button
                type="button"
                onClick={() => setIsCreateRequisition(true)}
                className="rounded-[6px] bg-[#1250a0] px-5 py-3 text-[12px] font-bold text-white shadow-[0_2px_4px_rgb(18_80_160_/_25%)] max-[1024px]:px-4 max-[1024px]:py-2 max-[620px]:text-[9px]"
              >
                + Create Requisition
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

                    {/* Branch Selection Dropdown */}
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
                          {categoryOptions.map((category) => (
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

                {inventoryError && (
                  <p
                    className="m-0 border-b border-[#f1b7af] bg-[#fff3f1] px-7 py-3 text-[12px] text-[#a83a2c]"
                    role="alert"
                  >
                    {inventoryError}
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
                    ]) => {
                      const isChecked = !!selectedItems[stockId];
                      const availableQuantity = Number(
                        availableQuantities.get(stockId) ?? quantity,
                      );
                      const isJobBranch =
                        branch.toLowerCase() ===
                        String(jobAllocation?.branch || "").toLowerCase();
                      return (
                        <Fragment key={stockId}>
                          {/* Desktop / tablet table row (unchanged layout) */}
                          <div
                            className={`grid min-h-[64px] grid-cols-[2fr_.8fr_.9fr_1.25fr_1fr_1fr_1fr_1fr_140px] items-center border-t border-[#e4e8eb] px-7 text-[11px] max-[1100px]:grid-cols-[2fr_1fr_1fr_1fr_1fr_140px] max-[1100px]:[&>*:nth-child(4)]:hidden max-[1100px]:[&>*:nth-child(5)]:hidden max-[1100px]:[&>*:nth-child(6)]:hidden max-[850px]:grid-cols-[2fr_1fr_1fr_1fr_140px] max-[850px]:[&>*:nth-child(7)]:hidden max-[850px]:px-4 max-[620px]:hidden ${
                              alert ? "bg-[#fff3f1]" : "bg-white"
                            } ${!isAllocatingForJob ? "cursor-pointer hover:bg-[#f8fbff]" : ""}`}
                            onClick={() => {
                              if (!isAllocatingForJob) {
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
                                alert
                                  ? "border-[#ffb0a3] text-[#f05b48]"
                                  : "border-[#d7dadd] text-[#70777d]"
                              }`}
                            >
                              <span className="material-symbols-outlined mr-1 align-middle text-[13px]">
                                {alert ? "warning" : "check_circle"}
                              </span>
                              {statusName}
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
                                    className="h-8 w-[68px] rounded border border-[#d9dfe4] bg-white px-2 text-center text-[11px] text-[#1250a0] outline-none focus:border-[#1250a0] disabled:bg-[#f2f4f6]"
                                  />
                                </>
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
                              if (!isAllocatingForJob) {
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
                              </small>
                            </div>
                            <div className="flex flex-none flex-col items-end gap-1.5">
                              <span
                                className={`w-max rounded-full px-2.5 py-1 text-[10px] font-bold ${
                                  alert
                                    ? "bg-[#ffd9d2] text-[#e05b45]"
                                    : "bg-[#e1f6e4] text-[#388b47]"
                                }`}
                              >
                                {statusName}
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
                                    className="h-8 w-[68px] rounded border border-[#d9dfe4] bg-white px-2 text-center text-[11px] text-[#1250a0] outline-none focus:border-[#1250a0] disabled:bg-[#f2f4f6]"
                                  />
                                </div>
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
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <p className="m-0 text-[10px] font-bold uppercase tracking-[.12em] text-[#777e85]">
                      RECORDED STOCK MOVEMENTS
                    </p>
                    <h2 className="m-0 mt-1 text-[21px] font-bold text-[#063b7c]">
                      Job Allocations History
                    </h2>
                  </div>
                  <span className="rounded-full border border-[#d7dadd] bg-[#fafafa] px-3 py-1 text-[11px] font-bold text-[#70777d]">
                    {jobAllocationsHistory.length} {jobAllocationsHistory.length === 1 ? "entry" : "entries"}
                  </span>
                </div>

                <div className="overflow-hidden rounded-[8px] border border-[#dfe6ec]">
                  <div className="grid grid-cols-[1.5fr_1.5fr_2fr_1fr_1.5fr] bg-[#fafafa] px-6 py-3 text-[10px] font-bold uppercase text-[#77818a] max-[850px]:grid-cols-[1.5fr_1.5fr_2fr_1.5fr] max-[850px]:[&>span:nth-child(4)]:hidden max-[620px]:grid-cols-[1.5fr_1.5fr_1.5fr] max-[620px]:[&>span:nth-child(5)]:hidden">
                    <span>Date</span>
                    <span>Job</span>
                    <span>Item</span>
                    <span>Qty Reserved</span>
                    <span>Technician</span>
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
                  ) : (
                    jobAllocationsHistory.map((item) => (
                      <div
                        key={item.id}
                        className="grid grid-cols-[1.5fr_1.5fr_2fr_1fr_1.5fr] items-center border-t border-[#e4e8eb] px-6 py-4 text-[11px] max-[850px]:grid-cols-[1.5fr_1.5fr_2fr_1.5fr] max-[850px]:[&>*:nth-child(4)]:hidden max-[620px]:grid-cols-[1.5fr_1.5fr_1.5fr] max-[620px]:[&>*:nth-child(5)]:hidden"
                      >
                        <span className="text-[#8e959b]">
                          {item.date
                            ? new Date(item.date).toLocaleDateString("en-US", {
                                month: "short",
                                day: "numeric",
                                year: "numeric",
                              })
                            : "—"}
                        </span>
                        <div>
                          <strong className="block text-[#063b7c]">{item.job}</strong>
                          <span className="text-[10px] capitalize text-[#8d969e]">
                            {item.status}
                          </span>
                        </div>
                        <div>
                          <strong className="block text-[#063b7c]">
                            {item.item}
                          </strong>
                          <span className="text-[10px] text-[#8d969e]">
                            {item.code}
                          </span>
                        </div>
                        <strong className="text-[#063b7c]">{item.quantity}</strong>
                        <span className="text-[#3a434d]">{item.technician}</span>
                      </div>
                    ))
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

              <footer className="flex justify-between border-t border-[#293d58] px-7 py-4 max-[620px]:px-5">
                <button
                  type="button"
                  onClick={() => {
                    setFormError("");
                    setNewItemQuantity(selectedInventoryItem[3]);
                    setNewItemUnitPrice(
                      String(
                        Number(
                          selectedInventoryItem[7].replace(/[^0-9.]/g, ""),
                        ),
                      ),
                    );
                    setIsEditItem(true);
                  }}
                  className="h-11 rounded-[8px] border border-[#4d88e8] px-5 text-[13px] font-semibold text-[#bcd4fa] hover:bg-[#1d3351]"
                >
                  Edit details
                </button>
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
                    Item Code <span className="text-[#ff6557]">*</span>
                    <input
                      required
                      name="sku"
                      defaultValue={isEditItem ? selectedInventoryItem[2] : ""}
                      placeholder="e.g. DMP-145"
                      className="mt-1.5 h-12 w-full rounded-[10px] border border-[#293f5d] bg-[#1d3351] px-4 text-[15px] text-white outline-none placeholder:text-[#7188a4] focus:border-[#4d88e8]"
                    />
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
                        isEditItem ? selectedInventoryItem[5] : "Makati"
                      }
                      className="mt-1.5 h-12 w-full rounded-[10px] border border-[#293f5d] bg-[#1d3351] px-4 text-[15px] text-white outline-none focus:border-[#4d88e8]"
                    >
                      <option>Makati</option>
                      <option>Cebu</option>
                    </select>
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
                      name="category"
                      defaultValue={
                        isEditItem ? selectedInventoryItem[9] : "Intrusion"
                      }
                      className="mt-1.5 h-12 w-full rounded-[10px] border border-[#293f5d] bg-[#1d3351] px-4 text-[15px] text-white outline-none focus:border-[#4d88e8]"
                    >
                      <option>Power</option>
                      <option>Intrusion</option>
                      <option>Access</option>
                      <option>CCTV</option>
                    </select>
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

        {/* Modal: Create Requisition */}
        {isCreateRequisition && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-[#071426]/75 p-4 backdrop-blur-[2px] max-[620px]:items-end max-[620px]:p-0"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget)
                setIsCreateRequisition(false);
            }}
          >
            <section
              role="dialog"
              className="flex max-h-[92vh] w-full max-w-[890px] flex-col overflow-hidden rounded-[17px] border border-[#263c5a] bg-[#172a44] text-[#e5edf8] shadow-[0_24px_80px_rgb(0_0_0_/_45%)] max-[620px]:max-h-[94vh] max-[620px]:rounded-b-none max-[620px]:rounded-t-[16px]"
            >
              <header className="flex shrink-0 items-start justify-between border-b border-[#293d58] px-7 py-5 max-[620px]:px-5 max-[620px]:py-4">
                <div>
                  <p className="m-0 text-[12px] font-semibold uppercase tracking-[.1em] text-[#91a8c7]">
                    Stock Ledger / Inventory
                  </p>
                  <h2
                    id="create-requisition-title"
                    className="m-0 mt-1 text-[27px] font-bold text-[white] max-[620px]:text-[23px]"
                  >
                    Create Requisition
                  </h2>
                  <p className="m-0 mt-1 text-[15px] text-[#99afc9]">
                    Add or request parts and equipment for stock management.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsCreateRequisition(false)}
                  className="grid h-8 w-8 place-items-center text-[27px] leading-none text-[#91a8c7] hover:text-white"
                >
                  ×
                </button>
              </header>

              <form
                id="create-requisition-form"
                className="min-h-0 flex-1 overflow-y-auto px-7 py-5 max-[620px]:px-5"
                onSubmit={(event) => {
                  event.preventDefault();
                  setIsCreateRequisition(false);
                }}
              >
                <div className="mb-4 grid grid-cols-2 gap-4 max-[620px]:grid-cols-1 max-[620px]:gap-3">
                  <label className="text-[14px] font-medium text-[#a9bfd9]">
                    Part Name <span className="text-[#ff6557]">*</span>
                    <input
                      required
                      autoFocus
                      type="text"
                      placeholder="e.g. PIR Motion Detector"
                      className="mt-1.5 h-12 w-full rounded-[10px] border border-[#293f5d] bg-[#1d3351] px-4 text-[15px] text-white outline-none placeholder:text-[#7188a4] focus:border-[#4d88e8]"
                    />
                  </label>
                  <label className="text-[14px] font-medium text-[#a9bfd9]">
                    Item Code <span className="text-[#ff6557]">*</span>
                    <input
                      required
                      type="text"
                      placeholder="e.g. DMP-145"
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
                      placeholder="e.g. 8"
                      className="mt-1.5 h-12 w-full rounded-[10px] border border-[#293f5d] bg-[#1d3351] px-4 text-[15px] text-white outline-none placeholder:text-[#7188a4] focus:border-[#4d88e8]"
                    />
                  </label>
                  <label className="text-[14px] font-medium text-[#a9bfd9]">
                    Category <span className="text-[#ff6557]">*</span>
                    <select
                      defaultValue="Intrusion"
                      className="mt-1.5 h-12 w-full rounded-[10px] border border-[#293f5d] bg-[#1d3351] px-4 text-[15px] text-white outline-none focus:border-[#4d88e8]"
                    >
                      <option>Power</option>
                      <option>Intrusion</option>
                      <option>Access</option>
                      <option>CCTV</option>
                    </select>
                  </label>
                </div>

                <div className="mb-4 grid grid-cols-2 gap-4 max-[620px]:grid-cols-1 max-[620px]:gap-3">
                  <label className="text-[14px] font-medium text-[#a9bfd9]">
                    Branch <span className="text-[#ff6557]">*</span>
                    <select
                      defaultValue="Makati"
                      className="mt-1.5 h-12 w-full rounded-[10px] border border-[#293f5d] bg-[#1d3351] px-4 text-[15px] text-white outline-none focus:border-[#4d88e8]"
                    >
                      <option>Makati</option>
                      <option>Cebu</option>
                    </select>
                  </label>
                </div>

                <fieldset className="mb-4 border-0 p-0">
                  <legend className="mb-1.5 text-[14px] font-medium text-[#a9bfd9]">
                    Status
                  </legend>
                  <div className="grid grid-cols-2 gap-2 max-[420px]:grid-cols-1">
                    <button
                      type="button"
                      onClick={() => setStatus("In stock")}
                      className={`h-12 rounded-[10px] border text-[15px] transition-colors ${
                        status === "In stock"
                          ? "border-[#4d88e8] bg-[#4d88e8] text-white"
                          : "border-[#293f5d] bg-[#1d3351] text-[#e5edf8] hover:border-[#4d88e8]"
                      }`}
                    >
                      In stock
                    </button>
                    <button
                      type="button"
                      onClick={() => setStatus("Low stock")}
                      className={`h-12 rounded-[10px] border text-[15px] transition-colors ${
                        status === "Low stock"
                          ? "border-[#ff6557] bg-[#ff6557] text-white"
                          : "border-[#293f5d] bg-[#1d3351] text-[#e5edf8] hover:border-[#ff6557]"
                      }`}
                    >
                      Low stock
                    </button>
                  </div>
                </fieldset>

                <label className="mt-4 block text-[14px] font-medium text-[#a9bfd9]">
                  Notes / Remarks
                  <textarea
                    rows="3"
                    placeholder="Add supplier information, specifications, or notes..."
                    className="mt-1.5 w-full resize-y rounded-[10px] border border-[#293f5d] bg-[#1d3351] px-4 py-3 text-[15px] text-white outline-none placeholder:text-[#7188a4] focus:border-[#4d88e8]"
                  />
                </label>
              </form>

              <footer className="flex shrink-0 items-center justify-between gap-4 border-t border-[#293d58] bg-[#172a44] px-7 py-4 max-[620px]:flex-col max-[620px]:items-stretch max-[620px]:px-5">
                <span className="text-[14px] text-[#91a8c7]">
                  Requisition Ref: REQ-
                  {requisitionReference}
                </span>
                <div className="flex gap-3 max-[420px]:flex-wrap">
                  <button
                    type="button"
                    onClick={() => setIsCreateRequisition(false)}
                    className="h-[50px] rounded-[10px] border border-[#293f5d] px-5 text-[14px] text-[#e5edf8] hover:bg-[#1d3351]"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsCreateRequisition(false)}
                    className="h-[50px] rounded-[10px] border border-[#293f5d] px-5 text-[14px] text-[#e5edf8] hover:bg-[#1d3351]"
                  >
                    Save draft
                  </button>
                  <button
                    type="submit"
                    form="create-requisition-form"
                    className="h-[50px] rounded-[10px] bg-[#4d88e8] px-5 text-[14px] font-semibold text-white hover:bg-[#5b96f4] max-[420px]:flex-1"
                  >
                    Create Requisition
                  </button>
                </div>
              </footer>
            </section>
          </div>
        )}
      </section>
    </main>
  );
}

export default Inventory;
