import { useState } from "react";
import Sidebar from "./Sidebar.jsx";
import TopBar from "./TopBar.jsx";
import logo from "../images/Guard All Logo Blue.png";

const schedule = [
  ["09:00", "TODAY", "Harborview Residences", "WO-88429", "Preventive maintenance", "Makati - Tower 2", "Maya Santos", "Available"],
  ["10:30", "TODAY", "Northbridge Dental Clinic", "WO-88431", "Service call", "Makati - West Avenue", "Jordan Lee", "1 Shortage"],
  ["13:00", "TODAY", "Pioneer Cold Storage", "WO-88432", "CCTV expansion", "Cebu - Mandaue", "Donnie Ramos", "Available"],
  ["08:30", "TOMORROW", "Lakeside Corporate Center", "WO-88433", "Access control install", "Makati - BGC", "Lanie Santos", "Review"],
  ["09:00", "TOMORROW", "St. Catherine Hospital", "WO-88434", "Quarterly inspection", "Cebu - Lahug", "Jun Reyes", "Available"],
];

function Scheduling() {
  const [selectedOrder, setSelectedOrder] = useState("WO-88431");
  const selectedJob = schedule.find((job) => job[3] === selectedOrder) ?? schedule[1];

  return (
    <main className="flex h-screen overflow-hidden bg-[#202123] font-sans text-[#174f9a] max-[1024px]:block max-[1024px]:[&>aside]:hidden">
      <Sidebar />

      <section className="h-screen min-w-0 flex-1 overflow-y-auto bg-[#edf7ff]">
        <TopBar />
        <header className="hidden h-[52px] items-center justify-between border-b border-[#d7e2ec] bg-white px-4 max-[1024px]:flex"><img className="h-7 w-[95px] object-contain" src={logo} alt="Guard-All" /><div className="text-right text-[7px] text-[#7c8186]"><strong className="block text-[8px] text-[#202a35]">Makati - Metro Manila</strong><span>Mon, 15 Sep 2026 · 9:58 AM</span></div><span className="grid h-7 w-7 place-items-center rounded-full bg-[#ff4825] text-[8px] font-bold text-white">RJ</span></header>

        <div className="px-8 pb-6 pt-8 max-[1024px]:px-6 max-[1024px]:pb-20 max-[1024px]:pt-5 max-[620px]:px-3">
          <div className="mb-7 flex items-end justify-between gap-5 max-[620px]:mb-4 max-[620px]:items-start">
            <div>
              <p className="mb-1 text-[10px] font-bold uppercase tracking-[.1em] text-[#818b94] max-[620px]:text-[7px]">
                Operations / Jobs
              </p>
              <h1 className="m-0 text-[30px] font-bold tracking-[-.5px] max-[1024px]:text-[24px] max-[620px]:text-[19px]">
                Scheduling
              </h1>
              <p className="mb-0 mt-2 text-[14px] text-[#8b949c] max-[620px]:mt-1 max-[620px]:text-[9px]">
                Put the right technician and parts on every site visit.
              </p>
            </div>
            <div className="flex items-center gap-6 max-[620px]:self-end">
              <span className="material-symbols-outlined text-[31px] text-[#174f9a] max-[620px]:hidden">
                calendar_month
              </span>
              <button className="rounded-[6px] bg-[#1250a0] px-5 py-3 text-[12px] font-bold text-white shadow-[0_2px_4px_rgb(18_80_160_/_25%)] max-[1024px]:px-4 max-[1024px]:py-2 max-[620px]:text-[9px]">
                + Create Job
              </button>
            </div>
          </div>

          <div className="grid grid-cols-[minmax(0,2fr)_minmax(300px,1fr)] gap-[18px] max-[620px]:grid-cols-1">
            <section className="overflow-hidden rounded-[12px] border border-[#dfe6ec] bg-white shadow-[0_3px_8px_rgb(31_59_82_/_14%)] max-[620px]:overflow-visible max-[620px]:border-0 max-[620px]:bg-transparent max-[620px]:shadow-none">
              <header className="flex h-[84px] items-center justify-between border-b border-[#e1e6eb] px-6 max-[1024px]:h-[57px] max-[1024px]:px-3 max-[620px]:rounded-[7px] max-[620px]:bg-white">
                <div className="flex items-center gap-3">
                  <button className="grid h-9 w-9 place-items-center rounded-[6px] border border-[#e5e9ed] bg-white text-[#89939b] max-[620px]:hidden" aria-label="Previous period">
                    <span className="material-symbols-outlined text-[20px]">chevron_left</span>
                  </button>
                  <div>
                    <strong className="text-[15px] max-[1024px]:text-[10px]">1-15 September 2026</strong>
                    <small className="block text-[10px] text-[#8f989f] max-[1024px]:text-[7px]">Week 2 · 18 jobs scheduled</small>
                  </div>
                  <button className="grid h-9 w-9 place-items-center rounded-[6px] border border-[#e5e9ed] bg-white text-[#89939b] max-[620px]:hidden" aria-label="Next period">
                    <span className="material-symbols-outlined text-[20px]">chevron_right</span>
                  </button>
                </div>
                <div className="flex rounded-[7px] bg-[#f4f7fb] p-1 text-[11px] font-bold max-[1024px]:text-[8px]">
                  <button className="rounded-[6px] bg-white px-4 py-2.5 text-[#174f9a] shadow-sm max-[1024px]:px-3 max-[1024px]:py-1.5">List</button>
                  <button className="px-4 py-2.5 text-[#82909c] max-[1024px]:px-3 max-[1024px]:py-1.5">Calendar</button>
                </div>
              </header>

              <div>
                {schedule.map(([time, day, client, order, service, location, technician, stock], index) => {
                  const isSelected = selectedOrder === order;
                  const isShortage = stock === "1 Shortage";
                  return (
                    <button
                      type="button"
                      className={`flex min-h-[86px] w-full items-center gap-5 border-b border-[#e5e8eb] px-6 py-4 text-left last:border-0 max-[1024px]:min-h-[70px] max-[1024px]:gap-3 max-[1024px]:px-3 max-[1024px]:py-3 max-[620px]:mb-2 max-[620px]:min-h-[76px] max-[620px]:rounded-[7px] max-[620px]:border ${index === 0 ? "max-[620px]:hidden" : ""} ${index === 4 ? "max-[620px]:hidden" : ""} ${isSelected ? "bg-[#f0f5fb] shadow-[0_2px_5px_rgb(31_59_82_/_18%)]" : "bg-white hover:bg-[#f8fbff]"}`}
                      key={order}
                      onClick={() => setSelectedOrder(order)}
                    >
                      <div className="w-[82px] flex-none max-[1024px]:w-[58px]">
                        <strong className="block text-[15px] max-[1024px]:text-[10px]">{time}</strong>
                        <small className="text-[10px] text-[#929aa1] max-[1024px]:text-[7px]">{day}</small>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline gap-2">
                          <strong className="truncate text-[14px] max-[1024px]:text-[10px]">{client}</strong>
                          <small className="text-[10px] text-[#8c969f] max-[1024px]:text-[7px]">{order}</small>
                        </div>
                        <p className="m-0 mt-1 text-[10px] text-[#8b949c] max-[1024px]:text-[7px]">
                          {service} · {location}
                        </p>
                        <div className="mt-2 flex gap-4 text-[10px] text-[#7f8992] max-[1024px]:mt-1 max-[1024px]:gap-2 max-[1024px]:text-[7px]">
                          <span>
                            <span className="material-symbols-outlined mr-1 align-middle text-[15px]">person</span>
                            {technician}
                          </span>
                          <span className={isShortage ? "text-[#e45e4e]" : "text-[#5e8e70]"}>
                            <span className="material-symbols-outlined mr-1 align-middle text-[15px]">{isShortage ? "warning" : "inventory_2"}</span>
                            {stock}
                          </span>
                        </div>
                      </div>
                      <span className="material-symbols-outlined text-[25px] text-[#a6afb8]">chevron_right</span>
                    </button>
                  );
                })}
              </div>
            </section>

            <aside className="min-h-[518px] rounded-[12px] border border-[#dfe6ec] bg-[#f9fbfd] p-5 shadow-[0_3px_8px_rgb(31_59_82_/_10%)] max-[1024px]:min-h-[455px] max-[1024px]:p-4 max-[620px]:min-h-0 max-[620px]:rounded-[7px] max-[620px]:p-3">
              <div className="flex items-start justify-between">
                <div>
                  <p className="m-0 text-[10px] uppercase tracking-[.08em] text-[#87929c]">Selected work order</p>
                  <small className="mt-2 block text-[10px] font-bold text-[#50719a]">{selectedJob[3]}</small>
                  <h2 className="m-0 mt-2 text-[23px] font-bold leading-tight max-[1024px]:text-[17px]">{selectedJob[2]}</h2>
                  <p className="m-0 mt-2 text-[10px] text-[#8a949c]">
                    <span className="material-symbols-outlined mr-1 align-middle text-[15px]">location_on</span>
                    {selectedJob[5]}
                  </p>
                </div>
                <span className="rounded-[6px] bg-white px-3 py-2 text-[9px] text-[#6d879f] shadow-sm">TODAY</span>
              </div>

              <div className="mt-6 grid grid-cols-2 gap-2 max-[1024px]:mt-4">
                <div className="rounded-[6px] bg-white p-3 shadow-sm">
                  <small className="block text-[9px] uppercase text-[#89939c]">Service type</small>
                  <strong className="mt-1 block text-[13px] max-[1024px]:text-[10px]">{selectedJob[4]}</strong>
                </div>
                <div className="rounded-[6px] bg-white p-3 shadow-sm">
                  <small className="block text-[9px] uppercase text-[#89939c]">Technician</small>
                  <strong className="mt-1 block text-[13px]">{selectedJob[6]}</strong>
                </div>
              </div>

              <div className="mt-3 rounded-[7px] border border-[#ff8f7c] bg-[#fff0ed] p-3 text-[#df6657]">
                <strong className="flex items-center gap-2 text-[12px] max-[1024px]:text-[9px]">
                  <span className="material-symbols-outlined text-[17px]">info</span>
                  Real-time stock check: shortage found
                </strong>
                <p className="m-0 mt-2 text-[10px] leading-relaxed max-[1024px]:text-[8px]">
                  DMP-145 PIR Motion Detector is 2 units short in Makati. Requisition or swap the branch before confirming.
                </p>
                <a className="mt-2 block text-[10px] font-bold text-[#d35e50]" href="#shortage">
                  View shortage options <span className="material-symbols-outlined align-middle text-[15px]">chevron_right</span>
                </a>
              </div>

              <button className="mt-3 flex w-full items-center justify-center gap-2 rounded-[6px] bg-[#86a7d5] py-3 text-[12px] font-bold text-white max-[1024px]:py-2 max-[1024px]:text-[9px]">
                <span className="material-symbols-outlined text-[18px]">check</span>
                Confirm assignment
              </button>
            </aside>
          </div>

          <footer className="mt-8 border-t border-[#c9d4de] pt-3 text-[9px] text-[#8a9299] max-[1024px]:hidden">
            Guard-All Electronic Security Systems, Inc.
          </footer>
        </div>
        <nav className="hidden max-[1024px]:fixed max-[1024px]:bottom-0 max-[1024px]:left-0 max-[1024px]:right-0 max-[1024px]:z-10 max-[1024px]:grid max-[1024px]:grid-cols-5 max-[1024px]:border-t max-[1024px]:border-[#d5dfe8] max-[1024px]:bg-white max-[1024px]:py-2 max-[620px]:py-1" aria-label="Mobile navigation"><a className="flex flex-col items-center text-[7px] text-[#8a9299] no-underline" href="/dashboard"><span className="material-symbols-outlined text-[17px]">dashboard</span>Dash</a><a className="flex flex-col items-center text-[7px] font-bold text-[#174f9a] no-underline" href="/scheduling"><span className="material-symbols-outlined text-[17px]">calendar_month</span>Schedule</a><a className="flex flex-col items-center text-[7px] text-[#8a9299] no-underline" href="/reports"><span className="material-symbols-outlined text-[17px]">assignment</span>Reports</a><a className="flex flex-col items-center text-[7px] text-[#8a9299] no-underline" href="/billing"><span className="material-symbols-outlined text-[17px]">sell</span>Billing</a><a className="flex flex-col items-center text-[7px] text-[#8a9299] no-underline" href="/inventory"><span className="material-symbols-outlined text-[17px]">inventory_2</span>Inventory</a></nav>
      </section>
    </main>
  );
}

export default Scheduling;
