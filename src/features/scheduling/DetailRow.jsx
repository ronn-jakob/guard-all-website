export default function DetailRow({ icon, label, children }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-[#eef2f6] px-3 py-2 last:border-b-0">
      <dt className="flex flex-none items-center gap-1.5 text-[10px] uppercase tracking-[.06em] text-[#89939c]">
        <span className="material-symbols-outlined text-[14px]">{icon}</span>
        {label}
      </dt>
      <dd className="m-0 min-w-0 text-right text-[12px] font-semibold text-[#263747]">
        {children}
      </dd>
    </div>
  );
}
