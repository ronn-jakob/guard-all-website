import { callAuthFunction } from "../auth.js";

// Template editor actions. listParts is the catalogue the editor reads; it is
// only used here today, so it lives with the templates until Inventory moves.
export const TEMPLATE_ACTIONS = Object.freeze({
  list: "list-job-templates",
  listParts: "list-parts",
  save: "save-job-template",
  remove: "delete-job-template",
});

export function listJobTemplates() {
  return callAuthFunction(TEMPLATE_ACTIONS.list);
}

export function listParts() {
  return callAuthFunction(TEMPLATE_ACTIONS.listParts);
}

export function saveJobTemplate(payload) {
  return callAuthFunction(TEMPLATE_ACTIONS.save, payload);
}

export function deleteJobTemplate(payload) {
  return callAuthFunction(TEMPLATE_ACTIONS.remove, payload);
}
