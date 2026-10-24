import { response, supabaseAdmin } from "../shared.ts";
import { generateTemporaryPassword, hashPassword, passwordConfirmationError } from "../auth.ts";
import { rolePermissions } from "../roles.ts";
import { ensureTechnicianRecord } from "./scheduling.ts";
export async function ensureRole(roleName: string) {
  const { data: existing, error: selectError } = await supabaseAdmin.from("roles").select("role_id").eq("role_name", roleName).maybeSingle();
  if (selectError) throw selectError;
  if (existing) return existing.role_id;
  const { data, error } = await supabaseAdmin.from("roles").insert({ role_name: roleName }).select("role_id").single();
  if (error) throw error;
  return data.role_id;
}

export async function ensureRoles() {
  const roleIds: Record<string, string> = {};
  for (const roleName of Object.keys(rolePermissions)) {
    roleIds[roleName] = await ensureRole(roleName);
    const { data: existingPermissions, error: permissionError } = await supabaseAdmin.from("module_permissions").select("module").eq("role_id", roleIds[roleName]);
    if (permissionError) throw permissionError;
    const existingModules = new Set((existingPermissions ?? []).map((permission: { module: string }) => permission.module));
    const missing = rolePermissions[roleName].filter(([module]) => !existingModules.has(module)).map(([module, access_level]) => ({ role_id: roleIds[roleName], module, access_level }));
    if (missing.length) {
      const { error } = await supabaseAdmin.from("module_permissions").insert(missing);
      if (error) throw error;
    }
  }
  return roleIds;
}

export async function handleCreateAccount({ body, session, db }: { body: any; session: any; db: any }) {
  const firstName = String(body.firstName ?? "").trim();
  const lastName = String(body.lastName ?? "").trim();
  const email = String(body.email ?? "").trim().toLowerCase();
  const password = String(body.password ?? "");
  const role = String(body.role ?? "");
  const branch = String(body.branch ?? "").trim().toLowerCase();
  if (!firstName || !lastName || !email || password.length < 8 || !rolePermissions[role] || !["makati", "cebu"].includes(branch)) return response({ error: "Please provide valid account details." }, 400);
  const roleIds = await ensureRoles();
  const { data: existingUser, error: existingUserError } = await db.from("users").select("user_id, is_active").eq("email", email).maybeSingle();
  if (existingUserError) throw existingUserError;
  if (existingUser?.is_active) return response({ error: "An account with this email address already exists." }, 409);
  if (existingUser) {
    const { data: reactivatedUser, error: reactivateError } = await db
      .from("users")
      .update({ first_name: firstName, last_name: lastName, password_hash: await hashPassword(password), role_id: roleIds[role], branch, is_active: true, updated_at: new Date().toISOString() })
      .eq("user_id", existingUser.user_id)
      .select("user_id, first_name, last_name, email, branch, is_active, created_at, roles(role_name)")
      .single();
    if (reactivateError) throw reactivateError;
    if (role === "Technician") await ensureTechnicianRecord(reactivatedUser, db);
    return response({ account: { id: reactivatedUser.user_id, name: `${reactivatedUser.first_name} ${reactivatedUser.last_name}`, email: reactivatedUser.email, branch: reactivatedUser.branch, role: reactivatedUser.roles?.role_name, status: "Active", createdAt: new Date(reactivatedUser.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) } }, 200);
  }
  const { data, error } = await db.from("users").insert({ first_name: firstName, last_name: lastName, email, password_hash: await hashPassword(password), role_id: roleIds[role], branch }).select("user_id, first_name, last_name, email, branch, is_active, created_at, roles(role_name)").single();
  if (error) {
    if (error.code === "23505") return response({ error: "An account with this email address already exists." }, 409);
    throw error;
  }
  if (role === "Technician") await ensureTechnicianRecord(data, db);
  return response({ account: { id: data.user_id, name: `${data.first_name} ${data.last_name}`, email: data.email, branch: data.branch, role: data.roles?.role_name, status: data.is_active ? "Active" : "Inactive", createdAt: new Date(data.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) } }, 201);
}

