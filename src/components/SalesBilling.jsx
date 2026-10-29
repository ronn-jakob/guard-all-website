import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Sidebar from "./Sidebar.jsx";
import TopBar from "./TopBar.jsx";
import { listInvoices, listInvoiceCandidates } from "../lib/api/billing.js";
import {
  buildBillingBreakdown,
  filterInvoicesByPeriod,
  periodLabel,
  summariseInvoices,
} from "../lib/billing.js";
import { todayKey } from "../features/billing/billingFormatters.js";
import BillingPeriodFilter from "../features/billing/BillingPeriodFilter.jsx";
import BillingMetricCards from "../features/billing/BillingMetricCards.jsx";
import BillingBreakdown from "../features/billing/BillingBreakdown.jsx";
import InvoiceRegister from "../features/billing/InvoiceRegister.jsx";
import PaymentDialog from "../features/billing/PaymentDialog.jsx";

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
  // Approved reports on jobs with no invoice yet. A live queue, not a period
  // total, so it stays put when the money cards change with the filter.
  const [waitingReports, setWaitingReports] = useState(0);
  const [isLoadingWaiting, setIsLoadingWaiting] = useState(true);
  const [waitingError, setWaitingError] = useState("");

  useEffect(() => {
    let isCurrent = true;
    listInvoices()
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
    listInvoiceCandidates()
      .then(({ candidates }) => {
        if (!isCurrent) return;
        setWaitingReports(Array.isArray(candidates) ? candidates.length : 0);
        setWaitingError("");
      })
      .catch((error) => {
        if (isCurrent) setWaitingError(error.message);
      })
      .finally(() => {
        if (isCurrent) setIsLoadingWaiting(false);
      });
    return () => {
      isCurrent = false;
    };
  }, [reloadToken]);

  const periodValue =
    periodMode === "month" ? periodMonth : periodMode === "year" ? periodYear : "";

  // The printable report always needs a concrete period; "All time" opens the
  // current month so the link is never ambiguous.
  const reportPeriod =
    periodMode === "year"
      ? { mode: "year", value: periodYear }
      : periodMode === "month"
        ? { mode: "month", value: periodMonth }
        : { mode: "month", value: todayKey().slice(0, 7) };

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

  function handleSelectBreakdownPeriod(key) {
    if (breakdownMode === "year") {
      setPeriodMode("year");
      setPeriodYear(key);
      return;
    }
    setPeriodMode("month");
    setPeriodMonth(key);
  }

  function toggleExpanded(id) {
    setExpandedId((currentId) => (currentId === id ? "" : id));
  }

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

          <BillingPeriodFilter
            periodMode={periodMode}
            periodMonth={periodMonth}
            periodYear={periodYear}
            periodValue={periodValue}
            availableYears={availableYears}
            invoiceCount={summary.count}
            isBreakdownOpen={isBreakdownOpen}
            onSelectMode={setPeriodMode}
            onChangeMonth={setPeriodMonth}
            onChangeYear={setPeriodYear}
            onToggleBreakdown={() => setIsBreakdownOpen((open) => !open)}
            printHref={`/print/billing?mode=${reportPeriod.mode}&value=${reportPeriod.value}`}
          />

          <BillingMetricCards
            summary={summary}
            waitingReports={waitingReports}
            isLoadingWaiting={isLoadingWaiting}
            waitingError={waitingError}
          />

          {isBreakdownOpen && (
            <BillingBreakdown
              breakdown={breakdown}
              breakdownMode={breakdownMode}
              periodMode={periodMode}
              periodValue={periodValue}
              onSelectPeriod={handleSelectBreakdownPeriod}
            />
          )}

          <InvoiceRegister
            invoices={invoices}
            periodInvoices={periodInvoices}
            visibleInvoices={visibleInvoices}
            periodLabelText={periodLabel(periodMode, periodValue)}
            isLoading={isLoading}
            loadError={loadError}
            search={search}
            filterTab={filterTab}
            expandedId={expandedId}
            onSearchChange={(event) => setSearch(event.target.value)}
            onFilterTabChange={setFilterTab}
            onToggleExpand={toggleExpanded}
            onRecordPayment={setPaymentInvoice}
          />

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

export default SalesBilling;
