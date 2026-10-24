import { callAuthFunction } from "../auth.js";

// Self-service profile actions used by Settings.
export const PROFILE_ACTIONS = Object.freeze({
  get: "get-profile",
  update: "update-profile",
  createPhotoUpload: "create-profile-photo-upload",
  updatePhoto: "update-profile-photo",
  removePhoto: "remove-profile-photo",
  changePassword: "change-password",
});

export function getProfile() {
  return callAuthFunction(PROFILE_ACTIONS.get);
}

export function updateProfile(payload) {
  return callAuthFunction(PROFILE_ACTIONS.update, payload);
}

export function createProfilePhotoUpload(payload) {
  return callAuthFunction(PROFILE_ACTIONS.createPhotoUpload, payload);
}

export function updateProfilePhoto(payload) {
  return callAuthFunction(PROFILE_ACTIONS.updatePhoto, payload);
}

export function removeProfilePhoto() {
  return callAuthFunction(PROFILE_ACTIONS.removePhoto);
}

export function changePassword(payload) {
  return callAuthFunction(PROFILE_ACTIONS.changePassword, payload);
}
