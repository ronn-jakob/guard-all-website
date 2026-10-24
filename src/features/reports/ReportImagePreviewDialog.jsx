// Single-image lightbox for attachments. Renders nothing until an index is set
// and that index resolves to an image in the report.
export default function ReportImagePreviewDialog({
  images,
  index,
  onClose,
  onPrevious,
  onNext,
}) {
  const image = index === null ? null : images?.[index];
  if (!image) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#071426]/85 p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-label="Attached image"
        className="flex max-h-[92vh] w-full max-w-[820px] flex-col overflow-hidden rounded-[10px] bg-white shadow-[0_20px_60px_rgb(7_20_38_/_45%)]"
      >
        <header className="flex items-start justify-between gap-3 border-b border-[#e1e6eb] px-5 py-3">
          <div className="min-w-0">
            <strong className="block truncate text-[13px] text-[#174276]">
              {image.alt || "Attached image"}
            </strong>
            <span className="text-[10px] text-[#8b949c]">
              {index + 1} of {images.length}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close image"
            className="grid h-8 w-8 shrink-0 place-items-center rounded-[6px] border border-[#dfe6ec] bg-white text-[20px] leading-none text-[#718090] hover:bg-[#f4f8ff]"
          >
            ×
          </button>
        </header>
        <div className="grid min-h-0 flex-1 place-items-center overflow-auto bg-[#0d1a2b] p-3">
          {image.src ? (
            <img
              src={image.src}
              alt={image.alt || "Attached image"}
              className="max-h-[70vh] max-w-full object-contain"
            />
          ) : (
            <p className="m-0 text-[12px] text-[#dbeafa]">Image unavailable.</p>
          )}
        </div>
        {images.length > 1 && (
          <footer className="flex items-center justify-between border-t border-[#e1e6eb] bg-[#f8fbff] px-5 py-3">
            <button
              type="button"
              onClick={onPrevious}
              disabled={index === 0}
              className="rounded-[6px] border border-[#d9dfe4] bg-white px-3 py-1.5 text-[11px] font-bold text-[#5e6b78] hover:bg-[#f2f7ff] disabled:opacity-40"
            >
              Previous
            </button>
            <button
              type="button"
              onClick={onNext}
              disabled={index === images.length - 1}
              className="rounded-[6px] border border-[#d9dfe4] bg-white px-3 py-1.5 text-[11px] font-bold text-[#5e6b78] hover:bg-[#f2f7ff] disabled:opacity-40"
            >
              Next
            </button>
          </footer>
        )}
      </section>
    </div>
  );
}
