import { response } from "../shared.ts";
import { hashPassword, passwordConfirmationError, verifyPassword } from "../auth.ts";
import { roleTitleFor } from "../roles.ts";
import {
  ATTACHMENT_CONTENT_TYPES,
  MAX_PROFILE_PHOTO_BYTES,
  PROFILE_PHOTO_BUCKET,
  PROFILE_PHOTO_PATH_PATTERN,
  PROFILE_PHOTO_TTL_SECONDS,
  attachmentExtension,
} from "../config.ts";

// Reads are served through short-lived signed URLs minted with the service role;
// the bucket itself stays private.
export async function signProfilePhoto(path: unknown, db: any) {
  const value = String(path ?? "").trim();
  if (!value) return "";
  const { data, error } = await db.storage
    .from(PROFILE_PHOTO_BUCKET)
    .createSignedUrl(value, PROFILE_PHOTO_TTL_SECONDS);
  if (error) {
    console.error("Could not sign profile photo:", error.message);
    return "";
  }
  return data?.signedUrl ?? "";
}

export async function handleChangePassword({ body, session, db }: { body: any; session: any; db: any }) {
  const currentPassword = String(body.currentPassword ?? "");
  const newPassword = String(body.newPassword ?? "");
  if (newPassword.length < 8) return response({ error: "The new password must be at least 8 characters." }, 400);
  const { data: user, error } = await db.from("users").select("password_hash").eq("user_id", session.sub).maybeSingle();
  if (error) throw error;
  if (!user || !(await verifyPassword(currentPassword, user.password_hash))) return response({ error: "Your current password is incorrect." }, 401);
  const { error: updateError } = await db.from("users").update({ password_hash: await hashPassword(newPassword), updated_at: new Date().toISOString() }).eq("user_id", session.sub);
  if (updateError) throw updateError;
  return response({ message: "Password updated successfully." });
}

export async function handleUpdateProfile({ body, session, db }: { body: any; session: any; db: any }) {
  const firstName = String(body.firstName ?? "").trim();
  const lastName = String(body.lastName ?? "").trim();
  const email = String(body.email ?? "").trim().toLowerCase();
  const phone = String(body.phone ?? "").trim();
  // Derived from the role, never accepted from the client.
  const title = roleTitleFor(String(session.role ?? ""));
  if (!firstName || !lastName || !email) {
    return response({ error: "First name, last name, and email are required." }, 400);
  }

  // Changing the address someone signs in with is sensitive: a stolen session
  // must not be able to redirect the account. Name and phone stay frictionless.
  const { data: current, error: currentError } = await db
    .from("users")
    .select("email")
    .eq("user_id", session.sub)
    .maybeSingle();
  if (currentError) throw currentError;
  if (!current) return response({ error: "Your account could not be found." }, 404);
  if (email !== String(current.email ?? "").toLowerCase()) {
    const passwordError = await passwordConfirmationError(session, String(body.currentPassword ?? ""));
    if (passwordError) return response({ error: passwordError }, 401);
  }

  const { data: updated, error } = await db
    .from("users")
    .update({
      first_name: firstName,
      last_name: lastName,
      email,
      phone: phone || null,
      title: title || null,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", session.sub)
    .select("user_id, first_name, last_name, email, branch, phone, title, photo_path, roles(role_name)")
    .single();
  if (error) {
    if (error.code === "23505") return response({ error: "That email address is already in use by another account." }, 409);
    throw error;
  }
  const role = Array.isArray(updated.roles) ? updated.roles[0]?.role_name : updated.roles?.role_name;
  return response({
    profile: {
      id: updated.user_id,
      name: [updated.first_name, updated.last_name].filter(Boolean).join(" "),
      email: updated.email,
      branch: updated.branch,
      phone: updated.phone ?? "",
      title: updated.title ?? "",
      role: role ?? session.role,
      photoUrl: await signProfilePhoto(updated.photo_path, db),
    },
  });
}

export async function handleGetProfile({ session, db }: { session: any; db: any }) {
  const { data: account, error: accountError } = await db
    .from("users")
    .select("user_id, first_name, last_name, email, branch, phone, title, photo_path, roles(role_name)")
    .eq("user_id", session.sub)
    .maybeSingle();
  if (accountError) throw accountError;
  if (!account) return response({ error: "Your account could not be found." }, 404);
  const role = Array.isArray(account.roles) ? account.roles[0]?.role_name : account.roles?.role_name;
  return response({
    profile: {
      id: account.user_id,
      name: [account.first_name, account.last_name].filter(Boolean).join(" "),
      firstName: account.first_name,
      lastName: account.last_name,
      email: account.email,
      branch: account.branch,
      phone: account.phone ?? "",
      title: roleTitleFor(role ?? session.role),
      role: role ?? session.role,
      photoUrl: await signProfilePhoto(account.photo_path, db),
    },
  });
}

export async function handleCreateProfilePhotoUpload({ body, session, db }: { body: any; session: any; db: any }) {
  const contentType = String(body.contentType ?? "").trim().toLowerCase();
  const size = Number(body.size);
  if (!ATTACHMENT_CONTENT_TYPES.has(contentType)) {
    return response({ error: "Choose a JPEG, PNG, or WebP image." }, 400);
  }
  if (!Number.isFinite(size) || size <= 0 || size > MAX_PROFILE_PHOTO_BYTES) {
    return response({ error: "The photo must be 5 MB or smaller." }, 400);
  }
  const path = `avatars/${session.sub}/${crypto.randomUUID()}.${attachmentExtension(contentType)}`;
  const { data: signed, error: signError } = await db.storage
    .from(PROFILE_PHOTO_BUCKET)
    .createSignedUploadUrl(path);
  if (signError) throw signError;
  if (!signed?.token) return response({ error: "Could not prepare the upload." }, 502);
  return response({ path, token: signed.token });
}

export async function handleUpdateProfilePhoto({ body, session, db }: { body: any; session: any; db: any }) {
  const path = String(body.path ?? "").trim();
  if (!PROFILE_PHOTO_PATH_PATTERN.test(path) || !path.startsWith(`avatars/${session.sub}/`)) {
    return response({ error: "That photo does not belong to you." }, 403);
  }
  const { data: current, error: currentError } = await db
    .from("users")
    .select("photo_path")
    .eq("user_id", session.sub)
    .maybeSingle();
  if (currentError) throw currentError;

  const { error: updateError } = await db
    .from("users")
    .update({ photo_path: path, updated_at: new Date().toISOString() })
    .eq("user_id", session.sub);
  if (updateError) throw updateError;

  // Best effort: an orphaned object is harmless in a private bucket.
  if (current?.photo_path && current.photo_path !== path) {
    await db.storage.from(PROFILE_PHOTO_BUCKET).remove([current.photo_path]);
  }
  return response({ photoPath: path, photoUrl: await signProfilePhoto(path, db) });
}

export async function handleRemoveProfilePhoto({ session, db }: { session: any; db: any }) {
  const { data: current, error: currentError } = await db
    .from("users")
    .select("photo_path")
    .eq("user_id", session.sub)
    .maybeSingle();
  if (currentError) throw currentError;

  const { error: updateError } = await db
    .from("users")
    .update({ photo_path: null, updated_at: new Date().toISOString() })
    .eq("user_id", session.sub);
  if (updateError) throw updateError;

  if (current?.photo_path) {
    await db.storage.from(PROFILE_PHOTO_BUCKET).remove([current.photo_path]);
  }
  return response({ photoPath: "", photoUrl: "" });
}
