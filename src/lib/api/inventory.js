import { callAuthFunction } from "../auth.js";

// Inventory actions: catalogue, categories, stock adjustments, item saves, and
// the warehouse side of job allocation.
export const INVENTORY_ACTIONS = Object.freeze({
  list: "list-inventory",
  listCategories: "list-part-categories",
  saveCategory: "save-part-category",
  adjustStock: "adjust-inventory-stock",
  deletePart: "delete-inventory-part",
  restorePart: "restore-inventory-part",
  createItem: "create-inventory-item",
  updateItem: "update-inventory-item",
  allocationStock: "list-job-allocation-stock",
  pendingRequests: "list-pending-job-requests",
  allocationHistory: "list-job-allocation-history",
  allocate: "allocate-job-stock",
});

export function listInventory(payload = {}) {
  return callAuthFunction(INVENTORY_ACTIONS.list, payload);
}

export function listPartCategories() {
  return callAuthFunction(INVENTORY_ACTIONS.listCategories);
}

export function savePartCategory(payload) {
  return callAuthFunction(INVENTORY_ACTIONS.saveCategory, payload);
}

export function adjustInventoryStock(payload) {
  return callAuthFunction(INVENTORY_ACTIONS.adjustStock, payload);
}

export function deleteInventoryPart(payload) {
  return callAuthFunction(INVENTORY_ACTIONS.deletePart, payload);
}

export function restoreInventoryPart(payload) {
  return callAuthFunction(INVENTORY_ACTIONS.restorePart, payload);
}

export function createInventoryItem(payload) {
  return callAuthFunction(INVENTORY_ACTIONS.createItem, payload);
}

export function updateInventoryItem(payload) {
  return callAuthFunction(INVENTORY_ACTIONS.updateItem, payload);
}

export function listJobAllocationStock(payload) {
  return callAuthFunction(INVENTORY_ACTIONS.allocationStock, payload);
}

export function listPendingJobRequests() {
  return callAuthFunction(INVENTORY_ACTIONS.pendingRequests);
}

export function listJobAllocationHistory() {
  return callAuthFunction(INVENTORY_ACTIONS.allocationHistory);
}

export function allocateJobStock(payload) {
  return callAuthFunction(INVENTORY_ACTIONS.allocate, payload);
}
