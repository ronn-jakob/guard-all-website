import {
  isValidPrefix,
  nextSku,
  normalisePrefix,
  suggestPrefix,
} from "../../lib/inventoryCategories.js";

export default function CategoryFormDialog({
  onClose,
  onSubmit,
  editingCategory,
  isSavingCategory,
  categoryFormName,
  setCategoryFormName,
  categoryFormPrefix,
  setCategoryFormPrefix,
  categoryPrefixEdited,
  setCategoryPrefixEdited,
  categories,
  inventoryRecords,
  categoryFormError,
}) {
  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-[#071426]/75 p-4 backdrop-blur-[2px] max-[620px]:items-end max-[620px]:p-0"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !isSavingCategory) {
          onClose();
        }
      }}
    >
      <form
        onSubmit={onSubmit}
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
            {editingCategory ? " · existing item codes keep their number" : ""}
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
            onClick={onClose}
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
  );
}
