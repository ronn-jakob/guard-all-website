import { useEffect, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import logo from "../images/Guard All Logo White.png";
import { canAccessModule, clearSession, getSession } from "../lib/auth.js";

const primaryNavigation = [
  ["dashboard", "Dashboard", "/dashboard", null],
  ["calendar_month", "Scheduling", "/scheduling", "scheduling"],
  ["inventory_2", "Inventory", "/inventory", "inventory"],
  ["assignment", "Field Reports", "/reports", "field_reporting"],
  ["sell", "Sales & Billing", "/billing", "sales_billing"],
];

function Sidebar() {
  const [session, setSession] = useState(() => getSession());
  const role = session?.user?.role;
  const displayName = session?.user?.name || "Account";
  const nameParts = displayName.trim().split(/\s+/).filter(Boolean);
  const initials = nameParts
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  const profilePhotoKey = session?.user?.id
    ? `profilePhoto:${session.user.id}`
    : "profilePhoto";
  const [menuOpen, setMenuOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [profilePhoto, setProfilePhoto] = useState(
    () => localStorage.getItem(profilePhotoKey) || localStorage.getItem("profilePhoto") || "",
  );
  const navigate = useNavigate();

  useEffect(() => {
    const handleProfileUpdate = () => {
      setProfilePhoto(localStorage.getItem(profilePhotoKey) || "");
    };
    const handleAccountUpdate = () => setSession(getSession());

    window.addEventListener("profile-updated", handleProfileUpdate);
    window.addEventListener("account-updated", handleAccountUpdate);
    return () => {
      window.removeEventListener("profile-updated", handleProfileUpdate);
      window.removeEventListener("account-updated", handleAccountUpdate);
    };
  }, []);

  const navigation = [
    ...primaryNavigation,
    ["manage_accounts", "Manage Accounts", "/account", "admin"],
  ];
  const handleLogout = () => {
    clearSession();
    setProfileOpen(false);
    navigate("/");
  };

  return (
  <aside className="sticky top-0 flex h-screen w-[249px] flex-none flex-col bg-[#174f9a] text-white max-[1024px]:pointer-events-none max-[1024px]:fixed max-[1024px]:left-0 max-[1024px]:top-0 max-[1024px]:z-40 max-[1024px]:h-0 max-[1024px]:w-full max-[1024px]:bg-transparent">
      <div className="grid h-[67px] place-items-center border-b border-white/25 bg-[#1250a0] max-[1024px]:hidden">
        <img
          className="max-h-[52px] w-[150px] object-contain"
          src={logo}
          alt="Guard-All"
        />
      </div>
      <button
        aria-expanded={menuOpen}
        aria-label={menuOpen ? "Close navigation menu" : "Open navigation menu"}
        className="hidden border-0 bg-[#1250a0] text-white shadow-[0_3px_10px_rgb(4_35_78_/_22%)] max-[1024px]:pointer-events-auto max-[1024px]:fixed max-[1024px]:left-3 max-[1024px]:top-3 max-[1024px]:z-50 max-[1024px]:grid max-[1024px]:h-10 max-[1024px]:w-10 max-[1024px]:place-items-center max-[1024px]:rounded-[7px]"
        onClick={() => setMenuOpen((isOpen) => !isOpen)}
        type="button"
      >
        <span className="material-symbols-outlined text-[22px]">
          {menuOpen ? "close" : "menu"}
        </span>
      </button>
      <div className={`px-[18px] py-7 max-[1024px]:pointer-events-auto max-[1024px]:fixed max-[1024px]:bottom-0 max-[1024px]:left-0 max-[1024px]:top-0 max-[1024px]:z-40 max-[1024px]:w-[260px] max-[1024px]:border-r max-[1024px]:border-white/15 max-[1024px]:bg-[#174f9a] max-[1024px]:p-3 max-[1024px]:pt-16 max-[1024px]:shadow-[6px_0_18px_rgb(4_35_78_/_22%)] ${menuOpen ? "" : "max-[1024px]:hidden"}`}>
        <p className="mb-3 ml-4 text-[10px] font-bold uppercase tracking-[.14em] text-[#a9c7ed] max-[1024px]:hidden">
          Operation console
        </p>
        <nav className="space-y-1 max-[1024px]:flex max-[1024px]:flex-col max-[1024px]:gap-1">
          {navigation.map(([icon, name, path, module]) => {
            const enabled = !module || canAccessModule(module, role);
            const targetPath = name === "Field Reports" && role === "Technician"
              ? "/reports/new"
              : path;
            const content = (isActive = false) => (
              <>
                <span
                  className={`grid h-6 w-6 place-items-center rounded-[4px] transition-colors ${isActive ? "bg-[#dceaff] text-[#14519f]" : "bg-white/10 text-[#dceaff] group-hover:bg-white/15"}`}
                >
                  <span className="material-symbols-outlined text-[18px]">
                    {icon}
                  </span>
                </span>
                {name}
                {!enabled && <span className="material-symbols-outlined ml-auto text-[15px] opacity-70">lock</span>}
              </>
            );

            if (!enabled) {
              return (
                <button
                  className="group relative flex h-10 w-full cursor-not-allowed items-center gap-3 rounded-[7px] border-0 bg-transparent px-3.5 text-left text-[13px] font-medium text-white/45 max-[1024px]:h-10 max-[1024px]:px-3 max-[1024px]:text-[12px]"
                  key={name}
                  onClick={(event) => event.preventDefault()}
                  title="Your role does not have access to this module"
                  type="button"
                >
                  {content()}
                </button>
              );
            }

            return (
              <NavLink
                className={({ isActive }) =>
                  `group relative flex h-10 items-center gap-3 rounded-[7px] px-3.5 text-[13px] font-medium no-underline transition-all max-[1024px]:h-10 max-[1024px]:w-full max-[1024px]:justify-start max-[1024px]:gap-3 max-[1024px]:whitespace-nowrap max-[1024px]:px-3 max-[1024px]:text-[12px] ${isActive ? "bg-white font-bold text-[#174f9a] shadow-[0_3px_10px_rgb(3_36_79_/_18%)]" : "text-[#eef5ff] hover:bg-white/10 hover:text-white"}`
                }
                to={targetPath}
                key={name}
              >
                {({ isActive }) => content(isActive)}
              </NavLink>
            );
          })}
        </nav>
        <div className="mt-5 hidden border-t border-white/15 pt-4 max-[1024px]:block">
          <button
            className="flex w-full items-center gap-3 border-0 bg-transparent px-3 text-left text-white"
            onClick={() => setProfileOpen((isOpen) => !isOpen)}
            type="button"
          >
            {profilePhoto ? (
              <img className="h-8 w-8 rounded-full object-cover" src={profilePhoto} alt="" />
            ) : (
              <div className="grid h-8 w-8 place-items-center rounded-full bg-[#ff4825] text-[10px] font-bold">
                {initials}
              </div>
            )}
            <div>
              <strong className="block text-[12px]">{displayName}</strong>
              <small className="block text-[10px] text-[#d6e4f9]">
                {role || "No role"}
              </small>
            </div>
            <span className="material-symbols-outlined ml-auto text-[18px]">
              {profileOpen ? "expand_less" : "expand_more"}
            </span>
          </button>
          {profileOpen && (
            <div className="mt-3 space-y-1 border-t border-white/15 pt-3">
              <NavLink
                className="flex items-center gap-2 rounded-[6px] px-3 py-2 text-[12px] font-semibold text-white no-underline transition-colors hover:bg-white/10"
                to="/settings"
              >
                <span className="material-symbols-outlined text-[17px]">
                  settings
                </span>
                Settings
              </NavLink>
              <button
                className="flex w-full items-center gap-2 rounded-[6px] border border-white/15 bg-white/10 px-3 py-2 text-left text-[12px] font-semibold text-white transition-colors hover:bg-white/15"
                onClick={handleLogout}
                type="button"
              >
                <span className="material-symbols-outlined text-[17px]">
                  logout
                </span>
                Logout
              </button>
            </div>
          )}
        </div>
      </div>
      <div className="relative mx-3 mb-5 mt-auto rounded-[7px] border border-white/20 bg-white/10 p-3 max-[1024px]:hidden">
        <button
          className="flex w-full items-center gap-3 border-0 bg-transparent p-0 text-left text-white"
          onClick={() => setProfileOpen((isOpen) => !isOpen)}
        >
          {profilePhoto ? (
            <img className="h-9 w-9 flex-none rounded-full object-cover" src={profilePhoto} alt="" />
          ) : (
            <div className="grid h-9 w-9 flex-none place-items-center rounded-full bg-[#ff4825] text-[12px] font-bold">
                {initials}
            </div>
          )}
          <div>
              <strong className="block text-[13px]">{displayName}</strong>
            <small className="block text-[11px] text-[#d6e4f9]">
                {role || "No role"}
            </small>
          </div>
          <span
            className={`material-symbols-outlined ml-auto text-[21px] transition-transform ${profileOpen ? "rotate-180" : ""}`}
          >
            expand_more
          </span>
        </button>
        {profileOpen && (
          <div className="mt-3 space-y-1 border-t border-white/20 pt-3">
            <NavLink
              className="flex items-center gap-2 rounded-[6px] px-2 py-2 text-[12px] font-semibold text-white no-underline transition-colors hover:bg-white/10"
              to="/settings"
            >
              <span className="material-symbols-outlined text-[18px]">
                settings
              </span>
              Settings
            </NavLink>
            <button
              className="flex w-full items-center gap-2 border-0 bg-transparent px-2 py-2 text-left text-[12px] font-semibold text-white transition-colors hover:text-[#ffd5cc]"
              onClick={handleLogout}
              type="button"
            >
              <span className="material-symbols-outlined text-[18px]">
                logout
              </span>
              Logout
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}

export default Sidebar;
