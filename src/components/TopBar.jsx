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
    <header className="sticky top-0 z-20 flex h-14 items-center justify-between bg-[#fffaf9] px-3 shadow-[0_2px_5px_rgb(27_54_79_/_15%)] max-[1024px]:pl-16 max-[1024px]:pr-3 max-[768px]:h-12 max-[480px]:pl-14 max-[480px]:pr-2">
      <div className="min-w-0 flex-1">
        <p className="m-0 truncate text-[10px] font-bold uppercase tracking-[.12em] text-[#7c8186] max-[620px]:text-[9px] max-[480px]:text-[8px]">
          Guard All / Makati - Metro Manila
        </p>
        <strong className="block truncate text-[13px] text-[#202a35] max-[620px]:text-[11px] max-[480px]:text-[10px]">
          <span className="max-[640px]:hidden">{date}</span>
          <span className="px-2 text-[#9ca3aa] max-[640px]:hidden">•</span>
          {time}
        </strong>
      </div>
    </header>
  );
}

export default TopBar;
