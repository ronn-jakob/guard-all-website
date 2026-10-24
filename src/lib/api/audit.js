import { callAuthFunction } from "../auth.js";

// One wrapper per Edge Function action. Action names live here instead of being
// spelled at each call site, so a rename is a single edit and callers can be
// mocked without knowing the wire protocol.
export const AUDIT_ACTIONS = Object.freeze({
  list: "list-audit-log",
});

export function listAuditLog(params = {}) {
  return callAuthFunction(AUDIT_ACTIONS.list, params);
}
