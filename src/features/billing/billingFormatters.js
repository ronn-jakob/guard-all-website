export const formatPeso = (value) =>
  `₱${Number(value || 0).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

export const formatDate = (value) =>
  value
    ? new Date(`${value}T00:00:00`).toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "—";

export const todayKey = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
    now.getDate(),
  ).padStart(2, "0")}`;
};

export const methodLabels = {
  cash: "Cash",
  check: "Check",
  bank_transfer: "Bank transfer",
  online: "Online",
};

export const statusLabels = {
  paid: "Paid",
  pending: "Pending",
  overdue: "Overdue",
  cancelled: "Cancelled",
};

export const statusStyles = {
  paid: "border-[#73a9eb] bg-[#eef6ff] text-[#1762b1]",
  pending: "border-[#ffb0a3] bg-[#fff3f1] text-[#f05b48]",
  overdue: "border-[#e6b24c] bg-[#fff8e6] text-[#a56b00]",
  cancelled: "border-[#d7dadd] bg-[#f4f5f6] text-[#70777d]",
};

export const fieldClass =
  "mt-1.5 h-10 w-full rounded-[6px] border border-[#d6dee6] bg-white px-3 text-[12px] text-[#273746] outline-none transition focus:border-[#14519f] focus:ring-2 focus:ring-[#14519f]/15";
