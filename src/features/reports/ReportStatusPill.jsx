const statusStyles = {
  orange: "border-[#ff9f8f] bg-[#ffe5df] text-[#e05b45]",
  gray: "border-[#c8c8c8] bg-[#f3f3f3] text-[#858585]",
  green: "border-[#73c481] bg-[#e1f6e4] text-[#388b47]",
  yellow: "border-[#e8cc70] bg-[#fdf5dd] text-[#8a6d1a]",
  blue: "border-[#73a9eb] bg-[#eef6ff] text-[#1762b1]",
};

export default function ReportStatusPill({ children, tone }) {
  return (
    <span
      className={`rounded-full border px-3 py-1 text-[11px] font-bold ${
        statusStyles[tone] ?? statusStyles.gray
      }`}
    >
      {children}
    </span>
  );
}
