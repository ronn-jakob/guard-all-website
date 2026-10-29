import Sidebar from "./Sidebar.jsx";
import TopBar from "./TopBar.jsx";
import { Link } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import { listFieldReports, reviewFieldReport } from "../lib/api/reports.js";
import { currentPeriodValue } from "../lib/reportPeriods.js";
import ReportStatsCards from "../features/reports/ReportStatsCards.jsx";
import IncomingReportsQueue from "../features/reports/IncomingReportsQueue.jsx";
import ReportReviewDetail from "../features/reports/ReportReviewDetail.jsx";
import ReportImagePreviewDialog from "../features/reports/ReportImagePreviewDialog.jsx";
import ReportFullDetailsDialog from "../features/reports/ReportFullDetailsDialog.jsx";
import {
  buildQueueRows,
  filterReportsByQueue,
  queueFilterLabelFor,
} from "../features/reports/reportsQueue.js";

function ReportsOverview() {
  const [reports, setReports] = useState([]);
  const [selectedReportId, setSelectedReportId] = useState(null);
  const [isFullDetailsOpen, setIsFullDetailsOpen] = useState(false);
  const [previewImageIndex, setPreviewImageIndex] = useState(null);
  const [isReviewing, setIsReviewing] = useState(false);
  const [reviewError, setReviewError] = useState("");
  const [reviewMessage, setReviewMessage] = useState("");
  const [queueFilter, setQueueFilter] = useState("all");
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const filterRef = useRef(null);

  useEffect(() => {
    let isMounted = true;

    listFieldReports()
      .then(({ reports: incomingReports = [] }) => {
        if (!isMounted) return;
        const nextReports = Array.isArray(incomingReports)
          ? incomingReports
          : [];
        setReports(nextReports);
        setSelectedReportId(nextReports[0]?.id ?? null);
      })
      .catch(() => {
        if (isMounted) {
          setReports([]);
          setSelectedReportId(null);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    function handleClickOutside(event) {
      if (filterRef.current && !filterRef.current.contains(event.target)) {
        setIsFilterOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Reload the queue without discarding the current selection.
  async function refreshReports() {
    const { reports: incomingReports = [] } = await listFieldReports();
    setReports(Array.isArray(incomingReports) ? incomingReports : []);
  }

  async function handleReviewReport(decision) {
    if (!selectedReport?.reportUuid) return;
    setReviewError("");
    setReviewMessage("");
    setIsReviewing(true);
    try {
      const result = await reviewFieldReport({
        reportId: selectedReport.reportUuid,
        decision,
      });
      await refreshReports();
      setReviewMessage(result.message);
    } catch (error) {
      setReviewError(error.message);
    } finally {
      setIsReviewing(false);
    }
  }

  const filteredQueue = filterReportsByQueue(reports, queueFilter);
  const queueFilterLabel = queueFilterLabelFor(queueFilter);
  const openCount = reports.filter((report) => !report.invoice).length;
  const queueRows = buildQueueRows(reports, filteredQueue);

  // Keep the open report inside the filtered set, so the detail pane can never
  // show something that the list is currently hiding.
  const selectedReport =
    filteredQueue.find((report) => report.id === selectedReportId) ||
    filteredQueue[0] ||
    null;

  function applyQueueFilter(nextFilter) {
    setQueueFilter(nextFilter);
    setIsFilterOpen(false);
    const nextQueue = filterReportsByQueue(reports, nextFilter);
    if (!nextQueue.some((report) => report.id === selectedReportId)) {
      setSelectedReportId(nextQueue[0]?.id ?? null);
    }
  }

  return (
    <main className="flex h-screen overflow-hidden bg-[#1f2022] font-sans text-[#063b7c] max-[1024px]:block">
      <Sidebar />
      <section className="h-screen w-full min-w-0 flex-1 overflow-y-auto bg-[#edf7ff] max-[1024px]:h-[100dvh]">
        <TopBar />
        <div className="px-8 pb-6 pt-7 max-[1024px]:px-6 max-[1024px]:pb-20 max-[1024px]:pt-5 max-[620px]:px-3">
          <header className="mb-5 flex items-end justify-between max-[620px]:items-start max-[620px]:gap-3">
            <div>
              <p className="mb-1 text-[12px] font-bold uppercase tracking-[.12em] text-[#818b94]">
                Operations / Field reporting
              </p>
              <h1 className="m-0 text-[30px] font-bold tracking-[-.5px] max-[1280px]:text-[26px] max-[620px]:text-[22px]">
                Field Reports
              </h1>
              <p className="mb-0 mt-1 text-[14px] text-[#8b949c]">
                A concise manager review on what happened on site.
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2">
              <Link
                className="inline-flex items-center gap-2 rounded-[6px] border border-[#1250a0] bg-white px-4 py-3 text-[14px] font-bold text-[#1250a0] no-underline transition-colors hover:bg-[#f3f8ff] max-[620px]:px-3 max-[620px]:py-2 max-[620px]:text-[12px]"
                to={`/print/reports?mode=month&value=${currentPeriodValue("month")}`}
              >
                <span className="material-symbols-outlined text-[19px]">print</span>
                Print report
              </Link>
              <Link
                className="inline-flex items-center gap-2 rounded-[6px] bg-[#1250a0] px-4 py-3 text-[14px] font-bold text-white no-underline shadow-[0_2px_4px_rgb(18_80_160_/_25%)] transition-colors hover:bg-[#0d438a] max-[620px]:px-3 max-[620px]:py-2"
                to="/reports/new"
              >
                <span className="material-symbols-outlined text-[19px]">add</span>
                New Report
              </Link>
            </div>
          </header>

          <ReportStatsCards reports={reports} />

          <div className="grid grid-cols-[380px_minmax(0,1fr)] items-start gap-4 max-[1100px]:grid-cols-[330px_minmax(0,1fr)] max-[850px]:grid-cols-1">
            <IncomingReportsQueue
              reports={reports}
              openCount={openCount}
              filteredQueue={filteredQueue}
              queueRows={queueRows}
              queueFilter={queueFilter}
              queueFilterLabel={queueFilterLabel}
              isFilterOpen={isFilterOpen}
              filterRef={filterRef}
              selectedReportId={selectedReportId}
              onToggleFilter={() => setIsFilterOpen((isOpen) => !isOpen)}
              onApplyFilter={applyQueueFilter}
              onSelectReport={setSelectedReportId}
            />

            {selectedReport ? (
              <ReportReviewDetail
                report={selectedReport}
                isReviewing={isReviewing}
                reviewError={reviewError}
                reviewMessage={reviewMessage}
                onShowAllParts={() => setIsFullDetailsOpen(true)}
                onOpenImage={() => setPreviewImageIndex(0)}
                onReview={handleReviewReport}
              />
            ) : (
              <section className="rounded-[10px] border border-dashed border-[#cbd8e7] bg-white px-5 py-8 text-center text-[14px] text-[#778593]">
                No incoming reports or reserved jobs are available.
              </section>
            )}
          </div>

          <footer className="mt-6 border-t border-[#c9d4de] pt-3 text-[12px] text-[#8a9299] max-[1024px]:hidden">
            Guard-All Electronic Security Systems, Inc.
          </footer>
        </div>
      </section>

      <ReportImagePreviewDialog
        images={selectedReport?.images}
        index={previewImageIndex}
        onClose={() => setPreviewImageIndex(null)}
        onPrevious={() =>
          setPreviewImageIndex((index) => Math.max(0, (index ?? 0) - 1))
        }
        onNext={() =>
          setPreviewImageIndex((index) =>
            Math.min((selectedReport?.images?.length ?? 1) - 1, (index ?? 0) + 1),
          )
        }
      />

      {isFullDetailsOpen && (
        <ReportFullDetailsDialog
          report={selectedReport}
          onClose={() => setIsFullDetailsOpen(false)}
        />
      )}
    </main>
  );
}

export default ReportsOverview;
