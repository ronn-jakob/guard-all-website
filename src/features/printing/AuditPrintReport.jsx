import { useEffect, useMemo, useState } from "react";
import { listAuditLog } from "../../lib/api/audit.js";
import { AUDIT_PRINT_CAP, buildAuditReport } from "../../lib/auditReport.js";
import {
  printSectionTitleClass as sectionTitleClass,
  printTableCellClass as tdClass,
  printTableHeadClass as thClass,
} from "./printStyles.js";

const PAGE_SIZE = 100;

// The action pages at 100 rows, so a report reads page by page until the
// period is covered or the print cap is reached.
async function loadAuditEvents(from, to) {
  const entries = [];
  let total = 0;
  let offset = 0;

  while (entries.length < AUDIT_PRINT_CAP) {
    const page = await listAuditLog({ from, to, limit: PAGE_SIZE, offset });
    const pageEntries = Array.isArray(page?.entries) ? page.entries : [];
    total = Number(page?.total) || total;
    entries.push(...pageEntries);
    if (pageEntries.length < PAGE_SIZE) break;
    if (total && entries.length >= total) break;
    offset += PAGE_SIZE;
  }

  const capped = entries.slice(0, AUDIT_PRINT_CAP);
  return {
    entries: capped,
    total: Math.max(total, entries.length),
    truncated: entries.length > capped.length || total > capped.length,
  };
}

const formatTimestamp = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const changedFields = (entry) => {
  const fields = (entry.changes ?? []).map((change) => change.field).filter(Boolean);
  if (fields.length) {
    const shown = fields.slice(0, 3).join(", ");
    return fields.length > 3 ? `${shown} +${fields.length - 3}` : shown;
  }
  if (entry.action === "insert") return "Created";
  if (entry.action === "delete") return "Deleted";
  return "—";
};

export default function AuditPrintReport({ period }) {
  const [data, setData] = useState({ entries: [], total: 0, truncated: false });
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const from = period.startKey;
  const to = period.endKey;

  useEffect(() => {
    let isCurrent = true;
    loadAuditEvents(from, to)
      .then((result) => {
        if (!isCurrent) return;
        setData(result);
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
  }, [from, to]);

  const report = useMemo(
    () => buildAuditReport(data.entries, data, period),
    [data, period],
  );

  if (isLoading) {
    return (
      <p className="m-0 py-10 text-center text-[12px] text-[#8e959b]">
        Loading audit events…
      </p>
    );
  }

  if (loadError) {
    return (
      <p
        className="m-0 rounded-[6px] border border-[#f1b7af] bg-[#fff3f1] px-3 py-2 text-[11px] text-[#a83a2c]"
        role="alert"
      >
        The audit log could not be loaded: {loadError}
      </p>
    );
  }

  const summaryCells = [
    ["Events", String(report.totals.events)],
    ["Inserts", String(report.totals.inserts)],
    ["Updates", String(report.totals.updates)],
    ["Deletes", String(report.totals.deletes)],
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

      <p className="m-0 text-[9px] leading-relaxed text-[#8a9299]">
        The range uses the audit action&apos;s UTC day boundaries, matching the
        Audit log screen.
        {report.truncated
          ? ` Showing the first ${AUDIT_PRINT_CAP.toLocaleString()} of ${report.total.toLocaleString()} events; narrow the period for the full trail.`
          : ""}
      </p>

      {report.byTable.length === 0 ? (
        <p className="m-0 text-[11px] text-[#8e959b]">
          No audit events were recorded in this period.
        </p>
      ) : (
        <>
          <section>
            <h2 className={sectionTitleClass}>Events by table</h2>
            <table className="mt-1.5 w-full border-collapse">
              <thead>
                <tr>
                  <th className={thClass}>Table</th>
                  <th className={`${thClass} text-right`}>Insert</th>
                  <th className={`${thClass} text-right`}>Update</th>
                  <th className={`${thClass} text-right`}>Delete</th>
                  <th className={`${thClass} text-right`}>Total</th>
                </tr>
              </thead>
              <tbody>
                {report.byTable.map((row) => (
                  <tr key={row.table}>
                    <td className={tdClass}>{row.table}</td>
                    <td className={`${tdClass} text-right`}>{row.insert}</td>
                    <td className={`${tdClass} text-right`}>{row.update}</td>
                    <td className={`${tdClass} text-right`}>{row.delete}</td>
                    <td className={`${tdClass} text-right`}>{row.total}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section>
            <h2 className={sectionTitleClass}>Events by actor</h2>
            <table className="mt-1.5 w-full border-collapse">
              <thead>
                <tr>
                  <th className={thClass}>Actor</th>
                  <th className={thClass}>Role</th>
                  <th className={`${thClass} text-right`}>Events</th>
                </tr>
              </thead>
              <tbody>
                {report.byActor.map((row) => (
                  <tr key={`${row.name}-${row.role}`}>
                    <td className={tdClass}>{row.name}</td>
                    <td className={tdClass}>{row.role || "—"}</td>
                    <td className={`${tdClass} text-right`}>{row.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section>
            <h2 className={sectionTitleClass}>Event ledger</h2>
            <table className="mt-1.5 w-full border-collapse">
              <thead>
                <tr>
                  <th className={thClass}>When</th>
                  <th className={thClass}>Actor</th>
                  <th className={thClass}>Action</th>
                  <th className={thClass}>Table</th>
                  <th className={thClass}>Record</th>
                  <th className={thClass}>Fields changed</th>
                </tr>
              </thead>
              <tbody>
                {report.rows.map((row) => (
                  <tr key={row.id}>
                    <td className={`${tdClass} whitespace-nowrap`}>
                      {formatTimestamp(row.changedAt)}
                    </td>
                    <td className={tdClass}>
                      {row.actor?.name || "Unattributed"}
                    </td>
                    <td className={`${tdClass} capitalize`}>{row.action}</td>
                    <td className={tdClass}>{row.table}</td>
                    <td className={`${tdClass} whitespace-nowrap`}>
                      {row.recordLabel ||
                        String(row.recordId ?? "").slice(0, 8) ||
                        "—"}
                    </td>
                    <td className={tdClass}>{changedFields(row)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </>
      )}
    </div>
  );
}
