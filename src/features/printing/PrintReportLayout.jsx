import logo from "../../images/Guard All Logo Blue.png";

// Shared A4 shell for every printable report: letterhead, period, and the
// who/when meta line. Nothing here is interactive, so the on-screen preview and
// the printed page are the same document.
export default function PrintReportLayout({
  title,
  periodLabel,
  branchLabel,
  preparedBy,
  generatedAt,
  children,
}) {
  return (
    <article className="print-page mx-auto w-full max-w-[210mm] bg-white p-10 text-[#063b7c] max-[620px]:p-4">
      <header className="flex items-start justify-between gap-6 border-b-2 border-[#1250a0] pb-3">
        <img
          className="h-12 w-auto flex-none object-contain"
          src={logo}
          alt="Guard-All Electronic Security Systems, Inc."
        />
        <div className="text-right">
          <p className="m-0 text-[9px] font-bold uppercase tracking-[.12em] text-[#5b6b7b]">
            Guard-All Electronic Security Systems, Inc.
          </p>
          <h1 className="m-0 mt-1 text-[20px] font-bold leading-tight">
            {title}
          </h1>
          <p className="m-0 mt-0.5 text-[12px] font-semibold text-[#1250a0]">
            {periodLabel}
          </p>
        </div>
      </header>

      <dl className="m-0 mt-3 flex flex-wrap gap-x-6 gap-y-1 text-[10px] text-[#5b6b7b]">
        <div className="flex gap-1">
          <dt className="font-bold uppercase tracking-[.08em]">Branch</dt>
          <dd className="m-0">{branchLabel}</dd>
        </div>
        <div className="flex gap-1">
          <dt className="font-bold uppercase tracking-[.08em]">Prepared by</dt>
          <dd className="m-0">{preparedBy}</dd>
        </div>
        <div className="flex gap-1">
          <dt className="font-bold uppercase tracking-[.08em]">Generated</dt>
          <dd className="m-0">{generatedAt}</dd>
        </div>
      </dl>

      <div className="mt-5">{children}</div>

      <footer className="mt-6 border-t border-[#c9d4de] pt-2 text-[9px] text-[#8a9299]">
        Guard-All Electronic Security Systems, Inc. · {title} · {periodLabel}
      </footer>
    </article>
  );
}
