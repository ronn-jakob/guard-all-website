import { callAuthFunction } from "../auth.js";

// Scheduling actions used by the board and the job form.
export const SCHEDULING_ACTIONS = Object.freeze({
  list: "list-schedules",
  get: "get-schedule",
  confirm: "confirm-job-assignment",
  deleteJob: "delete-job",
  listTechnicians: "list-technicians",
  listClients: "list-clients",
  update: "update-schedule",
  createFromTemplate: "create-job-from-template",
});

export function listSchedules() {
  return callAuthFunction(SCHEDULING_ACTIONS.list);
}

export function getSchedule(payload) {
  return callAuthFunction(SCHEDULING_ACTIONS.get, payload);
}

export function confirmJobAssignment(payload) {
  return callAuthFunction(SCHEDULING_ACTIONS.confirm, payload);
}

export function deleteJob(payload) {
  return callAuthFunction(SCHEDULING_ACTIONS.deleteJob, payload);
}

export function listTechnicians(payload = {}) {
  return callAuthFunction(SCHEDULING_ACTIONS.listTechnicians, payload);
}

export function listClients(payload = {}) {
  return callAuthFunction(SCHEDULING_ACTIONS.listClients, payload);
}

export function updateSchedule(payload) {
  return callAuthFunction(SCHEDULING_ACTIONS.update, payload);
}

export function createJobFromTemplate(payload) {
  return callAuthFunction(SCHEDULING_ACTIONS.createFromTemplate, payload);
}
