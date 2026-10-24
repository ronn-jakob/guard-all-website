// Storage configuration shared by the report handlers and the inline upload
// handlers. Keeping the constants here means the bucket rules are defined once.

export const ATTACHMENT_BUCKET = "report-attachments";
export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;
export const MAX_REPORT_ATTACHMENTS = 5;
export const ATTACHMENT_CONTENT_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
// reports/<job_id>/<user_id>/<uuid>.<ext> — a session may only attach uploads it
// made itself, for the job it is reporting on.
export const ATTACHMENT_PATH_PATTERN = /^reports\/[0-9a-f-]{36}\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.(jpg|jpeg|png|webp)$/i;
export const attachmentExtension = (contentType: string) =>
  contentType === "image/png" ? "png" : contentType === "image/webp" ? "webp" : "jpg";

// Profile photos follow the same private-bucket model as report attachments.
export const PROFILE_PHOTO_BUCKET = "profile-photos";
export const MAX_PROFILE_PHOTO_BYTES = 5 * 1024 * 1024;
export const PROFILE_PHOTO_TTL_SECONDS = 8 * 60 * 60; // matches the token lifetime
export const PROFILE_PHOTO_PATH_PATTERN = /^avatars\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.(jpg|jpeg|png|webp)$/i;
