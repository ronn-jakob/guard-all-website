import { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import logo from "../images/Guard All Logo White.png";

const navigation = [
  ["dashboard", "Dashboard", "/dashboard"],
  ["calendar_month", "Scheduling", "/scheduling"],
  ["inventory_2", "Inventory", "/inventory"],
   ["assignment", "Field Reports", "/reports"],
  ["sell", "Sales & Billing", "/billing"],
];

function Sidebar() {
  const [profileOpen, setProfileOpen] = useState(false);
  const navigate = useNavigate();

  const handleLogout = () => {
    setProfileOpen(false);
    navigate("/");
  };

  return (
    <aside className="sticky top-0 flex h-screen w-[249px] flex-none flex-col bg-[#174f9a] text-white max-[850px]:w-[65px]">
      <div className="grid h-[67px] place-items-center border-b border-white/25 bg-[#1250a0]">
        <img className="max-h-[52px] w-[150px] object-contain max-[850px]:w-12" src={logo} alt="Guard-All" />
      </div>
      <div className="px-[18px] py-7">
        <p className="mb-5 ml-4 text-[11px] font-bold uppercase tracking-[.12em] text-[#d9e8ff] max-[850px]:text-[0px]">
          Operations console
        </p>
        <nav aria-label="Main navigation" className="space-y-1">
          {navigation.map(([icon, name, path]) => (
            <NavLink
              className={({ isActive }) =>
                `flex h-12 items-center gap-3 rounded-[6px] px-4 text-[14px] no-underline transition-colors max-[850px]:justify-center max-[850px]:px-0 max-[850px]:text-[0px] ${isActive ? "bg-white font-bold text-[#174f9a]" : "bg-transparent text-white"}`
              }
              to={path}
              key={name}
            >
              <span className="material-symbols-outlined w-6 text-center text-[21px]">
                {icon}
              </span>
              {name}
            </NavLink>
          ))}
        </nav>
      </div>
      <div className="mx-3 mb-5 mt-auto rounded-[7px] border border-white/20 bg-white/10 p-3 max-[850px]:mx-[7px] max-[850px]:p-[6px]">
        <button
          className="flex w-full items-center gap-3 border-0 bg-transparent p-0 text-left text-white"
          onClick={() => setProfileOpen((isOpen) => !isOpen)}
          type="button"
          aria-expanded={profileOpen}
        >
          <div className="grid h-9 w-9 flex-none place-items-center rounded-full bg-[#ff4825] text-[12px] font-bold">
            RJ
          </div>
          <div className="max-[850px]:hidden">
            <strong className="block text-[13px]">R. Jakob</strong>
            <small className="block text-[11px] text-[#d6e4f9]">Service Manager</small>
          </div>
          <span className={`material-symbols-outlined ml-auto text-[21px] transition-transform max-[850px]:hidden ${profileOpen ? "rotate-180" : ""}`}>
            expand_more
          </span>
        </button>
        {profileOpen && (
          <button
            className="mt-3 flex w-full items-center gap-2 border-t border-white/20 pt-3 text-left text-[12px] font-semibold text-white transition-colors hover:text-[#ffd5cc] max-[850px]:justify-center max-[850px]:border-0 max-[850px]:pt-1"
            onClick={handleLogout}
            type="button"
          >
            <span className="material-symbols-outlined text-[18px]">logout</span>
            <span className="max-[850px]:hidden">Logout</span>
          </button>
        )}
      </div>
    </aside>
  );
}

export default Sidebar;
