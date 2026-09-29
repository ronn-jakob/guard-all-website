import { useState, useMemo } from "react";
import Sidebar from "./Sidebar.jsx";
import TopBar from "./TopBar.jsx";

const initialInvoices = [
  {
    id: "INV - 10822",
    client: "Alder House Hotel",
    report: "FSR - 2026 - 0413",
    date: "2026-04-15",
    amount: 39550,
    status: "Paid",
  },
  {
    id: "INV - 10819",
    client: "Alder House Hotel",
    report: "FSR - 2026 - 0414",
    date: "2026-04-16",
    amount: 27600,
    status: "Pending",
  },
  {
    id: "INV - 10816",
    client: "Alder House Hotel",
    report: "FSR - 2026 - 0410",
    date: "2026-04-15",
    amount: 42800,
    status: "Paid",
  },
  {
    id: "INV - 10811",
    client: "Alder House Hotel",
    report: "FSR - 2026 - 0408",
    date: "2026-04-12",
    amount: 11950,
    status: "Pending",
  },
];

function SalesBilling() {
  const [invoicesList, setInvoicesList] = useState(initialInvoices);
  const [isNewInvoice, setIsNewInvoice] = useState(false);
  const [invoiceStatus, setInvoiceStatus] = useState("Pending");
  const [filterTab, setFilterTab] = useState("All");

  // Calendar popover state
  const [showCalendar, setShowCalendar] = useState(false);
  const [selectedDate, setSelectedDate] = useState("");

  // New Invoice Form State
  const [formData, setFormData] = useState({
    client: "Alder House Hotel",
    fsr: "",
    amount: "",
    date: new Date().toISOString().split("T")[0],
    vat: "12%",
    terms: "Net 30",
    remarks: "",
  });

  // Toggle invoice status
  const togglePaymentStatus = (id) => {
    setInvoicesList((prev) =>
      prev.map((inv) =>
        inv.id === id
          ? { ...inv, status: inv.status === "Paid" ? "Pending" : "Paid" }
          : inv
      )
    );
  };

  // Filter invoices by tab and selected date from calendar
  const filteredInvoices = useMemo(() => {
    return invoicesList.filter((inv) => {
      const matchesTab =
        filterTab === "All" ? true : inv.status === filterTab;
      const matchesDate = selectedDate ? inv.date === selectedDate : true;
      return matchesTab && matchesDate;
    });
  }, [invoicesList, filterTab, selectedDate]);

  // Compute summary metrics dynamically
  const summaryMetrics = useMemo(() => {
    const totalRev = invoicesList.reduce((acc, curr) => acc + curr.amount, 0);
    const collected = invoicesList
      .filter((inv) => inv.status === "Paid")
      .reduce((acc, curr) => acc + curr.amount, 0);
    const outstanding = invoicesList
      .filter((inv) => inv.status === "Pending")
      .reduce((acc, curr) => acc + curr.amount, 0);
    const pendingCount = invoicesList.filter(
      (inv) => inv.status === "Pending"
    ).length;

    return [
      {
        icon: "mail",
        title: "Revenue this month",
        value: `₱${totalRev.toLocaleString()}`,
        note: `${invoicesList.length} invoices issued`,
        alert: false,
      },
      {
        icon: "check_circle",
        title: "Collected",
        value: `₱${collected.toLocaleString()}`,
        note: "Paid invoices",
        alert: false,
      },
      {
        icon: "warning",
        title: "Outstanding",
        value: `₱${outstanding.toLocaleString()}`,
        note: `${pendingCount} invoices pending`,
        alert: true,
      },
    ];
  }, [invoicesList]);

  const handleCreateInvoice = (e) => {
    e.preventDefault();
    const nextId = `INV - ${Math.floor(10823 + Math.random() * 100)}`;
    const newEntry = {
      id: nextId,
      client: formData.client,
      report: formData.fsr || "FSR - 2026 - 0000",
      date: formData.date,
      amount: parseFloat(formData.amount) || 0,
      status: invoiceStatus,
    };

    setInvoicesList([newEntry, ...invoicesList]);
    setIsNewInvoice(false);
    setFormData({
      client: "Alder House Hotel",
      fsr: "",
      amount: "",
      date: new Date().toISOString().split("T")[0],
      vat: "12%",
      terms: "Net 30",
      remarks: "",
    });
  };

  const formatDateString = (dateStr) => {
    if (!dateStr) return "";
    const options = { day: "2-digit", month: "short", year: "numeric" };
    return new Date(dateStr).toLocaleDateString("en-GB", options);
  };

  return (
    <main className="flex h-screen overflow-hidden bg-[#1f2022] font-sans text-[#063b7c] max-[1024px]:block">
      <Sidebar />
      <section className="h-screen min-w-0 flex-1 overflow-y-auto bg-[#edf7ff]">
        <TopBar />

        <div className="px-8 pb-6 pt-8 max-[1024px]:px-6 max-[1024px]:pb-20 max-[1024px]:pt-5 max-[620px]:px-3">
          <div className="mb-7 flex items-end justify-between gap-5 max-[620px]:mb-4 max-[620px]:items-start">
            <div>
              <p className="mb-1 text-[10px] font-bold uppercase tracking-[.12em] text-[#818b94] max-[620px]:text-[7px]">
                Finance / Invoice queue
              </p>
              <h1 className="m-0 text-[30px] font-bold tracking-[-.5px] max-[1024px]:text-[24px] max-[620px]:text-[19px]">
                Sales &amp; Billing
              </h1>
              <p className="mb-0 mt-2 text-[14px] text-[#8b949c] max-[620px]:mt-1 max-[620px]:text-[9px]">
                Completed reports become clean, traceable invoices.
              </p>
            </div>

            <div className="relative flex items-center gap-4 max-[620px]:self-end">
              {/* Interactive Calendar Icon & Button */}
              <button
                type="button"
                onClick={() => setShowCalendar(!showCalendar)}
                className={`flex items-center justify-center rounded-lg p-1.5 transition-colors ${
                  selectedDate
                    ? "bg-[#1250a0] text-white"
                    : "text-[#1250a0] hover:bg-[#d6e6fb]"
                }`}
              >
                <span className="material-symbols-outlined text-[31px]">
                  calendar_month
                </span>
              </button>

              {/* Calendar Filter Popover */}
              {showCalendar && (
                <div className="absolute right-36 top-12 z-40 w-72 rounded-xl border border-[#dfe6ec] bg-white p-4 shadow-xl max-[620px]:right-0 max-[620px]:top-10">
                  <div className="mb-3 flex items-center justify-between border-b border-[#e1e6eb] pb-2">
                    <span className="text-[12px] font-bold text-[#174f9a]">
                      Filter by Issue Date
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowCalendar(false)}
                      className="text-[#818b94] hover:text-black"
                    >
                      ✕
                    </button>
                  </div>
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="w-full rounded-lg border border-[#c9d4de] p-2 text-[13px] outline-none focus:border-[#1250a0]"
                  />
                  <div className="mt-3 flex justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedDate("")}
                      className="rounded-md border border-[#dfe6ec] px-3 py-1.5 text-[11px] font-semibold text-[#818b94] hover:bg-gray-100"
                    >
                      Clear
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowCalendar(false)}
                      className="rounded-md bg-[#1250a0] px-3 py-1.5 text-[11px] font-bold text-white hover:bg-[#0f4387]"
                    >
                      Apply Filter
                    </button>
                  </div>
                </div>
              )}

              <button
                type="button"
                onClick={() => setIsNewInvoice(true)}
                className="rounded-[6px] bg-[#1250a0] px-5 py-3 text-[12px] font-bold text-white shadow-[0_2px_4px_rgb(18_80_160_/_25%)] hover:bg-[#0f4387] max-[1024px]:px-4 max-[1024px]:py-2 max-[620px]:w-full max-[620px]:px-3 max-[620px]:py-2 max-[620px]:text-[9px]"
              >
                + New invoice
              </button>
            </div>
          </div>

          <section className="grid grid-cols-3 gap-[18px] max-[620px]:gap-1">
            {summaryMetrics.map(({ icon, title, value, note, alert }) => (
              <article
                className={`relative min-h-[156px] rounded-[11px] border bg-white p-7 shadow-[0_3px_8px_rgb(31_59_82_/_14%)] max-[1024px]:min-h-[112px] max-[1024px]:p-4 max-[620px]:min-h-[58px] max-[620px]:rounded-[6px] max-[620px]:p-2 ${
                  alert ? "border-[#ff725f]" : "border-[#dfe6ec]"
                }`}
                key={title}
              >
                <div
                  className={`grid h-9 w-9 place-items-center rounded-[6px] max-[1024px]:h-7 max-[1024px]:w-7 max-[620px]:hidden ${
                    alert
                      ? "bg-[#ffd5cc] text-[#ff725f]"
                      : "bg-[#d6e6fb] text-[#1954a0]"
                  }`}
                >
                  <span className="material-symbols-outlined text-[21px]">
                    {icon}
                  </span>
                </div>
                <span
                  className={`absolute right-7 top-7 material-symbols-outlined text-[21px] max-[1024px]:right-4 max-[1024px]:top-4 max-[620px]:hidden ${
                    alert ? "text-[#ff725f]" : "text-[#16bc56]"
                  }`}
                >
                  north_east
                </span>
                <p className="mb-0 mt-5 text-[11px] font-bold uppercase tracking-[.07em] text-[#858b90] max-[1024px]:mt-3 max-[620px]:mt-0 max-[620px]:text-[7px] max-[620px]:tracking-normal">
                  {title}
                </p>
                <strong className="mt-1 block text-[29px] font-extrabold leading-tight max-[1024px]:text-[23px] max-[620px]:text-[15px]">
                  {value}
                </strong>
                <small className="text-[12px] text-[#8e959b] max-[1024px]:text-[9px] max-[620px]:hidden">
                  {note}
                </small>
              </article>
            ))}
          </section>

          <section className="mt-5 overflow-hidden rounded-[11px] border border-[#dfe6ec] bg-white shadow-[0_3px_8px_rgb(31_59_82_/_14%)] max-[620px]:mt-3">
            <header className="flex items-center justify-between gap-4 border-b border-[#e1e6eb] px-7 py-5 max-[620px]:px-3 max-[620px]:py-3">
              <div>
                <p className="m-0 text-[10px] font-bold uppercase tracking-[.12em] text-[#777e85] max-[620px]:text-[7px]">
                  Generated from field reports
                </p>
                <h2 className="m-0 mt-1 text-[21px] font-bold max-[620px]:text-[13px]">
                  Invoice register
                </h2>
              </div>
              <div className="flex rounded-full border border-[#dfe4e8] bg-[#f8fafc] p-1 text-[10px] max-[620px]:text-[7px]">
                {["All", "Paid", "Pending"].map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setFilterTab(tab)}
                    className={`rounded-full px-4 py-1 max-[620px]:px-2 ${
                      filterTab === tab
                        ? "bg-white font-bold text-[#174f9a] shadow-sm"
                        : "text-[#87929d]"
                    }`}
                  >
                    {tab}
                  </button>
                ))}
              </div>
            </header>
            <div className="grid grid-cols-[1.25fr_1.4fr_1fr_1fr_1fr_90px] items-center bg-[#fafafa] px-7 py-3 text-[10px] font-bold uppercase tracking-[.08em] text-[#77818a] max-[850px]:grid-cols-[1.25fr_1.4fr_1fr_1fr_90px] max-[850px]:px-4 max-[620px]:hidden">
              <span>Invoice</span>
              <span>Client / source report</span>
              <span>Issued</span>
              <span>Amount</span>
              <span>Status</span>
              <span>Action</span>
            </div>

            {filteredInvoices.length === 0 ? (
              <div className="p-8 text-center text-[13px] text-[#8d969e]">
                No invoice records found matching the current criteria.
              </div>
            ) : (
              filteredInvoices.map((inv) => (
                <div
                  className="grid min-h-[57px] grid-cols-[1.25fr_1.4fr_1fr_1fr_1fr_90px] items-center border-t border-[#e4e8eb] px-7 text-[11px] max-[850px]:grid-cols-[1.25fr_1.4fr_1fr_1fr_90px] max-[850px]:px-4 max-[620px]:grid-cols-[1fr_auto] max-[620px]:gap-x-2 max-[620px]:gap-y-1 max-[620px]:px-3 max-[620px]:py-3"
                  key={inv.id}
                >
                  <div className="max-[620px]:col-start-1">
                    <strong className="block text-[#174f9a] max-[620px]:text-[9px]">
                      {inv.id}
                    </strong>
                    <small className="text-[9px] text-[#8d969e] max-[620px]:text-[7px]">
                      ▤ Service invoice
                    </small>
                  </div>
                  <div className="max-[620px]:col-start-1">
                    <strong className="block max-[620px]:text-[9px]">
                      {inv.client}
                    </strong>
                    <small className="text-[9px] text-[#8d969e] max-[620px]:text-[7px]">
                      {inv.report}
                    </small>
                  </div>
                  <span className="max-[620px]:col-start-1 max-[620px]:text-[7px]">
                    {formatDateString(inv.date)}
                  </span>
                  <strong className="text-[10px] max-[620px]:col-start-2 max-[620px]:row-start-1 max-[620px]:text-[8px]">
                    ₱{inv.amount.toLocaleString()}
                  </strong>
                  <span
                    className={`w-max rounded-full border px-3 py-1 text-[10px] max-[620px]:col-start-2 max-[620px]:row-start-2 max-[620px]:justify-self-end max-[620px]:px-2 max-[620px]:py-0.5 max-[620px]:text-[7px] ${
                      inv.status === "Paid"
                        ? "border-[#73a9eb] bg-[#eef6ff] text-[#1762b1]"
                        : "border-[#ffb0a3] bg-[#fff3f1] text-[#f05b48]"
                    }`}
                  >
                    <span className="material-symbols-outlined mr-1 align-middle text-[13px] max-[620px]:hidden">
                      {inv.status === "Paid" ? "check_circle" : "schedule"}
                    </span>
                    {inv.status}
                  </span>
                  <button
                    type="button"
                    onClick={() => togglePaymentStatus(inv.id)}
                    className="text-right text-[9px] font-bold text-[#7573bd] hover:underline max-[620px]:hidden"
                  >
                    {inv.status === "Paid" ? "View receipt" : "✓ Mark paid"}
                  </button>
                </div>
              ))
            )}
            <footer className="flex items-center justify-between border-t border-[#e4e8eb] px-7 py-3 text-[10px] text-[#7f8992] max-[620px]:hidden">
              <span>
                Invoices are linked to approved field reports automatically
              </span>
              <span>◷ Last reconciliation 8:40 AM</span>
            </footer>
          </section>
          <footer className="mt-6 border-t border-[#c9d4de] pt-3 text-[9px] text-[#8a9299] max-[1024px]:hidden">
            Guard-All Electronic Security Systems, Inc.
          </footer>
        </div>

        {/* Modal Dialog */}
        {isNewInvoice && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-[#071426]/75 p-4 backdrop-blur-[2px] max-[620px]:items-end max-[620px]:p-0"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) setIsNewInvoice(false);
            }}
          >
            <section
              role="dialog"
              className="flex max-h-[92vh] w-full max-w-[890px] flex-col overflow-hidden rounded-[17px] border border-[#263c5a] bg-[#172a44] text-[#e5edf8] shadow-[0_24px_80px_rgb(0_0_0_/_45%)] max-[620px]:max-h-[94vh] max-[620px]:rounded-b-none max-[620px]:rounded-t-[16px]"
            >
              <header className="flex shrink-0 items-start justify-between border-b border-[#293d58] px-7 py-5 max-[620px]:px-5 max-[620px]:py-4">
                <div>
                  <p className="m-0 text-[12px] font-semibold uppercase tracking-[.1em] text-[#91a8c7]">
                    Finance / Invoice Queue
                  </p>
                  <h2
                    id="create-invoice-title"
                    className="m-0 mt-1 text-[27px] font-bold text-white max-[620px]:text-[23px]"
                  >
                    Create New Invoice
                  </h2>
                  <p className="m-0 mt-1 text-[15px] text-[#99afc9]">
                    Generate a billing statement from an approved service field
                    report.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsNewInvoice(false)}
                  className="grid h-8 w-8 place-items-center text-[27px] leading-none text-[#91a8c7] hover:text-white"
                >
                  ×
                </button>
              </header>

              <form
                id="create-invoice-form"
                className="min-h-0 flex-1 overflow-y-auto px-7 py-5 max-[620px]:px-5"
                onSubmit={handleCreateInvoice}
              >
                <div className="mb-4 grid grid-cols-2 gap-4 max-[620px]:grid-cols-1 max-[620px]:gap-3">
                  <label className="text-[14px] font-medium text-[#a9bfd9]">
                    Client Name <span className="text-[#ff6557]">*</span>
                    <select
                      required
                      autoFocus
                      value={formData.client}
                      onChange={(e) =>
                        setFormData({ ...formData, client: e.target.value })
                      }
                      className="mt-1.5 h-12 w-full rounded-[10px] border border-[#293f5d] bg-[#1d3351] px-4 text-[15px] text-white outline-none focus:border-[#4d88e8]"
                    >
                      <option>Alder House Hotel</option>
                      <option>Grand Plaza Resort</option>
                      <option>Metro Logistics Hub</option>
                      <option>Apex Commercial Center</option>
                    </select>
                  </label>
                  <label className="text-[14px] font-medium text-[#a9bfd9]">
                    Source Field Service Report (FSR){" "}
                    <span className="text-[#ff6557]">*</span>
                    <input
                      required
                      type="text"
                      placeholder="e.g. FSR - 2026 - 0415"
                      value={formData.fsr}
                      onChange={(e) =>
                        setFormData({ ...formData, fsr: e.target.value })
                      }
                      className="mt-1.5 h-12 w-full rounded-[10px] border border-[#293f5d] bg-[#1d3351] px-4 text-[15px] text-white outline-none placeholder:text-[#7188a4] focus:border-[#4d88e8]"
                    />
                  </label>
                </div>

                <div className="mb-4 grid grid-cols-2 gap-4 max-[620px]:grid-cols-1 max-[620px]:gap-3">
                  <label className="text-[14px] font-medium text-[#a9bfd9]">
                    Amount (₱) <span className="text-[#ff6557]">*</span>
                    <input
                      required
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="e.g. 35000"
                      value={formData.amount}
                      onChange={(e) =>
                        setFormData({ ...formData, amount: e.target.value })
                      }
                      className="mt-1.5 h-12 w-full rounded-[10px] border border-[#293f5d] bg-[#1d3351] px-4 text-[15px] text-white outline-none placeholder:text-[#7188a4] focus:border-[#4d88e8]"
                    />
                  </label>
                  <label className="text-[14px] font-medium text-[#a9bfd9]">
                    Issue Date <span className="text-[#ff6557]">*</span>
                    <input
                      required
                      type="date"
                      value={formData.date}
                      onChange={(e) =>
                        setFormData({ ...formData, date: e.target.value })
                      }
                      className="mt-1.5 h-12 w-full rounded-[10px] border border-[#293f5d] bg-[#1d3351] px-4 text-[15px] text-white outline-none focus:border-[#4d88e8]"
                    />
                  </label>
                </div>

                <div className="mb-4 grid grid-cols-2 gap-4 max-[620px]:grid-cols-1 max-[620px]:gap-3">
                  <label className="text-[14px] font-medium text-[#a9bfd9]">
                    Tax / VAT Rate <span className="text-[#ff6557]">*</span>
                    <select
                      value={formData.vat}
                      onChange={(e) =>
                        setFormData({ ...formData, vat: e.target.value })
                      }
                      className="mt-1.5 h-12 w-full rounded-[10px] border border-[#293f5d] bg-[#1d3351] px-4 text-[15px] text-white outline-none focus:border-[#4d88e8]"
                    >
                      <option>12% VAT Included</option>
                      <option>12% VAT Exclusive</option>
                      <option>Zero-Rated (0%)</option>
                      <option>VAT Exempt</option>
                    </select>
                  </label>

                  <label className="text-[14px] font-medium text-[#a9bfd9]">
                    Payment Terms <span className="text-[#ff6557]">*</span>
                    <select
                      value={formData.terms}
                      onChange={(e) =>
                        setFormData({ ...formData, terms: e.target.value })
                      }
                      className="mt-1.5 h-12 w-full rounded-[10px] border border-[#293f5d] bg-[#1d3351] px-4 text-[15px] text-white outline-none focus:border-[#4d88e8]"
                    >
                      <option>Due on Receipt</option>
                      <option>Net 15</option>
                      <option>Net 30</option>
                      <option>Net 60</option>
                    </select>
                  </label>
                </div>

                <fieldset className="mb-4 border-0 p-0">
                  <legend className="mb-1.5 text-[14px] font-medium text-[#a9bfd9]">
                    Initial Status
                  </legend>
                  <div className="grid grid-cols-2 gap-2 max-[420px]:grid-cols-1">
                    <button
                      type="button"
                      onClick={() => setInvoiceStatus("Pending")}
                      className={`h-12 rounded-[10px] border text-[15px] transition-colors ${
                        invoiceStatus === "Pending"
                          ? "border-[#ff6557] bg-[#ff6557] text-white"
                          : "border-[#293f5d] bg-[#1d3351] text-[#e5edf8] hover:border-[#ff6557]"
                      }`}
                    >
                      Pending
                    </button>
                    <button
                      type="button"
                      onClick={() => setInvoiceStatus("Paid")}
                      className={`h-12 rounded-[10px] border text-[15px] transition-colors ${
                        invoiceStatus === "Paid"
                          ? "border-[#4d88e8] bg-[#4d88e8] text-white"
                          : "border-[#293f5d] bg-[#1d3351] text-[#e5edf8] hover:border-[#4d88e8]"
                      }`}
                    >
                      Paid
                    </button>
                  </div>
                </fieldset>

                <label className="mt-4 block text-[14px] font-medium text-[#a9bfd9]">
                  Invoice Remarks / Scope Description
                  <textarea
                    rows="3"
                    value={formData.remarks}
                    onChange={(e) =>
                      setFormData({ ...formData, remarks: e.target.value })
                    }
                    placeholder="Add breakdown of services rendered, replaced hardware, or client PO numbers..."
                    className="mt-1.5 w-full resize-y rounded-[10px] border border-[#293f5d] bg-[#1d3351] px-4 py-3 text-[15px] text-white outline-none placeholder:text-[#7188a4] focus:border-[#4d88e8]"
                  />
                </label>
              </form>

              <footer className="flex shrink-0 items-center justify-between gap-4 border-t border-[#293d58] bg-[#172a44] px-7 py-4 max-[620px]:flex-col max-[620px]:items-stretch max-[620px]:px-5">
                <span className="text-[14px] text-[#91a8c7]">
                  Invoice Ref: INV-NEW
                </span>
                <div className="flex gap-3 max-[420px]:flex-wrap">
                  <button
                    type="button"
                    onClick={() => setIsNewInvoice(false)}
                    className="h-[50px] rounded-[10px] border border-[#293f5d] px-5 text-[14px] text-[#e5edf8] hover:bg-[#1d3351]"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    form="create-invoice-form"
                    className="h-[50px] rounded-[10px] bg-[#4d88e8] px-5 text-[14px] font-semibold text-white hover:bg-[#5b96f4] max-[420px]:flex-1"
                  >
                    Create Invoice
                  </button>
                </div>
              </footer>
            </section>
          </div>
        )}
      </section>
    </main>
  );
}

export default SalesBilling;