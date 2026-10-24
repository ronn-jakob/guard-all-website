import { callAuthFunction } from "../auth.js";

// The landing dashboard payload is role-aware on the server; the client only
// names the action.
export const DASHBOARD_ACTIONS = Object.freeze({
  summary: "dashboard-summary",
});

export function getDashboardSummary() {
  return callAuthFunction(DASHBOARD_ACTIONS.summary);
}
