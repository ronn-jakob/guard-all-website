export default function ItemDetailsDialog({
  selectedItem,
  onClose,
  stockAdjustment,
  onStockAdjustmentChange,
  onAdjustStock,
  isAdjustingStock,
  actionError,
  onEdit,
  onRequestDelete,
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#071426]/75 p-4 backdrop-blur-[2px] max-[620px]:items-end max-[620px]:p-0"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
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
              {selectedItem[1]}
            </h2>
            <p className="m-0 mt-1 text-[13px] text-[#99afc9]">
              {selectedItem[2]} · {selectedItem[9]}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
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
                {selectedItem[5]}
              </strong>
            </div>
            <div className="rounded-[8px] bg-[#1d3351] p-3">
              <span className="block text-[11px] text-[#91a8c7]">
                Address
              </span>
              <strong className="mt-1 block">
                {selectedItem[6]}
              </strong>
            </div>
            <div className="rounded-[8px] bg-[#1d3351] p-3">
              <span className="block text-[11px] text-[#91a8c7]">
                Unit price
              </span>
              <strong className="mt-1 block">
                {selectedItem[7]}
              </strong>
            </div>
            <div className="rounded-[8px] bg-[#1d3351] p-3">
              <span className="block text-[11px] text-[#91a8c7]">
                Total cost
              </span>
              <strong className="mt-1 block">
                {selectedItem[8]}
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
                  {selectedItem[3]}
                  <span className="ml-1 text-[12px] font-normal text-[#91a8c7]">
                    {selectedItem[14]}
                  </span>
                  <span className="ml-2 text-[12px] font-normal text-[#91a8c7]">
                    / minimum {selectedItem[4]}
                  </span>
                </strong>
              </div>
              <span
                className={`rounded-full border px-3 py-1 text-[11px] font-semibold ${
                  selectedItem[10] === "Low stock"
                    ? "border-[#ff8f7c] text-[#ff9d8c]"
                    : "border-[#7bc695] text-[#9be0ae]"
                }`}
              >
                {selectedItem[10]}
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
                  onStockAdjustmentChange(event.target.value)
                }
                placeholder="Enter quantity"
                className="mt-1.5 h-11 w-full rounded-[8px] border border-[#293f5d] bg-[#1d3351] px-3 text-[14px] text-white outline-none placeholder:text-[#7188a4] focus:border-[#4d88e8]"
              />
            </label>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => onAdjustStock("add")}
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
                onClick={() => onAdjustStock("remove")}
                disabled={
                  !stockAdjustment ||
                  Number(stockAdjustment) <= 0 ||
                  Number(stockAdjustment) >
                    Number(selectedItem[3]) ||
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
              onClick={() => onEdit(selectedItem)}
              className="h-11 rounded-[8px] border border-[#4d88e8] px-5 text-[13px] font-semibold text-[#bcd4fa] hover:bg-[#1d3351]"
            >
              Edit details
            </button>
            <button
              type="button"
              onClick={onRequestDelete}
              className="h-11 rounded-[8px] border border-[#7d3b34] px-4 text-[13px] font-semibold text-[#f0b8b0] hover:bg-[#3a2320] max-[620px]:px-3"
            >
              Delete part
            </button>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="h-11 rounded-[8px] border border-[#293f5d] px-5 text-[13px] text-[#e5edf8] hover:bg-[#1d3351]"
          >
            Close
          </button>
        </footer>
      </section>
    </div>
  );
}