export async function handleListUsers({ db }: { db: any }) {
  const { data, error } = await db.from("users").select("user_id, first_name, last_name, email, branch, is_active, created_at, roles(role_name)").eq("is_active", true).order("created_at", { ascending: false });
  if (error) throw error;
  return response({ accounts: (data ?? []).map((user: any) => ({ id: user.user_id, name: [user.first_name, user.last_name].filter(Boolean).join(" "), email: user.email, branch: user.branch, role: user.roles?.role_name, status: user.is_active ? "Active" : "Inactive", createdAt: new Date(user.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) })) });
}

export async function handleDeleteUser({ body, session, db }: { body: any; session: any; db: any }) {
  const userId = String(body.userId ?? "");
  if (!userId) return response({ error: "A user id is required." }, 400);
  if (userId === session.sub) return response({ error: "You cannot remove your own account." }, 400);
  const passwordError = await passwordConfirmationError(session, String(body.password ?? ""));
  if (passwordError) return response({ error: passwordError }, 401);
  const { error } = await db.from("users").update({ is_active: false, updated_at: new Date().toISOString() }).eq("user_id", userId).eq("is_active", true);
  if (error) throw error;
  return response({ message: "User removed from the active directory." });
}

export async function handleListPasswordResetRequests({ db }: { db: any }) {
  const { data, error } = await db
    .from("password_reset_requests")
    .select("request_id, email, status, requested_at, expires_at, users!password_reset_requests_user_id_fkey(first_name, last_name)")
    .eq("status", "pending")
    .order("requested_at", { ascending: false });
  if (error) throw error;
  const now = Date.now();
  return response({
    requests: (data ?? []).map((request: any) => {
      const account = Array.isArray(request.users) ? request.users[0] : request.users;
      return {
        id: request.request_id,
        email: request.email,
        name: account ? [account.first_name, account.last_name].filter(Boolean).join(" ") : "Unknown user",
        requestedAt: request.requested_at,
        expiresAt: request.expires_at,
        expired: new Date(request.expires_at).getTime() <= now,
      };
    }),
  });
}

export async function handleResolvePasswordReset({ body, session, db }: { body: any; session: any; db: any }) {
  const requestId = String(body.requestId ?? "").trim();
  const decision = String(body.decision ?? "").trim();
  if (!requestId || !["approve", "cancel"].includes(decision)) {
    return response({ error: "A reset request and a valid decision are required." }, 400);
  }
  const { data: resetRequest, error } = await db
    .from("password_reset_requests")
    .select("request_id, user_id, status, expires_at")
    .eq("request_id", requestId)
    .maybeSingle();
  if (error) throw error;
  if (!resetRequest) return response({ error: "Reset request not found." }, 404);
  if (resetRequest.status !== "pending") return response({ error: "This request has already been handled." }, 409);

  const handledAt = new Date().toISOString();
  if (decision === "cancel") {
    const { error: cancelError } = await db
      .from("password_reset_requests")
      .update({ status: "cancelled", handled_by: session.sub, handled_at: handledAt })
      .eq("request_id", requestId);
    if (cancelError) throw cancelError;
    return response({ message: "Reset request cancelled." });
  }

  if (new Date(resetRequest.expires_at).getTime() <= Date.now()) {
    return response({ error: "This reset request has expired. Ask the user to submit a new one." }, 409);
  }

  // A one-time temporary password is returned here, once, for the administrator
  // to hand to the user out of band. The user is expected to change it afterwards.
  const temporaryPassword = generateTemporaryPassword();
  const { error: passwordError } = await db
    .from("users")
    .update({ password_hash: await hashPassword(temporaryPassword), updated_at: handledAt })
    .eq("user_id", resetRequest.user_id);
  if (passwordError) throw passwordError;
  const { error: approveError } = await db
    .from("password_reset_requests")
    .update({ status: "approved", handled_by: session.sub, handled_at: handledAt })
    .eq("request_id", requestId);
  if (approveError) throw approveError;
  return response({ message: "Temporary password issued.", temporaryPassword });
}
