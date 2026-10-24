export default function CategoryManagerDialog({
  onClose,
  categories,
  categoriesError,
  isLoadingCategories,
  onEdit,
  onToggle,
  onNew,
}) {
  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-[#071426]/75 p-4 backdrop-blur-[2px] max-[620px]:items-end max-[620px]:p-0"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
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
            onClick={onClose}
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
                    onClick={() => onEdit(category)}
                    className="h-8 rounded-[6px] border border-[#3a5578] px-3 text-[11px] font-semibold text-[#bcd4fa] hover:bg-[#22395a]"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => onToggle(category)}
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
            onClick={onNew}
            className="h-10 rounded-[6px] bg-[#4d88e8] px-4 text-[12px] font-semibold text-white hover:bg-[#5b96f4]"
          >
            + New category
          </button>
          <button
            type="button"
            onClick={onClose}
            className="h-10 rounded-[6px] border border-[#293f5d] px-4 text-[12px] text-[#e5edf8] hover:bg-[#1d3351]"
          >
            Done
          </button>
        </footer>
      </section>
    </div>
  );
}
