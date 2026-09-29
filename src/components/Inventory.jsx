import { useState, useRef, useEffect } from "react";
import Sidebar from "./Sidebar.jsx";
import TopBar from "./TopBar.jsx";

const inventoryItems = [
  [
    "inventory_2",
    "12V 7Ah Backup Battery",
    "BAT-012",
    "14",
    "8",
    "Makati",
    "rm823 8 floor",
    "₱1,200",
    "₱16,800",
    "Power",
    "In stock",
  ],
  [
    "deployed_code",
    "PIR Motion Detector",
    "DMP-145",
    "8",
    "10",
    "Makati",
    "rm823 8 floor",
    "₱850",
    "₱6,800",
    "Intrusion",
    "Low stock",
    true,
  ],
  [
    "inventory_2",
    "Proximity Card Reader",
    "RDR-220",
    "6",
    "4",
    "Makati",
    "rm823 8 floor",
    "₱2,400",
    "₱14,400",
    "Access",
    "In stock",
  ],
  [
    "deployed_code",
    "Surveillance HDD 4TB",
    "HDD-008",
    "2",
    "3",
    "Cebu",
    "rm823 8 floor",
    "₱8,500",
    "₱17,000",
    "CCTV",
    "Low stock",
    true,
  ],
  [
    "inventory_2",
    "Surface Door Contact",
    "CNT-204",
    "23",
    "12",
    "Makati",
    "rm823 8 floor",
    "₱420",
    "₱9,660",
    "Intrusion",
    "In stock",
  ],
];

const metricCards = [
  ["inventory_2", "Total tracked items", "1,284", "Across 2 branches"],
  ["warning", "Below reorder point", "03", "Requires procurement", true],
  ["local_shipping", "In transit", "128", "Expected by 22 Apr"],
];

const branchOptions = ["All branches", "Makati", "Cebu"];

