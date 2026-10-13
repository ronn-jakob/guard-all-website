import Sidebar from "./Sidebar.jsx";
import TopBar from "./TopBar.jsx";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { callAuthFunction } from "../lib/auth.js";

const input =
  "mt-1 h-10 w-full rounded-[5px] border border-[#cbd8e7] bg-[#eef4ff] px-3 text-[14px] text-[#4d6075] outline-none";
const card =
  "rounded-[10px] border border-[#dfe6ec] bg-white p-3 shadow-[0_2px_5px_rgb(31_59_82_/_8%)]";
const label = "text-[12px] font-bold uppercase tracking-[.06em] text-[#778593]";

function FieldReports() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const requestedJobNumber = searchParams.get("job");
  const [jobs, setJobs] = useState([]);
  const [selectedJob, setSelectedJob] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [attachedImages, setAttachedImages] = useState([]);
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
    partSku: "",
    partDescription: "",
    partQuantity: "1",
  });

  useEffect(() => {
    let isMounted = true;
    callAuthFunction("list-field-report-jobs")
      .then(({ jobs: assignedJobs }) => {
        if (!isMounted) return;
        const nextJobs = assignedJobs || [];
        setJobs(nextJobs);
        const requestedJob = nextJobs.find((job) => job.jobNumber === requestedJobNumber);
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
    setSelectedJob(job);
    setSubmitError("");
    setAttachedImages([]);
    setFormValues((currentValues) => ({
      ...currentValues,
      clientName: job.clientName,
      jobNumber: job.jobNumber,
      serviceType: job.serviceType,
      siteAddress: job.siteAddress,
      technicianName: job.technicianName,
      serviceDate: job.serviceDate,
      arrivalTime: job.arrivalTime,
    }));
  }

  function updateField(field, value) {
    setFormValues((currentValues) => ({ ...currentValues, [field]: value }));
  }

  function handleImageSelection(event) {
    const files = Array.from(event.target.files ?? []);
    if (!files.length) return;

    Promise.all(
      files.map(
        (file) =>
          new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = () => {
              resolve({
                id: `${file.name}-${file.lastModified}-${Math.random().toString(16).slice(2)}`,
                name: file.name,
                type: file.type,
                dataUrl: String(reader.result || ""),
              });
            };
            reader.onerror = () => resolve(null);
            reader.readAsDataURL(file);
          })
      )
    ).then((imageEntries) => {
      const validImages = imageEntries.filter(Boolean).slice(0, 5);
      setAttachedImages((currentImages) => [...currentImages, ...validImages].slice(0, 5));
      event.target.value = "";
    });
  }

  async function handleSubmitReport() {
    if (!selectedJob) return;

    const partSku = String(formValues.partSku ?? "").trim();
    const partDescription = String(formValues.partDescription ?? "").trim();
    const partQuantity = Number(formValues.partQuantity ?? 0);

    if (!formValues.workPerformed || !formValues.serviceDate || !formValues.siteAddress || !formValues.technicianName) {
      setSubmitError("Please complete the required job and work summary details before submitting.");
      return;
    }

    setIsSubmitting(true);
    setSubmitError("");

    try {
      await callAuthFunction("submit-field-report", {
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
        parts: partSku
          ? [{ sku: partSku, description: partDescription || partSku, quantity: Number.isFinite(partQuantity) && partQuantity > 0 ? partQuantity : 1 }]
          : [],
        images: attachedImages
          .filter((image) => image && image.dataUrl)
          .map((image) => ({
            name: image.name,
            type: image.type,
            fileUrl: image.dataUrl,
          })),
      });

      navigate("/reports");
    } catch (error) {
      setSubmitError(error.message || "Unable to submit the field report right now.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="flex h-screen overflow-hidden bg-[#1f2022] font-sans text-[#063b7c] max-[1024px]:block">
      <Sidebar />
      <section className="h-screen min-w-0 flex-1 overflow-y-auto bg-[#edf7ff]">
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
              <span className="material-symbols-outlined text-[18px]">arrow_back</span>
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
                    {job.serviceLabel} · {job.technicianName}
                  </span>
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

          {selectedJob ? (
            <>
          <div className="grid grid-cols-2 gap-3 max-[620px]:grid-cols-1">
            <section className={card}>
              <p className="m-0 text-[13px] font-bold text-[#68798a]">
                01 / JOB INFORMATION
              </p>
              <div className="mt-3 grid grid-cols-2 gap-2 max-[620px]:grid-cols-1">
                <label className={`${label} col-span-2 max-[620px]:col-span-1`}>
                  Client name *
                  <input
                    className={input}
                    value={formValues.clientName || ""}
                    onChange={(event) => updateField("clientName", event.target.value)}
                  />
                </label>
                <label className={label}>
                  Work order no. *
                  <input
                    className={input}
                    value={formValues.jobNumber || ""}
                    onChange={(event) => updateField("jobNumber", event.target.value)}
                  />
                </label>
                <label className={label}>
                  Service type *
                  <select
                    className={input}
                    value={formValues.serviceType || ""}
                    onChange={(event) => updateField("serviceType", event.target.value)}
                  >
                    <option value="">Select service type...</option>
                    <option value="installation">Installation</option>
                    <option value="maintenance">Maintenance</option>
                    <option value="repair">Repair</option>
                  </select>
                </label>
                <label className={`${label} col-span-2 max-[620px]:col-span-1`}>
                  Site address *
                  <input
                    className={input}
                    value={formValues.siteAddress || ""}
                    placeholder="Full address of the service site"
                    onChange={(event) => updateField("siteAddress", event.target.value)}
                  />
                </label>
              </div>
            </section>
            <section className={card}>
              <p className="m-0 text-[13px] font-bold text-[#68798a]">
                02 / TECHNICIAN &amp; TIME ON SITE
              </p>
              <div className="mt-3 grid grid-cols-2 gap-2 max-[620px]:grid-cols-1">
                <label className={`${label} col-span-2 max-[620px]:col-span-1`}>
                  Technician name *
                  <input
                    className={input}
                    placeholder="Full name of technician"
                    value={formValues.technicianName || ""}
                    onChange={(event) => updateField("technicianName", event.target.value)}
                  />
                </label>
                <label className={label}>
                  Date of service *
                  <input
                    className={input}
                    type="date"
                    value={formValues.serviceDate || ""}
                    onChange={(event) => updateField("serviceDate", event.target.value)}
                  />
                </label>
                <label className={label}>
                  Time arrival *
                  <input
                    className={input}
                    type="time"
                    value={formValues.arrivalTime || ""}
                    onChange={(event) => updateField("arrivalTime", event.target.value)}
                  />
                </label>
              </div>
            </section>
            <section className={card}>
              <p className="m-0 text-[13px] font-bold text-[#68798a]">
                03 / WORK SUMMARY
              </p>
              <div className="mt-3 border-l-2 border-[#286fc7] bg-[#eef4ff] p-2 text-[13px] text-[#778593]">
                Describe the work performed on site. Be specific about equipment
                installed, issues found, and actions taken.
              </div>
              <textarea
                className="mt-2 min-h-[100px] w-full resize-none rounded-[5px] border border-[#cbd8e7] bg-[#eef4ff] p-2 text-[14px] outline-none"
                placeholder="Describe work performed in detail..."
                value={formValues.workPerformed || ""}
                onChange={(event) => updateField("workPerformed", event.target.value)}
              />
            </section>
            <section className={card}>
              <div className="flex items-center justify-between">
                <p className="m-0 text-[13px] font-bold text-[#68798a]">
                  04 / PARTS USED
                </p>
                <button
                  className="text-[12px] font-bold text-[#174f9a]"
                  type="button"
                >
                  + Add Part
                </button>
              </div>
              <div className="mt-3 grid grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_minmax(56px,.65fr)] gap-2">
                <label className={label}>
                  Part no.
                  <input
                    className={input}
                    value={formValues.partSku || ""}
                    onChange={(event) => updateField("partSku", event.target.value)}
                  />
                </label>
                <label className={label}>
                  Description
                  <input
                    className={input}
                    value={formValues.partDescription || ""}
                    onChange={(event) => updateField("partDescription", event.target.value)}
                  />
                </label>
                <label className={label}>
                  Qty
                  <input
                    className={input}
                    value={formValues.partQuantity || ""}
                    onChange={(event) => updateField("partQuantity", event.target.value)}
                  />
                </label>
              </div>
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
                        {image.dataUrl && (
                          <img
                            src={image.dataUrl}
                            alt={image.name}
                            className="h-10 w-10 rounded-[5px] object-cover"
                          />
                        )}
                        <span className="truncate text-[12px] text-[#607286]">
                          {image.name}
                        </span>
                      </div>
                      <button
                        type="button"
                        className="text-[11px] font-bold text-[#b33a3a]"
                        onClick={() =>
                          setAttachedImages((currentImages) =>
                            currentImages.filter((currentImage) => currentImage.id !== image.id)
                          )
                        }
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
                  onChange={(event) => updateField("clientSignoff", event.target.checked)}
                />
                <span>
                  <strong className="block">Client Sign-off Obtained</strong>
                  <small className="text-[11px]">Client confirmed work completion on site</small>
                </span>
              </label>
              <label className={`${label} mt-3 block`}>
                Client sign-off name
                <input
                  className={input}
                  value={formValues.clientSignoffName || ""}
                  onChange={(event) => updateField("clientSignoffName", event.target.value)}
                  placeholder="Full name of client signer"
                />
              </label>
              <label className={`${label} mt-3 block`}>
                Additional notes
                <textarea
                  className="mt-1 min-h-[64px] w-full resize-none rounded-[5px] border border-[#cbd8e7] bg-[#eef4ff] p-2 text-[14px] outline-none"
                  placeholder="Any remarks, follow-up actions, or issues found..."
                  value={formValues.additionalNotes || ""}
                  onChange={(event) => updateField("additionalNotes", event.target.value)}
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
                <span className="material-symbols-outlined text-[19px]">send</span>
                {isSubmitting ? "Submitting..." : "Submit Report"}
              </button>
            </div>
          </section>
          {submitError && (
            <p className="mt-3 text-[13px] font-semibold text-[#b33a3a]">{submitError}</p>
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
    </main>
  );
}

export default FieldReports;
