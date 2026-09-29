import Sidebar from "./Sidebar.jsx";
import TopBar from "./TopBar.jsx";
import { Link } from "react-router-dom";
import { useState } from "react";

const reports = [
  {
    id: "FSR-2026-3253",
    client: "Northbridge Dental Clinic",
    service: "CCTV Installation",
    technician: "Carl Klaro",
    time: "Today, 8:34 AM",
    status: "Needs Review",
    tone: "orange",
  },
  {
    id: "FSR-2026-3655",
    client: "Cattleya Condominium",
    service: "CCTV Installation and Alarm Maintenance",
    technician: "John Lee",
    time: "Today, 8:12 AM",
    status: "Submitted",
    tone: "gray",
  },
  {
    id: "FSR-2026-3664",
    client: "Aldrin Compound",
    service: "Automated Door Locks Consultation",
    technician: "Carl Klaro",
    time: "Sep 11, 11:11 AM",
    status: "Ready for Billing",
    tone: "green",
  },
];

const reportDetails = {
  "FSR-2026-3253": {
    workSummary:
      "Installed and commissioned the CCTV system at Northbridge Dental Clinic. Six camera feeds were tested at the recorder, the front-desk monitor was configured, and the clinic manager verified the live view and playback. The recorder was left online and the manager was shown how to export a clip.",
    parts: [
      { sku: "CAM-123", description: "Indoor dome camera", quantity: 3, note: "Installed" },
      { sku: "NVR-008", description: "8-channel network recorder", quantity: 1, note: "Configured" },
      { sku: "CAT6-100", description: "CAT6 cable (meters)", quantity: 42, note: "Consumed" },
      { sku: "CON-014", description: "RJ45 connector", quantity: 12, note: "Consumed" },
    ],
    images: [
      {
        name: "IMG-34h2349f132e.png",
        src: "https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=900&q=80",
        alt: "Close-up of electronic components",
      },
      {
        name: "IMG-34h2350f132f.png",
        src: "https://images.unsplash.com/photo-1581092921461-eab62e97a780?auto=format&fit=crop&w=900&q=80",
        alt: "Technician inspecting installed equipment",
      },
    ],
    signature: {
      signer: "Mark Roberts",
      signedAt: "Tuesday, Sep 14 2026 · 11:12 AM",
      method: "Signed on device",
    },
    billing: {
      readiness: "Ready for manager review",
      inventory: "Reconciled",
      reference: "BILL-2026-1048",
    },
    audit: [
      { time: "8:34 AM", action: "Report submitted", actor: "Carl Klaro" },
      { time: "11:12 AM", action: "Client sign-off captured", actor: "Mark Roberts" },
      { time: "11:18 AM", action: "Queued for manager review", actor: "System" },
    ],
  },
  "FSR-2026-3655": {
    workSummary:
      "Completed the scheduled CCTV and alarm maintenance at Cattleya Condominium. Camera views were checked, the alarm panel was tested, and the building representative received a walkthrough of the test results and any follow-up recommendations.",
    parts: [
      { sku: "CAM-123", description: "Indoor dome camera", quantity: 1, note: "Re-aimed and tested" },
      { sku: "BAT-009", description: "Alarm backup battery", quantity: 2, note: "Replaced" },
      { sku: "CON-014", description: "RJ45 connector", quantity: 4, note: "Consumed" },
    ],
    images: [
      {
        name: "IMG-CC-2026-091.png",
        src: "https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=900&q=80",
        alt: "Close-up of electronic components",
      },
      {
        name: "IMG-CC-2026-092.png",
        src: "https://images.unsplash.com/photo-1581092921461-eab62e97a780?auto=format&fit=crop&w=900&q=80",
        alt: "Technician inspecting installed equipment",
      },
    ],
    signature: {
      signer: "Mira Castillo",
      signedAt: "Tuesday, Sep 14 2026 · 10:46 AM",
      method: "Signed on device",
    },
    billing: {
      readiness: "Awaiting report review",
      inventory: "Reconciled",
      reference: "BILL-2026-1051",
    },
    audit: [
      { time: "8:12 AM", action: "Report submitted", actor: "John Lee" },
      { time: "10:46 AM", action: "Client sign-off captured", actor: "Mira Castillo" },
    ],
  },
  "FSR-2026-3664": {
    workSummary:
      "Assessed the automated door locks at Aldrin Compound and completed the requested lock controller consultation. The access schedule was reviewed with the client, controller settings were verified, and operating recommendations were documented for the property manager.",
    parts: [
      { sku: "ACS-220", description: "Access controller", quantity: 1, note: "Inspected; retained" },
      { sku: "LOCK-041", description: "Electronic door lock", quantity: 2, note: "Function tested" },
      { sku: "CAB-016", description: "Low-voltage cable (meters)", quantity: 8, note: "Consumed" },
    ],
    images: [
      {
        name: "IMG-AC-2026-114.png",
        src: "https://images.unsplash.com/photo-1558008258-3256797b43f3?auto=format&fit=crop&w=900&q=80",
        alt: "Security access device mounted at an entrance",
      },
      {
        name: "IMG-AC-2026-115.png",
        src: "https://images.unsplash.com/photo-1581092921461-eab62e97a780?auto=format&fit=crop&w=900&q=80",
        alt: "Technician inspecting installed equipment",
      },
    ],
    signature: {
      signer: "Aldrin Reyes",
      signedAt: "Sep 11 2026 · 12:02 PM",
      method: "Signed on device",
    },
    billing: {
      readiness: "Ready for billing",
      inventory: "Reconciled",
      reference: "BILL-2026-0974",
    },
    audit: [
      { time: "11:11 AM", action: "Report submitted", actor: "Carl Klaro" },
      { time: "12:02 PM", action: "Client sign-off captured", actor: "Aldrin Reyes" },
      { time: "12:15 PM", action: "Approved for billing", actor: "Operations" },
    ],
  },
};

