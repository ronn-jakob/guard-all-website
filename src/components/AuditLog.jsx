import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import Sidebar from "./Sidebar.jsx";
import TopBar from "./TopBar.jsx";
import { listAuditLog } from "../lib/api/audit.js";
import {
  AUDITED_TABLES,
  actionLabel,
  buildAuditRequest,
  describeEntry,
  fieldLabel,
  formatAuditTime,
  formatAuditValue,
  tableLabel,
} from "../lib/audit.js";

const PAGE_SIZE = 30;

const emptyFilters = {
  table: "",
  action: "",
  actorId: "",
  recordId: "",
  from: "",
  to: "",
  search: "",
};

const actionTone = {
  insert: {
    icon: "add_circle",
    chip: "border-[#b9e3c4] bg-[#effaf2] text-[#267340]",
    dot: "bg-[#3ba55d]",
  },
  update: {
    icon: "edit_note",
    chip: "border-[#c3d8f5] bg-[#eef4ff] text-[#174f9a]",
    dot: "bg-[#174f9a]",
  },
  delete: {
    icon: "delete",
    chip: "border-[#f0b8b0] bg-[#fff3f1] text-[#a83a2c]",
    dot: "bg-[#d85b45]",
  },
};

function AuditLog() {
  const [params] = useSearchParams();
  const [filters, setFilters] = useState(() => ({
    ...emptyFilters,
    table: params.get("table") || "",
    recordId: params.get("record") || "",
  }));
  const [searchInput, setSearchInput] = useState("");
  const [offset, setOffset] = useState(0);
  const [entries, setEntries] = useState([]);
  const [total, setTotal] = useState(0);
  const [actors, setActors] = useState([]);
  const [stats, setStats] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState(null);

  // Typing in the search box waits for a pause before it becomes a filter, so a
  // six-letter word does not fire six queries.
  useEffect(() => {
    const timer = setTimeout(() => {
      setFilters((current) =>
        current.search === searchInput ? current : { ...current, search: searchInput },
      );
      setOffset(0);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    let isCurrent = true;
    // A filter or page change is a new request; this flag is what the list
    // renders while it is in flight.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsLoading(true);
    listAuditLog(buildAuditRequest(filters, { offset, limit: PAGE_SIZE }))
      .then((data) => {
        if (!isCurrent) return;
        const incoming = Array.isArray(data.entries) ? data.entries : [];
        setEntries((current) => (offset === 0 ? incoming : [...current, ...incoming]));
        setTotal(Number(data.total) || 0);
        setError("");
        if (Array.isArray(data.actors) && data.actors.length) setActors(data.actors);
        if (data.stats) setStats(data.stats);
      })
      .catch((requestError) => {
        if (isCurrent) setError(requestError.message);
      })
      .finally(() => {
        if (isCurrent) setIsLoading(false);
      });
    return () => {
      isCurrent = false;
    };
  }, [filters, offset]);

  function updateFilter(key, value) {
    setError("");
    setFilters((current) => ({ ...current, [key]: value }));
    setOffset(0);
  }

  function clearFilters() {
    setSearchInput("");
    setError("");
    setFilters({ ...emptyFilters });
    setOffset(0);
  }

  function loadMore() {
    setError("");
    setOffset((current) => current + PAGE_SIZE);
  }

  const hasFilters = useMemo(
    () =>
      Object.entries(filters).some(
        ([key, value]) => key !== "recordId" && String(value).trim() !== "",
      ) || Boolean(filters.recordId),
    [filters],
  );

  const firstShown = total === 0 ? 0 : offset + 1;
  const lastShown = Math.min(offset + entries.length, total);

  const cards = [
    {
      label: "Matching events",
      value: total.toLocaleString("en-US"),
      note: hasFilters ? "With the current filters" : "Everything recorded",
      icon: "history",
    },
    {
      label: "Last 24 hours",
      value: stats ? stats.today.toLocaleString("en-US") : "—",
      note: "System activity today",
      icon: "bolt",
    },
    {
      label: "Last 7 days",
      value: stats ? stats.week.toLocaleString("en-US") : "—",
      note: "Rolling week",
      icon: "date_range",
    },
  ];

  return (
    <main className="flex h-screen overflow-hidden bg-[#1f2022] font-sans text-[#063b7c] max-[1024px]:block">
      <Sidebar />
      <section className="h-screen w-full min-w-0 flex-1 overflow-y-auto bg-[#edf7ff] max-[1024px]:h-[100dvh]">
        <TopBar />

        <div className="px-8 pb-8 pt-8 max-[1024px]:px-6 max-[1024px]:pb-20 max-[1024px]:pt-5 max-[620px]:px-3">
          <header className="mb-6 max-[620px]:mb-4">
            <p className="mb-1 text-[10px] font-bold uppercase tracking-[.12em] text-[#818b94] max-[620px]:text-[7px]">
              Operations / Administration
            </p>
            <h1 className="m-0 text-[30px] font-bold tracking-[-.5px] max-[1024px]:text-[24px] max-[620px]:text-[19px]">
              Audit log
            </h1>
            <p className="mb-0 mt-2 text-[14px] text-[#8b949c] max-[620px]:mt-1 max-[620px]:text-[9px]">
              Every recorded change, who made it, and exactly which fields moved.
            </p>
          </header>

          <section className="mb-5 max-w-[1180px] rounded-[10px] border border-[#dfe6ec] bg-white p-4 shadow-[0_3px_8px_rgb(31_59_82_/_10%)] max-[620px]:p-3">
            <div className="grid grid-cols-[1fr_1fr_1fr_150px_150px] gap-2 max-[1200px]:grid-cols-3 max-[620px]:grid-cols-2">
              <label className="flex flex-col text-[10px] font-bold uppercase tracking-[.08em] text-[#818b94]">
                Table
                <select
                  value={filters.table}
                  onChange={(event) => updateFilter("table", event.target.value)}
                  className="mt-1 h-9 rounded-[6px] border border-[#d9dfe4] bg-white px-2 text-[12px] font-normal normal-case tracking-normal text-[#273746] outline-none focus:border-[#1250a0]"
                >
                  <option value="">All tables</option>
                  {AUDITED_TABLES.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.plural}
                    </option>
                  ))}
                </select>
              </label>

              <label className="flex flex-col text-[10px] font-bold uppercase tracking-[.08em] text-[#818b94]">
                Action
                <select
                  value={filters.action}
                  onChange={(event) => updateFilter("action", event.target.value)}
                  className="mt-1 h-9 rounded-[6px] border border-[#d9dfe4] bg-white px-2 text-[12px] font-normal normal-case tracking-normal text-[#273746] outline-none focus:border-[#1250a0]"
                >
                  <option value="">All actions</option>
                  <option value="insert">Created</option>
                  <option value="update">Updated</option>
                  <option value="delete">Deleted</option>
                </select>
              </label>

              <label className="flex flex-col text-[10px] font-bold uppercase tracking-[.08em] text-[#818b94]">
                Actor
                <select
                  value={filters.actorId}
                  onChange={(event) => updateFilter("actorId", event.target.value)}
                  className="mt-1 h-9 rounded-[6px] border border-[#d9dfe4] bg-white px-2 text-[12px] font-normal normal-case tracking-normal text-[#273746] outline-none focus:border-[#1250a0]"
                >
                  <option value="">Anyone</option>
                  {actors.map((actor) => (
                    <option key={actor.id} value={actor.id}>
                      {actor.name || actor.email}
                      {actor.active ? "" : " (inactive)"}
                    </option>
                  ))}
                </select>
              </label>

              <label className="flex flex-col text-[10px] font-bold uppercase tracking-[.08em] text-[#818b94]">
                From
                <input
                  type="date"
                  value={filters.from}
                  onChange={(event) => updateFilter("from", event.target.value)}
                  className="mt-1 h-9 rounded-[6px] border border-[#d9dfe4] bg-white px-2 text-[12px] font-normal normal-case tracking-normal text-[#273746] outline-none focus:border-[#1250a0]"
                />
              </label>

              <label className="flex flex-col text-[10px] font-bold uppercase tracking-[.08em] text-[#818b94]">
                To
                <input
                  type="date"
                  value={filters.to}
                  onChange={(event) => updateFilter("to", event.target.value)}
                  className="mt-1 h-9 rounded-[6px] border border-[#d9dfe4] bg-white px-2 text-[12px] font-normal normal-case tracking-normal text-[#273746] outline-none focus:border-[#1250a0]"
                />
              </label>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <input
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder="Search table name, or paste a record id"
                className="h-9 min-w-[240px] flex-1 rounded-[6px] border border-[#d9dfe4] bg-[#fbfdff] px-3 text-[12px] text-[#273746] outline-none focus:border-[#1250a0] max-[620px]:min-w-0"
              />
              {filters.recordId && (
                <span className="inline-flex items-center gap-1 rounded-full border border-[#c3d8f5] bg-[#eef4ff] px-3 py-1 text-[10px] font-bold text-[#174f9a]">
                  One record
                  <button
                    type="button"
                    onClick={() => updateFilter("recordId", "")}
                    className="border-0 bg-transparent p-0 text-[#174f9a] hover:text-[#a83a2c]"
                    aria-label="Clear record filter"
                  >
                    <span className="material-symbols-outlined text-[13px]">close</span>
                  </button>
                </span>
              )}
              {hasFilters && (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="rounded-[6px] border border-[#d9dfe4] bg-white px-3 py-1.5 text-[10px] font-bold text-[#5e6b78] hover:bg-[#f4f6f8]"
                >
                  Clear filters
                </button>
              )}
            </div>
          </section>

          <section className="mb-5 grid max-w-[1180px] grid-cols-3 gap-[18px] max-[620px]:gap-2">
            {cards.map(({ label, value, note, icon }) => (
              <article
                key={label}
                className="rounded-[10px] border border-[#dfe6ec] bg-white p-5 shadow-[0_3px_8px_rgb(31_59_82_/_10%)] max-[620px]:p-3"
              >
                <div className="grid h-8 w-8 place-items-center rounded-[6px] bg-[#d6e6fb] text-[#1954a0] max-[620px]:hidden">
                  <span className="material-symbols-outlined text-[19px]">{icon}</span>
                </div>
                <p className="mb-0 mt-3 text-[10px] font-bold uppercase tracking-[.08em] text-[#858b90] max-[620px]:mt-0 max-[620px]:text-[7px]">
                  {label}
                </p>
                <strong className="mt-1 block text-[24px] font-extrabold leading-tight max-[620px]:text-[15px]">
                  {value}
                </strong>
                <small className="text-[11px] text-[#8e959b] max-[620px]:hidden">{note}</small>
              </article>
            ))}
          </section>

          <section className="max-w-[1180px] overflow-hidden rounded-[10px] border border-[#dfe6ec] bg-white shadow-[0_3px_8px_rgb(31_59_82_/_10%)]">
            <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e1e6eb] px-6 py-4 max-[620px]:px-3">
              <div>
                <p className="m-0 text-[10px] font-bold uppercase tracking-[.1em] text-[#818b94]">
                  Recorded changes
                </p>
                <h2 className="m-0 mt-1 text-[17px] font-bold max-[620px]:text-[13px]">
                  Activity
                </h2>
              </div>
              <span className="text-[11px] text-[#8b949c]">
                {total === 0 ? "No events" : `Showing ${firstShown}–${lastShown} of ${total}`}
              </span>
            </header>

            {error && (
              <p className="m-0 border-b border-[#f1b7af] bg-[#fff3f1] px-6 py-2 text-[11px] text-[#a83a2c]" role="alert">
                {error}
              </p>
            )}

            {isLoading && offset === 0 ? (
              <div className="py-12 text-center text-[13px] text-[#8e959b]">
                Loading activity...
              </div>
            ) : entries.length === 0 ? (
              <div className="px-6 py-12 text-center text-[13px] text-[#8d969e]">
                <p className="m-0 font-bold text-[#5e6b78]">No events match these filters.</p>
                <p className="m-0 mt-1 text-[12px]">
                  {hasFilters ? "Clear the filters or widen the date range." : "Changes will appear here as they happen."}
                </p>
              </div>
            ) : (
              <div className="divide-y divide-[#e8edf1]">
                {entries.map((entry) => {
                  const tone = actionTone[entry.action] ?? actionTone.update;
                  return (
                    <button
                      key={entry.id}
                      type="button"
                      onClick={() => setSelected(entry)}
                      className="grid w-full grid-cols-[auto_minmax(0,1fr)_minmax(0,180px)_150px_auto] items-center gap-3 border-0 bg-white px-6 py-3 text-left transition-colors hover:bg-[#f8fbff] max-[1024px]:grid-cols-[auto_minmax(0,1fr)_150px_auto] max-[1024px]:[&>*:nth-child(3)]:hidden max-[620px]:grid-cols-[auto_minmax(0,1fr)_auto] max-[620px]:px-3"
                    >
                      <span className={`grid h-8 w-8 place-items-center rounded-full text-white ${tone.dot}`}>
                        <span className="material-symbols-outlined text-[17px]">
                          {tone.icon}
                        </span>
                      </span>

                      <span className="min-w-0">
                        <strong className="block truncate text-[12px] text-[#263747]">
                          {describeEntry(entry)}
                        </strong>
                        <small className="block truncate text-[10px] text-[#8d969e]">
                          {tableLabel(entry.table, { plural: false })}
                          {entry.changes.length > 0
                            ? ` · ${entry.changes.length} ${entry.changes.length === 1 ? "field" : "fields"} changed`
                            : " · no field changes"}
                        </small>
                      </span>

                      <span className="truncate text-[11px] text-[#5d6872]">
                        {entry.actor ? entry.actor.name : "Unattributed"}
                        {entry.actor?.role && (
                          <small className="mt-0.5 block text-[9px] text-[#9aa3aa]">
                            {entry.actor.role}
                          </small>
                        )}
                      </span>

                      <span className="text-right text-[10px] text-[#7f8992]">
                        {formatAuditTime(entry.changedAt)}
                      </span>

                      <span className={`rounded-full border px-2 py-0.5 text-[9px] font-bold ${tone.chip}`}>
                        {actionLabel(entry.action)}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}

            {entries.length < total && (
              <div className="border-t border-[#e8edf1] px-6 py-3 text-center">
                <button
                  type="button"
                  onClick={loadMore}
                  disabled={isLoading}
                  className="rounded-[6px] border border-[#d9dfe4] bg-white px-4 py-2 text-[11px] font-bold text-[#174f9a] hover:bg-[#f4f6f8] disabled:opacity-50"
                >
                  {isLoading ? "Loading..." : "Load more"}
                </button>
              </div>
            )}
          </section>
        </div>
      </section>

      {selected && (
        <div
          className="fixed inset-0 z-50 flex justify-end bg-[#071426]/65 backdrop-blur-[1px]"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setSelected(null);
          }}
        >
          <aside
            role="dialog"
            aria-modal="true"
            aria-label="Audit event detail"
            className="h-full w-full max-w-[560px] overflow-y-auto bg-white p-6 shadow-[-8px_0_30px_rgb(0_0_0_/_30%)] max-[620px]:p-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="m-0 text-[10px] font-bold uppercase tracking-[.12em] text-[#818b94]">
                  {actionLabel(selected.action)} · {tableLabel(selected.table)}
                </p>
                <h2 className="m-0 mt-1 break-words text-[18px] font-bold text-[#063b7c] max-[620px]:text-[15px]">
                  {describeEntry(selected)}
                </h2>
                <p className="m-0 mt-1 break-all text-[10px] text-[#9aa3aa]">
                  {selected.recordId || "No record id"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="grid h-8 w-8 flex-none place-items-center rounded-full border border-[#dfe6ec] bg-white text-[#5e6b78] hover:bg-[#f4f6f8]"
                aria-label="Close"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            <dl className="mt-4 grid grid-cols-2 gap-3 rounded-[8px] border border-[#e1e6eb] bg-[#fbfdff] p-3 text-[11px]">
              <div>
                <dt className="m-0 text-[9px] font-bold uppercase tracking-[.08em] text-[#818b94]">
                  Actor
                </dt>
                <dd className="m-0 mt-1 font-semibold text-[#263747]">
                  {selected.actor ? selected.actor.name : "Unattributed"}
                  {selected.actor?.role && (
                    <span className="block text-[10px] font-normal text-[#8d969e]">
                      {selected.actor.role}
                    </span>
                  )}
                </dd>
              </div>
              <div>
                <dt className="m-0 text-[9px] font-bold uppercase tracking-[.08em] text-[#818b94]">
                  When
                </dt>
                <dd className="m-0 mt-1 font-semibold text-[#263747]">
                  {formatAuditTime(selected.changedAt)}
                </dd>
              </div>
            </dl>

            <h3 className="mb-2 mt-5 text-[12px] font-bold uppercase tracking-[.08em] text-[#5e6b78]">
              Field changes
            </h3>
            {selected.changes.length === 0 ? (
              <p className="m-0 rounded-[6px] border border-[#e1e6eb] bg-[#fbfdff] px-3 py-3 text-[11px] text-[#8d969e]">
                No field-level difference was recorded for this event.
              </p>
            ) : (
              <div className="overflow-hidden rounded-[8px] border border-[#e1e6eb]">
                <div className="grid grid-cols-[1fr_1.2fr_1.2fr] gap-2 bg-[#fafafa] px-3 py-2 text-[9px] font-bold uppercase tracking-[.08em] text-[#77818a]">
                  <span>Field</span>
                  <span>Before</span>
                  <span>After</span>
                </div>
                {selected.changes.map((change) => (
                  <div
                    key={change.field}
                    className="grid grid-cols-[1fr_1.2fr_1.2fr] gap-2 border-t border-[#e8edf1] px-3 py-2 text-[10px]"
                  >
                    <span className="font-semibold text-[#45515c]">
                      {fieldLabel(change.field)}
                    </span>
                    <span className="break-words text-[#8d969e]">
                      {formatAuditValue(change.before)}
                    </span>
                    <span className="break-words text-[#263747]">
                      {formatAuditValue(change.after)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </aside>
        </div>
      )}
    </main>
  );
}

export default AuditLog;
