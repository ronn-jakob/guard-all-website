import { callAuthFunction } from "../auth.js";

// Account-management actions. create-account is still routed to guard-account
// inside callAuthFunction; the wrapper only removes the magic string.
export const ACCOUNT_ACTIONS = Object.freeze({
  listUsers: "list-users",
  createAccount: "create-account",
  deleteUser: "delete-user",
  listResetRequests: "list-password-reset-requests",
  resolveReset: "resolve-password-reset",
});

export function listUsers() {
  return callAuthFunction(ACCOUNT_ACTIONS.listUsers);
}

export function createAccount(payload) {
  return callAuthFunction(ACCOUNT_ACTIONS.createAccount, payload);
}

export function deleteUser(payload) {
  return callAuthFunction(ACCOUNT_ACTIONS.deleteUser, payload);
}

export function listPasswordResetRequests() {
  return callAuthFunction(ACCOUNT_ACTIONS.listResetRequests);
}

export function resolvePasswordReset(payload) {
  return callAuthFunction(ACCOUNT_ACTIONS.resolveReset, payload);
}
