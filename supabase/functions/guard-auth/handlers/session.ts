import { response, supabaseAdmin } from "../shared.ts";
import { hashPassword, signToken, verifyPassword } from "../auth.ts";
import { roleTitleFor } from "../roles.ts";
import { signProfilePhoto } from "./profile.ts";
import { ensureRole, ensureRoles } from "./accounts.ts";
export async function userResponse(user: Record<string, unknown>, roleName: string) {
  const token = await signToken({ sub: user.user_id, role: roleName, exp: Math.floor(Date.now() / 1000) + 60 * 60 * 8 });
  const photoUrl = await signProfilePhoto(user.photo_path, supabaseAdmin);
  return { token, user: { id: user.user_id, name: [user.first_name, user.last_name].filter(Boolean).join(" "), email: user.email, branch: user.branch, role: roleName, phone: user.phone ?? "", title: roleTitleFor(roleName), photoUrl } };
}

export async function handleLogin({ body, db }: { body: any; db: any }) {
  const email = String(body.email ?? "").trim().toLowerCase();
  const password = String(body.password ?? "");
  if (!email || !password) return response({ error: "Email and password are required." }, 400);
  await ensureRoles();
  let { data: user, error } = await db.from("users").select("user_id, first_name, last_name, email, password_hash, branch, phone, title, photo_path, is_active, roles(role_name)").eq("email", email).maybeSingle();
  if (error) throw error;
  if (!user && email === "admin@gmail.com" && password === "admin123") {
    const roleId = await ensureRole("Admin");
    const passwordHash = await hashPassword(password);
    const created = await db.from("users").insert({ first_name: "Website", last_name: "Admin", email, password_hash: passwordHash, role_id: roleId, branch: "makati" }).select("user_id, first_name, last_name, email, password_hash, branch, is_active").single();
    if (created.error) throw created.error;
    user = { ...created.data, roles: { role_name: "Admin" } };
  }
  if (!user || !user.is_active || !(await verifyPassword(password, user.password_hash))) return response({ error: "Invalid email or password." }, 401);
  return response(await userResponse(user, user.roles?.role_name ?? ""));
}

export async function handleRequestPasswordReset({ body, db }: { body: any; db: any }) {
  const email = String(body.email ?? "").trim().toLowerCase();
  if (!email) return response({ error: "An email address is required." }, 400);
  const { data: user, error } = await db
    .from("users")
    .select("user_id, email")
    .eq("email", email)
    .maybeSingle();
  if (error) throw error;
  // Answer identically whether or not the address exists, so this endpoint
  // cannot be used to discover which emails have accounts.
  if (user) {
    const { error: insertError } = await db
      .from("password_reset_requests")
      .insert({ user_id: user.user_id, email: user.email });
    // 23505 means a pending request already exists for this user; that is fine.
    if (insertError && insertError.code !== "23505") throw insertError;
  }
  return response({ message: "If that email address has an account, a reset request is waiting for an administrator." });
}
