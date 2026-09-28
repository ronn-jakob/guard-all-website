import Sidebar from "./Sidebar.jsx";
import logo from "../images/Guard All Logo Blue.png";
import TopBar from "./TopBar.jsx";

const invoices = [
  ["INV - 10822", "Alder House Hotel", "FSR - 2026 - 0413", "15 Apr, 2026", "₱39,550", "Paid"],
  ["INV - 10819", "Alder House Hotel", "FSR - 2026 - 0414", "16 Apr, 2026", "₱27,600", "Pending"],
  ["INV - 10816", "Alder House Hotel", "FSR - 2026 - 0410", "15 Apr, 2026", "₱42,800", "Paid"],
  ["INV - 10811", "Alder House Hotel", "FSR - 2026 - 0408", "12 Apr, 2026", "₱11,950", "Pending"],
];

const summary = [
  ["mail", "Revenue this month", "₱100,800", "12 invoices issued"],
  ["check_circle", "Collected", "₱61,250", "Paid invoices"],
  ["warning", "Outstanding", "₱39,550", "2 invoices pending", true],
];

function SalesBilling() {
  return (
    <main className="flex h-screen overflow-hidden bg-[#1f2022] font-sans text-[#063b7c] max-[1024px]:block max-[1024px]:[&>aside]:hidden">
      <Sidebar />
      <section className="h-screen min-w-0 flex-1 overflow-y-auto bg-[#edf7ff]">
        <TopBar />
        <header className="hidden h-[52px] items-center justify-between border-b border-[#d7e2ec] bg-white px-4 max-[1024px]:flex">
          <img className="h-7 w-[95px] object-contain" src={logo} alt="Guard-All" />
          <div className="text-right text-[7px] text-[#7c8186]"><strong className="block text-[8px] text-[#202a35]">Makati - Metro Manila</strong><span>Mon, 15 Sep 2026 · 9:58 AM</span></div>
          <span className="grid h-7 w-7 place-items-center rounded-full bg-[#ff4825] text-[8px] font-bold text-white">RJ</span>
        </header>

        <div className="px-8 pb-6 pt-8 max-[1024px]:px-6 max-[1024px]:pb-20 max-[1024px]:pt-5 max-[620px]:px-3">
          <div className="mb-7 flex items-end justify-between gap-5 max-[620px]:mb-4 max-[620px]:items-start"><div><p className="mb-1 text-[10px] font-bold uppercase tracking-[.12em] text-[#818b94] max-[620px]:text-[7px]">Finance / Invoice queue</p><h1 className="m-0 text-[30px] font-bold tracking-[-.5px] max-[1024px]:text-[24px] max-[620px]:text-[19px]">Sales &amp; Billing</h1><p className="mb-0 mt-2 text-[14px] text-[#8b949c] max-[620px]:mt-1 max-[620px]:text-[9px]">Completed reports become clean, traceable invoices.</p></div><div className="flex items-center gap-4 max-[620px]:self-end"><span className="material-symbols-outlined text-[31px] max-[620px]:hidden">calendar_month</span><button className="rounded-[6px] bg-[#1250a0] px-5 py-3 text-[12px] font-bold text-white shadow-[0_2px_4px_rgb(18_80_160_/_25%)] max-[1024px]:px-4 max-[1024px]:py-2 max-[620px]:w-full max-[620px]:px-3 max-[620px]:py-2 max-[620px]:text-[9px]">+ New invoice</button></div></div>

          <section className="grid grid-cols-3 gap-[18px] max-[620px]:gap-1">{summary.map(([icon, title, value, note, alert]) => <article className={`relative min-h-[156px] rounded-[11px] border bg-white p-7 shadow-[0_3px_8px_rgb(31_59_82_/_14%)] max-[1024px]:min-h-[112px] max-[1024px]:p-4 max-[620px]:min-h-[58px] max-[620px]:rounded-[6px] max-[620px]:p-2 ${alert ? "border-[#ff725f]" : "border-[#dfe6ec]"}`} key={title}><div className={`grid h-9 w-9 place-items-center rounded-[6px] max-[1024px]:h-7 max-[1024px]:w-7 max-[620px]:hidden ${alert ? "bg-[#ffd5cc] text-[#ff725f]" : "bg-[#d6e6fb] text-[#1954a0]"}`}><span className="material-symbols-outlined text-[21px]">{icon}</span></div><span className={`absolute right-7 top-7 material-symbols-outlined text-[21px] max-[1024px]:right-4 max-[1024px]:top-4 max-[620px]:hidden ${alert ? "text-[#ff725f]" : "text-[#16bc56]"}`}>north_east</span><p className="mb-0 mt-5 text-[11px] font-bold uppercase tracking-[.07em] text-[#858b90] max-[1024px]:mt-3 max-[620px]:mt-0 max-[620px]:text-[6px] max-[620px]:tracking-normal">{title}</p><strong className="mt-1 block text-[29px] font-extrabold leading-tight max-[1024px]:text-[23px] max-[620px]:text-[11px]">{value}</strong><small className="text-[12px] text-[#8e959b] max-[1024px]:text-[9px] max-[620px]:hidden">{note}</small></article>)}</section>

          <section className="mt-5 overflow-hidden rounded-[11px] border border-[#dfe6ec] bg-white shadow-[0_3px_8px_rgb(31_59_82_/_14%)] max-[620px]:mt-3"><header className="flex items-center justify-between gap-4 border-b border-[#e1e6eb] px-7 py-5 max-[620px]:px-3 max-[620px]:py-3"><div><p className="m-0 text-[10px] font-bold uppercase tracking-[.12em] text-[#777e85] max-[620px]:text-[7px]">Generated from field reports</p><h2 className="m-0 mt-1 text-[21px] font-bold max-[620px]:text-[13px]">Invoice register</h2></div><div className="flex rounded-full border border-[#dfe4e8] bg-[#f8fafc] p-1 text-[10px] max-[620px]:text-[7px]"><button className="rounded-full bg-white px-4 py-1 font-bold text-[#174f9a] shadow-sm max-[620px]:px-2">All</button><button className="px-4 py-1 text-[#87929d] max-[620px]:px-2">Paid</button><button className="px-4 py-1 text-[#87929d] max-[620px]:px-2">Pending</button></div></header>
            <div className="grid grid-cols-[1.25fr_1.4fr_1fr_1fr_1fr_90px] items-center bg-[#fafafa] px-7 py-3 text-[10px] font-bold uppercase tracking-[.08em] text-[#77818a] max-[850px]:grid-cols-[1.25fr_1.4fr_1fr_1fr_90px] max-[850px]:px-4 max-[620px]:hidden"><span>Invoice</span><span>Client / source report</span><span>Issued</span><span>Amount</span><span>Status</span><span>Action</span></div>
            {invoices.map(([id, client, report, date, amount, status]) => <div className="grid min-h-[57px] grid-cols-[1.25fr_1.4fr_1fr_1fr_1fr_90px] items-center border-t border-[#e4e8eb] px-7 text-[11px] max-[850px]:grid-cols-[1.25fr_1.4fr_1fr_1fr_90px] max-[850px]:px-4 max-[620px]:grid-cols-[1fr_auto] max-[620px]:gap-x-2 max-[620px]:gap-y-1 max-[620px]:px-3 max-[620px]:py-3" key={id}><div className="max-[620px]:col-start-1"><strong className="block text-[#174f9a] max-[620px]:text-[9px]">{id}</strong><small className="text-[9px] text-[#8d969e] max-[620px]:text-[7px]">▤ Service invoice</small></div><div className="max-[620px]:col-start-1"><strong className="block max-[620px]:text-[9px]">{client}</strong><small className="text-[9px] text-[#8d969e] max-[620px]:text-[7px]">{report}</small></div><span className="max-[620px]:col-start-1 max-[620px]:text-[7px]">{date}</span><strong className="text-[10px] max-[620px]:col-start-2 max-[620px]:row-start-1 max-[620px]:text-[8px]">{amount}</strong><span className={`w-max rounded-full border px-3 py-1 text-[10px] max-[620px]:col-start-2 max-[620px]:row-start-2 max-[620px]:justify-self-end max-[620px]:px-2 max-[620px]:py-0.5 max-[620px]:text-[7px] ${status === "Paid" ? "border-[#73a9eb] bg-[#eef6ff] text-[#1762b1]" : "border-[#ffb0a3] bg-[#fff3f1] text-[#f05b48]"}`}><span className="material-symbols-outlined mr-1 align-middle text-[13px] max-[620px]:hidden">{status === "Paid" ? "check_circle" : "schedule"}</span>{status}</span><a className="text-right text-[9px] font-bold text-[#7573bd] max-[620px]:hidden" href="#invoice">{status === "Paid" ? "View receipt" : "✓ Mark paid"}</a></div>)}
            <footer className="flex items-center justify-between border-t border-[#e4e8eb] px-7 py-3 text-[10px] text-[#7f8992] max-[620px]:hidden"><span>Invoices are linked to approved field reports automatically</span><span>◷ Last reconciliation 8:40 AM</span></footer>
          </section>
          <footer className="mt-6 border-t border-[#c9d4de] pt-3 text-[9px] text-[#8a9299] max-[1024px]:hidden">Guard-All Electronic Security Systems, Inc.</footer>
        </div>
        <nav className="hidden max-[1024px]:fixed max-[1024px]:bottom-0 max-[1024px]:left-0 max-[1024px]:right-0 max-[1024px]:z-10 max-[1024px]:grid max-[1024px]:grid-cols-5 max-[1024px]:border-t max-[1024px]:border-[#d5dfe8] max-[1024px]:bg-white max-[1024px]:py-2 max-[620px]:py-1" aria-label="Mobile navigation"><a className="flex flex-col items-center text-[7px] text-[#8a9299] no-underline" href="/dashboard"><span className="material-symbols-outlined text-[17px]">dashboard</span>Dash</a><a className="flex flex-col items-center text-[7px] text-[#8a9299] no-underline" href="/scheduling"><span className="material-symbols-outlined text-[17px]">calendar_month</span>Schedule</a><a className="flex flex-col items-center text-[7px] text-[#8a9299] no-underline" href="/reports"><span className="material-symbols-outlined text-[17px]">assignment</span>Reports</a><a className="flex flex-col items-center text-[7px] font-bold text-[#174f9a] no-underline" href="/billing"><span className="material-symbols-outlined text-[17px]">sell</span>Billing</a><a className="flex flex-col items-center text-[7px] text-[#8a9299] no-underline" href="/inventory"><span className="material-symbols-outlined text-[17px]">inventory_2</span>Inventory</a></nav>
      </section>
    </main>
  );
}

export default SalesBilling;