function Inventory() {
  const [isCreateRequisition, setIsCreateRequisition] = useState(false);
  const [isLedgerMaximized, setIsLedgerMaximized] = useState(false);
  const [priority, setPriority] = useState("Normal");
  const [status, setStatus] = useState("In stock");

  // Branch dropdown & filtering state
  const [selectedBranch, setSelectedBranch] = useState("All branches");
  const [isBranchDropdownOpen, setIsBranchDropdownOpen] = useState(false);
  const branchDropdownRef = useRef(null);

  // Close branch dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event) {
      if (
        branchDropdownRef.current &&
        !branchDropdownRef.current.contains(event.target)
      ) {
        setIsBranchDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Filter inventory items based on selected branch
  const filteredInventoryItems = inventoryItems.filter((item) => {
    const itemBranch = item[5]; // Index 5 holds branch name
    if (selectedBranch === "All branches") return true;
    return itemBranch.toLowerCase() === selectedBranch.toLowerCase();
  });
  const hasInventoryItems = filteredInventoryItems.length > 0;

  return (
    <main className="flex h-screen overflow-hidden bg-[#1f2022] font-sans text-[#063b7c] max-[1024px]:block">
      <Sidebar />
      <section className="h-screen min-w-0 flex-1 overflow-y-auto bg-[#edf7ff]">
        <TopBar />
        <div className="px-8 pb-6 pt-8 max-[1024px]:px-6 max-[1024px]:pb-20 max-[1024px]:pt-5 max-[620px]:px-3">
          <div className="mb-7 flex items-end justify-between gap-5 max-[620px]:mb-4 max-[620px]:items-start">
            <div>
              <p className="mb-1 text-[10px] font-bold uppercase tracking-[.12em] text-[#818b94] max-[620px]:text-[7px]">
                Operations / Stock ledger
              </p>
              <h1 className="m-0 text-[30px] font-bold tracking-[-.5px] max-[1024px]:text-[24px] max-[620px]:text-[19px]">
                Inventory
              </h1>
              <p className="mb-0 mt-2 text-[14px] text-[#8b949c] max-[620px]:mt-1 max-[620px]:text-[9px]">
                Know what can leave the branch before the truck does.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsCreateRequisition(true)}
              className="rounded-[6px] bg-[#1250a0] px-5 py-3 text-[12px] font-bold text-white shadow-[0_2px_4px_rgb(18_80_160_/_25%)] max-[1024px]:px-4 max-[1024px]:py-2 max-[620px]:text-[9px]"
            >
              + Create Requisition
            </button>
          </div>

          <section
            className={`${isLedgerMaximized ? "max-h-0 pointer-events-none opacity-0" : "max-h-[500px] opacity-100"} grid overflow-hidden grid-cols-3 gap-[18px] transition-[max-height,opacity] duration-300 ease-in-out max-[620px]:gap-1`}
          >
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

          <section
            className={`${isLedgerMaximized && hasInventoryItems ? "mt-0 min-h-[calc(100vh-112px)]" : "mt-5 max-[620px]:mt-3"} overflow-hidden rounded-[11px] border border-[#dfe6ec] bg-white shadow-[0_3px_8px_rgb(31_59_82_/_14%)] transition-[margin,min-height] duration-300 ease-in-out`}
          >
            <header className="flex items-center justify-between gap-4 border-b border-[#e1e6eb] px-7 py-5 max-[620px]:items-start max-[620px]:px-3 max-[620px]:py-3">
              <div>
                <p className="m-0 text-[10px] font-bold uppercase tracking-[.12em] text-[#777e85]">
                  Stock ledger
                </p>
                <h2 className="m-0 mt-1 text-[21px] font-bold max-[620px]:text-[13px]">
                  Parts &amp; equipment
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
                <button
                  type="button"
                  title={
                    isLedgerMaximized
                      ? "Exit maximized stock ledger"
                      : "Maximize stock ledger"
                  }
                  onClick={() => setIsLedgerMaximized((isMaximized) => !isMaximized)}
                  className="grid h-9 w-9 flex-none place-items-center rounded-[6px] border border-[#d9dfe4] bg-[#f8f9fa] text-[#174f9a] transition-colors hover:bg-[#eff4f9]"
                >
                  <span className="material-symbols-outlined text-[19px]">
                    {isLedgerMaximized ? "close_fullscreen" : "open_in_full"}
                  </span>
                </button>
              </div>
            </header>

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

            {filteredInventoryItems.length === 0 ? (
              <div className="py-12 text-center text-[13px] text-[#8e959b]">
                No inventory items found for <strong>{selectedBranch}</strong>.
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
                ]) => (
                  <div
                    className={`grid min-h-[64px] grid-cols-[2fr_.8fr_.9fr_1.25fr_1fr_1fr_1fr_1fr_90px] items-center border-t border-[#e4e8eb] px-7 text-[11px] max-[1100px]:grid-cols-[2fr_1fr_1fr_1fr_1fr_90px] max-[1100px]:[&>*:nth-child(4)]:hidden max-[1100px]:[&>*:nth-child(5)]:hidden max-[1100px]:[&>*:nth-child(6)]:hidden max-[850px]:grid-cols-[2fr_1fr_1fr_1fr_90px] max-[850px]:[&>*:nth-child(7)]:hidden max-[850px]:px-4 max-[620px]:min-h-[62px] max-[620px]:grid-cols-[1fr_auto] max-[620px]:gap-x-2 max-[620px]:gap-y-1 max-[620px]:px-3 max-[620px]:py-2 ${
                      alert ? "bg-[#fff3f1]" : "bg-white"
                    }`}
                    key={code}
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
                    <strong className="max-[620px]:hidden">{branch}</strong>
                    <span className="text-[#7f8992] max-[1100px]:hidden">{address}</span>
                    <span className="text-[#174f9a] max-[1100px]:hidden">{unitPrice}</span>
                    <strong className="text-[#174f9a] max-[1100px]:hidden">{totalCost}</strong>
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
                    <a
                      href="#action"
                      className="text-right text-[10px] font-bold text-[#7573bd] max-[620px]:hidden"
                    >
                      {alert ? "Requisition" : "View"}
                    </a>
                  </div>
                )
              )
            )}
          </section>

          <footer className="mt-6 border-t border-[#c9d4de] pt-3 text-[9px] text-[#8a9299] max-[1024px]:hidden">
            Guard-All Electronic Security Systems, Inc.
          </footer>
        </div>

        {/* Modal */}
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
                    Minimum Stock Threshold{" "}
                    <span className="text-[#ff6557]">*</span>
                    <input
                      required
                      type="number"
                      min="0"
                      placeholder="e.g. 10"
                      className="mt-1.5 h-12 w-full rounded-[10px] border border-[#293f5d] bg-[#1d3351] px-4 text-[15px] text-white outline-none placeholder:text-[#7188a4] focus:border-[#4d88e8]"
                    />
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
                  {Math.floor(10000 + Math.random() * 90000)}
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