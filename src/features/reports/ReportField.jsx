export default function ReportField({ fieldLabel, value }) {
  return (
    <div className="rounded-[6px] border border-[#e1e6eb] bg-[#f8fbff] px-3 py-2">
      <span className="block text-[11px] font-bold uppercase tracking-[.06em] text-[#7d8994]">
        {fieldLabel}
      </span>
      <strong className="mt-1 block text-[13px] font-semibold text-[#174276]">
        {value || "—"}
      </strong>
    </div>
  );
}
