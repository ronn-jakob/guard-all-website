import { isScheduleNearToday } from "./inventoryUtils.js";

export default function PendingJobRequestsTab({
  pendingJobRequests,
  pendingRequestsError,
  isLoadingPendingRequests,
  onSelectJob,
}) {
  return (
    <div className="p-7">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="m-0 text-[10px] font-bold uppercase tracking-[.12em] text-[#777e85]">
            AWAITING STOCK ALLOCATION
          </p>
          <h2 className="m-0 mt-1 text-[21px] font-bold text-[#063b7c]">
            Pending Job Requests
          </h2>
        </div>
        <span className="rounded-full border border-[#ffb0a3] bg-[#fff3f1] px-3 py-1 text-[11px] font-bold text-[#f05b48]">
          {pendingJobRequests.length} awaiting allocation
        </span>
      </div>

      {pendingRequestsError && (
        <p className="mb-3 rounded-[6px] border border-[#f1b7af] bg-[#fff3f1] px-4 py-3 text-[12px] text-[#a83a2c]" role="alert">
          {pendingRequestsError}
        </p>
      )}

      <div className="overflow-hidden rounded-[8px] border border-[#dfe6ec]">
        <div className="grid grid-cols-[1.2fr_2fr_1.5fr_1fr_1.2fr_120px] bg-[#fafafa] px-6 py-3 text-[10px] font-bold uppercase text-[#77818a] max-[850px]:grid-cols-[1.2fr_2fr_1.5fr_120px] max-[850px]:[&>span:nth-child(4)]:hidden max-[850px]:[&>span:nth-child(5)]:hidden max-[620px]:grid-cols-[1fr_1fr_100px] max-[620px]:[&>span:nth-child(2)]:hidden">
          <span>Job</span>
          <span>Client Location</span>
          <span>Scheduled</span>
          <span>Branch</span>
          <span>Technician</span>
          <span className="text-right">Action</span>
        </div>

        {isLoadingPendingRequests ? (
          <p className="m-0 px-6 py-8 text-center text-[12px] text-[#8e959b]">
            Loading pending job requests...
          </p>
        ) : pendingJobRequests.length === 0 ? (
          <p className="m-0 px-6 py-8 text-center text-[12px] text-[#8e959b]">
            No confirmed jobs are waiting for stock allocation.
          </p>
        ) : (
          pendingJobRequests.map((req) => (
            <div
              key={req.jobNumber}
              className="grid grid-cols-[1.2fr_2fr_1.5fr_1fr_1.2fr_120px] items-center border-t border-[#e4e8eb] px-6 py-4 text-[11px] max-[850px]:grid-cols-[1.2fr_2fr_1.5fr_120px] max-[850px]:[&>*:nth-child(4)]:hidden max-[850px]:[&>*:nth-child(5)]:hidden max-[620px]:grid-cols-[1fr_1fr_100px] max-[620px]:[&>*:nth-child(2)]:hidden"
            >
              <div>
                <strong className="block text-[#063b7c]">
                  {req.jobNumber}
                </strong>
                <span className="text-[10px] text-[#8d969e]">
                  Pending
                </span>
              </div>
              <span className="text-[#3a434d]">{req.location}</span>
              <span className="text-[#3a434d]">
                <span
                  className={
                    isScheduleNearToday(req.scheduledDate)
                      ? "font-semibold text-red-600"
                      : ""
                  }
                >
                  {req.scheduledDate} · {req.scheduledTime}
                </span>
              </span>
              <strong className="text-[#3a434d]">
                {req.branch.replace(/^./, (letter) => letter.toUpperCase())}
              </strong>
              <span className="text-[#3a434d]">
                {req.technicianName}
              </span>
              <div className="text-right">
                <button
                  type="button"
                  onClick={() => onSelectJob(req)}
                  className="rounded-[6px] border border-[#1250a0] bg-white px-3 py-1.5 text-[11px] font-bold text-[#1250a0] hover:bg-[#f3f8ff]"
                >
                  Select items
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
