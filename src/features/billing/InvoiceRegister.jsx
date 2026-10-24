import InvoiceRegisterRow from "./InvoiceRegisterRow.jsx";

const tabs = [
  { id: "all", label: "All" },
  { id: "pending", label: "Pending" },
  { id: "overdue", label: "Overdue" },
  { id: "paid", label: "Paid" },
];

// Search, status tabs, table head, empty states, and the invoice rows.
export default function InvoiceRegister({
  invoices,
  periodInvoices,
  visibleInvoices,
  periodLabelText,
  isLoading,
  loadError,
  search,
  filterTab,
  expandedId,
  onSearchChange,
  onFilterTabChange,
  onToggleExpand,
  onRecordPayment,
}) {
  return (
    <section className="mt-5 overflow-hidden rounded-[11px] border border-[#dfe6ec] bg-white shadow-[0_3px_8px_rgb(31_59_82_/_14%)] max-[620px]:mt-3">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e1e6eb] px-7 py-5 max-[620px]:px-3 max-[620px]:py-3">
        <div>
          <p className="m-0 text-[10px] font-bold uppercase tracking-[.12em] text-[#777e85] max-[620px]:text-[7px]">
            Generated from approved field reports
          </p>
          <h2 className="m-0 mt-1 text-[21px] font-bold max-[620px]:text-[13px]">
            Invoice register
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <input
            value={search}
            onChange={onSearchChange}
            placeholder="Search invoice, client, job"
            className="h-8 w-56 rounded-[6px] border border-[#d9dfe4] bg-[#f8f9fa] px-3 text-[11px] text-[#174f9a] outline-none focus:border-[#1250a0] max-[620px]:w-32"
          />
          <div className="flex rounded-full border border-[#dfe4e8] bg-[#f8fafc] p-1 text-[10px] max-[620px]:hidden">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => onFilterTabChange(tab.id)}
                className={`rounded-full px-3 py-1 ${
                  filterTab === tab.id
                    ? "bg-white font-bold text-[#174f9a] shadow-sm"
                    : "text-[#87929d]"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      <div className="grid grid-cols-[1.1fr_1.5fr_.9fr_.9fr_1fr_1.1fr_.9fr_120px] items-center bg-[#fafafa] px-7 py-3 text-[10px] font-bold uppercase tracking-[.08em] text-[#77818a] max-[1200px]:grid-cols-[1.1fr_1.5fr_1fr_1.2fr_.9fr_120px] max-[1200px]:[&>span:nth-child(3)]:hidden max-[1200px]:[&>span:nth-child(4)]:hidden max-[850px]:grid-cols-[1.2fr_1.4fr_1fr_120px] max-[850px]:[&>span:nth-child(6)]:hidden max-[850px]:px-4 max-[620px]:hidden">
        <span>Invoice</span>
        <span>Client / source</span>
        <span>Issued</span>
        <span>Due</span>
        <span>Total</span>
        <span>Paid / balance</span>
        <span>Status</span>
        <span>Action</span>
      </div>

      {loadError && (
        <p
          className="m-0 border-b border-[#f1b7af] bg-[#fff3f1] px-7 py-3 text-[12px] text-[#a83a2c]"
          role="alert"
        >
          {loadError}
        </p>
      )}

      {isLoading ? (
        <div className="py-12 text-center text-[13px] text-[#8e959b]">
          Loading invoices...
        </div>
      ) : invoices.length === 0 ? (
        <div className="px-6 py-12 text-center text-[13px] text-[#8d969e]">
          <p className="m-0 font-bold text-[#5e6b78]">No invoices yet.</p>
          <p className="m-0 mt-1 text-[12px]">
            Create one from an approved field report.
          </p>
        </div>
      ) : periodInvoices.length === 0 ? (
        <div className="px-6 py-12 text-center text-[13px] text-[#8d969e]">
          <p className="m-0 font-bold text-[#5e6b78]">
            No invoices were issued {periodLabelText}.
          </p>
          <p className="m-0 mt-1 text-[12px]">
            Pick another period or switch back to All time.
          </p>
        </div>
      ) : visibleInvoices.length === 0 ? (
        <div className="px-6 py-12 text-center text-[13px] text-[#8d969e]">
          <p className="m-0 font-bold text-[#5e6b78]">
            No invoices match the current filter.
          </p>
          <p className="m-0 mt-1 text-[12px]">
            Clear the search or switch back to All.
          </p>
        </div>
      ) : (
        visibleInvoices.map((invoice) => (
          <InvoiceRegisterRow
            key={invoice.id}
            invoice={invoice}
            isExpanded={expandedId === invoice.id}
            onToggleExpand={() => onToggleExpand(invoice.id)}
            onRecordPayment={onRecordPayment}
          />
        ))
      )}

      <footer className="flex items-center justify-between border-t border-[#e4e8eb] px-7 py-3 text-[10px] text-[#7f8992] max-[620px]:hidden">
        <span>
          Invoices start from an approved field report; the quotation lines are
          copied automatically.
        </span>
        <span>
          {visibleInvoices.length} of {periodInvoices.length} shown
        </span>
      </footer>
    </section>
  );
}
