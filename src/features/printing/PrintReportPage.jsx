import { useEffect, useMemo } from "react";
import { Link, Navigate, useParams, useSearchParams } from "react-router-dom";
import { canAccessModule, getSession } from "../../lib/auth.js";
import { periodFromSearchParams, resolvePeriod } from "../../lib/reportPeriods.js";
import PrintReportLayout from "./PrintReportLayout.jsx";
import ReportPeriodPicker from "./ReportPeriodPicker.jsx";
import BillingPrintReport from "./BillingPrintReport.jsx";
import SchedulingPrintReport from "./SchedulingPrintReport.jsx";
import FieldReportsPrintReport from "./FieldReportsPrintReport.jsx";
import InventoryPrintReport from "./InventoryPrintReport.jsx";
import AuditPrintReport from "./AuditPrintReport.jsx";
import AccountsPrintReport from "./AccountsPrintReport.jsx";
import TemplatesPrintReport from "./TemplatesPrintReport.jsx";

// One entry per printable report. A module is added here only once its section
// component exists; anything else redirects instead of rendering an empty page.
const PRINT_MODULES = {
  billing: {
    module: "sales_billing",
    title: "Sales & Billing Report",
    backTo: "/billing",
    backLabel: "Back to billing",
    defaultMode: "month",
  },
  scheduling: {
    module: "scheduling",
    title: "Operations Schedule",
    backTo: "/scheduling",
    backLabel: "Back to scheduling",
    defaultMode: "week",
  },
  reports: {
    module: "field_reporting",
    title: "Field Reports Summary",
    backTo: "/reports",
    backLabel: "Back to reports",
    defaultMode: "month",
  },
  inventory: {
    module: "inventory",
    title: "Inventory Report",
    backTo: "/inventory",
    backLabel: "Back to inventory",
    defaultMode: "month",
  },
  audit: {
    module: "admin",
    title: "Audit Log Report",
    backTo: "/audit",
    backLabel: "Back to audit log",
    defaultMode: "month",
  },
  accounts: {
    module: "admin",
    title: "Accounts Directory",
    backTo: "/account",
    backLabel: "Back to accounts",
    periodless: true,
  },
  templates: {
    module: "sales_billing",
    title: "Job Template Price List",
    backTo: "/templates",
    backLabel: "Back to templates",
    periodless: true,
  },
};

const capitalize = (value) =>
  String(value ?? "").replace(/^./, (letter) => letter.toUpperCase());

export default function PrintReportPage() {
  const { module } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const config = PRINT_MODULES[module];
  const session = getSession();

  const { mode, value } = periodFromSearchParams(
    searchParams,
    new Date(),
    config?.defaultMode ?? "month",
  );
  const period = useMemo(() => resolvePeriod(mode, value), [mode, value]);
  const generatedAt = useMemo(
    () =>
      new Date().toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
      }),
    [],
  );

  // A saved PDF takes its filename from the document title.
  const isPeriodless = Boolean(config?.periodless);
  const periodLabel = isPeriodless ? `As at ${generatedAt}` : period.label;

  useEffect(() => {
    if (!config) return;
    const previousTitle = document.title;
    document.title = `${config.title} · ${periodLabel} · Guard-All`;
    return () => {
      document.title = previousTitle;
    };
  }, [config, periodLabel]);

  if (!session) return <Navigate replace to="/" />;
  if (!config || !canAccessModule(config.module, session.user.role)) {
    return <Navigate replace to="/dashboard" />;
  }

  const branchLabel =
    session.user.role === "Admin"
      ? "All branches"
      : capitalize(session.user.branch) || "—";

  return (
    // Deliberately not <main>: index.css scales small text inside <main> for app
    // screens, which would enlarge the printed tables.
    <div className="min-h-screen bg-[#edf7ff] px-4 py-6 print:min-h-0 print:bg-white print:p-0">
      <div className="mx-auto mb-3 w-full max-w-[210mm]">
        <div className="no-print mb-2 flex items-center justify-between gap-2">
          <Link
            to={config.backTo}
            className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-[.1em] text-[#7f8992] no-underline hover:text-[#1250a0]"
          >
            <span className="material-symbols-outlined text-[15px]">arrow_back</span>
            {config.backLabel}
          </Link>
          <span className="text-[10px] text-[#8a9299]">
            A4 · portrait · prints as shown
          </span>
        </div>
        {!isPeriodless && (
          <ReportPeriodPicker
            period={period}
            onSelect={(nextMode, nextValue) =>
              setSearchParams({ mode: nextMode, value: nextValue })
            }
            onPrint={() => window.print()}
          />
        )}
        {isPeriodless && (
          <div className="no-print mt-2 flex items-center justify-between gap-2">
            <span className="text-[11px] font-semibold text-[#174f9a]">
              As at {generatedAt} · this report is a snapshot, not a period
            </span>
            <button
              type="button"
              onClick={() => window.print()}
              className="flex h-8 items-center gap-1.5 rounded-[6px] bg-[#1250a0] px-3 text-[11px] font-bold text-white hover:bg-[#0f4387]"
            >
              <span className="material-symbols-outlined text-[16px]">print</span>
              Print / Save as PDF
            </button>
          </div>
        )}
      </div>

      <div className="mx-auto w-full max-w-[210mm] border border-[#dfe6ec] bg-white shadow-[0_8px_30px_rgb(31_59_82_/_12%)] print:border-0 print:shadow-none">
        <PrintReportLayout
          title={config.title}
          periodLabel={periodLabel}
          branchLabel={branchLabel}
          preparedBy={session.user.name || "Account"}
          generatedAt={generatedAt}
        >
          {module === "billing" && <BillingPrintReport period={period} />}
          {module === "scheduling" && <SchedulingPrintReport period={period} />}
          {module === "reports" && <FieldReportsPrintReport period={period} />}
          {module === "inventory" && <InventoryPrintReport period={period} />}
          {module === "audit" && <AuditPrintReport period={period} />}
          {module === "accounts" && <AccountsPrintReport />}
          {module === "templates" && <TemplatesPrintReport />}
        </PrintReportLayout>
      </div>
    </div>
  );
}
