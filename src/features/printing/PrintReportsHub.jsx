import { Link } from "react-router-dom";
import Sidebar from "../../components/Sidebar.jsx";
import TopBar from "../../components/TopBar.jsx";
import { canAccessModule, getSession } from "../../lib/auth.js";
import { currentPeriodValue } from "../../lib/reportPeriods.js";

const REPORTS = [
  {
    key: "billing",
    module: "sales_billing",
    title: "Sales & Billing",
    description:
      "Invoices issued in the period, collected and outstanding totals, and payments received.",
    icon: "receipt_long",
    period: "month",
  },
  {
    key: "scheduling",
    module: "scheduling",
    title: "Operations schedule",
    description:
      "Jobs scheduled in the period, their workflow stage, technicians, and invoicing state.",
    icon: "calendar_month",
    period: "week",
  },
  {
    key: "reports",
    module: "field_reporting",
    title: "Field reports",
    description:
      "Reports filed in the period, review status, technician workload, and parts used.",
    icon: "assignment",
    period: "month",
  },
  {
    key: "inventory",
    module: "inventory",
    title: "Inventory",
    description:
      "Stock movements, low-stock parts, and the current stock value by category and branch.",
    icon: "inventory_2",
    period: "month",
  },
  {
    key: "audit",
    module: "admin",
    title: "Audit log",
    description:
      "Every recorded change in the period, grouped by table and actor.",
    icon: "history",
    period: "month",
  },
  {
    key: "accounts",
    module: "admin",
    title: "Accounts directory",
    description: "Active accounts by role and branch, as at today.",
    icon: "manage_accounts",
    periodless: true,
  },
  {
    key: "templates",
    module: "sales_billing",
    title: "Job template price list",
    description:
      "Client-facing prices for every standard package, as at today.",
    icon: "description",
    periodless: true,
  },
];

const periodLabel = (report) => {
  if (report.periodless) return "As at today";
  return report.period === "week" ? "This week" : "This month";
};

function PrintReportsHub() {
  const session = getSession();
  const role = session?.user?.role;
  const reports = REPORTS.filter((report) =>
    canAccessModule(report.module, role),
  );

  return (
    <main className="flex h-screen overflow-hidden bg-[#1f2022] font-sans text-[#063b7c] max-[1024px]:block">
      <Sidebar />
      <section className="h-screen w-full min-w-0 flex-1 overflow-y-auto bg-[#edf7ff] max-[1024px]:h-[100dvh]">
        <TopBar />
        <div className="px-8 pb-6 pt-8 max-[1024px]:px-6 max-[1024px]:pb-20 max-[1024px]:pt-5 max-[620px]:px-3">
          <header className="mb-7">
            <p className="mb-1 text-[10px] font-bold uppercase tracking-[.12em] text-[#818b94]">
              Operations / Reporting
            </p>
            <h1 className="m-0 text-[30px] font-bold tracking-[-.5px] max-[1024px]:text-[24px] max-[620px]:text-[19px]">
              Print reports
            </h1>
            <p className="mb-0 mt-2 text-[14px] text-[#8b949c]">
              Period reports for each module, ready to print or save as PDF.
              Every page uses A4 portrait and only shows data your role can
              already open.
            </p>
          </header>

          {reports.length === 0 ? (
            <p className="rounded-[8px] border border-[#dfe6ec] bg-white px-4 py-6 text-center text-[12px] text-[#8e959b]">
              No printable reports are available for your role.
            </p>
          ) : (
            <div className="grid grid-cols-3 gap-4 max-[1100px]:grid-cols-2 max-[620px]:grid-cols-1">
              {reports.map((report) => (
                <Link
                  key={report.key}
                  to={
                    report.periodless
                      ? `/print/${report.key}`
                      : `/print/${report.key}?mode=${report.period}&value=${currentPeriodValue(report.period)}`
                  }
                  className="group flex flex-col rounded-[11px] border border-[#dfe6ec] bg-white p-5 text-inherit no-underline shadow-[0_3px_8px_rgb(31_59_82_/_10%)] transition-colors hover:border-[#1250a0] hover:bg-[#f8fbff] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1250a0]"
                >
                  <span className="grid h-9 w-9 place-items-center rounded-[6px] bg-[#d6e6fb] text-[#1954a0]">
                    <span className="material-symbols-outlined text-[20px]">
                      {report.icon}
                    </span>
                  </span>
                  <strong className="mt-3 block text-[15px] font-bold">
                    {report.title}
                  </strong>
                  <span className="mt-1 block flex-1 text-[12px] leading-relaxed text-[#5e6b78]">
                    {report.description}
                  </span>
                  <span className="mt-3 flex items-center justify-between text-[10px] font-bold uppercase tracking-[.08em] text-[#7f8992]">
                    {periodLabel(report)}
                    <span className="material-symbols-outlined text-[16px] text-[#1250a0] transition-transform group-hover:translate-x-0.5">
                      arrow_forward
                    </span>
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}

export default PrintReportsHub;
