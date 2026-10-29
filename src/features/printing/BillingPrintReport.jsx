import { useEffect, useMemo, useState } from "react";
import { listInvoices } from "../../lib/api/billing.js";
import { buildBillingReport } from "../../lib/billingReport.js";
import {
  formatDate,
  formatPeso,
  methodLabels,
  statusLabels,
} from "../billing/billingFormatters.js";
import {
  printSectionTitleClass as sectionTitleClass,
  printTableCellClass as tdClass,
  printTableHeadClass as thClass,
} from "./printStyles.js";

export default function BillingPrintReport({ period }) {
  const [invoices, setInvoices] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

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
    return () => {
      isCurrent = false;
    };
  }, []);

  const report = useMemo(
    () => buildBillingReport(invoices, period),
    [invoices, period],
  );

  if (isLoading) {
    return (
      <p className="m-0 py-10 text-center text-[12px] text-[#8e959b]">
        Loading invoices…
      </p>
    );
  }

  if (loadError) {
    return (
      <p
        className="m-0 rounded-[6px] border border-[#f1b7af] bg-[#fff3f1] px-3 py-2 text-[11px] text-[#a83a2c]"
        role="alert"
      >
        Invoices could not be loaded: {loadError}
      </p>
    );
  }

  const summaryCells = [
    ["Invoices issued", String(report.totals.count)],
    ["Invoiced", formatPeso(report.totals.invoiced)],
    ["Collected", formatPeso(report.totals.collected)],
    ["Outstanding", formatPeso(report.totals.outstanding)],
  ];

  return (
    <div className="space-y-5">
      <section>
        <div className="grid grid-cols-4 gap-2 max-[620px]:grid-cols-2">
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
        </div>
        <p className="m-0 mt-2 text-[9px] leading-relaxed text-[#8a9299]">
          Collected counts payments received against the invoices issued in this
          period, matching the Sales &amp; Billing screen. The payments table
          below lists money received during the period itself, so the two totals
          can differ when a payment settles an earlier invoice.
        </p>
      </section>

      <section>
        <h2 className={sectionTitleClass}>Status breakdown</h2>
        <table className="mt-1.5 w-full border-collapse">
          <thead>
            <tr>
              <th className={thClass}>Status</th>
              <th className={`${thClass} text-right`}>Invoices</th>
              <th className={`${thClass} text-right`}>Billed</th>
            </tr>
          </thead>
          <tbody>
            {report.statusSplit.map((row) => (
              <tr key={row.status}>
                <td className={tdClass}>{statusLabels[row.status]}</td>
                <td className={`${tdClass} text-right`}>{row.count}</td>
                <td className={`${tdClass} text-right`}>
                  {formatPeso(row.amount)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section>
        <h2 className={sectionTitleClass}>Invoices issued</h2>
        {report.invoices.length === 0 ? (
          <p className="m-0 mt-1.5 text-[11px] text-[#8e959b]">
            No invoices were issued in this period.
          </p>
        ) : (
          <table className="mt-1.5 w-full border-collapse">
            <thead>
              <tr>
                <th className={thClass}>Invoice</th>
                <th className={thClass}>Issued</th>
                <th className={thClass}>Job</th>
                <th className={thClass}>Client</th>
                <th className={thClass}>Report</th>
                <th className={`${thClass} text-right`}>Total</th>
                <th className={`${thClass} text-right`}>Paid</th>
                <th className={`${thClass} text-right`}>Balance</th>
                <th className={thClass}>Status</th>
              </tr>
            </thead>
            <tbody>
              {report.invoices.map((invoice) => (
                <tr key={invoice.id}>
                  <td className={`${tdClass} whitespace-nowrap font-semibold`}>
                    {invoice.invoiceNumber}
                  </td>
                  <td className={`${tdClass} whitespace-nowrap`}>
                    {formatDate(invoice.issueDate)}
                  </td>
                  <td className={`${tdClass} whitespace-nowrap`}>
                    {invoice.jobNumber || "—"}
                  </td>
                  <td className={tdClass}>{invoice.clientName}</td>
                  <td className={`${tdClass} whitespace-nowrap`}>
                    {invoice.reportNumber || "—"}
                  </td>
                  <td className={`${tdClass} whitespace-nowrap text-right`}>
                    {formatPeso(invoice.totalAmount)}
                  </td>
                  <td className={`${tdClass} whitespace-nowrap text-right`}>
                    {formatPeso(invoice.paidAmount)}
                  </td>
                  <td className={`${tdClass} whitespace-nowrap text-right`}>
                    {formatPeso(invoice.balance)}
                  </td>
                  <td className={`${tdClass} whitespace-nowrap`}>
                    {statusLabels[invoice.status] ?? invoice.status}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section>
        <h2 className={sectionTitleClass}>Payments received in this period</h2>
        {report.payments.length === 0 ? (
          <p className="m-0 mt-1.5 text-[11px] text-[#8e959b]">
            No payments were recorded in this period.
          </p>
        ) : (
          <table className="mt-1.5 w-full border-collapse">
            <thead>
              <tr>
                <th className={thClass}>Date</th>
                <th className={thClass}>Invoice</th>
                <th className={thClass}>Client</th>
                <th className={thClass}>Method</th>
                <th className={`${thClass} text-right`}>Amount</th>
              </tr>
            </thead>
            <tbody>
              {report.payments.map((payment, index) => (
                <tr key={`${payment.date}-${payment.invoiceNumber}-${index}`}>
                  <td className={`${tdClass} whitespace-nowrap`}>
                    {formatDate(payment.date)}
                  </td>
                  <td className={`${tdClass} whitespace-nowrap font-semibold`}>
                    {payment.invoiceNumber}
                  </td>
                  <td className={tdClass}>{payment.clientName}</td>
                  <td className={tdClass}>
                    {methodLabels[payment.method] ?? payment.method}
                  </td>
                  <td className={`${tdClass} whitespace-nowrap text-right`}>
                    {formatPeso(payment.amount)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td className={tdClass} colSpan={4}>
                  <strong>Total received</strong>
                </td>
                <td className={`${tdClass} whitespace-nowrap text-right font-bold`}>
                  {formatPeso(report.paymentsTotal)}
                </td>
              </tr>
            </tfoot>
          </table>
        )}
      </section>
    </div>
  );
}
