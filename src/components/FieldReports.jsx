import Sidebar from "./Sidebar.jsx";
import TopBar from "./TopBar.jsx";
import { Link } from "react-router-dom";

const input =
  "mt-1 h-10 w-full rounded-[5px] border border-[#cbd8e7] bg-[#eef4ff] px-3 text-[14px] text-[#4d6075] outline-none";
const card =
  "rounded-[10px] border border-[#dfe6ec] bg-white p-3 shadow-[0_2px_5px_rgb(31_59_82_/_8%)]";
const label = "text-[12px] font-bold uppercase tracking-[.06em] text-[#778593]";

function FieldReports() {
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
                    defaultValue="Northbridge Dental Clinic"
                  />
                </label>
                <label className={label}>
                  Work order no. *
                  <input className={input} defaultValue="WO-88431" />
                </label>
                <label className={label}>
                  Service type *
                  <select className={input} defaultValue="">
                    <option value="">Select service type...</option>
                    <option>Service call</option>
                  </select>
                </label>
                <label className={`${label} col-span-2 max-[620px]:col-span-1`}>
                  Site address *
                  <input
                    className={input}
                    placeholder="Full address of the service site"
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
                  />
                </label>
                <label className={label}>
                  Date of service *<input className={input} type="date" />
                </label>
                <label className={label}>
                  Time arrival *<input className={input} type="time" />
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
                  <input className={input} defaultValue="CAM-123" />
                </label>
                <label className={label}>
                  Description
                  <input
                    className={input}
                    defaultValue="IP Camera, Dome Type"
                  />
                </label>
                <label className={label}>
                  Qty
                  <input className={input} defaultValue="1" />
                </label>
              </div>
            </section>
            <section className={card}>
              <p className="m-0 text-[13px] font-bold text-[#68798a]">
                05 / ATTACHED IMAGES
              </p>
              <button
                className="mt-3 flex h-[78px] w-full flex-col items-center justify-center rounded-[6px] border border-dashed border-[#bfcbe0] bg-[#f7faff] text-[13px] text-[#8290a0]"
                type="button"
              >
                <span className="material-symbols-outlined text-[18px]">
                  add_a_photo
                </span>
                Click to attach images
              </button>
            </section>
            <section className={card}>
              <p className="m-0 text-[13px] font-bold text-[#68798a]">
                06 / COMPLETION &amp; SIGN-OFF
              </p>
              <label className="mt-3 flex items-center gap-2 rounded-[5px] border border-[#cbd8e7] bg-[#eef4ff] p-2 text-[13px] text-[#607286]">
                <input type="checkbox" />
                <span>
                  <strong className="block">Client Sign-off Obtained</strong>
                  <small className="text-[11px]">Client confirmed work completion on site</small>
                </span>
              </label>
              <label className={`${label} mt-3 block`}>
                Additional notes
                <textarea
                  className="mt-1 min-h-[64px] w-full resize-none rounded-[5px] border border-[#cbd8e7] bg-[#eef4ff] p-2 text-[14px] outline-none"
                  placeholder="Any remarks, follow-up actions, or issues found..."
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
                className="flex h-12 items-center justify-center gap-2 rounded-[10px] bg-[#1953a5] px-7 text-[14px] font-bold text-white shadow-[0_2px_3px_rgb(18_80_160_/_18%)] max-[620px]:flex-1"
                type="button"
              >
                <span className="material-symbols-outlined text-[19px]">send</span>
                Submit Report
              </button>
            </div>
          </section>
          <footer className="mt-6 border-t border-[#c9d4de] pt-3 text-[12px] text-[#8a9299] max-[1024px]:hidden">
            Guard-All Electronic Security Systems, Inc.
          </footer>
        </div>
      </section>
    </main>
  );
}

export default FieldReports;
