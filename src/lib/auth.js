import { supabase } from "./supabaseClient.js";

export const roleAccess = {
  Admin: ["scheduling", "inventory", "field_reporting", "sales_billing", "admin"],
  "Service Manager": ["scheduling", "field_reporting"],
  "Sales Manager": ["scheduling", "field_reporting"],
  Technician: ["field_reporting"],
  "Warehouse Manager": ["inventory"],
  "Billing Staff": ["sales_billing"],
};

export async function callAuthFunction(action, payload = {}) {
  const token = sessionStorage.getItem("authToken");
  // Account creation lives in guard-account (Admin-only). Password changes go to
  // guard-auth, which lets any signed-in user change their own password;
  // guard-account's change-password requires the Admin role.
  const functionName = action === "create-account" ? "guard-account" : "guard-auth";
  const { data, error } = await supabase.functions.invoke(functionName, {
    body: { action, ...payload },
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });

  if (error) {
    let serverMessage = "";
    if (error.context instanceof Response) {
      try {
        const errorBody = await error.context.json();
        serverMessage = errorBody?.error || "";
      } catch {
        serverMessage = "";
      }
    }
    throw new Error(serverMessage || error.message || "Unable to reach the authentication service.");
  }
  if (data?.error) {
    throw new Error(data.error);
  }
  return data;
}

export function getSession() {
  try {
    const session = JSON.parse(sessionStorage.getItem("authSession") || "null");
    if (!session?.user || !sessionStorage.getItem("authToken")) return null;
    return session;
  } catch {
    return null;
  }
}

export function setSession(session) {
  sessionStorage.setItem("authToken", session.token);
  sessionStorage.setItem("authSession", JSON.stringify(session));
}

export function clearSession() {
  sessionStorage.removeItem("authToken");
  sessionStorage.removeItem("authSession");
  sessionStorage.removeItem("isAdmin");
}

export function canAccessModule(module, role = getSession()?.user?.role) {
  return Boolean(role && roleAccess[role]?.includes(module));
}
