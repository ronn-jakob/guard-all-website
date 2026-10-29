import { useEffect, useMemo, useState } from "react";
import { listFieldReports } from "../../lib/api/reports.js";
import { buildFieldReportReport } from "../../lib/fieldReportReport.js";
import { formatShortDate } from "../scheduling/scheduleUtils.js";
import {
  printSectionTitleClass as sectionTitleClass,
  printTableCellClass as tdClass,
  printTableHeadClass as thClass,
} from "./printStyles.js";

const partsLabel = (parts) => {
  const list = Array.isArray(parts) ? parts : [];
  const units = list.reduce(
    (total, part) => total + (Number(part.quantity) || 0),
    0,
  );
  if (!list.length) return "—";
  return `${list.length} line${list.length === 1 ? "" : "s"} · ${units} unit${
    units === 1 ? "" : "s"
  }`;
};

export default function FieldReportsPrintReport({ period }) {
  const [reports, setReports] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    let isCurrent = true;
    listFieldReports()
      .then(({ reports: incoming }) => {
        if (!isCurrent) return;
        setReports(Array.isArray(incoming) ? incoming : []);
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
    () => buildFieldReportReport(reports, period),
    [reports, period],
  );

  if (isLoading) {
    return (
      <p className="m-0 py-10 text-center text-[12px] text-[#8e959b]">
        Loading field reports…
      </p>
    );
  }

  if (loadError) {
    return (
      <p
        className="m-0 rounded-[6px] border border-[#f1b7af] bg-[#fff3f1] px-3 py-2 text-[11px] text-[#a83a2c]"
        role="alert"
      >
        Field reports could not be loaded: {loadError}
      </p>
    );
  }

  const summaryCells = [
    ["Reports filed", String(report.totals.reports)],
    ["Ready for billing", String(report.totals.readyForBilling)],
    ["Needs review", String(report.totals.needsReview)],
    ["Units used", String(report.totals.partsUnits)],
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

      {report.awaitingCount > 0 && (
        <p className="m-0 rounded-[6px] border border-[#f0dcb4] bg-[#fffbf2] px-3 py-2 text-[10px] text-[#7a5a12]">
          <strong>{report.awaitingCount}</strong>{" "}
          {report.awaitingCount === 1 ? "job is" : "jobs are"} currently awaiting
          a field report. This is a live count and is not limited to the period.
        </p>
      )}

      <section>
        <h2 className={sectionTitleClass}>Review status</h2>
        {report.byStatus.length === 0 ? (
          <p className="m-0 mt-1.5 text-[11px] text-[#8e959b]">
            No field reports were filed for this period.
          </p>
        ) : (
          <table className="mt-1.5 w-full border-collapse">
            <thead>
              <tr>
                <th className={thClass}>Status</th>
                <th className={`${thClass} text-right`}>Reports</th>
              </tr>
            </thead>
            <tbody>
              {report.byStatus.map((row) => (
                <tr key={row.status}>
                  <td className={tdClass}>{row.status}</td>
                  <td className={`${tdClass} text-right`}>{row.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {report.byTechnician.length > 0 && (
        <section>
          <h2 className={sectionTitleClass}>Reports per technician</h2>
          <table className="mt-1.5 w-full border-collapse">
            <thead>
              <tr>
                <th className={thClass}>Technician</th>
                <th className={`${thClass} text-right`}>Reports</th>
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

      <section>
        <h2 className={sectionTitleClass}>Filed reports</h2>
        {report.rows.length === 0 ? (
          <p className="m-0 mt-1.5 text-[11px] text-[#8e959b]">
            No field reports were filed for this period.
          </p>
        ) : (
          <table className="mt-1.5 w-full border-collapse">
            <thead>
              <tr>
                <th className={thClass}>Date</th>
                <th className={thClass}>Report</th>
                <th className={thClass}>Work order</th>
                <th className={thClass}>Client</th>
                <th className={thClass}>Technician</th>
                <th className={thClass}>Status</th>
                <th className={thClass}>Parts used</th>
                <th className={thClass}>Invoice</th>
              </tr>
            </thead>
            <tbody>
              {report.rows.map((row) => (
                <tr key={row.reportUuid ?? row.id}>
                  <td className={`${tdClass} whitespace-nowrap`}>
                    {formatShortDate(row.serviceDate)}
                  </td>
                  <td className={`${tdClass} whitespace-nowrap font-semibold`}>
                    {row.id}
                  </td>
                  <td className={`${tdClass} whitespace-nowrap`}>
                    {row.jobNumber || "—"}
                  </td>
                  <td className={tdClass}>{row.client}</td>
                  <td className={tdClass}>{row.technician}</td>
                  <td className={tdClass}>{row.status}</td>
                  <td className={tdClass}>{partsLabel(row.parts)}</td>
                  <td className={`${tdClass} whitespace-nowrap`}>
                    {row.invoice?.number || "—"}
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
