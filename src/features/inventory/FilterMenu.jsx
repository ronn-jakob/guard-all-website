import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

// The trigger keeps its place in the toolbar; the menu is rendered into <body>
// with fixed positioning. An absolutely positioned menu would be clipped by the
// ledger card's overflow-hidden whenever the card is shorter than the list
// (e.g. a filtered result with no rows).
const MENU_WIDTH = 176; // 11rem, matches w-44
const MENU_GAP = 6;
const VIEWPORT_EDGE = 8;
const MENU_MAX_HEIGHT = 320;
const MENU_MIN_HEIGHT = 96;

const triggerClass =
  "flex h-9 items-center gap-2 rounded-[6px] border border-[#d9dfe4] bg-[#f8f9fa] px-3 text-[11px] font-medium text-[#174f9a] transition-colors hover:bg-[#eff4f9]";

// Measured tight to the trigger: right-aligned, below it unless there is not
// enough room, and never taller than the space actually available.
function measureAnchor(trigger) {
  if (!trigger) return null;
  const rect = trigger.getBoundingClientRect();
  const spaceBelow = window.innerHeight - rect.bottom - MENU_GAP - VIEWPORT_EDGE;
  const spaceAbove = rect.top - MENU_GAP - VIEWPORT_EDGE;
  const openUp = spaceBelow < MENU_MIN_HEIGHT && spaceAbove > spaceBelow;
  const maxHeight = Math.max(
    MENU_MIN_HEIGHT,
    Math.min(MENU_MAX_HEIGHT, openUp ? spaceAbove : spaceBelow),
  );
  const left = Math.min(
    Math.max(VIEWPORT_EDGE, rect.right - MENU_WIDTH),
    window.innerWidth - MENU_WIDTH - VIEWPORT_EDGE,
  );

  return openUp
    ? { left, bottom: window.innerHeight - rect.top + MENU_GAP, maxHeight }
    : { left, top: rect.bottom + MENU_GAP, maxHeight };
}

export default function FilterMenu({
  label,
  options,
  value,
  onSelect,
  ariaLabel,
  triggerClassName = "",
}) {
  const triggerRef = useRef(null);
  const menuRef = useRef(null);
  const [isOpen, setIsOpen] = useState(false);
  const [anchor, setAnchor] = useState(null);

  // Only subscribes; the first measurement happens in the click handler, so the
  // effect never writes state synchronously.
  useLayoutEffect(() => {
    if (!isOpen) return;

    function handleViewportChange() {
      setAnchor(measureAnchor(triggerRef.current));
    }

    window.addEventListener("resize", handleViewportChange);
    window.addEventListener("scroll", handleViewportChange, true);
    return () => {
      window.removeEventListener("resize", handleViewportChange);
      window.removeEventListener("scroll", handleViewportChange, true);
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    function handlePointerDown(event) {
      if (triggerRef.current?.contains(event.target)) return;
      if (menuRef.current?.contains(event.target)) return;
      setIsOpen(false);
    }

    function handleKeyDown(event) {
      if (event.key !== "Escape") return;
      setIsOpen(false);
      triggerRef.current?.focus();
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  function handleToggle() {
    if (isOpen) {
      setIsOpen(false);
      return;
    }
    // Measure before opening so the menu is painted in place on its first frame.
    setAnchor(measureAnchor(triggerRef.current));
    setIsOpen(true);
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-expanded={isOpen}
        aria-haspopup="true"
        aria-label={ariaLabel ? `${ariaLabel}: ${value}` : undefined}
        onClick={handleToggle}
        className={`${triggerClass} ${triggerClassName}`}
      >
        <span className="material-symbols-outlined text-[17px]">tune</span>{" "}
        {label}
        <span className="material-symbols-outlined text-[16px] text-[#777e85]">
          arrow_drop_down
        </span>
      </button>

      {isOpen &&
        anchor &&
        createPortal(
          <div
            ref={menuRef}
            style={{
              left: anchor.left,
              top: anchor.top,
              bottom: anchor.bottom,
              maxHeight: anchor.maxHeight,
            }}
            className="app-portal fixed z-40 w-44 overflow-y-auto rounded-[8px] border border-[#d9dfe4] bg-white p-1 font-sans shadow-[0_8px_20px_rgba(0,0,0,0.12)]"
          >
            {options.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => {
                  onSelect(option);
                  setIsOpen(false);
                }}
                className={`flex w-full items-center justify-between gap-2 rounded-[5px] px-3 py-2 text-left text-[11px] transition-colors ${
                  value === option
                    ? "bg-[#e8f1fd] font-bold text-[#1250a0]"
                    : "text-[#3a434d] hover:bg-[#f1f5f9]"
                }`}
              >
                <span className="truncate">{option}</span>
                {value === option && (
                  <span className="material-symbols-outlined flex-none text-[14px]">
                    check
                  </span>
                )}
              </button>
            ))}
          </div>,
          document.body,
        )}
    </>
  );
}
