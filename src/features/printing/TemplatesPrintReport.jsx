import { useEffect, useMemo, useState } from "react";
import { listJobTemplates } from "../../lib/api/templates.js";
import { buildTemplatesReport } from "../../lib/templatesReport.js";
import { formatPeso } from "../billing/billingFormatters.js";
import {
  printSectionTitleClass as sectionTitleClass,
  printTableCellClass as tdClass,
  printTableHeadClass as thClass,
} from "./printStyles.js";

export default function TemplatesPrintReport() {
  const [templates, setTemplates] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    let isCurrent = true;
    listJobTemplates()
      .then(({ templates: incoming }) => {
        if (!isCurrent) return;
        setTemplates(Array.isArray(incoming) ? incoming : []);
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

  const report = useMemo(() => buildTemplatesReport(templates), [templates]);

  if (isLoading) {
    return (
      <p className="m-0 py-10 text-center text-[12px] text-[#8e959b]">
        Loading job templates…
      </p>
    );
  }

  if (loadError) {
    return (
      <p
        className="m-0 rounded-[6px] border border-[#f1b7af] bg-[#fff3f1] px-3 py-2 text-[11px] text-[#a83a2c]"
        role="alert"
      >
        Job templates could not be loaded: {loadError}
      </p>
    );
  }

  const summaryCells = [
    ["Templates", String(report.totals.templates)],
    ["Active", String(report.totals.active)],
    ["All branches", String(report.totals.shared)],
    ["Priced lines", String(report.totals.lines)],
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
        Client-facing prices as at generation. Template markup and base costs
        are deliberately not printed.
      </p>

      <section>
        <h2 className={sectionTitleClass}>Templates by service</h2>
        {report.byJobType.length === 0 ? (
          <p className="m-0 mt-1.5 text-[11px] text-[#8e959b]">
            No job templates have been created.
          </p>
        ) : (
          <table className="mt-1.5 w-full border-collapse">
            <thead>
              <tr>
                <th className={thClass}>Service</th>
                <th className={`${thClass} text-right`}>Templates</th>
              </tr>
            </thead>
            <tbody>
              {report.byJobType.map((row) => (
                <tr key={row.jobType}>
                  <td className={tdClass}>{row.jobType}</td>
                  <td className={`${tdClass} text-right`}>{row.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section>
        <h2 className={sectionTitleClass}>Price list</h2>
        {report.rows.length === 0 ? (
          <p className="m-0 mt-1.5 text-[11px] text-[#8e959b]">
            No job templates have been created.
          </p>
        ) : (
          <table className="mt-1.5 w-full border-collapse">
            <thead>
              <tr>
                <th className={thClass}>Description</th>
                <th className={`${thClass} text-right`}>Qty</th>
                <th className={`${thClass} text-right`}>Unit price</th>
                <th className={`${thClass} text-right`}>Line total</th>
              </tr>
            </thead>
            {report.rows.map((template) => {
              const items = Array.isArray(template.items) ? template.items : [];
              return (
                <tbody key={template.id} className="break-inside-avoid">
                  <tr className="bg-[#eef4ff]">
                    <td className={`${tdClass} font-bold`} colSpan={3}>
                      {template.name}
                      <span className="ml-2 font-normal text-[#5b6b7b]">
                        {template.jobTypeLabel} · {template.branchLabel}
                        {template.isActive ? "" : " · inactive"}
                      </span>
                    </td>
                    <td className={`${tdClass} whitespace-nowrap text-right font-bold`}>
                      {formatPeso(template.clientTotal)}
                    </td>
                  </tr>
                  {items.length === 0 ? (
                    <tr>
                      <td className={`${tdClass} text-[#8e959b]`} colSpan={4}>
                        No priced lines.
                      </td>
                    </tr>
                  ) : (
                    items.map((item) => (
                      <tr key={item.id}>
                        <td className={tdClass}>{item.description}</td>
                        <td className={`${tdClass} text-right`}>
                          {item.quantity}
                        </td>
                        <td className={`${tdClass} text-right`}>
                          {formatPeso(item.unitPriceClient)}
                        </td>
                        <td className={`${tdClass} text-right`}>
                          {formatPeso(item.lineTotalClient)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              );
            })}
          </table>
        )}
      </section>
    </div>
  );
}
