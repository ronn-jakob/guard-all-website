declare const Deno: {
  env: { get(key: string): string | undefined };
};
declare const btoa: (value: string) => string;
declare const atob: (value: string) => string;

import { supabaseAdmin } from "./shared.ts";

const encoder = new TextEncoder();
const decoder = new TextDecoder();
const iterations = 120000;

export function toBase64Url(value: Uint8Array | string) {
  const bytes = typeof value === "string" ? encoder.encode(value) : value;
  let binary = "";
  bytes.forEach((byte) => (binary += String.fromCharCode(byte)));
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function fromBase64Url(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(normalized + "=".repeat((4 - (normalized.length % 4)) % 4));
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function derivePassword(password: string, salt: Uint8Array) {
  const key = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"]);
  const saltBuffer = new Uint8Array(salt.length);
  saltBuffer.set(salt);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", salt: saltBuffer, iterations, hash: "SHA-256" }, key, 256);
  return new Uint8Array(bits);
}

export async function hashPassword(password: string) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await derivePassword(password, salt);
  return `pbkdf2_sha256$${iterations}$${toBase64Url(salt)}$${toBase64Url(hash)}`;
}

// Ambiguous characters (0/O, 1/l/I) are omitted so a temporary password can be
// read aloud or copied by hand without transcription errors.
export function generateTemporaryPassword() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  return Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join("");
}

export async function verifyPassword(password: string, storedHash: string) {
  const [algorithm, iterationText, saltText, hashText] = storedHash.split("$");
  if (algorithm !== "pbkdf2_sha256" || !iterationText || !saltText || !hashText) return false;
  const salt = fromBase64Url(saltText);
  const expected = fromBase64Url(hashText);
  const key = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", salt, iterations: Number(iterationText), hash: "SHA-256" }, key, expected.length * 8);
  const actual = new Uint8Array(bits);
  return actual.length === expected.length && actual.every((byte, index) => byte === expected[index]);
}

export async function signToken(payload: Record<string, unknown>) {
  const header = toBase64Url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = toBase64Url(JSON.stringify(payload));
  const key = await crypto.subtle.importKey("raw", encoder.encode(Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(`${header}.${body}`));
  return `${header}.${body}.${toBase64Url(new Uint8Array(signature))}`;
}

export async function verifyToken(request: Request) {
  const token = request.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const [header, body, signature] = token.split(".");
  if (!header || !body || !signature) return null;

  let payload: any;
  try {
    // Inspect the header before trusting anything inside the token. The signature
    // is always HMAC-SHA256, so an unexpected alg or typ is simply not our token.
    const tokenHeader = JSON.parse(decoder.decode(fromBase64Url(header)));
    if (tokenHeader?.alg !== "HS256") return null;
    if (tokenHeader?.typ && tokenHeader.typ !== "JWT") return null;

    const key = await crypto.subtle.importKey("raw", encoder.encode(Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!), { name: "HMAC", hash: "SHA-256" }, false, ["verify"]);
    const valid = await crypto.subtle.verify("HMAC", key, fromBase64Url(signature), encoder.encode(`${header}.${body}`));
    if (!valid) return null;

    payload = JSON.parse(decoder.decode(fromBase64Url(body)));
  } catch {
    // A segment that cannot be decoded is not a valid token; never surface it as
    // a server error.
    return null;
  }
  if (!(payload.exp > Math.floor(Date.now() / 1000))) return null;

  // A valid signature alone is not enough. The account must still be active, and
  // the role is read from the database so that deactivation or a role change
  // takes effect immediately instead of only after the token expires.
  const { data: account, error } = await supabaseAdmin
    .from("users")
    .select("is_active, branch, roles(role_name)")
    .eq("user_id", payload.sub)
    .maybeSingle();
  if (error) throw error;
  if (!account?.is_active) return null;
  const role = Array.isArray(account.roles) ? account.roles[0]?.role_name : account.roles?.role_name;
  return { ...payload, role: role ?? payload.role, branch: account.branch ?? null };
}

// Admins work across branches and may choose; every other role is pinned to the
// branch on their account, whatever the request says.
export function scopedBranch(session: Record<string, any>, requested: unknown) {
  if (String(session.role ?? "") === "Admin") {
    const branch = String(requested ?? "").trim().toLowerCase();
    return ["makati", "cebu"].includes(branch) ? branch : "";
  }
  return String(session.branch ?? "");
}

// Read scope: null means "no restriction" (Admin). A non-admin with no branch
// gets an empty string, which matches nothing — fail closed.
export function branchScope(session: Record<string, any>) {
  return String(session.role ?? "") === "Admin" ? null : String(session.branch ?? "");
}

// Destructive actions re-verify the signed-in user's password. The modal is only
// the UX; this is the actual gate.
export async function passwordConfirmationError(session: Record<string, unknown>, password: string) {
  if (!password) return "Enter your password to confirm.";
  const { data: account, error } = await supabaseAdmin
    .from("users")
    .select("password_hash, is_active")
    .eq("user_id", session.sub)
    .maybeSingle();
  if (error) throw error;
  if (!account?.is_active) return "Your account is not active.";
  if (!(await verifyPassword(password, account.password_hash))) {
    return "That password is not correct.";
  }
  return null;
}
