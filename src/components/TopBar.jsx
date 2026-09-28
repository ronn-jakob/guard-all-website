import { useEffect, useState } from "react";

function TopBar() {
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

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
    <header className="sticky top-0 z-20 flex h-16 items-center justify-between bg-[#fffaf9] px-6 shadow-[0_2px_5px_rgb(27_54_79_/_15%)]">
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
      <button
        className="relative border-0 bg-transparent text-[#174f9a]"
        aria-label="Notifications"
        type="button"
      >
        <span className="material-symbols-outlined text-[27px]">notifications</span>
        <i className="absolute right-[-1px] top-px h-[6px] w-[6px] rounded-full bg-[#fb4126]" />
      </button>
    </header>
  );
}

export default TopBar;
