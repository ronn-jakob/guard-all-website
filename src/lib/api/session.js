import { callAuthFunction } from "../auth.js";

// Session entry points. These are the only actions that run before a token
// exists; the wrappers still go through callAuthFunction so error handling and
// function routing stay in one place.
export const SESSION_ACTIONS = Object.freeze({
  login: "login",
  requestPasswordReset: "request-password-reset",
});

export function login(payload) {
  return callAuthFunction(SESSION_ACTIONS.login, payload);
}

export function requestPasswordReset(payload) {
  return callAuthFunction(SESSION_ACTIONS.requestPasswordReset, payload);
}
