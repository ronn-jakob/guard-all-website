import Sidebar from "./Sidebar.jsx";
import TopBar from "./TopBar.jsx";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { getSession } from "../lib/auth.js";
import {
  createReportUpload,
  discardReportUpload,
  listFieldReportJobs,
  listFieldReports,
  resubmitFieldReport,
  submitFieldReport,
} from "../lib/api/reports.js";
import { supabase } from "../lib/supabaseClient.js";
import ReportDetailDialog from "../features/reports/ReportDetailDialog.jsx";
import ReportEditDialog from "../features/reports/ReportEditDialog.jsx";
import { card, input, label } from "../features/reports/reportStyles.js";

const ATTACHMENT_BUCKET = "report-attachments";
const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;
const MAX_ATTACHMENTS = 5;

const reportStatusStyles = {
  orange: "border-[#ff9f8f] bg-[#ffe5df] text-[#e05b45]",
  gray: "border-[#c8c8c8] bg-[#f3f3f3] text-[#858585]",
  green: "border-[#73c481] bg-[#e1f6e4] text-[#388b47]",
  yellow: "border-[#e8cc70] bg-[#fdf5dd] text-[#8a6d1a]",
};

// Phone photos routinely exceed the bucket limit, so shrink them before upload.
// Anything unexpected (no canvas, no createImageBitmap, a bigger result) falls back
// to the original file, and EXIF orientation is honoured so photos are not sideways.
async function prepareImageForUpload(file) {
  if (!file.type.startsWith("image/")) return file;
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    const maxEdge = 2000;
    const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
    if (scale === 1 && file.size <= 1_500_000) {
      bitmap.close?.();
      return file;
    }
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext("2d");
    if (!context) {
      bitmap.close?.();
      return file;
    }
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close?.();
    const blob = await new Promise((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.82),
    );
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], `${file.name.replace(/\.[^.]+$/, "")}.jpg`, {
      type: "image/jpeg",
    });
  } catch {
    return file;
  }
}

