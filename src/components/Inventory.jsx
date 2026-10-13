import { useState, useRef, useEffect } from "react";
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
  ];
}

async function fetchInventoryRecords() {
  const result = await callAuthFunction("list-inventory");
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

const confirmedJobsData = [
  {
    id: "JOB #104",
    branch: "CEBU",
    title: "Cebu Branch, Room 813, Cebu City",
    date: "Oct 16, 2026 · 9:00 AM · R. Villanueva",
    status: "Confirmed",
  },
  {
    id: "JOB #105",
    branch: "MAKATI",
    title: "Ayala Ave, Makati City",
    date: "Oct 18, 2026 · 1:00 PM · M. Santos",
    status: "Confirmed",
  },
];

const pendingJobRequestsData = [
  {
    job: "Job #104",
    status: "Confirmed",
    location: "Cebu Branch, Room 813, Cebu City",
    scheduled: "Oct 16, 2026 · 9:00 AM",
    branch: "Cebu",
    technician: "R. Villanueva",
  },
  {
    job: "Job #105",
    status: "Confirmed",
    location: "Ayala Ave, Makati City",
    scheduled: "Oct 18, 2026 · 1:00 PM",
    branch: "Makati",
    technician: "M. Santos",
  },
];

const jobAllocationsHistoryData = [
  {
    date: "Oct 13, 2026",
    job: "Job #105",
    item: "Motion Sensor",
    code: "DMP-001",
    qtyIssued: 2,
    technician: "M. Santos",
  },
  {
    date: "Oct 13, 2026",
    job: "Job #104",
    item: "Door Contact",
    code: "DMP-003",
    qtyIssued: 1,
    technician: "R. Villanueva",
  },
  {
    date: "Oct 13, 2026",
    job: "Job #104",
    item: "Motion Sensor",
    code: "DMP-001",
    qtyIssued: 1,
    technician: "R. Villanueva",
  },
];

function Inventory() {
  const [inventoryRecords, setInventoryRecords] = useState([]);
  const [isLoadingInventory, setIsLoadingInventory] = useState(true);
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
  const [activeTab, setActiveTab] = useState("Stock Ledger");
  const [showJobCards, setShowJobCards] = useState(false);
  const [selectedJobId, setSelectedJobId] = useState("JOB #104");
  const [selectedItems, setSelectedItems] = useState({});
  const [issueQuantities, setIssueQuantities] = useState({});

  // Branch dropdown & filtering state
  const [selectedBranch, setSelectedBranch] = useState("All branches");
  const [isBranchDropdownOpen, setIsBranchDropdownOpen] = useState(false);
  const branchDropdownRef = useRef(null);
  const [selectedCategory, setSelectedCategory] = useState("All categories");
  const [isCategoryDropdownOpen, setIsCategoryDropdownOpen] = useState(false);
  const categoryDropdownRef = useRef(null);

  useEffect(() => {
    let isCurrent = true;
    fetchInventoryRecords()
      .then((records) => {
        if (isCurrent) setInventoryRecords(records);
      })
      .catch((error) => {
        if (isCurrent) setInventoryError(error.message);
      })
      .finally(() => {
        if (isCurrent) setIsLoadingInventory(false);
      });
    return () => {
      isCurrent = false;
    };
  }, []);

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

  const filteredInventoryItems = inventoryRecords.filter((item) => {
    const itemBranch = item[5];
    const itemCategory = item[9];
    const matchesBranch =
      selectedBranch === "All branches" ||
      itemBranch.toLowerCase() === selectedBranch.toLowerCase();
    const matchesCategory =
      selectedCategory === "All categories" ||
      itemCategory.toLowerCase() === selectedCategory.toLowerCase();
    return matchesBranch && matchesCategory;
  });
  const hasInventoryItems = filteredInventoryItems.length > 0;
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
    ["local_shipping", "In transit", "—", "No incoming stock tracked"],
  ];

  const handleSelectItem = (stockId) => {
    setSelectedItems((prev) => ({ ...prev, [stockId]: !prev[stockId] }));
  };

  const handleQuantityChange = (stockId, qty) => {
    setIssueQuantities((prev) => ({ ...prev, [stockId]: qty }));
  };

  const selectedCount = Object.values(selectedItems).filter(Boolean).length;

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
      <section className="h-screen min-w-0 flex-1 overflow-y-auto bg-[#edf7ff]">
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
                {showJobCards
                  ? `Select parts and quantities for ${selectedJobId}.`
                  : "Know what can leave the branch before the truck does."}
              </p>
            </div>
            <div className="flex items-center gap-3 max-[620px]:gap-2">
              <button
                type="button"
                onClick={() => setShowJobCards((prev) => !prev)}
                className="rounded-[6px] border border-[#1250a0] bg-white px-5 py-3 text-[12px] font-bold text-[#1250a0] shadow-[0_2px_4px_rgb(18_80_160_/_12%)] hover:bg-[#f3f8ff] max-[1024px]:px-4 max-[1024px]:py-2 max-[620px]:text-[9px]"
              >
                {showJobCards ? "Show Inventory Metrics" : "Choose Another Job"}
              </button>
              <button
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
              </button>
              <button
                type="button"
                onClick={() => setIsCreateRequisition(true)}
                className="rounded-[6px] bg-[#1250a0] px-5 py-3 text-[12px] font-bold text-white shadow-[0_2px_4px_rgb(18_80_160_/_25%)] max-[1024px]:px-4 max-[1024px]:py-2 max-[620px]:text-[9px]"
              >
                + Create Requisition
              </button>
            </div>
          </div>

          {/* Cards Header Display Section (Whole card clickable) */}
          {showJobCards ? (
            <div className="mb-6 grid grid-cols-2 gap-[18px] max-[768px]:grid-cols-1">
              {confirmedJobsData.map((job) => {
                const isSelected = selectedJobId === job.id;
                return (
                  <div
                    key={job.id}
                    onClick={() => {
                      setSelectedJobId(job.id);
                      setActiveTab("Stock Ledger");
                    }}
                    className={`relative cursor-pointer rounded-[11px] border bg-white p-6 shadow-[0_3px_8px_rgb(31_59_82_/_14%)] transition-all hover:border-[#1250a0] ${
                      isSelected
                        ? "border-[#1250a0] ring-1 ring-[#1250a0]"
                        : "border-[#dfe6ec]"
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex h-10 w-10 items-center justify-center rounded-[6px] bg-[#d6e6fb] text-[#1954a0]">
                        <span className="material-symbols-outlined text-[20px]">
                          work
                        </span>
                      </div>
                      <span className="rounded-full bg-[#f3f8ff] px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-[#1250a0]">
                        {job.status}
                      </span>
                    </div>
                    <div className="mt-4">
                      <p className="m-0 text-[11px] font-bold text-[#858b90]">
                        {job.id} · {job.branch}
                      </p>
                      <h3 className="m-0 mt-1 text-[16px] font-bold text-[#063b7c]">
                        {job.title}
                      </h3>
                      <p className="m-0 mt-1 text-[11px] text-[#8e959b]">
                        {job.date}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
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
          )}

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
                      {showJobCards
                        ? `ALLOCATING STOCK · ${selectedJobId}`
                        : "Stock ledger"}
                    </p>
                    <h2 className="m-0 mt-1 text-[21px] font-bold max-[620px]:text-[13px]">
                      {showJobCards
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
                {showJobCards ? (
                  <div className="grid grid-cols-[40px_1.5fr_1fr_1fr_1fr_1.2fr_0.8fr_1fr_1fr_1fr_1.2fr_40px] items-center bg-[#fafafa] px-7 py-3 text-[10px] font-bold uppercase tracking-[.08em] text-[#77818a]">
                    <span>Select</span>
                    <span>Part Name & Code</span>
                    <span>Available Qty</span>
                    <span>Qty To Issue</span>
                    <span>Allocated Qty</span>
                    <span>Target Job</span>
                    <span>Branch</span>
                    <span>Address</span>
                    <span>Unit Price</span>
                    <span>Total Cost</span>
                    <span>Status</span>
                    <span>Action</span>
                  </div>
                ) : (
                  <div className="grid grid-cols-[2fr_.8fr_.9fr_1.25fr_1fr_1fr_1fr_1fr_90px] items-center bg-[#fafafa] px-7 py-3 text-[10px] font-bold uppercase tracking-[.08em] text-[#77818a] max-[1100px]:grid-cols-[2fr_1fr_1fr_1fr_1fr_90px] max-[1100px]:[&>span:nth-child(4)]:hidden max-[1100px]:[&>span:nth-child(5)]:hidden max-[1100px]:[&>span:nth-child(6)]:hidden max-[850px]:grid-cols-[2fr_1fr_1fr_1fr_90px] max-[850px]:[&>span:nth-child(7)]:hidden max-[850px]:px-4 max-[620px]:hidden">
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
                )}

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
                      return showJobCards ? (
                        <div
                          className={`grid grid-cols-[40px_1.5fr_1fr_1fr_1fr_1.2fr_0.8fr_1fr_1fr_1fr_1.2fr_40px] items-center border-t border-[#e4e8eb] px-7 py-3 text-[11px] transition-colors ${
                            isChecked
                              ? "bg-[#f3f8ff]"
                              : "bg-white hover:bg-[#fafafa]"
                          }`}
                          key={stockId}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => handleSelectItem(stockId)}
                            className="h-4 w-4 rounded border-gray-300 text-[#1250a0] focus:ring-[#1250a0]"
                          />
                          <div className="min-w-0">
                            <strong className="block truncate">{name}</strong>
                            <small className="mt-1 block text-[10px] text-[#8d969e]">
                              {code}
                            </small>
                          </div>
                          <strong className="text-[11px]">{quantity}</strong>
                          <div>
                            <input
                              type="number"
                              min="1"
                              max={quantity}
                              value={issueQuantities[stockId] || "1"}
                              onChange={(e) =>
                                handleQuantityChange(stockId, e.target.value)
                              }
                              className="h-8 w-16 rounded border border-[#d9dfe4] bg-white px-2 text-center text-[11px] text-[#1250a0] outline-none focus:border-[#1250a0]"
                            />
                          </div>
                          <span className="text-[#7f8992]">0 Allocated</span>
                          <span className="font-semibold text-[#1250a0]">
                            {selectedJobId}
                          </span>
                          <strong>{branch}</strong>
                          <span className="text-[#7f8992]">{address}</span>
                          <span className="text-[#174f9a]">{unitPrice}</span>
                          <strong className="text-[#174f9a]">
                            {totalCost}
                          </strong>
                          <span
                            className={`w-max rounded-full border px-3 py-1 text-[10px] ${
                              alert
                                ? "border-[#ffb0a3] text-[#f05b48]"
                                : "border-[#d7dadd] text-[#70777d]"
                            }`}
                          >
                            {statusName}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedItemCode(stockId);
                              setStockAdjustment("");
                              setActionError("");
                            }}
                            className="text-[#7f8992] hover:text-[#1250a0]"
                          >
                            <span className="material-symbols-outlined text-[18px]">
                              edit
                            </span>
                          </button>
                        </div>
                      ) : (
                        <div
                          className={`grid min-h-[64px] grid-cols-[2fr_.8fr_.9fr_1.25fr_1fr_1fr_1fr_1fr_90px] items-center border-t border-[#e4e8eb] px-7 text-[11px] max-[1100px]:grid-cols-[2fr_1fr_1fr_1fr_1fr_90px] max-[1100px]:[&>*:nth-child(4)]:hidden max-[1100px]:[&>*:nth-child(5)]:hidden max-[1100px]:[&>*:nth-child(6)]:hidden max-[850px]:grid-cols-[2fr_1fr_1fr_1fr_90px] max-[850px]:[&>*:nth-child(7)]:hidden max-[850px]:px-4 max-[620px]:min-h-[62px] max-[620px]:grid-cols-[1fr_auto] max-[620px]:gap-x-2 max-[620px]:gap-y-1 max-[620px]:px-3 max-[620px]:py-2 ${
                            alert ? "bg-[#fff3f1]" : "bg-white"
                          }`}
                          key={stockId}
                        >
                          <div className="flex min-w-0 items-center gap-4 max-[620px]:col-start-1 max-[620px]:row-span-2 max-[620px]:gap-2">
                            <span
                              className={`grid h-9 w-9 flex-none place-items-center rounded-[6px] max-[620px]:hidden ${
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
                          <strong className="max-[620px]:col-start-2 max-[620px]:row-start-1 max-[620px]:text-[9px]">
                            {quantity}
                            <small className="font-normal text-[#8d969e]">
                              {" "}
                              / min {minimum}
                            </small>
                          </strong>
                          <strong className="max-[620px]:hidden">
                            {branch}
                          </strong>
                          <span className="text-[#7f8992] max-[1100px]:hidden">
                            {address}
                          </span>
                          <span className="text-[#174f9a] max-[1100px]:hidden">
                            {unitPrice}
                          </span>
                          <strong className="text-[#174f9a] max-[1100px]:hidden">
                            {totalCost}
                          </strong>
                          <span className="text-[#7f8992] max-[620px]:hidden">
                            {category}
                          </span>
                          <span
                            className={`w-max rounded-full border px-3 py-1 text-[10px] max-[620px]:col-start-2 max-[620px]:row-start-2 max-[620px]:justify-self-end max-[620px]:px-2 max-[620px]:py-0.5 max-[620px]:text-[7px] ${
                              alert
                                ? "border-[#ffb0a3] text-[#f05b48]"
                                : "border-[#d7dadd] text-[#70777d]"
                            }`}
                          >
                            <span className="material-symbols-outlined mr-1 align-middle text-[13px] max-[620px]:hidden">
                              {alert ? "warning" : "check_circle"}
                            </span>
                            {statusName}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedItemCode(stockId);
                              setStockAdjustment("");
                              setActionError("");
                            }}
                            className="text-right text-[10px] font-bold text-[#7573bd] hover:text-[#1250a0] max-[620px]:col-start-2 max-[620px]:row-start-3"
                          >
                            View
                          </button>
                        </div>
                      );
                    },
                  )
                )}

                {/* Footer Action Bar when Items are Selected & Job Cards Mode is Active */}
                {showJobCards && (
                  <div className="flex items-center justify-between border-t border-[#e1e6eb] bg-[#fafafa] px-7 py-4">
                    <div>
                      <strong className="block text-[13px] text-[#063b7c]">
                        {selectedCount} items selected
                      </strong>
                      <span className="text-[11px] text-[#8b949c]">
                        for {selectedJobId} · R. Villanueva
                      </span>
                    </div>

                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => setSelectedItems({})}
                        className="rounded-[6px] border border-[#1250a0] bg-white px-5 py-2 text-[12px] font-bold text-[#1250a0] hover:bg-[#f3f8ff]"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        disabled={selectedCount === 0}
                        className="rounded-[6px] bg-[#1250a0] px-5 py-2 text-[12px] font-bold text-white shadow-[0_2px_4px_rgb(18_80_160_/_25%)] disabled:opacity-50"
                      >
                        Accept & Deduct Stock
                      </button>
                    </div>
                  </div>
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
                    2 confirmed schedules
                  </span>
                </div>

                <div className="overflow-hidden rounded-[8px] border border-[#dfe6ec]">
                  <div className="grid grid-cols-[1.2fr_2fr_1.5fr_1fr_1.2fr_120px] bg-[#fafafa] px-6 py-3 text-[10px] font-bold uppercase text-[#77818a]">
                    <span>Job</span>
                    <span>Client Location</span>
                    <span>Scheduled</span>
                    <span>Branch</span>
                    <span>Technician</span>
                    <span className="text-right">Action</span>
                  </div>

                  {pendingJobRequestsData.map((req, idx) => (
                    <div
                      key={idx}
                      className="grid grid-cols-[1.2fr_2fr_1.5fr_1fr_1.2fr_120px] items-center border-t border-[#e4e8eb] px-6 py-4 text-[11px]"
                    >
                      <div>
                        <strong className="block text-[#063b7c]">
                          {req.job}
                        </strong>
                        <span className="text-[10px] text-[#8d969e]">
                          {req.status}
                        </span>
                      </div>
                      <span className="text-[#3a434d]">{req.location}</span>
                      <span className="text-[#3a434d]">{req.scheduled}</span>
                      <strong className="text-[#3a434d]">{req.branch}</strong>
                      <span className="text-[#3a434d]">{req.technician}</span>
                      <div className="text-right">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedJobId(req.job.toUpperCase());
                            setShowJobCards(true);
                            setActiveTab("Stock Ledger");
                          }}
                          className="rounded-[6px] border border-[#1250a0] bg-white px-3 py-1.5 text-[11px] font-bold text-[#1250a0] hover:bg-[#f3f8ff]"
                        >
                          Select items
                        </button>
                      </div>
                    </div>
                  ))}
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
                    3 entries
                  </span>
                </div>

                <div className="overflow-hidden rounded-[8px] border border-[#dfe6ec]">
                  <div className="grid grid-cols-[1.5fr_1.5fr_2fr_1fr_1.5fr] bg-[#fafafa] px-6 py-3 text-[10px] font-bold uppercase text-[#77818a]">
                    <span>Date</span>
                    <span>Job</span>
                    <span>Item</span>
                    <span>Qty Issued</span>
                    <span>Technician</span>
                  </div>

                  {jobAllocationsHistoryData.map((item, idx) => (
                    <div
                      key={idx}
                      className="grid grid-cols-[1.5fr_1.5fr_2fr_1fr_1.5fr] items-center border-t border-[#e4e8eb] px-6 py-4 text-[11px]"
                    >
                      <span className="text-[#8e959b]">{item.date}</span>
                      <strong className="text-[#063b7c]">{item.job}</strong>
                      <div>
                        <strong className="block text-[#063b7c]">
                          {item.item}
                        </strong>
                        <span className="text-[10px] text-[#8d969e]">
                          {item.code}
                        </span>
                      </div>
                      <strong className="text-[#063b7c]">
                        {item.qtyIssued}
                      </strong>
                      <span className="text-[#3a434d]">{item.technician}</span>
                    </div>
                  ))}
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