const statusStyles = {
  orange: "border-[#ff9f8f] bg-[#ffe5df] text-[#e05b45]",
  gray: "border-[#c8c8c8] bg-[#f3f3f3] text-[#858585]",
  green: "border-[#73c481] bg-[#e1f6e4] text-[#388b47]",
};

function StatusPill({ children, tone }) {
  return (
    <span
      className={`rounded-full border px-3 py-1 text-[11px] font-bold ${statusStyles[tone]}`}
    >
      {children}
    </span>
  );
}

function ReportsOverview() {
  const [selectedReportId, setSelectedReportId] = useState(reports[0].id);
  const [isFullDetailsOpen, setIsFullDetailsOpen] = useState(false);
  const selectedReport =
    reports.find((report) => report.id === selectedReportId) || reports[0];
  const selectedReportDetails = reportDetails[selectedReport.id];

  return (
    <main className="flex h-screen overflow-hidden bg-[#1f2022] font-sans text-[#063b7c] max-[1024px]:block">
      <Sidebar />
      <section className="h-screen min-w-0 flex-1 overflow-y-auto bg-[#edf7ff]">
        <TopBar />
        <div className="px-8 pb-6 pt-7 max-[1024px]:px-6 max-[1024px]:pb-20 max-[1024px]:pt-5 max-[620px]:px-3">
          <header className="mb-5 flex items-end justify-between max-[620px]:items-start max-[620px]:gap-3">
            <div>
              <p className="mb-1 text-[12px] font-bold uppercase tracking-[.12em] text-[#818b94]">
                Operations / Field reporting
              </p>
              <h1 className="m-0 text-[30px] font-bold tracking-[-.5px] max-[1280px]:text-[26px] max-[620px]:text-[22px]">
                Field Reports
              </h1>
              <p className="mb-0 mt-1 text-[14px] text-[#8b949c]">
                A concise manager review on what happened on site.
              </p>
            </div>
            <Link
              className="inline-flex items-center gap-2 rounded-[6px] bg-[#1250a0] px-4 py-3 text-[14px] font-bold text-white no-underline shadow-[0_2px_4px_rgb(18_80_160_/_25%)] transition-colors hover:bg-[#0d438a] max-[620px]:px-3 max-[620px]:py-2"
              to="/reports/new"
            >
              <span className="material-symbols-outlined text-[19px]">add</span>
              New Report
            </Link>
          </header>

          <div className="mb-4 grid grid-cols-4 gap-4 max-[850px]:grid-cols-2 max-[620px]:gap-2">
            {[
              ["Needs Review", "1", "text-[#e34f2d]"],
              ["Submitted", "1", "text-[#15519c]"],
              ["Ready for Billing", "2", "text-[#388b47]"],
              ["Sign-off Captured", "4", "text-[#15519c]"],
            ].map(([label, value, color]) => (
              <article
                className="rounded-[10px] border border-[#dfe6ec] bg-white px-5 py-4 shadow-[0_3px_8px_rgb(31_59_82_/_14%)] max-[620px]:px-3 max-[620px]:py-3"
                key={label}
              >
                <p className="m-0 text-[11px] font-bold uppercase tracking-[.06em] text-[#7e878e]">
                  {label}
                </p>
                <strong className={`mt-2 block text-[29px] leading-none ${color}`}>
                  {value}
                </strong>
              </article>
            ))}
          </div>

          <div className="grid grid-cols-[380px_minmax(0,1fr)] gap-4 max-[1100px]:grid-cols-[330px_minmax(0,1fr)] max-[850px]:grid-cols-1">
            <section className="overflow-hidden rounded-[10px] border border-[#dfe6ec] bg-white shadow-[0_3px_8px_rgb(31_59_82_/_12%)]">
              <header className="flex items-start justify-between border-b border-[#e1e6eb] px-5 py-4">
                <div>
                  <h2 className="m-0 text-[15px] font-bold text-[#68798a]">Incoming Reports</h2>
                  <p className="m-0 mt-1 text-[12px] text-[#8b949c]">3 reports in current queue</p>
                </div>
                <button className="border-0 bg-transparent p-0 text-[#7b8792]" type="button">
                  <span className="material-symbols-outlined text-[21px]">filter_alt</span>
                </button>
              </header>
              <div>
                {reports.map((report) => (
                  <button
                    className={`block w-full border-b border-[#e1e6eb] px-5 py-4 text-left last:border-b-0 transition-colors hover:bg-[#f4f8ff] ${report.id === selectedReportId ? "border-l-4 border-l-[#286fc7] bg-[#eef4ff]" : ""}`}
                    key={report.id}
                    type="button"
                    onClick={() => setSelectedReportId(report.id)}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <strong className="text-[11px] font-bold text-[#35649a]">{report.id}</strong>
                      <StatusPill tone={report.tone}>{report.status}</StatusPill>
                    </div>
                    <h3 className="m-0 mt-3 text-[15px] font-bold text-[#174276]">{report.client}</h3>
                    <p className="m-0 mt-1 text-[12px] text-[#7d8994]">{report.service}</p>
                    <div className="mt-3 flex items-center justify-between text-[11px] text-[#8b949c]">
                      <span>{report.technician}</span>
                      <span>{report.time}</span>
                    </div>
                  </button>
                ))}
              </div>
            </section>

            <section className="overflow-hidden rounded-[10px] border border-[#dfe6ec] bg-white shadow-[0_3px_8px_rgb(31_59_82_/_12%)]">
              <header className="flex items-start justify-between border-b border-[#e1e6eb] px-6 py-5 max-[620px]:px-4">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <strong className="text-[12px] font-bold text-[#35649a]">{selectedReport.id}</strong>
                    <StatusPill tone={selectedReport.tone}>{selectedReport.status}</StatusPill>
                  </div>
                  <h2 className="m-0 mt-2 text-[17px] font-bold text-[#174276]">{selectedReport.client}</h2>
                  <p className="m-0 mt-1 text-[11px] text-[#8b949c]">WO-8875 &nbsp;•&nbsp; Submitted {selectedReport.time}</p>
                </div>
                <div className="flex items-center gap-2 text-[12px] text-[#707b86]">
                  <span className="grid h-7 w-7 place-items-center rounded-full bg-[#d65c58] text-[11px] font-bold text-white">CK</span>
                  {selectedReport.technician}
                </div>
              </header>

              <div className="grid grid-cols-[1.25fr_1fr] gap-6 px-6 py-5 max-[620px]:grid-cols-1 max-[620px]:px-4">
                <div>
                  <p className="m-0 text-[11px] font-bold uppercase tracking-[.08em] text-[#7d8994]">01 / Work Summary</p>
                  <h3 className="m-0 mt-3 text-[15px] font-bold text-[#174276]">{selectedReport.service}</h3>
                  <p className="m-0 mt-2 text-[12px] leading-relaxed text-[#7d8994]">
                    Lorem ipsum dolor sit amet consectetur adipisicing elit. Dolor quod labore quod est autem minus. Sint at dolorum nulla eum et voluptas exercitation cupiditate et in.
                  </p>
                  <div className="my-4 border-t border-[#e1e6eb]" />
                  <p className="m-0 text-[11px] font-bold uppercase tracking-[.08em] text-[#7d8994]">02 / Parts Used</p>
                  <div className="mt-3 rounded-[7px] border border-[#bac8db] bg-[#eef4ff] px-4 py-3 text-[12px] text-[#35649a]">
                    <div className="flex items-center justify-between font-bold">
                      <span>1 x CAM-123</span>
                      <span className="font-normal text-[#8b949c]">3x used</span>
                    </div>
                    <div className="mt-3 border-t border-[#cbd8e7] pt-3 text-center text-[#68798a]">Show More</div>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="rounded-[7px] border border-[#bac8db] bg-[#f3f7fd] p-4">
                    <p className="m-0 text-[11px] font-bold uppercase tracking-[.08em] text-[#7d8994]">Attached Images</p>
                    <div className="mt-3 flex items-center justify-between text-[12px] text-[#8b949c]">
                      <span className="flex items-center gap-2"><span className="material-symbols-outlined text-[18px]">image</span>IMG-34h2349f132e.png</span>
                      <strong className="text-[11px]">Open</strong>
                    </div>
                  </div>
                  <div className="rounded-[7px] border border-[#9ed6a8] bg-[#effbef] p-4 text-[12px] text-[#5b9764]">
                    <div className="flex items-center justify-between font-bold"><span>✓ &nbsp; Client Sign-off</span><span className="font-normal">11:12 AM</span></div>
                    <div className="mt-3 flex justify-between text-[11px]"><span>Mark Roberts Signed on device</span><span>Tuesday, Sep 14 2026</span></div>
                  </div>
                  <div className="rounded-[7px] border border-[#bac8db] bg-[#eef4ff] p-4 text-[12px] text-[#5b9764]">
                    <p className="m-0 font-bold uppercase tracking-[.08em] text-[#7d8994]">Billing Readiness</p>
                    <p className="m-0 mt-4 font-bold">✓ &nbsp; Inventory reconciled</p>
                    <p className="m-0 mt-3 font-bold">✓ &nbsp; Sign-off captured</p>
                  </div>
                </div>
              </div>

              <footer className="flex items-center justify-between border-t border-[#e1e6eb] bg-[#eef4ff] px-6 py-4 max-[620px]:flex-col max-[620px]:items-stretch max-[620px]:gap-3 max-[620px]:px-4">
                <a
                  className="text-[13px] font-bold text-[#7a8793] no-underline hover:text-[#174f9a]"
                  href="#details"
                  onClick={(event) => {
                    event.preventDefault();
                    setIsFullDetailsOpen(true);
                  }}
                >
                  Show Full Details
                </a>
                <div className="flex gap-3 max-[620px]:flex-1">
                  <Link className="inline-flex h-10 flex-1 items-center justify-center rounded-[7px] border-2 border-[#c5ccd6] bg-transparent px-4 text-[12px] font-bold text-[#89939e] no-underline" to="/reports">Return for Correction</Link>
                  <button className="flex h-10 flex-1 items-center justify-center gap-2 rounded-[7px] bg-[#1953a5] px-4 text-[12px] font-bold text-white" type="button">
                    <span className="material-symbols-outlined text-[17px]">send</span>
                    Approve for Billing
                  </button>
                </div>
              </footer>
            </section>
          </div>

          <footer className="mt-6 border-t border-[#c9d4de] pt-3 text-[12px] text-[#8a9299] max-[1024px]:hidden">
            Guard-All Electronic Security Systems, Inc.
          </footer>
        </div>
      </section>
      {isFullDetailsOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#071426]/65 p-4 max-[620px]:items-end max-[620px]:p-0"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setIsFullDetailsOpen(false);
            }
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="full-report-title"
            className="flex max-h-[92vh] w-full max-w-[1000px] flex-col overflow-hidden rounded-[10px] bg-white text-[#174276] shadow-[0_20px_60px_rgb(7_20_38_/_35%)] max-[620px]:max-h-[95vh] max-[620px]:rounded-b-none max-[620px]:rounded-t-[12px]"
          >
            <header className="flex shrink-0 items-start justify-between gap-4 border-b border-[#e1e6eb] px-6 py-5 max-[620px]:px-4">
              <div>
                <p className="m-0 text-[11px] font-bold uppercase tracking-[.08em] text-[#7d8994]">
                  {selectedReport.id} · {selectedReport.status}
                </p>
                <h2 id="full-report-title" className="m-0 mt-1 text-[22px] font-bold">
                  {selectedReport.client}
                </h2>
                <p className="m-0 mt-1 text-[12px] text-[#7d8994]">
                  {selectedReport.service} · {selectedReport.technician}
                </p>
              </div>
              <button
                type="button"
                aria-label="Close full report details"
                onClick={() => setIsFullDetailsOpen(false)}
                className="grid h-9 w-9 shrink-0 place-items-center rounded-[6px] border border-[#dfe6ec] bg-white text-[23px] leading-none text-[#718090] hover:bg-[#f4f8ff]"
              >
                ×
              </button>
            </header>

            <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-6 py-5 max-[620px]:space-y-5 max-[620px]:px-4">
              <section>
                <h3 className="m-0 text-[12px] font-bold uppercase tracking-[.08em] text-[#7d8994]">
                  Work Summary
                </h3>
                <p className="m-0 mt-2 text-[13px] leading-relaxed text-[#52677c]">
                  {selectedReportDetails.workSummary}
                </p>
              </section>

              <section>
                <h3 className="m-0 text-[12px] font-bold uppercase tracking-[.08em] text-[#7d8994]">
                  Parts Used
                </h3>
                <div className="mt-2 overflow-x-auto rounded-[7px] border border-[#dfe6ec]">
                  <table className="w-full min-w-[560px] border-collapse text-left text-[12px]">
                    <thead className="bg-[#f3f7fd] text-[#68798a]">
                      <tr>
                        <th className="px-3 py-2 font-bold">Item</th>
                        <th className="px-3 py-2 font-bold">Description</th>
                        <th className="px-3 py-2 font-bold">Qty</th>
                        <th className="px-3 py-2 font-bold">Usage</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedReportDetails.parts.map((part) => (
                        <tr className="border-t border-[#e8edf2]" key={part.sku}>
                          <td className="px-3 py-2 font-bold text-[#35649a]">{part.sku}</td>
                          <td className="px-3 py-2 text-[#52677c]">{part.description}</td>
                          <td className="px-3 py-2 text-[#52677c]">{part.quantity}</td>
                          <td className="px-3 py-2 text-[#52677c]">{part.note}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>

              <section>
                <h3 className="m-0 text-[12px] font-bold uppercase tracking-[.08em] text-[#7d8994]">
                  Attached Images
                </h3>
                <div className="mt-2 grid grid-cols-2 gap-3 max-[620px]:grid-cols-1">
                  {selectedReportDetails.images.map((image) => (
                    <figure className="m-0 overflow-hidden rounded-[7px] border border-[#dfe6ec] bg-[#f3f7fd]" key={image.name}>
                      <img
                        className="h-[190px] w-full object-cover"
                        src={image.src}
                        alt={image.alt}
                        loading="lazy"
                      />
                      <figcaption className="px-3 py-2 text-[11px] text-[#68798a]">
                        {image.name} · Sample preview
                      </figcaption>
                    </figure>
                  ))}
                </div>
              </section>

              <div className="grid grid-cols-2 gap-4 max-[620px]:grid-cols-1">
                <section className="rounded-[7px] border border-[#9ed6a8] bg-[#effbef] p-4">
                  <h3 className="m-0 text-[12px] font-bold uppercase tracking-[.08em] text-[#5b9764]">
                    Client Sign-off
                  </h3>
                  <p className="m-0 mt-3 text-[13px] font-bold text-[#39734b]">
                    {selectedReportDetails.signature.signer}
                  </p>
                  <p className="m-0 mt-1 text-[12px] text-[#5b9764]">
                    {selectedReportDetails.signature.method}
                  </p>
                  <p className="m-0 mt-2 text-[12px] text-[#5b9764]">
                    {selectedReportDetails.signature.signedAt}
                  </p>
                </section>

                <section className="rounded-[7px] border border-[#bac8db] bg-[#f3f7fd] p-4">
                  <h3 className="m-0 text-[12px] font-bold uppercase tracking-[.08em] text-[#68798a]">
                    Billing Readiness
                  </h3>
                  <p className="m-0 mt-3 text-[13px] font-bold text-[#35649a]">
                    {selectedReportDetails.billing.readiness}
                  </p>
                  <p className="m-0 mt-2 text-[12px] text-[#68798a]">
                    Inventory: {selectedReportDetails.billing.inventory}
                  </p>
                  <p className="m-0 mt-1 text-[12px] text-[#68798a]">
                    Billing reference: {selectedReportDetails.billing.reference}
                  </p>
                </section>
              </div>

              <section>
                <h3 className="m-0 text-[12px] font-bold uppercase tracking-[.08em] text-[#7d8994]">
                  Billing / Audit History
                </h3>
                <ol className="m-0 mt-2 divide-y divide-[#e8edf2] rounded-[7px] border border-[#dfe6ec] p-0">
                  {selectedReportDetails.audit.map((entry) => (
                    <li className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-3 py-2.5 text-[12px]" key={`${entry.time}-${entry.action}`}>
                      <span className="font-bold text-[#35649a]">{entry.action}</span>
                      <span className="text-[#68798a]">{entry.actor} · {entry.time}</span>
                    </li>
                  ))}
                </ol>
              </section>
            </div>

            <footer className="flex shrink-0 justify-end border-t border-[#e1e6eb] bg-[#f8fbff] px-6 py-4 max-[620px]:px-4">
              <button
                type="button"
                onClick={() => setIsFullDetailsOpen(false)}
                className="rounded-[6px] bg-[#1250a0] px-5 py-2.5 text-[12px] font-bold text-white hover:bg-[#0d438a]"
              >
                Close details
              </button>
            </footer>
          </section>
        </div>
      )}
    </main>
  );
}

export default ReportsOverview;
