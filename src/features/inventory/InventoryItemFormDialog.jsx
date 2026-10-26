import { formatCurrency } from "./inventoryUtils.js";
import { skuMatchesPrefix } from "../../lib/inventoryCategories.js";

export default function InventoryItemFormDialog({
  isEditItem,
  onClose,
  onSubmit,
  selectedItemCode,
  selectedItem,
  skuMode,
  setSkuMode,
  manualSku,
  setManualSku,
  generatedSku,
  setGeneratedSku,
  nextSkuFor,
  selectedCategoryId,
  setSelectedCategoryId,
  isAdmin,
  accountBranchLabel,
  newItemQuantity,
  setNewItemQuantity,
  newItemUnitPrice,
  setNewItemUnitPrice,
  newItemTotalCost,
  activeCategories,
  categories,
  categoryNameById,
  onNewCategory,
  isLoadingCategories,
  categoriesError,
  formError,
  isSavingItem,
}) {
  // A part that still carries its old category's prefix is renumbered by the
  // server on save, so the read-only field previews the code it will receive.
  const currentCategory = (categories ?? []).find(
    (category) => category.id === selectedItem?.[17],
  );
  const nextCategory = (categories ?? []).find(
    (category) => category.id === selectedCategoryId,
  );
  const willRenumber =
    isEditItem &&
    Boolean(currentCategory) &&
    Boolean(nextCategory) &&
    currentCategory.id !== nextCategory.id &&
    skuMatchesPrefix(selectedItem?.[2], currentCategory.prefix);
  const previewSku = willRenumber
    ? nextCategory.nextSku || nextSkuFor(nextCategory.id)
    : manualSku;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#071426]/75 p-4 backdrop-blur-[2px] max-[620px]:items-end max-[620px]:p-0"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
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
            onClick={onClose}
            className="grid h-8 w-8 place-items-center text-[27px] leading-none text-[#91a8c7] hover:text-white"
          >
            ×
          </button>
        </header>

        <form
          id="add-new-item-form"
          key={isEditItem ? selectedItemCode : "new-item"}
          className="min-h-0 flex-1 overflow-y-auto px-7 py-5 max-[620px]:px-5"
          onSubmit={onSubmit}
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
                    ? previewSku
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
              {willRenumber && (
                <small className="mt-1 block text-[11px] text-[#ffd08a]">
                  Code will change from {selectedItem[2]} to {previewSku} when
                  you save.
                </small>
              )}
            </label>
            <label className="text-[14px] font-medium text-[#a9bfd9]">
              Part Name <span className="text-[#ff6557]">*</span>
              <input
                required
                autoFocus
                name="partName"
                defaultValue={isEditItem ? selectedItem[1] : ""}
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
                defaultValue={isEditItem ? selectedItem[4] : ""}
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
                  isEditItem ? selectedItem[5] : accountBranchLabel
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
                defaultValue={isEditItem ? selectedItem[6] : ""}
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
                    onNewCategory();
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
                  isEditItem ? selectedItem[14] : "pcs"
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
              defaultValue={isEditItem ? selectedItem[15] : ""}
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
              onClick={onClose}
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
  );
}
