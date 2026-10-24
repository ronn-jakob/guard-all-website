import { callAuthFunction } from "../auth.js";

// Report actions for both the manager review screen and the technician-facing
// field report screen.
export const REPORT_ACTIONS = Object.freeze({
  list: "list-field-reports",
  review: "review-field-report",
  listJobs: "list-field-report-jobs",
  createUpload: "create-report-upload",
  discardUpload: "discard-report-upload",
  resubmit: "resubmit-field-report",
  submit: "submit-field-report",
});

export function listFieldReports(payload = {}) {
  return callAuthFunction(REPORT_ACTIONS.list, payload);
}

export function reviewFieldReport(payload) {
  return callAuthFunction(REPORT_ACTIONS.review, payload);
}

export function listFieldReportJobs() {
  return callAuthFunction(REPORT_ACTIONS.listJobs);
}

export function createReportUpload(payload) {
  return callAuthFunction(REPORT_ACTIONS.createUpload, payload);
}

export function discardReportUpload(payload) {
  return callAuthFunction(REPORT_ACTIONS.discardUpload, payload);
}

export function resubmitFieldReport(payload) {
  return callAuthFunction(REPORT_ACTIONS.resubmit, payload);
}

export function submitFieldReport(payload) {
  return callAuthFunction(REPORT_ACTIONS.submit, payload);
}
