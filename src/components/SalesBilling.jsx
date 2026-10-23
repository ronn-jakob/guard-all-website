import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Sidebar from "./Sidebar.jsx";
import TopBar from "./TopBar.jsx";
import { callAuthFunction } from "../lib/auth.js";
import {
  buildBillingBreakdown,
  filterInvoicesByPeriod,
  periodLabel,
  summariseInvoices,
} from "../lib/billing.js";

const formatPeso = (value) =>
  `₱${Number(value || 0).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const formatDate = (value) =>
  value
    ? new Date(`${value}T00:00:00`).toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "—";

const todayKey = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
    now.getDate(),
  ).padStart(2, "0")}`;
};

const methodLabels = {
  cash: "Cash",
  check: "Check",
  bank_transfer: "Bank transfer",
  online: "Online",
};

const statusLabels = {
  paid: "Paid",
  pending: "Pending",
  overdue: "Overdue",
  cancelled: "Cancelled",
};

const statusStyles = {
  paid: "border-[#73a9eb] bg-[#eef6ff] text-[#1762b1]",
  pending: "border-[#ffb0a3] bg-[#fff3f1] text-[#f05b48]",
  overdue: "border-[#e6b24c] bg-[#fff8e6] text-[#a56b00]",
  cancelled: "border-[#d7dadd] bg-[#f4f5f6] text-[#70777d]",
};

const fieldClass =
  "mt-1.5 h-10 w-full rounded-[6px] border border-[#d6dee6] bg-white px-3 text-[12px] text-[#273746] outline-none transition focus:border-[#14519f] focus:ring-2 focus:ring-[#14519f]/15";

const tabs = [
  { id: "all", label: "All" },
  { id: "pending", label: "Pending" },
  { id: "overdue", label: "Overdue" },
  { id: "paid", label: "Paid" },
];

