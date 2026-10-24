import { listInventory } from "../../lib/api/inventory.js";

export function formatCurrency(value) {
  return `₱${Number(value || 0).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function mapInventoryRecord(row) {
  const part = row.parts;
  const quantity = Number(row.quantity_on_hand) || 0;
  const quantityAvailable = Math.max(
    0,
    quantity - (Number(row.quantity_reserved) || 0),
  );
  const minimum = Number(part.reorder_threshold) || 0;
  const unitPrice = Number(part.unit_cost) || 0;
  const statusName = quantity <= minimum ? "Low stock" : "In stock";
  const icon = part.category === "Intrusion" ? "deployed_code" : "inventory_2";

  return [
    icon,
    part.name,
    part.sku,
    String(quantity),
    String(minimum),
    row.branch.replace(/^./, (letter) => letter.toUpperCase()),
    part.address || "—",
    formatCurrency(unitPrice),
    formatCurrency(unitPrice * quantity),
    part.category || "Uncategorized",
    statusName,
    statusName === "Low stock",
    row.stock_id,
    row.part_id,
    part.unit_of_measure,
    part.notes || "",
    quantityAvailable,
    part.category_id || "",
  ];
}

export function isScheduleNearToday(dateValue) {
  const [year, month, day] = String(dateValue).split("-").map(Number);
  const scheduledDate = new Date(year, month - 1, day);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const daysUntilSchedule = Math.round(
    (scheduledDate.getTime() - today.getTime()) / 86400000,
  );
  return Math.abs(daysUntilSchedule) <= 3;
}

export async function fetchInventoryRecords(payload = {}) {
  const result = await listInventory(payload);
  return (result.items || []).map(mapInventoryRecord);
}

export const branchOptions = ["All branches", "Makati", "Cebu"];

// Outcome of a work order's stock: open while anything is still reserved, then
// whether the reservation was fully used, fully returned, or a mix.
export const allocationOutcomeStyles = {
  "In progress": "border-[#e6b24c] bg-[#fff8e6] text-[#a56b00]",
  "Fully used": "border-[#8bdba2] bg-[#dff8e5] text-[#18823a]",
  "Partly returned": "border-[#73a9eb] bg-[#eef6ff] text-[#1762b1]",
  "Fully returned": "border-[#d7dadd] bg-[#f4f5f6] text-[#70777d]",
};
export const allocationOutcomeFilters = ["All", "In progress", "Closed"];
