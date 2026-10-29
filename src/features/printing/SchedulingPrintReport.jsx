import { useEffect, useMemo, useState } from "react";
import { listSchedules } from "../../lib/api/scheduling.js";
import { buildScheduleReport } from "../../lib/scheduleReport.js";
import { formatShortDate } from "../scheduling/scheduleUtils.js";
import {
  printSectionTitleClass as sectionTitleClass,
  printTableCellClass as tdClass,
  printTableHeadClass as thClass,
} from "./printStyles.js";

const invoiceStatusLabel = {
  paid: "Paid",
  pending: "Pending",
  overdue: "Overdue",
};

export default function SchedulingPrintReport({ period }) {
  const [schedules, setSchedules] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    let isCurrent = true;
    listSchedules()
      .then(({ schedules: incoming }) => {
        if (!isCurrent) return;
        setSchedules(Array.isArray(incoming) ? incoming : []);
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
  }, []);

  const report = useMemo(
    () => buildScheduleReport(schedules, period),
    [schedules, period],
  );

  if (isLoading) {
    return (
      <p className="m-0 py-10 text-center text-[12px] text-[#8e959b]">
        Loading schedule…
      </p>
    );
  }

  if (loadError) {
    return (
      <p
        className="m-0 rounded-[6px] border border-[#f1b7af] bg-[#fff3f1] px-3 py-2 text-[11px] text-[#a83a2c]"
        role="alert"
      >
        The schedule could not be loaded: {loadError}
      </p>
    );
  }

  const summaryCells = [
    ["Jobs scheduled", String(report.totals.jobs)],
    ["Open", String(report.totals.open)],
    ["Closed", String(report.totals.closed)],
    ["Drafts", String(report.totals.drafts)],
  ];

  return (
    <div className="space-y-5">
      <section className="grid grid-cols-4 gap-2 max-[620px]:grid-cols-2">
        {summaryCells.map(([label, value]) => (
          <div
            key={label}
            className="rounded-[6px] border border-[#dfe6ec] bg-[#f8fbff] px-3 py-2"
          >
            <p className="m-0 text-[9px] font-bold uppercase tracking-[.07em] text-[#7d8994]">
              {label}
            </p>
            <strong className="mt-0.5 block text-[15px] font-extrabold leading-tight">
              {value}
            </strong>
          </div>
        ))}
      </section>

      <section>
        <h2 className={sectionTitleClass}>Workflow stages</h2>
        {report.byStage.length === 0 ? (
          <p className="m-0 mt-1.5 text-[11px] text-[#8e959b]">
            No jobs were scheduled in this period.
          </p>
        ) : (
          <table className="mt-1.5 w-full border-collapse">
            <thead>
              <tr>
                <th className={thClass}>Stage</th>
                <th className={`${thClass} text-right`}>Jobs</th>
              </tr>
            </thead>
            <tbody>
              {report.byStage.map((row) => (
                <tr key={row.stage}>
                  <td className={tdClass}>
                    <span
                      className={`inline-block rounded-full border px-2 py-0.5 text-[9px] font-bold ${row.style}`}
                    >
                      {row.stage}
                    </span>
                  </td>
                  <td className={`${tdClass} text-right`}>{row.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {report.byTechnician.length > 0 && (
        <section>
          <h2 className={sectionTitleClass}>Jobs per technician</h2>
          <table className="mt-1.5 w-full border-collapse">
            <thead>
              <tr>
                <th className={thClass}>Technician</th>
                <th className={`${thClass} text-right`}>Jobs</th>
              </tr>
            </thead>
            <tbody>
              {report.byTechnician.map((row) => (
                <tr key={row.name}>
                  <td className={tdClass}>{row.name}</td>
                  <td className={`${tdClass} text-right`}>{row.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {report.byBranch.length > 1 && (
        <section>
          <h2 className={sectionTitleClass}>Jobs per branch</h2>
          <table className="mt-1.5 w-full border-collapse">
            <thead>
              <tr>
                <th className={thClass}>Branch</th>
                <th className={`${thClass} text-right`}>Jobs</th>
              </tr>
            </thead>
            <tbody>
              {report.byBranch.map((row) => (
                <tr key={row.name}>
                  <td className={tdClass}>{row.name}</td>
                  <td className={`${tdClass} text-right`}>{row.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      <section>
        <h2 className={sectionTitleClass}>Scheduled jobs</h2>
        {report.rows.length === 0 ? (
          <p className="m-0 mt-1.5 text-[11px] text-[#8e959b]">
            No jobs were scheduled in this period.
          </p>
        ) : (
          <table className="mt-1.5 w-full border-collapse">
            <thead>
              <tr>
                <th className={thClass}>Date</th>
                <th className={thClass}>Time</th>
                <th className={thClass}>Work order</th>
                <th className={thClass}>Client</th>
                <th className={thClass}>Service</th>
                <th className={thClass}>Technicians</th>
                <th className={thClass}>Site</th>
                <th className={thClass}>Stage</th>
                <th className={thClass}>Invoice</th>
              </tr>
            </thead>
            <tbody>
              {report.rows.map((job) => (
                <tr key={job.order}>
                  <td className={`${tdClass} whitespace-nowrap`}>
                    {formatShortDate(job.date)}
                  </td>
                  <td className={`${tdClass} whitespace-nowrap`}>
                    {job.time || "—"}
                  </td>
                  <td className={`${tdClass} whitespace-nowrap font-semibold`}>
                    {job.order}
                  </td>
                  <td className={tdClass}>{job.client}</td>
                  <td className={tdClass}>{job.service}</td>
                  <td className={tdClass}>{job.technician}</td>
                  <td className={tdClass}>{job.location}</td>
                  <td className={tdClass}>
                    <span
                      className={`inline-block rounded-full border px-2 py-0.5 text-[9px] font-bold ${job.stage.style}`}
                    >
                      {job.stage.label}
                    </span>
                  </td>
                  <td className={`${tdClass} whitespace-nowrap`}>
                    {job.invoice
                      ? `${job.invoice.number} · ${
                          invoiceStatusLabel[job.invoice.status] ??
                          job.invoice.status
                        }`
                      : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
