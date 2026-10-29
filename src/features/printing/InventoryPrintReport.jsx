import { useEffect, useMemo, useState } from "react";
import { listInventory, listStockMovements } from "../../lib/api/inventory.js";
import {
  buildInventoryReport,
  movementRange,
  movementReasonLabel,
} from "../../lib/inventoryReport.js";
import { formatPeso } from "../billing/billingFormatters.js";
import {
  printSectionTitleClass as sectionTitleClass,
  printTableCellClass as tdClass,
  printTableHeadClass as thClass,
} from "./printStyles.js";

const formatMovementDate = (value) => {
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

export default function InventoryPrintReport({ period }) {
  const [data, setData] = useState({
    movements: [],
    stockItems: [],
    truncated: false,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const { from, to } = useMemo(() => movementRange(period), [period]);

  useEffect(() => {
    let isCurrent = true;
    Promise.all([listStockMovements({ from, to }), listInventory()])
      .then(([movementResult, inventoryResult]) => {
        if (!isCurrent) return;
        setData({
          movements: Array.isArray(movementResult?.movements)
            ? movementResult.movements
            : [],
          truncated: Boolean(movementResult?.truncated),
          stockItems: Array.isArray(inventoryResult?.items)
            ? inventoryResult.items
            : [],
        });
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
    () => buildInventoryReport(data, period),
    [data, period],
  );

  if (isLoading) {
    return (
      <p className="m-0 py-10 text-center text-[12px] text-[#8e959b]">
        Loading inventory movements…
      </p>
    );
  }

  if (loadError) {
    return (
      <p
        className="m-0 rounded-[6px] border border-[#f1b7af] bg-[#fff3f1] px-3 py-2 text-[11px] text-[#a83a2c]"
        role="alert"
      >
        Inventory could not be loaded: {loadError}
      </p>
    );
  }

  const summaryCells = [
    ["Items tracked", String(report.totals.items)],
    ["Units on hand", String(report.totals.unitsOnHand)],
    ["Stock value", formatPeso(report.totals.valueOnHand)],
    ["Movements", String(report.totals.movements)],
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
        On-hand quantities and stock value are a snapshot taken when this report
        was generated. The movement figures below cover the selected period only.
        {report.truncated
          ? " Showing the first 2,000 movements in this period; narrow the range for the full ledger."
          : ""}
      </p>

      <section>
        <h2 className={sectionTitleClass}>Stock movement summary</h2>
        <table className="mt-1.5 w-full border-collapse">
          <thead>
            <tr>
              <th className={thClass}>Direction</th>
              <th className={`${thClass} text-right`}>Quantity</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className={tdClass}>Stock in</td>
              <td className={`${tdClass} text-right`}>{report.totals.inQty}</td>
            </tr>
            <tr>
              <td className={tdClass}>Stock out</td>
              <td className={`${tdClass} text-right`}>{report.totals.outQty}</td>
            </tr>
            <tr>
              <td className={`${tdClass} font-bold`}>Net change</td>
              <td className={`${tdClass} text-right font-bold`}>
                {report.totals.netQty}
              </td>
            </tr>
          </tbody>
        </table>
      </section>

      {report.totals.movements > 0 && (
        <section>
          <h2 className={sectionTitleClass}>Movements by reason</h2>
          <table className="mt-1.5 w-full border-collapse">
            <thead>
              <tr>
                <th className={thClass}>Reason</th>
                <th className={`${thClass} text-right`}>In</th>
                <th className={`${thClass} text-right`}>Out</th>
                <th className={`${thClass} text-right`}>Movements</th>
              </tr>
            </thead>
            <tbody>
              {report.byReason
                .filter((row) => row.count > 0)
                .map((row) => (
                  <tr key={row.reason}>
                    <td className={tdClass}>{row.label}</td>
                    <td className={`${tdClass} text-right`}>{row.inQty}</td>
                    <td className={`${tdClass} text-right`}>{row.outQty}</td>
                    <td className={`${tdClass} text-right`}>{row.count}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </section>
      )}

      <section>
        <h2 className={sectionTitleClass}>Stock by category</h2>
        {report.byCategory.length === 0 ? (
          <p className="m-0 mt-1.5 text-[11px] text-[#8e959b]">
            No stock is recorded for this branch.
          </p>
        ) : (
          <table className="mt-1.5 w-full border-collapse">
            <thead>
              <tr>
                <th className={thClass}>Category</th>
                <th className={`${thClass} text-right`}>In</th>
                <th className={`${thClass} text-right`}>Out</th>
                <th className={`${thClass} text-right`}>Stock value</th>
              </tr>
            </thead>
            <tbody>
              {report.byCategory.map((row) => (
                <tr key={row.category}>
                  <td className={tdClass}>{row.category}</td>
                  <td className={`${tdClass} text-right`}>{row.inQty}</td>
                  <td className={`${tdClass} text-right`}>{row.outQty}</td>
                  <td className={`${tdClass} text-right`}>
                    {formatPeso(row.value)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section>
        <h2 className={sectionTitleClass}>Stock by branch</h2>
        <table className="mt-1.5 w-full border-collapse">
          <thead>
            <tr>
              <th className={thClass}>Branch</th>
              <th className={`${thClass} text-right`}>Units on hand</th>
              <th className={`${thClass} text-right`}>Stock value</th>
              <th className={`${thClass} text-right`}>Movements</th>
            </tr>
          </thead>
          <tbody>
            {report.byBranch.map((row) => (
              <tr key={row.branch}>
                <td className={tdClass}>{row.branch}</td>
                <td className={`${tdClass} text-right`}>{row.unitsOnHand}</td>
                <td className={`${tdClass} text-right`}>
                  {formatPeso(row.value)}
                </td>
                <td className={`${tdClass} text-right`}>{row.movements}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section>
        <h2 className={sectionTitleClass}>
          Low stock ({report.totals.lowStock})
        </h2>
        {report.lowStockRows.length === 0 ? (
          <p className="m-0 mt-1.5 text-[11px] text-[#8e959b]">
            Every part is above its reorder point.
          </p>
        ) : (
          <table className="mt-1.5 w-full border-collapse">
            <thead>
              <tr>
                <th className={thClass}>Part</th>
                <th className={thClass}>SKU</th>
                <th className={thClass}>Branch</th>
                <th className={`${thClass} text-right`}>On hand</th>
                <th className={`${thClass} text-right`}>Reorder point</th>
              </tr>
            </thead>
            <tbody>
              {report.lowStockRows.map((row) => (
                <tr key={`${row.branch}-${row.sku}`}>
                  <td className={tdClass}>{row.name}</td>
                  <td className={`${tdClass} whitespace-nowrap`}>{row.sku}</td>
                  <td className={tdClass}>{row.branch}</td>
                  <td className={`${tdClass} text-right`}>{row.quantity}</td>
                  <td className={`${tdClass} text-right`}>
                    {row.reorderThreshold}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section>
        <h2 className={sectionTitleClass}>Movement ledger</h2>
        {report.rows.length === 0 ? (
          <p className="m-0 mt-1.5 text-[11px] text-[#8e959b]">
            No stock movements were recorded in this period.
          </p>
        ) : (
          <table className="mt-1.5 w-full border-collapse">
            <thead>
              <tr>
                <th className={thClass}>Date</th>
                <th className={thClass}>Part</th>
                <th className={thClass}>SKU</th>
                <th className={thClass}>Branch</th>
                <th className={thClass}>Dir.</th>
                <th className={`${thClass} text-right`}>Qty</th>
                <th className={thClass}>Reason</th>
                <th className={thClass}>Work order</th>
                <th className={thClass}>Recorded by</th>
              </tr>
            </thead>
            <tbody>
              {report.rows.map((row) => (
                <tr key={row.id}>
                  <td className={`${tdClass} whitespace-nowrap`}>
                    {formatMovementDate(row.date)}
                  </td>
                  <td className={tdClass}>{row.name}</td>
                  <td className={`${tdClass} whitespace-nowrap`}>{row.sku}</td>
                  <td className={tdClass}>{row.branch}</td>
                  <td className={tdClass}>
                    {row.direction === "in" ? "In" : "Out"}
                  </td>
                  <td className={`${tdClass} text-right`}>{row.quantity}</td>
                  <td className={tdClass}>
                    {movementReasonLabel(row.reason)}
                  </td>
                  <td className={`${tdClass} whitespace-nowrap`}>
                    {row.jobNumber || "—"}
                  </td>
                  <td className={tdClass}>{row.performedBy || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
