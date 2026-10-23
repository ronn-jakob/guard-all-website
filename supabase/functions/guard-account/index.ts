declare const Deno: {
  env: { get(key: string): string | undefined };
  serve: (handler: (request: Request) => Response | Promise<Response>) => void;
};
declare const btoa: (value: string) => string;
declare const atob: (value: string) => string;

// @ts-ignore - This editor is not running the Deno runtime, so these edge runtime shims are not available here.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
// @ts-ignore - The npm: specifier resolves correctly in the deployed Supabase Edge runtime.
import { createClient } from "npm:@supabase/supabase-js@2";

const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};
const supabaseAdmin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { autoRefreshToken: false, persistSession: false } });

// Audit triggers read the actor from the x-guard-actor header, so writes made
// after authentication use a client tagged with the signed-in user.
function createRequestClient(actorId: string) {
  return createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { "x-guard-actor": actorId } },
  });
}
const permissions: Record<string, Array<[string, string]>> = {
  Admin: [["scheduling", "approve"], ["inventory", "approve"], ["field_reporting", "approve"], ["sales_billing", "approve"], ["admin", "approve"]],
  "Service Manager": [["scheduling", "edit"], ["field_reporting", "edit"]],
  "Sales Manager": [["scheduling", "edit"], ["field_reporting", "edit"]],
  Technician: [["field_reporting", "edit"]],
  "Warehouse Manager": [["inventory", "edit"]],
  "Billing Staff": [["sales_billing", "edit"]],
};
const encoder = new TextEncoder();
const decoder = new TextDecoder();
const iterations = 120000;
const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers });
const encode = (value: Uint8Array | string) => { const bytes = typeof value === "string" ? encoder.encode(value) : value; let binary = ""; bytes.forEach((byte) => binary += String.fromCharCode(byte)); return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); };
const decode = (value: string) => { const normalized = value.replace(/-/g, "+").replace(/_/g, "/"); const binary = atob(normalized + "=".repeat((4 - normalized.length % 4) % 4)); return Uint8Array.from(binary, (character) => character.charCodeAt(0)); };
async function passwordHash(password: string) { const salt = crypto.getRandomValues(new Uint8Array(16)); const key = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"]); const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", salt, iterations, hash: "SHA-256" }, key, 256); return `pbkdf2_sha256$${iterations}$${encode(salt)}$${encode(new Uint8Array(bits))}`; }
async function verifyPassword(password: string, stored: string) { const [algorithm, iterationText, saltText, hashText] = stored.split("$"); if (algorithm !== "pbkdf2_sha256") return false; const key = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"]); const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", salt: decode(saltText), iterations: Number(iterationText), hash: "SHA-256" }, key, decode(hashText).length * 8); return encode(new Uint8Array(bits)) === encode(decode(hashText)); }
async function verifyToken(request: Request) {
  const token = request.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const [header, body, signature] = token.split(".");
  if (!header || !body || !signature) return null;
  const key = await crypto.subtle.importKey("raw", encoder.encode(Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!), { name: "HMAC", hash: "SHA-256" }, false, ["verify"]);
  if (!await crypto.subtle.verify("HMAC", key, decode(signature), encoder.encode(`${header}.${body}`))) return null;
  const payload = JSON.parse(decoder.decode(decode(body)));
  if (!(payload.exp > Math.floor(Date.now() / 1000))) return null;

  // A valid signature alone is not enough: the account must still be active, and
  // the role is read from the database so deactivation or a role change applies
  // immediately instead of only after the token expires.
  const { data: account, error } = await supabaseAdmin
    .from("users")
    .select("is_active, roles(role_name)")
    .eq("user_id", payload.sub)
    .maybeSingle();
  if (error) throw error;
  if (!account?.is_active) return null;
  const role = Array.isArray(account.roles) ? account.roles[0]?.role_name : account.roles?.role_name;
  return { ...payload, role: role ?? payload.role };
}
async function roleId(roleName: string, db = supabaseAdmin) { const existing = await db.from("roles").select("role_id").eq("role_name", roleName).maybeSingle(); if (existing.error) throw existing.error; if (existing.data) return existing.data.role_id; const created = await db.from("roles").insert({ role_name: roleName }).select("role_id").single(); if (created.error) throw created.error; return created.data.role_id; }
Deno.serve(async (request: Request) => {
  let db = supabaseAdmin;
  if (request.method === "OPTIONS") return new Response("ok", { headers });
  try {
    const body = await request.json();
    const session = await verifyToken(request);
    if (!session) return response({ error: "You must be signed in to perform this action." }, 401);
    if (session.role !== "Admin") return response({ error: "Administrator access is required." }, 403);
    db = createRequestClient(String(session.sub));

    if (body.action === "create-account") {
      const firstName = String(body.firstName ?? "").trim();
      const lastName = String(body.lastName ?? "").trim();
      const email = String(body.email ?? "").trim().toLowerCase();
      const password = String(body.password ?? "");
      const role = String(body.role ?? "");
      const branch = String(body.branch ?? "").trim().toLowerCase();
      if (!firstName || !lastName || !email || password.length < 8 || !permissions[role] || !["makati", "cebu"].includes(branch)) return response({ error: "Please provide valid account details." }, 400);
      const existing = await db.from("users").select("user_id, is_active").eq("email", email).maybeSingle();
      if (existing.error) throw existing.error;
      const role_id = await roleId(role, db);
      let user;
      if (existing.data?.is_active) return response({ error: "An account with this email address already exists." }, 409);
      if (existing.data) {
        const updated = await db.from("users").update({ first_name: firstName, last_name: lastName, password_hash: await passwordHash(password), role_id, branch, is_active: true, updated_at: new Date().toISOString() }).eq("user_id", existing.data.user_id).select("user_id, first_name, last_name, email, branch, is_active, created_at, roles(role_name)").single();
        if (updated.error) throw updated.error;
        user = updated.data;
      } else {
        const created = await db.from("users").insert({ first_name: firstName, last_name: lastName, email, password_hash: await passwordHash(password), role_id, branch }).select("user_id, first_name, last_name, email, branch, is_active, created_at, roles(role_name)").single();
        if (created.error) throw created.error;
        user = created.data;
      }
      return response({ account: { id: user.user_id, name: `${user.first_name} ${user.last_name}`, email: user.email, branch: user.branch, role: user.roles?.role_name, status: "Active", createdAt: new Date(user.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) } }, 201);
    }

    if (body.action === "change-password") {
      const currentPassword = String(body.currentPassword ?? "");
      const newPassword = String(body.newPassword ?? "");
      if (newPassword.length < 8) return response({ error: "The new password must be at least 8 characters." }, 400);
      const user = await db.from("users").select("password_hash").eq("user_id", session.sub).maybeSingle();
      if (user.error) throw user.error;
      if (!user.data || !(await verifyPassword(currentPassword, user.data.password_hash))) return response({ error: "Your current password is incorrect." }, 401);
      const updated = await db.from("users").update({ password_hash: await passwordHash(newPassword), updated_at: new Date().toISOString() }).eq("user_id", session.sub);
      if (updated.error) throw updated.error;
      return response({ message: "Password updated successfully." });
    }
    return response({ error: "Unknown action." }, 400);
  } catch (error) {
    console.error(error);
    return response({ error: "Unable to complete the request." }, 500);
  }
});
