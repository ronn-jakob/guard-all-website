import { useEffect, useState, useRef } from "react";

const initialNotifications = [
  {
    id: 1,
    title: "New Service Field Report",
    message: "FSR - 2026 - 0415 submitted by Tech Manila.",
    time: "10 mins ago",
    unread: true,
  },
  {
    id: 2,
    title: "Invoice Approved",
    message: "INV - 10822 payment verified by Alder House Hotel.",
    time: "1 hour ago",
    unread: true,
  },
  {
    id: 3,
    title: "Schedule Updated",
    message: "Maintenance inspection assigned for tomorrow at 9:00 AM.",
    time: "3 hours ago",
    unread: false,
  },
];

function TopBar() {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState(initialNotifications);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const hasUnread = notifications.some((n) => n.unread);

  const handleMarkAllRead = () => {
    setNotifications((prev) =>
      prev.map((item) => ({ ...item, unread: false }))
    );
  };

  const date = currentTime.toLocaleDateString("en-US", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const time = currentTime.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center justify-between bg-[#fffaf9] px-6 shadow-[0_2px_5px_rgb(27_54_79_/_15%)] max-[1024px]:pl-16">
      <div>
        <p className="m-0 text-[10px] font-bold uppercase tracking-[.12em] text-[#7c8186]">
          Guard All / Makati - Metro Manila
        </p>
        <strong className="text-[13px] text-[#202a35]">
          {date}
          <span className="px-2 text-[#9ca3aa]">•</span>
          {time}
        </strong>
      </div>

      <div className="relative" ref={dropdownRef}>
        <button
          className="relative border-0 bg-transparent text-[#174f9a] outline-none cursor-pointer"
          type="button"
          onClick={() => setIsOpen((prev) => !prev)}
        >
          <span className="material-symbols-outlined text-[27px]">
            notifications
          </span>
          {hasUnread && (
            <i className="absolute right-[-1px] top-px h-[6px] w-[6px] rounded-full bg-[#fb4126]" />
          )}
        </button>

        {isOpen && (
          <div className="absolute right-0 mt-2 w-80 rounded-xl border border-[#dfe6ec] bg-white p-4 shadow-[0_10px_25px_rgba(0,0,0,0.12)]">
            <div className="mb-3 flex items-center justify-between border-b border-[#f0f4f8] pb-2">
              <h3 className="m-0 text-[14px] font-bold text-[#174f9a]">
                Notifications
              </h3>
              {hasUnread && (
                <button
                  type="button"
                  onClick={handleMarkAllRead}
                  className="text-[11px] font-semibold text-[#1250a0] hover:underline"
                >
                  Mark all as read
                </button>
              )}
            </div>

            <div className="max-h-72 overflow-y-auto">
              {notifications.length === 0 ? (
                <p className="py-4 text-center text-[12px] text-[#8e959b]">
                  No notifications
                </p>
              ) : (
                notifications.map((item) => (
                  <div
                    key={item.id}
                    className={`mb-2 rounded-lg p-2.5 transition-colors ${
                      item.unread ? "bg-[#f2f7fd]" : "hover:bg-[#f8fafc]"
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <strong className="text-[12px] text-[#202a35]">
                        {item.title}
                      </strong>
                      {item.unread && (
                        <span className="ml-2 h-2 w-2 rounded-full bg-[#fb4126]" />
                      )}
                    </div>
                    <p className="mb-1 mt-0.5 text-[11px] text-[#63707e]">
                      {item.message}
                    </p>
                    <small className="text-[9px] text-[#939da7]">
                      {item.time}
                    </small>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </header>
  );
}

export default TopBar;