function SalesBilling() {
  const navigate = useNavigate();
  const [invoices, setInvoices] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [filterTab, setFilterTab] = useState("all");
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState("");
  const [paymentInvoice, setPaymentInvoice] = useState(null);
  const [reloadToken, setReloadToken] = useState(0);
  // Period filter: All time by default so the page is unchanged until it is used.
  const [periodMode, setPeriodMode] = useState("all");
  const [periodMonth, setPeriodMonth] = useState(() => todayKey().slice(0, 7));
  const [periodYear, setPeriodYear] = useState(() => todayKey().slice(0, 4));
  const [isBreakdownOpen, setIsBreakdownOpen] = useState(true);

  useEffect(() => {
    let isCurrent = true;
    callAuthFunction("list-invoices")
      .then(({ invoices: incoming }) => {
        if (!isCurrent) return;
        setInvoices(Array.isArray(incoming) ? incoming : []);
        setLoadError("");
      })
      .catch((error) => {
        if (isCurrent) setLoadError(error.message);
      })
      .finally(() => {
        if (isCurrent) setIsLoading(false);
      });
    return () => {
      isCurrent = false;
    };
  }, [reloadToken]);

  const periodValue =
    periodMode === "month" ? periodMonth : periodMode === "year" ? periodYear : "";

  const periodInvoices = useMemo(
    () => filterInvoicesByPeriod(invoices, { mode: periodMode, value: periodValue }),
    [invoices, periodMode, periodValue],
  );

  const visibleInvoices = useMemo(() => {
    const query = search.trim().toLowerCase();
    return periodInvoices.filter((invoice) => {
      const matchesTab =
        filterTab === "all" ||
        invoice.status === filterTab ||
        (filterTab === "pending" && invoice.status === "overdue");
      const matchesSearch =
        !query ||
        `${invoice.invoiceNumber} ${invoice.clientName} ${invoice.jobNumber} ${invoice.reportNumber}`
          .toLowerCase()
          .includes(query);
      return matchesTab && matchesSearch;
    });
  }, [periodInvoices, filterTab, search]);

  // Collected counts payments against this period's invoices, so the three
  // figures always reconcile.
  const summary = useMemo(() => summariseInvoices(periodInvoices), [periodInvoices]);

  const availableYears = useMemo(() => {
    const years = new Set(
      invoices
        .filter((invoice) => invoice.status !== "cancelled")
        .map((invoice) => String(invoice.issueDate ?? "").slice(0, 4))
        .filter(Boolean),
    );
    years.add(periodYear);
    years.add(todayKey().slice(0, 4));
    return [...years].sort().reverse();
  }, [invoices, periodYear]);

  // The breakdown follows the filter's granularity: yearly when Year is chosen,
  // monthly otherwise.
  const breakdownMode = periodMode === "year" ? "year" : "month";
  const breakdown = useMemo(
    () => buildBillingBreakdown(invoices, { mode: breakdownMode }),
    [invoices, breakdownMode],
  );

  const metricCards = [
    {
      icon: "receipt_long",
      title: "Invoiced",
      value: formatPeso(summary.invoiced),
      note: `${summary.count} ${summary.count === 1 ? "invoice" : "invoices"} issued`,
      alert: false,
    },
    {
      icon: "check_circle",
      title: "Collected",
      value: formatPeso(summary.collected),
      note: "Payments received",
      alert: false,
    },
    {
      icon: "warning",
      title: "Outstanding",
      value: formatPeso(summary.outstanding),
      note: `${summary.openCount} ${summary.openCount === 1 ? "invoice" : "invoices"} awaiting payment`,
      alert: summary.outstanding > 0,
    },
  ];

  return (
    <main className="flex h-screen overflow-hidden bg-[#1f2022] font-sans text-[#063b7c] max-[1024px]:block">
      <Sidebar />
      <section className="h-screen w-full min-w-0 flex-1 overflow-y-auto bg-[#edf7ff] max-[1024px]:h-[100dvh]">
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
                Approved field reports become invoices; payments are collected here.
              </p>
            </div>

            <div className="flex items-center gap-4 max-[620px]:self-end">
              <Link
                to="/templates"
                className="rounded-[6px] border border-[#1250a0] bg-white px-5 py-3 text-[12px] font-bold text-[#1250a0] no-underline shadow-[0_2px_4px_rgb(18_80_160_/_12%)] hover:bg-[#f3f8ff] max-[1024px]:px-4 max-[1024px]:py-2 max-[620px]:hidden"
              >
                Job templates
              </Link>

              <button
                type="button"
                onClick={() => navigate("/billing/new")}
                className="rounded-[6px] bg-[#1250a0] px-5 py-3 text-[12px] font-bold text-white shadow-[0_2px_4px_rgb(18_80_160_/_25%)] hover:bg-[#0f4387] max-[1024px]:px-4 max-[1024px]:py-2 max-[620px]:px-3 max-[620px]:py-2 max-[620px]:text-[9px]"
              >
                + New invoice
              </button>
            </div>
          </div>

          <div className="mb-4 flex flex-wrap items-center gap-2">
            <div className="flex rounded-full border border-[#dfe4e8] bg-[#f8fafc] p-1 text-[10px]">
              {[
                { id: "all", label: "All time" },
                { id: "month", label: "Month" },
                { id: "year", label: "Year" },
              ].map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setPeriodMode(option.id)}
                  className={`rounded-full px-3 py-1 ${
                    periodMode === option.id
                      ? "bg-white font-bold text-[#174f9a] shadow-sm"
                      : "text-[#87929d]"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>

            {periodMode === "month" && (
              <input
                type="month"
                value={periodMonth}
                onChange={(event) => {
                  if (event.target.value) setPeriodMonth(event.target.value);
                }}
                aria-label="Invoice month"
                className="h-8 rounded-[6px] border border-[#d9dfe4] bg-white px-3 text-[11px] text-[#174f9a] outline-none focus:border-[#1250a0]"
              />
            )}
            {periodMode === "year" && (
              <select
                value={periodYear}
                onChange={(event) => setPeriodYear(event.target.value)}
                aria-label="Invoice year"
                className="h-8 rounded-[6px] border border-[#d9dfe4] bg-white px-3 text-[11px] text-[#174f9a] outline-none focus:border-[#1250a0]"
              >
                {availableYears.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
            )}

            <span className="text-[11px] text-[#8b949c]">
              {periodMode === "all"
                ? "All invoices"
                : `Showing ${periodLabel(periodMode, periodValue)} · ${summary.count} ${
                    summary.count === 1 ? "invoice" : "invoices"
                  }`}
            </span>

            <button
              type="button"
              onClick={() => setIsBreakdownOpen((open) => !open)}
              className="ml-auto rounded-[6px] border border-[#d9dfe4] bg-white px-3 py-1.5 text-[10px] font-bold text-[#5e6b78] hover:bg-[#f4f6f8]"
            >
              {isBreakdownOpen ? "Hide breakdown" : "Show breakdown"}
            </button>
          </div>

          <section className="grid grid-cols-3 gap-[18px] max-[620px]:gap-1">
            {metricCards.map(({ icon, title, value, note, alert }) => (
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

          {isBreakdownOpen && (
            <section className="mt-5 overflow-hidden rounded-[11px] border border-[#dfe6ec] bg-white shadow-[0_3px_8px_rgb(31_59_82_/_14%)]">
              <header className="flex flex-wrap items-center justify-between gap-2 border-b border-[#e1e6eb] px-7 py-4 max-[620px]:px-3">
                <div>
                  <p className="m-0 text-[10px] font-bold uppercase tracking-[.12em] text-[#777e85]">
                    {breakdownMode === "year" ? "YEARLY TOTALS" : "MONTHLY TOTALS"}
                  </p>
                  <h2 className="m-0 mt-1 text-[17px] font-bold text-[#063b7c] max-[620px]:text-[13px]">
                    Billing breakdown
                  </h2>
                </div>
                <span className="text-[10px] text-[#8b949c]">
                  Click a period to filter the register
                </span>
              </header>
              <div className="grid grid-cols-[1.2fr_.7fr_1fr_1fr_1fr] items-center bg-[#fafafa] px-7 py-2.5 text-[10px] font-bold uppercase tracking-[.08em] text-[#77818a] max-[620px]:grid-cols-[1.1fr_1fr_1fr] max-[620px]:[&>span:nth-child(2)]:hidden max-[620px]:[&>span:nth-child(5)]:hidden max-[620px]:px-3">
                <span>Period</span>
                <span>Invoices</span>
                <span>Invoiced</span>
                <span>Collected</span>
                <span>Outstanding</span>
              </div>
              {breakdown.length === 0 ? (
                <p className="m-0 px-7 py-6 text-center text-[12px] text-[#8d969e]">
                  No invoices have been issued yet.
                </p>
              ) : (
                breakdown.map((row) => {
                  const isActive = periodMode !== "all" && periodValue === row.key;
                  return (
                    <button
                      key={row.key}
                      type="button"
                      onClick={() => {
                        if (breakdownMode === "year") {
                          setPeriodMode("year");
                          setPeriodYear(row.key);
                        } else {
                          setPeriodMode("month");
                          setPeriodMonth(row.key);
                        }
                      }}
                      className={`grid w-full grid-cols-[1.2fr_.7fr_1fr_1fr_1fr] items-center border-t border-[#e4e8eb] px-7 py-2.5 text-left text-[11px] transition-colors hover:bg-[#f8fbff] max-[620px]:grid-cols-[1.1fr_1fr_1fr] max-[620px]:[&>*:nth-child(2)]:hidden max-[620px]:[&>*:nth-child(5)]:hidden max-[620px]:px-3 ${
                        isActive ? "bg-[#eef4ff]" : ""
                      }`}
                    >
                      <strong className="truncate text-[#174f9a]">
                        {row.label}
                      </strong>
                      <span className="text-[#607286]">{row.count}</span>
                      <span className="text-[#263747]">
                        {formatPeso(row.invoiced)}
                      </span>
                      <span className="text-[#263747]">
                        {formatPeso(row.collected)}
                      </span>
                      <span
                        className={
                          row.outstanding > 0
                            ? "font-bold text-[#f05b48]"
                            : "text-[#263747]"
                        }
                      >
                        {formatPeso(row.outstanding)}
                      </span>
                    </button>
                  );
                })
              )}
            </section>
          )}

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
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search invoice, client, job"
                  className="h-8 w-56 rounded-[6px] border border-[#d9dfe4] bg-[#f8f9fa] px-3 text-[11px] text-[#174f9a] outline-none focus:border-[#1250a0] max-[620px]:w-32"
                />
                <div className="flex rounded-full border border-[#dfe4e8] bg-[#f8fafc] p-1 text-[10px] max-[620px]:hidden">
                  {tabs.map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setFilterTab(tab.id)}
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
                  No invoices were issued {periodLabel(periodMode, periodValue)}.
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
              visibleInvoices.map((invoice) => {
                const isExpanded = expandedId === invoice.id;
                return (
                  <div key={invoice.id} className="border-t border-[#e4e8eb]">
                    <div className="grid min-h-[64px] grid-cols-[1.1fr_1.5fr_.9fr_.9fr_1fr_1.1fr_.9fr_120px] items-center px-7 text-[11px] max-[1200px]:grid-cols-[1.1fr_1.5fr_1fr_1.2fr_.9fr_120px] max-[1200px]:[&>*:nth-child(3)]:hidden max-[1200px]:[&>*:nth-child(4)]:hidden max-[850px]:grid-cols-[1.2fr_1.4fr_1fr_120px] max-[850px]:[&>*:nth-child(6)]:hidden max-[850px]:px-4 max-[620px]:grid-cols-[1fr_auto] max-[620px]:gap-x-2 max-[620px]:gap-y-1 max-[620px]:px-3 max-[620px]:py-3">
                      <div className="min-w-0">
                        <strong className="block truncate text-[#174f9a]">
                          {invoice.invoiceNumber}
                        </strong>
                        <small className="block truncate text-[9px] text-[#8d969e]">
                          {invoice.jobNumber || "No work order"}
                        </small>
                      </div>
                      <div className="min-w-0">
                        <strong className="block truncate">
                          {invoice.clientName}
                        </strong>
                        <small className="block truncate text-[9px] text-[#8d969e]">
                          {invoice.reportNumber || "No field report"}
                        </small>
                      </div>
                      <span className="text-[#7f8992]">
                        {formatDate(invoice.issueDate)}
                      </span>
                      <span className="text-[#7f8992]">
                        {formatDate(invoice.dueDate)}
                      </span>
                      <strong className="text-[#174f9a]">
                        {formatPeso(invoice.totalAmount)}
                      </strong>
                      <span>
                        <strong className="block text-[#263747]">
                          {formatPeso(invoice.paidAmount)}
                        </strong>
                        <small
                          className={`block text-[9px] ${
                            invoice.balance > 0 ? "text-[#f05b48]" : "text-[#8d969e]"
                          }`}
                        >
                          {invoice.balance > 0
                            ? `${formatPeso(invoice.balance)} left`
                            : "Settled"}
                        </small>
                      </span>
                      <span
                        className={`w-max rounded-full border px-3 py-1 text-[10px] ${statusStyles[invoice.status] ?? statusStyles.pending}`}
                      >
                        {statusLabels[invoice.status] ?? invoice.status}
                      </span>
                      <div className="flex items-center justify-end gap-2">
                        {invoice.balance > 0 && invoice.status !== "cancelled" ? (
                          <button
                            type="button"
                            onClick={() => setPaymentInvoice(invoice)}
                            className="rounded-[6px] bg-[#1250a0] px-3 py-1.5 text-[10px] font-bold text-white hover:bg-[#0f4387]"
                          >
                            Record payment
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() =>
                              setExpandedId(isExpanded ? "" : invoice.id)
                            }
                            className="text-[10px] font-bold text-[#7573bd] hover:text-[#1250a0]"
                          >
                            {isExpanded ? "Hide" : "View"}
                          </button>
                        )}
                        {invoice.balance > 0 && (
                          <button
                            type="button"
                            onClick={() =>
                              setExpandedId(isExpanded ? "" : invoice.id)
                            }
                            aria-label={isExpanded ? "Hide details" : "Show details"}
                            className="text-[#8b949c] hover:text-[#1250a0]"
                          >
                            <span className="material-symbols-outlined text-[18px]">
                              {isExpanded ? "expand_less" : "expand_more"}
                            </span>
                          </button>
                        )}
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="border-t border-dashed border-[#e4e8eb] bg-[#fbfdff] px-7 py-4 text-[11px] max-[620px]:px-3">
                        <div className="grid gap-4 max-[850px]:grid-cols-1 min-[851px]:grid-cols-[1.4fr_1fr]">
                          <div>
                            <p className="m-0 mb-1 text-[10px] font-bold uppercase tracking-[.08em] text-[#8b949c]">
                              Invoice lines
                            </p>
                            <div className="rounded-[6px] border border-[#e1e6eb] bg-white">
                              {invoice.lines.length === 0 ? (
                                <p className="m-0 px-3 py-2 text-[11px] text-[#8d969e]">
                                  No lines recorded.
                                </p>
                              ) : (
                                invoice.lines.map((line) => (
                                  <div
                                    key={line.id}
                                    className="flex items-center justify-between gap-3 border-b border-[#eef2f5] px-3 py-1.5 last:border-b-0"
                                  >
                                    <span className="min-w-0 truncate text-[#3a4a57]">
                                      {line.description}
                                    </span>
                                    <span className="shrink-0 text-[10px] text-[#8d969e]">
                                      {line.quantity} × {formatPeso(line.unitPrice)}
                                    </span>
                                    <strong className="shrink-0 text-[#174f9a]">
                                      {formatPeso(line.lineTotal)}
                                    </strong>
                                  </div>
                                ))
                              )}
                            </div>
                          </div>
                          <div>
                            <p className="m-0 mb-1 text-[10px] font-bold uppercase tracking-[.08em] text-[#8b949c]">
                              Payments
                            </p>
                            <div className="rounded-[6px] border border-[#e1e6eb] bg-white">
                              {invoice.payments.length === 0 ? (
                                <p className="m-0 px-3 py-2 text-[11px] text-[#8d969e]">
                                  Nothing received yet.
                                </p>
                              ) : (
                                invoice.payments.map((payment) => (
                                  <div
                                    key={payment.id}
                                    className="flex items-center justify-between gap-3 border-b border-[#eef2f5] px-3 py-1.5 last:border-b-0"
                                  >
                                    <span className="text-[#3a4a57]">
                                      {formatDate(payment.date)}
                                    </span>
                                    <span className="text-[10px] text-[#8d969e]">
                                      {methodLabels[payment.method] ?? payment.method}
                                    </span>
                                    <strong className="text-[#174f9a]">
                                      {formatPeso(payment.amount)}
                                    </strong>
                                  </div>
                                ))
                              )}
                            </div>
                            {invoice.quotationNumber && (
                              <p className="m-0 mt-2 text-[10px] text-[#8b949c]">
                                From quotation {invoice.quotationNumber}
                                {invoice.serviceDate
                                  ? ` · serviced ${formatDate(invoice.serviceDate)}`
                                  : ""}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
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

          <footer className="mt-6 border-t border-[#c9d4de] pt-3 text-[9px] text-[#8a9299] max-[1024px]:hidden">
            Guard-All Electronic Security Systems, Inc.
          </footer>
        </div>

        {paymentInvoice && (
          <PaymentDialog
            invoice={paymentInvoice}
            onClose={() => setPaymentInvoice(null)}
            onSaved={() => {
              setPaymentInvoice(null);
              setIsLoading(true);
              setReloadToken((token) => token + 1);
            }}
          />
        )}
      </section>
    </main>
  );
}

function PaymentDialog({ invoice, onClose, onSaved }) {
  const [amount, setAmount] = useState(() =>
    invoice.balance > 0 ? String(invoice.balance) : "",
  );
  const [method, setMethod] = useState("cash");
  const [paymentDate, setPaymentDate] = useState(todayKey);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event) {
    event.preventDefault();
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) {
      setError("Enter a payment amount greater than zero.");
      return;
    }
    if (value > invoice.balance + 0.001) {
      setError(
        `That is more than the ${formatPeso(invoice.balance)} still owed on this invoice.`,
      );
      return;
    }

    setError("");
    setIsSaving(true);
    try {
      await callAuthFunction("record-payment", {
        invoiceId: invoice.id,
        amount: value,
        method,
        paymentDate,
      });
      onSaved();
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#071426]/70 p-4 backdrop-blur-[2px] max-[620px]:items-end max-[620px]:p-0"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <form
        onSubmit={handleSubmit}
        role="dialog"
        aria-label={`Record payment for ${invoice.invoiceNumber}`}
        className="w-full max-w-[430px] rounded-[14px] border border-[#dfe6ec] bg-white p-6 shadow-[0_24px_70px_rgb(0_0_0_/_35%)] max-[620px]:rounded-b-none max-[620px]:rounded-t-[16px]"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="m-0 text-[10px] font-bold uppercase tracking-[.1em] text-[#818b94]">
              Record payment
            </p>
            <h2 className="m-0 mt-1 text-[18px] font-bold text-[#174f9a]">
              {invoice.invoiceNumber}
            </h2>
            <p className="m-0 mt-1 text-[12px] text-[#8b949c]">
              {invoice.clientName} · {formatPeso(invoice.balance)} outstanding
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="text-[#818b94] hover:text-[#174f9a]"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        <label className="mt-4 flex flex-col text-[11px] font-semibold text-[#45515c]">
          Amount
          <input
            type="number"
            min="0.01"
            step="0.01"
            max={invoice.balance}
            className={fieldClass}
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            required
          />
        </label>

        <div className="mt-3 grid grid-cols-2 gap-3">
          <label className="flex flex-col text-[11px] font-semibold text-[#45515c]">
            Method
            <select
              className={fieldClass}
              value={method}
              onChange={(event) => setMethod(event.target.value)}
            >
              {Object.entries(methodLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col text-[11px] font-semibold text-[#45515c]">
            Date
            <input
              type="date"
              className={fieldClass}
              value={paymentDate}
              onChange={(event) => setPaymentDate(event.target.value)}
              required
            />
          </label>
        </div>

        {error && (
          <p
            className="m-0 mt-3 rounded-[6px] border border-[#f1b7af] bg-[#fff3f1] px-3 py-2 text-[11px] text-[#a83a2c]"
            role="alert"
          >
            {error}
          </p>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-[6px] border border-[#d9dfe4] px-4 py-2 text-[11px] font-bold text-[#5e6b78] hover:bg-[#f4f6f8]"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSaving}
            className="rounded-[6px] bg-[#1250a0] px-4 py-2 text-[11px] font-bold text-white hover:bg-[#0f4387] disabled:opacity-50"
          >
            {isSaving ? "Saving..." : "Save payment"}
          </button>
        </div>
      </form>
    </div>
  );
}

export default SalesBilling;