function FieldReports() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const requestedJobNumber = searchParams.get("job");
  const [jobs, setJobs] = useState([]);
  const [selectedJob, setSelectedJob] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [attachedImages, setAttachedImages] = useState([]);
  const [usedParts, setUsedParts] = useState({});
  const [formValues, setFormValues] = useState({
    clientName: "",
    jobNumber: "",
    serviceType: "",
    siteAddress: "",
    technicianName: "",
    serviceDate: "",
    arrivalTime: "",
    workPerformed: "",
    issueDescription: "",
    recommendations: "",
    additionalNotes: "",
    clientSignoff: false,
    clientSignoffName: "",
  });

  const viewerRole = getSession()?.user?.role;
  const canFilterByTechnician = [
    "Admin",
    "Service Manager",
    "Sales Manager",
  ].includes(viewerRole);
  const [technicianFilter, setTechnicianFilter] = useState("");
  const [technicianOptions, setTechnicianOptions] = useState([]);
  const [submittedReports, setSubmittedReports] = useState([]);
  const [isLoadingSubmittedReports, setIsLoadingSubmittedReports] =
    useState(true);
  const [submittedReportsError, setSubmittedReportsError] = useState("");
  const [reloadToken, setReloadToken] = useState(0);
  const [editReport, setEditReport] = useState(null);
  const [editValues, setEditValues] = useState({
    serviceDate: "",
    arrivalTime: "",
    workPerformed: "",
    issueDescription: "",
    recommendations: "",
    additionalNotes: "",
    siteAddress: "",
    clientSignoff: false,
    clientSignoffName: "",
  });
  const [isResubmitting, setIsResubmitting] = useState(false);
  const [resubmitError, setResubmitError] = useState("");
  const [openReport, setOpenReport] = useState(null);

  useEffect(() => {
    let isMounted = true;
    listFieldReports(
      technicianFilter ? { technicianId: technicianFilter } : {},
    )
      .then(({ reports: incomingReports = [], technicians: incomingTechnicians = [] }) => {
        if (!isMounted) return;
        // Only already-submitted reports belong in this list; jobs that are still
        // waiting on a report stay in the picker above.
        setSubmittedReports(
          (Array.isArray(incomingReports) ? incomingReports : []).filter(
            (report) => !report.isPendingReport,
          ),
        );
        setTechnicianOptions(
          Array.isArray(incomingTechnicians) ? incomingTechnicians : [],
        );
      })
      .catch((error) => {
        if (isMounted) setSubmittedReportsError(error.message);
      })
      .finally(() => {
        if (isMounted) setIsLoadingSubmittedReports(false);
      });
    return () => {
      isMounted = false;
    };
  }, [technicianFilter, reloadToken]);

  useEffect(() => {
    let isMounted = true;
    listFieldReportJobs()
      .then(({ jobs: assignedJobs }) => {
        if (!isMounted) return;
        const nextJobs = assignedJobs || [];
        setJobs(nextJobs);
        const requestedJob = nextJobs.find(
          (job) => job.jobNumber === requestedJobNumber,
        );
        if (requestedJob) selectJob(requestedJob);
      })
      .catch(() => {
        if (isMounted) setJobs([]);
      });
    return () => {
      isMounted = false;
    };
  }, [requestedJobNumber]);

  function selectJob(job) {
    // Read the name inside the handler so this function owns no component state;
    // otherwise the auto-select effect would need it as a dependency.
    const currentName = getSession()?.user?.name || "";
    setSelectedJob(job);
    setSubmitError("");
    setAttachedImages([]);
    setUsedParts(
      Object.fromEntries(
        (job.reservedParts || []).map((part) => [part.jobPartId, {
          selected: false,
          quantity: "1",
        }]),
      ),
    );
    setFormValues((currentValues) => ({
      ...currentValues,
      clientName: job.clientName,
      jobNumber: job.jobNumber,
      serviceType: job.serviceType,
      siteAddress: job.siteAddress,
      technicianName:
        currentName || job.assignedTechnicians?.[0]?.name || job.technicianName,
      serviceDate: job.serviceDate,
      arrivalTime: job.arrivalTime,
    }));
  }

  function updateField(field, value) {
    setFormValues((currentValues) => ({ ...currentValues, [field]: value }));
  }

  function updateUsedPart(jobPartId, updates) {
    setUsedParts((currentParts) => ({
      ...currentParts,
      [jobPartId]: { ...currentParts[jobPartId], ...updates },
    }));
  }

  async function handleImageSelection(event) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (!files.length || !selectedJob) return;

    const room = MAX_ATTACHMENTS - attachedImages.length;
    if (room <= 0) {
      setSubmitError(`Attach at most ${MAX_ATTACHMENTS} images.`);
      return;
    }

    setSubmitError("");
    for (const file of files.slice(0, room)) {
      if (!file.type.startsWith("image/")) {
        setSubmitError(`${file.name} is not an image.`);
        continue;
      }

      const id = `${file.name}-${file.lastModified}-${Math.random().toString(16).slice(2)}`;
      setAttachedImages((current) => [
        ...current,
        {
          id,
          name: file.name,
          previewUrl: URL.createObjectURL(file),
          path: "",
          status: "uploading",
          error: "",
        },
      ]);

      try {
        const prepared = await prepareImageForUpload(file);
        if (prepared.size > MAX_ATTACHMENT_BYTES) {
          throw new Error("Each image must be 10 MB or smaller.");
        }
        // The bucket is private: ask the Edge Function for a one-off signed
        // upload URL, then put the file straight into storage.
        const { path, token } = await createReportUpload({
          jobId: selectedJob.jobId,
          fileName: prepared.name,
          contentType: prepared.type,
          size: prepared.size,
        });
        const { error } = await supabase.storage
          .from(ATTACHMENT_BUCKET)
          .uploadToSignedUrl(path, token, prepared, {
            contentType: prepared.type,
          });
        if (error) throw error;

        setAttachedImages((current) =>
          current.map((image) =>
            image.id === id
              ? { ...image, path, status: "ready", error: "" }
              : image,
          ),
        );
      } catch (error) {
        setAttachedImages((current) =>
          current.map((image) =>
            image.id === id
              ? { ...image, status: "error", error: error.message }
              : image,
          ),
        );
      }
    }
  }

  function removeImage(image) {
    if (image.previewUrl) URL.revokeObjectURL(image.previewUrl);
    setAttachedImages((current) =>
      current.filter((entry) => entry.id !== image.id),
    );
    if (image.path) {
      // Best effort: an orphaned object is harmless, and the bucket is private.
      discardReportUpload({ path: image.path }).catch(() => {});
    }
  }

  function openReportEditor(report) {
    setEditValues({
      serviceDate: report.serviceDate || "",
      arrivalTime: report.arrivalTime || "",
      workPerformed: report.workPerformed || "",
      issueDescription: report.issueDescription || "",
      recommendations: report.recommendations || "",
      additionalNotes: report.additionalNotes || "",
      siteAddress:
        report.siteAddress === "Not provided" ? "" : report.siteAddress || "",
      clientSignoff: Boolean(report.clientSignoff),
      clientSignoffName: report.clientSignoffName || "",
    });
    setResubmitError("");
    setEditReport(report);
  }

  function updateEditValue(field, value) {
    setEditValues((current) => ({ ...current, [field]: value }));
  }

  async function handleResubmit() {
    if (!editReport) return;
    if (!editValues.workPerformed.trim() || !editValues.serviceDate) {
      setResubmitError("Describe the work performed and give the service date.");
      return;
    }

    setResubmitError("");
    setIsResubmitting(true);
    try {
      await resubmitFieldReport({
        reportId: editReport.reportUuid,
        ...editValues,
      });
      setEditReport(null);
      setOpenReport(null);
      setReloadToken((token) => token + 1);
    } catch (error) {
      setResubmitError(error.message);
    } finally {
      setIsResubmitting(false);
    }
  }

  async function handleSubmitReport() {
    if (!selectedJob) return;
    const partsUsed = (selectedJob.reservedParts || [])
      .filter((part) => usedParts[part.jobPartId]?.selected)
      .map((part) => ({
        jobPartId: part.jobPartId,
        quantity: Number(usedParts[part.jobPartId].quantity),
      }));
    const hasInvalidPartQuantity = partsUsed.some(
      (partUsed) =>
        !Number.isInteger(partUsed.quantity) ||
        partUsed.quantity < 1 ||
        partUsed.quantity >
          selectedJob.reservedParts.find(
            (part) => part.jobPartId === partUsed.jobPartId,
          ).quantity,
    );
    if (hasInvalidPartQuantity) {
      setSubmitError("Enter a valid used quantity for each selected part.");
      return;
    }

    if (
      !formValues.workPerformed ||
      !formValues.serviceDate ||
      !formValues.siteAddress ||
      !formValues.technicianName
    ) {
      setSubmitError(
        "Please complete the required job and work summary details before submitting.",
      );
      return;
    }

    const hasUnreadyImage = attachedImages.some(
      (image) => image.status !== "ready" || !image.path,
    );
    if (hasUnreadyImage) {
      setSubmitError(
        "Wait for every image to finish uploading, and remove any that failed.",
      );
      return;
    }

    setIsSubmitting(true);
    setSubmitError("");

    try {
      await submitFieldReport({
        jobId: selectedJob.jobId,
        clientName: formValues.clientName,
        jobNumber: formValues.jobNumber,
        serviceType: formValues.serviceType,
        siteAddress: formValues.siteAddress,
        technicianName: formValues.technicianName,
        serviceDate: formValues.serviceDate,
        arrivalTime: formValues.arrivalTime,
        workPerformed: formValues.workPerformed,
        issueDescription: formValues.issueDescription,
        recommendations: formValues.recommendations,
        additionalNotes: formValues.additionalNotes,
        clientSignoff: formValues.clientSignoff,
        clientSignoffName: formValues.clientSignoffName,
        partsUsed,
        images: attachedImages.map((image) => ({
          name: image.name,
          path: image.path,
        })),
      });

      navigate("/reports");
    } catch (error) {
      setSubmitError(
        error.message || "Unable to submit the field report right now.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="flex h-screen overflow-hidden bg-[#1f2022] font-sans text-[#063b7c] max-[1024px]:block">
      <Sidebar />
      <section className="h-screen w-full min-w-0 flex-1 overflow-y-auto bg-[#edf7ff] max-[1024px]:h-[100dvh]">
        <TopBar />
        <div className="px-8 pb-6 pt-7 max-[1024px]:px-6 max-[1024px]:pb-20 max-[1024px]:pt-5 max-[620px]:px-3">
          <header className="mb-5 flex items-start justify-between max-[620px]:gap-3">
            <div>
              <p className="mb-1 text-[12px] font-bold uppercase tracking-[.12em] text-[#818b94]">
                Operations / Field reporting
              </p>
              <h1 className="m-0 text-[30px] font-bold tracking-[-.5px] max-[1024px]:text-[24px] max-[620px]:text-[19px]">
                New Field Report
              </h1>
              <p className="mb-0 mt-1 text-[14px] text-[#8b949c]">
                Complete all required fields and submit for manager review.
              </p>
            </div>
            <Link
              className="inline-flex items-center gap-1.5 rounded-[6px] border border-[#cbd8e7] bg-white px-3 py-2 text-[14px] font-semibold text-[#697a8c] no-underline transition-colors hover:border-[#174f9a] hover:bg-[#f4f8ff] hover:text-[#174f9a]"
              to="/reports"
            >
              <span className="material-symbols-outlined text-[18px]">
                arrow_back
              </span>
              Back
            </Link>
          </header>
          <section className={`${card} mb-3`}>
            <div className="mb-3 flex items-start justify-between gap-3 max-[620px]:flex-col">
              <div>
                <p className="m-0 text-[13px] font-bold text-[#68798a]">
                  SELECT AN ASSIGNED JOB
                </p>
                <p className="mb-0 mt-1 text-[13px] text-[#8290a0]">
                  Choose the job to prefill the report details.
                </p>
              </div>
              {selectedJob && (
                <span className="rounded-[5px] bg-[#e6f3ec] px-2 py-1 text-[12px] font-semibold text-[#287044]">
                  Selected: {selectedJob.jobNumber}
                </span>
              )}
            </div>
            <div className="grid grid-cols-3 gap-2 max-[1024px]:grid-cols-2 max-[620px]:grid-cols-1">
              {jobs.map((job) => (
                <button
                  key={job.jobNumber}
                  type="button"
                  aria-pressed={selectedJob?.jobNumber === job.jobNumber}
                  onClick={() => selectJob(job)}
                  className={`rounded-[6px] border p-3 text-left transition-colors ${
                    selectedJob?.jobNumber === job.jobNumber
                      ? "border-[#1953a5] bg-[#eef4ff] ring-1 ring-[#1953a5]"
                      : "border-[#dfe6ec] bg-white hover:border-[#8eadd4] hover:bg-[#f7faff]"
                  }`}
                >
                  <span className="flex items-center justify-between gap-2">
                    <strong className="text-[14px] text-[#174f9a]">
                      {job.clientName}
                    </strong>
                    <span className="shrink-0 text-[12px] font-bold text-[#68798a]">
                      {job.jobNumber}
                    </span>
                  </span>
                  <span className="mt-2 block text-[12px] text-[#778593]">
                    {job.serviceLabel}
                  </span>
                  {job.assignedTechnicians?.length > 0 && (
                    <span className="mt-1 block text-[11px] text-[#778593]">
                      {job.assignedTechnicians
                        .map(
                          (technician) =>
                            `${technician.name}${technician.reported ? " ✓" : " (pending)"}`,
                        )
                        .join(" · ")}
                    </span>
                  )}
                  <span className="mt-1 block text-[12px] text-[#778593]">
                    {job.siteAddress} · {job.serviceDate} {job.arrivalTime}
                  </span>
                </button>
              ))}
            </div>
            {jobs.length === 0 && (
              <p className="mb-0 mt-3 text-[13px] text-[#778593]">
                No assigned jobs are available.
              </p>
            )}
          </section>

          <section className={`${card} mb-3`}>
            <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="m-0 text-[13px] font-bold text-[#68798a]">
                  SUBMITTED REPORTS
                </p>
                <p className="mb-0 mt-1 text-[13px] text-[#8290a0]">
                  {canFilterByTechnician
                    ? technicianFilter
                      ? "Reports filed by the selected technician."
                      : "Every report filed so far."
                    : "Reports you have already submitted."}
                </p>
              </div>
              {canFilterByTechnician && (
                <label className="flex items-center gap-2 text-[12px] font-semibold text-[#45515c] max-[620px]:w-full">
                  Technician
                  <select
                    className={`${input} mt-0 h-10 w-[200px] max-[620px]:w-full`}
                    value={technicianFilter}
                    onChange={(event) => setTechnicianFilter(event.target.value)}
                  >
                    <option value="">All technicians</option>
                    {technicianOptions.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.name}
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </div>

            {submittedReportsError && (
              <p
                className="m-0 mb-3 rounded-[5px] border border-[#f0b8b0] bg-[#fff1ee] px-3 py-2 text-[12px] text-[#b64132]"
                role="alert"
              >
                {submittedReportsError}
              </p>
            )}

            {isLoadingSubmittedReports ? (
              <p className="mb-0 text-[13px] text-[#778593]">
                Loading submitted reports...
              </p>
            ) : submittedReports.length === 0 ? (
              <p className="mb-0 text-[13px] text-[#778593]">
                {technicianFilter
                  ? "This technician has not submitted any reports yet."
                  : "No reports have been submitted yet."}
              </p>
            ) : (
              <div className="divide-y divide-[#e5ebf1]">
                {submittedReports.map((report) => (
                  <button
                    key={report.id}
                    type="button"
                    onClick={() => setOpenReport(report)}
                    className="flex w-full items-center gap-3 py-3 text-left transition-colors hover:bg-[#f7faff]"
                  >
                    <span className="min-w-0 flex-1">
                      <strong className="block truncate text-[14px] text-[#174f9a]">
                        {report.client}
                      </strong>
                      <span className="mt-0.5 block truncate text-[12px] text-[#778593]">
                        {report.id} · {report.service} · {report.time}
                      </span>
                      {canFilterByTechnician && !technicianFilter && (
                        <span className="mt-0.5 block truncate text-[11px] text-[#8b99aa]">
                          {report.technician}
                        </span>
                      )}
                    </span>
                    <span
                      className={`shrink-0 rounded-full border px-3 py-1 text-[11px] font-bold ${
                        reportStatusStyles[report.tone] ?? reportStatusStyles.gray
                      }`}
                    >
                      {report.status}
                    </span>
                    <span className="material-symbols-outlined shrink-0 text-[20px] text-[#a6afb8]">
                      chevron_right
                    </span>
                  </button>
                ))}
              </div>
            )}
          </section>

          {selectedJob ? (
            <>
              <div className="grid grid-cols-2 gap-3 max-[620px]:grid-cols-1">
                <section className={card}>
                  <p className="m-0 text-[13px] font-bold text-[#68798a]">
                    01 / JOB INFORMATION
                  </p>
                  <div className="mt-3 grid grid-cols-2 gap-2 max-[620px]:grid-cols-1">
                    <label
                      className={`${label} col-span-2 max-[620px]:col-span-1`}
                    >
                      Client name *
                      <input
                        className={input}
                        value={formValues.clientName || ""}
                        onChange={(event) =>
                          updateField("clientName", event.target.value)
                        }
                      />
                    </label>
                    <label className={label}>
                      Work order no. *
                      <input
                        className={input}
                        value={formValues.jobNumber || ""}
                        onChange={(event) =>
                          updateField("jobNumber", event.target.value)
                        }
                      />
                    </label>
                    <label className={label}>
                      Service type *
                      <select
                        className={input}
                        value={formValues.serviceType || ""}
                        onChange={(event) =>
                          updateField("serviceType", event.target.value)
                        }
                      >
                        <option value="">Select service type...</option>
                        <option value="installation">Installation</option>
                        <option value="maintenance">Maintenance</option>
                        <option value="repair">Repair</option>
                      </select>
                    </label>
                    <label
                      className={`${label} col-span-2 max-[620px]:col-span-1`}
                    >
                      Site address *
                      <input
                        className={input}
                        value={formValues.siteAddress || ""}
                        placeholder="Full address of the service site"
                        onChange={(event) =>
                          updateField("siteAddress", event.target.value)
                        }
                      />
                    </label>
                  </div>
                </section>
                <section className={card}>
                  <p className="m-0 text-[13px] font-bold text-[#68798a]">
                    02 / TECHNICIAN &amp; TIME ON SITE
                  </p>
                  <div className="mt-3 grid grid-cols-2 gap-2 max-[620px]:grid-cols-1">
                    <label
                      className={`${label} col-span-2 max-[620px]:col-span-1`}
                    >
                      Technician name *
                      <input
                        className={input}
                        placeholder="Full name of technician"
                        value={formValues.technicianName || ""}
                        onChange={(event) =>
                          updateField("technicianName", event.target.value)
                        }
                      />
                    </label>
                    <label className={label}>
                      Date of service *
                      <input
                        className={input}
                        type="date"
                        value={formValues.serviceDate || ""}
                        onChange={(event) =>
                          updateField("serviceDate", event.target.value)
                        }
                      />
                    </label>
                    <label className={label}>
                      Time arrival *
                      <input
                        className={input}
                        type="time"
                        value={formValues.arrivalTime || ""}
                        onChange={(event) =>
                          updateField("arrivalTime", event.target.value)
                        }
                      />
                    </label>
                  </div>
                </section>
                <section className={card}>
                  <p className="m-0 text-[13px] font-bold text-[#68798a]">
                    03 / WORK SUMMARY
                  </p>
                  <div className="mt-3 border-l-2 border-[#286fc7] bg-[#eef4ff] p-2 text-[13px] text-[#778593]">
                    Describe the work performed on site. Be specific about
                    equipment installed, issues found, and actions taken.
                  </div>
                  <textarea
                    className="mt-2 min-h-[100px] w-full resize-none rounded-[5px] border border-[#cbd8e7] bg-[#eef4ff] p-2 text-[14px] outline-none"
                    placeholder="Describe work performed in detail..."
                    value={formValues.workPerformed || ""}
                    onChange={(event) =>
                      updateField("workPerformed", event.target.value)
                    }
                  />
                </section>
                <section className={card}>
                  <p className="m-0 text-[13px] font-bold text-[#68798a]">
                    04 / RESERVED PARTS
                  </p>
                  {selectedJob.reservedParts?.length ? (
                    <div className="mt-3 divide-y divide-[#e5ebf1]">
                      {selectedJob.reservedParts.map((part) => (
                        <div
                          key={part.jobPartId}
                          className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3 py-2 text-[13px]"
                        >
                          <span className="min-w-0">
                            <strong className="block truncate text-[#174f9a]">
                              {part.name}
                            </strong>
                            <small className="text-[#778593]">{part.sku}</small>
                          </span>
                          <label className="flex items-center gap-2 text-[11px] font-semibold text-[#607286]">
                            <input
                              type="checkbox"
                              checked={Boolean(usedParts[part.jobPartId]?.selected)}
                              aria-label={`Mark ${part.name} as used`}
                              onChange={(event) =>
                                updateUsedPart(part.jobPartId, {
                                  selected: event.target.checked,
                                })
                              }
                              className="h-4 w-4 rounded border-gray-300 text-[#1250a0] focus:ring-[#1250a0]"
                            />
                            Used
                          </label>
                          <input
                            type="number"
                            min="1"
                            max={part.quantity}
                            step="1"
                            value={usedParts[part.jobPartId]?.quantity ?? "1"}
                            disabled={!usedParts[part.jobPartId]?.selected}
                            aria-label={`Quantity of ${part.name} used`}
                            onChange={(event) =>
                              updateUsedPart(part.jobPartId, {
                                quantity: event.target.value,
                              })
                            }
                            className={`${input} mt-0 h-9 w-[84px] px-2 text-center disabled:bg-[#f2f4f6]`}
                          />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="mt-3 rounded-[6px] border border-[#e1e6eb] bg-[#f8fbff] px-3 py-2 text-[12px] text-[#607286]">
                      {selectedJob.partsReconciledBy
                        ? `Parts for this job were already reconciled by ${selectedJob.partsReconciledBy.name}${
                            selectedJob.partsReconciledBy.reportNumber
                              ? ` (${selectedJob.partsReconciledBy.reportNumber})`
                              : ""
                          }. Record the work you performed; parts are not claimed again.`
                        : "No stock was reserved for this job."}
                    </div>
                  )}
                  {selectedJob.reservedParts?.length ? (
                    <p className="mb-0 mt-2 text-[11px] text-[#8290a0]">
                      Select the parts and quantities used. Unselected quantities
                      are released when this report is submitted.
                    </p>
                  ) : null}
                </section>
                <section className={card}>
                  <p className="m-0 text-[13px] font-bold text-[#68798a]">
                    05 / ATTACHED IMAGES
                  </p>
                  <input
                    id="field-report-image-upload"
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={handleImageSelection}
                  />
                  <label
                    htmlFor="field-report-image-upload"
                    className="mt-3 flex h-[78px] w-full cursor-pointer flex-col items-center justify-center rounded-[6px] border border-dashed border-[#bfcbe0] bg-[#f7faff] text-[13px] text-[#8290a0]"
                  >
                    <span className="material-symbols-outlined text-[18px]">
                      add_a_photo
                    </span>
                    Click to attach images
                  </label>
                  {attachedImages.length > 0 && (
                    <div className="mt-3 space-y-2">
                      {attachedImages.map((image) => (
                        <div
                          key={image.id}
                          className="flex items-center justify-between gap-2 rounded-[6px] border border-[#dfe6ec] bg-[#f8fbff] px-2 py-2"
                        >
                          <div className="flex min-w-0 items-center gap-2">
                            {image.previewUrl && (
                              <img
                                src={image.previewUrl}
                                alt={image.name}
                                className="h-10 w-10 rounded-[5px] object-cover"
                              />
                            )}
                            <span className="min-w-0">
                              <span className="block truncate text-[12px] text-[#607286]">
                                {image.name}
                              </span>
                              {image.status === "uploading" && (
                                <span className="block text-[10px] text-[#8290a0]">
                                  Uploading...
                                </span>
                              )}
                              {image.status === "error" && (
                                <span className="block text-[10px] text-[#b33a3a]">
                                  {image.error || "Upload failed."}
                                </span>
                              )}
                              {image.status === "ready" && (
                                <span className="block text-[10px] text-[#388b47]">
                                  Uploaded
                                </span>
                              )}
                            </span>
                          </div>
                          <button
                            type="button"
                            className="shrink-0 text-[11px] font-bold text-[#b33a3a]"
                            onClick={() => removeImage(image)}
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </section>
                <section className={card}>
                  <p className="m-0 text-[13px] font-bold text-[#68798a]">
                    06 / COMPLETION &amp; SIGN-OFF
                  </p>
                  <label className="mt-3 flex items-center gap-2 rounded-[5px] border border-[#cbd8e7] bg-[#eef4ff] p-2 text-[13px] text-[#607286]">
                    <input
                      type="checkbox"
                      checked={Boolean(formValues.clientSignoff)}
                      onChange={(event) =>
                        updateField("clientSignoff", event.target.checked)
                      }
                    />
                    <span>
                      <strong className="block">
                        Client Sign-off Obtained
                      </strong>
                      <small className="text-[11px]">
                        Client confirmed work completion on site
                      </small>
                    </span>
                  </label>
                  <label className={`${label} mt-3 block`}>
                    Client sign-off name
                    <input
                      className={input}
                      value={formValues.clientSignoffName || ""}
                      onChange={(event) =>
                        updateField("clientSignoffName", event.target.value)
                      }
                      placeholder="Full name of client signer"
                    />
                  </label>
                  <label className={`${label} mt-3 block`}>
                    Additional notes
                    <textarea
                      className="mt-1 min-h-[64px] w-full resize-none rounded-[5px] border border-[#cbd8e7] bg-[#eef4ff] p-2 text-[14px] outline-none"
                      placeholder="Any remarks, follow-up actions, or issues found..."
                      value={formValues.additionalNotes || ""}
                      onChange={(event) =>
                        updateField("additionalNotes", event.target.value)
                      }
                    />
                  </label>
                </section>
              </div>
              <section className="mt-3 flex items-center justify-between rounded-[9px] border border-[#cbd8e7] bg-[#eef4ff] px-4 py-3 max-[620px]:flex-col max-[620px]:items-stretch max-[620px]:gap-2">
                <div>
                  <strong className="block text-[16px]">
                    Report ID will be assigned on submission
                  </strong>
                  <small className="text-[12px] text-[#8b99aa]">
                    This report will be sent to the manager queue for review.
                  </small>
                </div>
                <div className="flex gap-3 max-[620px]:flex-1">
                  <Link
                    className="inline-flex h-12 items-center justify-center rounded-[6px] border border-[#cbd8e7] bg-white px-3 text-[14px] font-semibold text-[#697a8c] transition-colors hover:border-[#174f9a] hover:bg-[#f4f8ff] hover:text-[#174f9a] max-[620px]:flex-1"
                    to="/reports"
                  >
                    Cancel
                  </Link>
                  <button
                    className="flex h-12 items-center justify-center gap-2 rounded-[10px] bg-[#1953a5] px-7 text-[14px] font-bold text-white shadow-[0_2px_3px_rgb(18_80_160_/_18%)] disabled:cursor-not-allowed disabled:opacity-60 max-[620px]:flex-1"
                    type="button"
                    onClick={handleSubmitReport}
                    disabled={isSubmitting}
                  >
                    <span className="material-symbols-outlined text-[19px]">
                      send
                    </span>
                    {isSubmitting ? "Submitting..." : "Submit Report"}
                  </button>
                </div>
              </section>
              {submitError && (
                <p className="mt-3 text-[13px] font-semibold text-[#b33a3a]">
                  {submitError}
                </p>
              )}
              <footer className="mt-6 border-t border-[#c9d4de] pt-3 text-[12px] text-[#8a9299] max-[1024px]:hidden">
                Guard-All Electronic Security Systems, Inc.
              </footer>
            </>
          ) : (
            <section className="rounded-[9px] border border-dashed border-[#cbd8e7] bg-white px-5 py-8 text-center text-[14px] text-[#778593]">
              Select a job above to open a prefilled field report.
            </section>
          )}
        </div>
      </section>

      {openReport && (
        <ReportDetailDialog
          openReport={openReport}
          setOpenReport={setOpenReport}
          openReportEditor={openReportEditor}
          canFilterByTechnician={canFilterByTechnician}
        />
      )}

      {editReport && (
        <ReportEditDialog
          editReport={editReport}
          setEditReport={setEditReport}
          editValues={editValues}
          updateEditValue={updateEditValue}
          handleResubmit={handleResubmit}
          isResubmitting={isResubmitting}
          resubmitError={resubmitError}
        />
      )}
    </main>
  );
}

export default FieldReports;
