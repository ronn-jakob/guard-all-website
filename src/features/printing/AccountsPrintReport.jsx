import { useEffect, useMemo, useState } from "react";
import { listUsers } from "../../lib/api/accounts.js";
import { buildAccountsReport } from "../../lib/accountsReport.js";
import {
  printSectionTitleClass as sectionTitleClass,
  printTableCellClass as tdClass,
  printTableHeadClass as thClass,
} from "./printStyles.js";

export default function AccountsPrintReport() {
  const [accounts, setAccounts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    let isCurrent = true;
    listUsers()
      .then(({ accounts: incoming }) => {
        if (!isCurrent) return;
        setAccounts(Array.isArray(incoming) ? incoming : []);
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

  const report = useMemo(() => buildAccountsReport(accounts), [accounts]);

  if (isLoading) {
    return (
      <p className="m-0 py-10 text-center text-[12px] text-[#8e959b]">
        Loading accounts…
      </p>
    );
  }

  if (loadError) {
    return (
      <p
        className="m-0 rounded-[6px] border border-[#f1b7af] bg-[#fff3f1] px-3 py-2 text-[11px] text-[#a83a2c]"
        role="alert"
      >
        Accounts could not be loaded: {loadError}
      </p>
    );
  }

  const summaryCells = [
    ["Active accounts", String(report.totals.accounts)],
    ["Roles", String(report.totals.roles)],
    ["Branches", String(report.totals.branches)],
  ];

  return (
    <div className="space-y-5">
      <section className="grid grid-cols-3 gap-2 max-[620px]:grid-cols-2">
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
        Active accounts as at generation. Deactivated accounts are kept out of
        the directory until they are reactivated.
      </p>

      <section>
        <h2 className={sectionTitleClass}>Accounts by role</h2>
        <table className="mt-1.5 w-full border-collapse">
          <thead>
            <tr>
              <th className={thClass}>Role</th>
              <th className={`${thClass} text-right`}>Accounts</th>
            </tr>
          </thead>
          <tbody>
            {report.byRole.map((row) => (
              <tr key={row.role}>
                <td className={tdClass}>{row.role}</td>
                <td className={`${tdClass} text-right`}>{row.count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section>
        <h2 className={sectionTitleClass}>Accounts by branch</h2>
        <table className="mt-1.5 w-full border-collapse">
          <thead>
            <tr>
              <th className={thClass}>Branch</th>
              <th className={`${thClass} text-right`}>Accounts</th>
            </tr>
          </thead>
          <tbody>
            {report.byBranch.map((row) => (
              <tr key={row.branch}>
                <td className={tdClass}>{row.branch}</td>
                <td className={`${tdClass} text-right`}>{row.count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section>
        <h2 className={sectionTitleClass}>Directory</h2>
        {report.rows.length === 0 ? (
          <p className="m-0 mt-1.5 text-[11px] text-[#8e959b]">
            No active accounts were found.
          </p>
        ) : (
          <table className="mt-1.5 w-full border-collapse">
            <thead>
              <tr>
                <th className={thClass}>Name</th>
                <th className={thClass}>Email</th>
                <th className={thClass}>Role</th>
                <th className={thClass}>Branch</th>
                <th className={thClass}>Status</th>
                <th className={thClass}>Created</th>
              </tr>
            </thead>
            <tbody>
              {report.rows.map((row) => (
                <tr key={row.id}>
                  <td className={`${tdClass} font-semibold`}>{row.name}</td>
                  <td className={tdClass}>{row.email}</td>
                  <td className={tdClass}>{row.role || "—"}</td>
                  <td className={tdClass}>
                    {row.branch
                      ? String(row.branch).replace(/^./, (letter) =>
                          letter.toUpperCase(),
                        )
                      : "—"}
                  </td>
                  <td className={tdClass}>{row.status}</td>
                  <td className={`${tdClass} whitespace-nowrap`}>
                    {row.createdAt}
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
