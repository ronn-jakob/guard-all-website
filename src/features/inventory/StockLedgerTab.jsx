import { Fragment } from "react";
import FilterMenu from "./FilterMenu.jsx";

export default function StockLedgerTab({
  accountBranchLabel,
  actionError,
  availableQuantities,
  branchOptions,
  categoryFilterOptions,
  filteredInventoryItems,
  handleAcceptJobStock,
  handleCancelJobAllocation,
  handleQuantityChange,
  handleRestorePart,
  handleSelectItem,
  hasQuotedDeviation,
  inventoryError,
  inventoryStatus,
  isAdmin,
  isAllocatingForJob,
  isAllocatingStock,
  isAllocationRoute,
  isLoadingInventory,
  issueQuantities,
  jobAllocation,
  partNotice,
  quotationNumber,
  quotedAdjustedCount,
  quotedByStockId,
  quotedMatchedCount,
  quotedPartCount,
  quotedUnavailable,
  searchTerm,
  selectedBranch,
  selectedCategory,
  selectedCount,
  selectedItems,
  selectedJobId,
  setActionError,
  setInventoryStatus,
  setSearchTerm,
  setSelectedBranch,
  setSelectedCategory,
  setSelectedItemCode,
  setStockAdjustment,
  setStockLevelFilter,
  stockLevelFilter,
}) {
  return (
    <>
      <header className="flex flex-col items-stretch gap-3 border-b border-[#e1e6eb] px-7 py-5 max-[620px]:px-3 max-[620px]:py-3 min-[1440px]:flex-row min-[1440px]:items-center min-[1440px]:justify-between min-[1440px]:gap-4">
        <div className="min-w-0">
          <p className="m-0 text-[10px] font-bold uppercase tracking-[.12em] text-[#777e85]">
            {isAllocatingForJob
              ? `ALLOCATING STOCK · ${selectedJobId}`
              : "Stock ledger"}
          </p>
          <h2 className="m-0 mt-1 text-[21px] font-bold max-[620px]:text-[17px]">
            {isAllocatingForJob
              ? "Select items from inventory"
              : "Parts & equipment"}
          </h2>
        </div>
        <div className="flex flex-wrap items-center justify-start gap-2 max-[620px]:grid max-[620px]:w-full max-[620px]:grid-cols-2 min-[1440px]:justify-end min-[1440px]:gap-3">
          <label className="flex h-9 min-w-[200px] max-w-[320px] flex-1 items-center gap-2 rounded-[6px] border border-[#d9dfe4] bg-[#f8f9fa] px-3 text-[11px] text-[#174f9a] max-[620px]:col-span-2 max-[620px]:h-10 max-[620px]:min-w-0 max-[620px]:max-w-none max-[620px]:w-full max-[620px]:text-[11px]">
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
            <div className="flex rounded-full border border-[#dfe4e8] bg-[#f8fafc] p-1 text-[10px] max-[620px]:col-span-2 max-[620px]:justify-center">
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
            <span className="flex h-9 items-center gap-2 rounded-[6px] border border-[#d9dfe4] bg-[#f8f9fa] px-3 text-[11px] font-medium text-[#174f9a] max-[620px]:w-full max-[620px]:justify-between">
              <span className="material-symbols-outlined text-[17px]">
                tune
              </span>
              {accountBranchLabel}
            </span>
          )}
          {isAdmin && (
            <FilterMenu
              label={selectedBranch}
              options={branchOptions}
              value={selectedBranch}
              onSelect={setSelectedBranch}
              ariaLabel="Filter by branch"
              triggerClassName="max-[620px]:w-full max-[620px]:justify-between"
            />
          )}
          <FilterMenu
            label={selectedCategory}
            options={categoryFilterOptions}
            value={selectedCategory}
            onSelect={setSelectedCategory}
            ariaLabel="Filter by category"
            triggerClassName="max-[620px]:w-full max-[620px]:justify-between"
          />
          {/* Allocation needs every part the branch holds, so the stock-level
              filter only appears on the working ledger. */}
          {!isAllocatingForJob && !isAllocationRoute && (
            <FilterMenu
              label={stockLevelFilter}
              options={["All stock", "Low stock", "In stock"]}
              value={stockLevelFilter}
              onSelect={setStockLevelFilter}
              ariaLabel="Filter by stock level"
              triggerClassName="max-[620px]:col-span-2 max-[620px]:w-full max-[620px]:justify-between"
            />
          )}
        </div>
      </header>
  
      {/* Table Header */}
      <div className="grid grid-cols-[2fr_.8fr_.5fr_.9fr_1.25fr_1fr_1fr_1fr_1fr_140px] items-center bg-[#fafafa] px-7 py-3 text-[10px] font-bold uppercase tracking-[.08em] text-[#77818a] max-[1100px]:grid-cols-[2fr_.8fr_.5fr_.9fr_1fr_1fr_140px] max-[1100px]:[&>span:nth-child(5)]:hidden max-[1100px]:[&>span:nth-child(6)]:hidden max-[1100px]:[&>span:nth-child(7)]:hidden max-[850px]:grid-cols-[2fr_.8fr_.5fr_.9fr_1fr_140px] max-[850px]:[&>span:nth-child(8)]:hidden max-[850px]:px-4 max-[620px]:hidden">
          <span>Part name</span>
          <span>Quantity</span>
          <span>Unit</span>
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
              {stockLevelFilter === "Low stock"
                ? "No low-stock items"
                : stockLevelFilter === "In stock"
                  ? "No in-stock items"
                  : "No inventory items found"}{" "}
              for <strong>{selectedBranch}</strong> and{" "}
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
            unitOfMeasure,
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
                  className={`grid min-h-[64px] grid-cols-[2fr_.8fr_.5fr_.9fr_1.25fr_1fr_1fr_1fr_1fr_140px] items-center border-t border-[#e4e8eb] px-7 text-[11px] max-[1100px]:grid-cols-[2fr_.8fr_.5fr_.9fr_1fr_1fr_140px] max-[1100px]:[&>*:nth-child(5)]:hidden max-[1100px]:[&>*:nth-child(6)]:hidden max-[1100px]:[&>*:nth-child(7)]:hidden max-[850px]:grid-cols-[2fr_.8fr_.5fr_.9fr_1fr_140px] max-[850px]:[&>*:nth-child(8)]:hidden max-[850px]:px-4 max-[620px]:hidden ${
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
                  <span className="text-[#7f8992]">{unitOfMeasure || "—"}</span>
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
                  className={`hidden max-[620px]:mx-2 max-[620px]:mb-2 max-[620px]:grid max-[620px]:grid-cols-[minmax(0,1fr)_auto] max-[620px]:items-start max-[620px]:gap-x-3 max-[620px]:gap-y-2 max-[620px]:rounded-[8px] max-[620px]:border max-[620px]:px-3 max-[620px]:py-3 max-[620px]:shadow-[0_2px_5px_rgb(31_59_82_/_8%)] ${
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
                  <div className="flex flex-none flex-col items-end gap-1.5 max-[620px]:col-start-2 max-[620px]:row-start-1">
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
                        {quantity} {unitOfMeasure || "—"}
                        <small className="font-normal text-[#8d969e]">
                          {" "}
                          /min {minimum}
                        </small>
                      </strong>
                    )}
                  </div>
                  <div className="hidden max-[620px]:col-span-2 max-[620px]:grid max-[620px]:grid-cols-3 max-[620px]:gap-2 max-[620px]:border-t max-[620px]:border-[#eef2f5] max-[620px]:pt-2">
                    <div className="min-w-0">
                      <span className="block text-[9px] font-bold uppercase text-[#8d969e]">
                        Quantity
                      </span>
                      <strong className="block truncate text-[11px] text-[#174f9a]">
                        {isAllocatingForJob ? availableQuantity : quantity} {unitOfMeasure || "—"}
                      </strong>
                    </div>
                    <div className="min-w-0">
                      <span className="block text-[9px] font-bold uppercase text-[#8d969e]">
                        Unit price
                      </span>
                      <strong className="block truncate text-[11px] text-[#174f9a]">
                        {unitPrice}
                      </strong>
                    </div>
                    <div className="min-w-0">
                      <span className="block text-[9px] font-bold uppercase text-[#8d969e]">
                        Total cost
                      </span>
                      <strong className="block truncate text-[11px] text-[#174f9a]">
                        {totalCost}
                      </strong>
                    </div>
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
  );
}
