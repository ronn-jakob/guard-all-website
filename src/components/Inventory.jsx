import Sidebar from "./Sidebar.jsx";
import TopBar from "./TopBar.jsx";
import logo from "../images/Guard All Logo Blue.png";

const inventoryItems = [
  ["inventory_2", "12V 7Ah Backup Battery", "BAT-012", "14", "8", "Makati", "Power", "In stock"],
  ["deployed_code", "PIR Motion Detector", "DMP-145", "8", "10", "Makati", "Intrusion", "Low stock", true],
  ["inventory_2", "Proximity Card Reader", "RDR-220", "6", "4", "Makati", "Access", "In stock"],
  ["deployed_code", "Surveillance HDD 4TB", "HDD-008", "2", "3", "Cebu", "CCTV", "Low stock", true],
  ["inventory_2", "Surface Door Contact", "CNT-204", "23", "12", "Makati", "Intrusion", "In stock"],
];

const metricCards = [
  ["inventory_2", "Total tracked items", "1,284", "Across 2 branches"],
  ["warning", "Below reorder point", "03", "Requires procurement", true],
  ["local_shipping", "In transit", "128", "Expected by 22 Apr"],
];

function Inventory() {
  return (
    <main className="flex h-screen overflow-hidden bg-[#1f2022] font-sans text-[#063b7c] max-[1024px]:block max-[1024px]:[&>aside]:hidden">
      <Sidebar />
      <section className="h-screen min-w-0 flex-1 overflow-y-auto bg-[#edf7ff]">
        <TopBar />
        <header className="hidden h-[52px] items-center justify-between border-b border-[#d7e2ec] bg-white px-4 max-[1024px]:flex"><img className="h-7 w-[95px] object-contain" src={logo} alt="Guard-All" /><div className="text-right text-[7px] text-[#7c8186]"><strong className="block text-[8px] text-[#202a35]">Makati - Metro Manila</strong><span>Mon, 15 Sep 2026 · 9:58 AM</span></div><span className="grid h-7 w-7 place-items-center rounded-full bg-[#ff4825] text-[8px] font-bold text-white">RJ</span></header>

        <div className="px-8 pb-6 pt-8 max-[1024px]:px-6 max-[1024px]:pb-20 max-[1024px]:pt-5 max-[620px]:px-3">
          <div className="mb-7 flex items-end justify-between gap-5 max-[620px]:mb-4 max-[620px]:items-start">
            <div>
              <p className="mb-1 text-[10px] font-bold uppercase tracking-[.12em] text-[#818b94] max-[620px]:text-[7px]">Operations / Stock ledger</p>
              <h1 className="m-0 text-[30px] font-bold tracking-[-.5px] max-[1024px]:text-[24px] max-[620px]:text-[19px]">Inventory</h1>
              <p className="mb-0 mt-2 text-[14px] text-[#8b949c] max-[620px]:mt-1 max-[620px]:text-[9px]">Know what can leave the branch before the truck does.</p>
            </div>
            <button className="rounded-[6px] bg-[#1250a0] px-5 py-3 text-[12px] font-bold text-white shadow-[0_2px_4px_rgb(18_80_160_/_25%)] max-[1024px]:px-4 max-[1024px]:py-2 max-[620px]:self-end max-[620px]:px-3 max-[620px]:py-2 max-[620px]:text-[9px]">+ Create requisition</button>
          </div>

          <section className="grid grid-cols-3 gap-[18px] max-[620px]:gap-1">
            {metricCards.map(([icon, title, value, note, alert]) => (
              <article className={`relative min-h-[156px] rounded-[11px] border bg-white p-7 shadow-[0_3px_8px_rgb(31_59_82_/_14%)] max-[1024px]:min-h-[112px] max-[1024px]:p-4 max-[620px]:min-h-[58px] max-[620px]:rounded-[6px] max-[620px]:p-2 ${alert ? "border-[#ff725f]" : "border-[#dfe6ec]"}`} key={title}>
                <div className={`grid h-9 w-9 place-items-center rounded-[6px] max-[1024px]:h-7 max-[1024px]:w-7 max-[620px]:hidden ${alert ? "bg-[#ffd5cc] text-[#ff725f]" : "bg-[#d6e6fb] text-[#1954a0]"}`}>
                  <span className="material-symbols-outlined text-[21px]">{icon}</span>
                </div>
                <span className={`absolute right-7 top-7 material-symbols-outlined text-[21px] max-[1024px]:right-4 max-[1024px]:top-4 max-[620px]:hidden ${alert ? "text-[#ff725f]" : "text-[#16bc56]"}`}>north_east</span>
                <p className="mb-0 mt-5 text-[11px] font-bold uppercase tracking-[.07em] text-[#858b90] max-[1024px]:mt-3 max-[620px]:mt-0 max-[620px]:text-[6px] max-[620px]:tracking-normal">{title}</p>
                <strong className="mt-1 block text-[29px] font-extrabold leading-tight max-[1024px]:text-[23px] max-[620px]:text-[11px]">{value}</strong>
                <small className="text-[12px] text-[#8e959b] max-[1024px]:text-[9px] max-[620px]:hidden">{note}</small>
              </article>
            ))}
          </section>

          <section className="mt-5 overflow-hidden rounded-[11px] border border-[#dfe6ec] bg-white shadow-[0_3px_8px_rgb(31_59_82_/_14%)] max-[620px]:mt-3">
            <header className="flex items-center justify-between gap-4 border-b border-[#e1e6eb] px-7 py-5 max-[620px]:items-start max-[620px]:px-3 max-[620px]:py-3">
              <div>
                <p className="m-0 text-[10px] font-bold uppercase tracking-[.12em] text-[#777e85]">Stock ledger</p>
                <h2 className="m-0 mt-1 text-[21px] font-bold max-[620px]:text-[13px]">Parts &amp; equipment</h2>
              </div>
              <div className="flex gap-3 max-[620px]:w-full">
                <label className="flex h-9 min-w-[180px] items-center gap-2 rounded-[6px] border border-[#d9dfe4] bg-[#f8f9fa] px-3 text-[11px] text-[#174f9a] max-[620px]:min-w-0 max-[620px]:flex-1 max-[620px]:text-[9px]">
                  <span className="material-symbols-outlined text-[18px] text-[#9ba3aa]">search</span>
                  <input className="min-w-0 w-full border-0 bg-transparent outline-none placeholder:text-[#174f9a]" placeholder="Search part or code" />
                </label>
                <button className="flex h-9 items-center gap-2 rounded-[6px] border border-[#d9dfe4] bg-[#f8f9fa] px-3 text-[11px] text-[#174f9a] max-[620px]:hidden"><span className="material-symbols-outlined text-[17px]">tune</span> All branches</button>
              </div>
            </header>
            <div className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr_90px] items-center bg-[#fafafa] px-7 py-3 text-[10px] font-bold uppercase tracking-[.08em] text-[#77818a] max-[850px]:grid-cols-[2fr_1fr_1fr_1fr_90px] max-[850px]:px-4 max-[620px]:hidden">
              <span>Part name</span><span>Quantity</span><span>Branch</span><span>Category</span><span>Status</span><span>Action</span>
            </div>
            {inventoryItems.map(([icon, name, code, quantity, minimum, branch, category, status, alert]) => (
              <div className={`grid min-h-[64px] grid-cols-[2fr_1fr_1fr_1fr_1fr_90px] items-center border-t border-[#e4e8eb] px-7 text-[11px] max-[850px]:grid-cols-[2fr_1fr_1fr_1fr_90px] max-[850px]:px-4 max-[620px]:min-h-[62px] max-[620px]:grid-cols-[1fr_auto] max-[620px]:gap-x-2 max-[620px]:gap-y-1 max-[620px]:px-3 max-[620px]:py-2 ${alert ? "bg-[#fff3f1]" : "bg-white"}`} key={code}>
                <div className="flex min-w-0 items-center gap-4 max-[620px]:col-start-1 max-[620px]:row-span-2 max-[620px]:gap-2">
                  <span className={`grid h-9 w-9 flex-none place-items-center rounded-[6px] max-[620px]:hidden ${alert ? "bg-[#ffd5cc] text-[#ff5a42]" : "bg-[#d6e6fb] text-[#1954a0]"}`}><span className="material-symbols-outlined text-[19px]">{icon}</span></span>
                  <span className="min-w-0"><strong className="block truncate">{name}</strong><small className="mt-1 block text-[10px] text-[#8d969e]">{code}</small></span>
                </div>
                <strong className="max-[620px]:col-start-2 max-[620px]:row-start-1 max-[620px]:text-[9px]">{quantity}<small className="font-normal text-[#8d969e]"> / min {minimum}</small></strong>
                <strong className="max-[620px]:hidden">{branch}</strong>
                <span className="text-[#7f8992] max-[620px]:hidden">{category}</span>
                <span className={`w-max rounded-full border px-3 py-1 text-[10px] max-[620px]:col-start-2 max-[620px]:row-start-2 max-[620px]:justify-self-end max-[620px]:px-2 max-[620px]:py-0.5 max-[620px]:text-[7px] ${alert ? "border-[#ffb0a3] text-[#f05b48]" : "border-[#d7dadd] text-[#70777d]"}`}><span className="material-symbols-outlined mr-1 align-middle text-[13px] max-[620px]:hidden">{alert ? "warning" : "check_circle"}</span>{status}</span>
                <a href="#action" className="text-right text-[10px] font-bold text-[#7573bd] max-[620px]:hidden">{alert ? "Requisition" : "View"}</a>
              </div>
            ))}
          </section>
          <footer className="mt-6 border-t border-[#c9d4de] pt-3 text-[9px] text-[#8a9299] max-[1024px]:hidden">Guard-All Electronic Security Systems, Inc.</footer>
        </div>
        <nav className="hidden max-[1024px]:fixed max-[1024px]:bottom-0 max-[1024px]:left-0 max-[1024px]:right-0 max-[1024px]:z-10 max-[1024px]:grid max-[1024px]:grid-cols-5 max-[1024px]:border-t max-[1024px]:border-[#d5dfe8] max-[1024px]:bg-white max-[1024px]:py-2 max-[620px]:py-1" aria-label="Mobile navigation"><a className="flex flex-col items-center text-[7px] text-[#8a9299] no-underline" href="/dashboard"><span className="material-symbols-outlined text-[17px]">dashboard</span>Dash</a><a className="flex flex-col items-center text-[7px] text-[#8a9299] no-underline" href="/scheduling"><span className="material-symbols-outlined text-[17px]">calendar_month</span>Schedule</a><a className="flex flex-col items-center text-[7px] text-[#8a9299] no-underline" href="/reports"><span className="material-symbols-outlined text-[17px]">assignment</span>Reports</a><a className="flex flex-col items-center text-[7px] text-[#8a9299] no-underline" href="/billing"><span className="material-symbols-outlined text-[17px]">sell</span>Billing</a><a className="flex flex-col items-center text-[7px] font-bold text-[#174f9a] no-underline" href="/inventory"><span className="material-symbols-outlined text-[17px]">inventory_2</span>Inventory</a></nav>
      </section>
    </main>
  );
}

export default Inventory;
