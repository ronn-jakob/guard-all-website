import { useEffect, useState } from "react";
import Sidebar from "./Sidebar.jsx";
import TopBar from "./TopBar.jsx";
import { callAuthFunction, getSession, roleTitleFor, setSession } from "../lib/auth.js";
import { supabase } from "../lib/supabaseClient.js";
import {
  PROFILE_PHOTO_MAX_BYTES,
  initialsFor,
  prepareProfilePhoto,
} from "../lib/images.js";

function splitDisplayName(displayName = "") {
  const nameParts = displayName.trim().split(/\s+/).filter(Boolean);
  return {
    firstName: nameParts[0] || "",
    lastName: nameParts.slice(1).join(" "),
  };
}

function Settings() {
  const sessionUser = getSession()?.user;
  const [profile, setProfile] = useState(() => ({
    ...splitDisplayName(sessionUser?.name || ""),
    email: sessionUser?.email || "",
    phone: sessionUser?.phone || "",
    title: roleTitleFor(sessionUser?.role),
  }));
  const [originalEmail, setOriginalEmail] = useState(sessionUser?.email || "");
  const [branch, setBranch] = useState(sessionUser?.branch || "");
  const [role, setRole] = useState(sessionUser?.role || "");
  const [profilePhoto, setProfilePhoto] = useState(sessionUser?.photoUrl || "");
  const [currentPassword, setCurrentPassword] = useState("");
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [formError, setFormError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [profileMessage, setProfileMessage] = useState("");
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [showPasswords, setShowPasswords] = useState(false);

  // The form loads from the database, not from the session snapshot, so a stale
  // login cannot make a save look as though it was ignored.
  useEffect(() => {
    let isMounted = true;
    callAuthFunction("get-profile")
      .then(({ profile: saved }) => {
        if (!isMounted || !saved) return;
        const fallbackName = splitDisplayName(saved.name || "");
        setProfile({
          firstName: saved.firstName ?? fallbackName.firstName,
          lastName: saved.lastName ?? fallbackName.lastName,
          email: saved.email ?? "",
          phone: saved.phone ?? "",
          title: saved.title ?? "",
        });
        setOriginalEmail(saved.email ?? "");
        setBranch(saved.branch ?? "");
        setRole(saved.role ?? "");
        setProfilePhoto(saved.photoUrl ?? "");

        const currentSession = getSession();
        if (currentSession?.user) {
          setSession({
            ...currentSession,
            user: {
              ...currentSession.user,
              name: saved.name ?? currentSession.user.name,
              email: saved.email ?? currentSession.user.email,
              phone: saved.phone ?? "",
              title: saved.title ?? "",
              photoUrl: saved.photoUrl ?? "",
            },
          });
          window.dispatchEvent(new Event("account-updated"));
        }
      })
      .catch((error) => {
        if (isMounted) setFormError(error.message);
      })
      .finally(() => {
        if (isMounted) setIsLoadingProfile(false);
      });
    return () => {
      isMounted = false;
    };
  }, []);

  function syncSessionPhoto(photoUrl) {
    const currentSession = getSession();
    if (!currentSession?.user) return;
    setSession({
      ...currentSession,
      user: { ...currentSession.user, photoUrl },
    });
    window.dispatchEvent(new Event("account-updated"));
  }

  const handlePhotoChange = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setFormError("");
    setProfileMessage("");
    setIsUploadingPhoto(true);
    try {
      const prepared = await prepareProfilePhoto(file);
      if (prepared.size > PROFILE_PHOTO_MAX_BYTES) {
        throw new Error("The photo must be 5 MB or smaller.");
      }
      const { path, token } = await callAuthFunction(
        "create-profile-photo-upload",
        { contentType: prepared.type, size: prepared.size },
      );
      const { error } = await supabase.storage
        .from("profile-photos")
        .uploadToSignedUrl(path, token, prepared, {
          contentType: prepared.type,
        });
      if (error) throw error;
      const { photoUrl } = await callAuthFunction("update-profile-photo", {
        path,
      });
      setProfilePhoto(photoUrl);
      syncSessionPhoto(photoUrl);
      setProfileMessage("Profile photo updated.");
    } catch (error) {
      setFormError(error.message);
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  const handlePhotoRemove = async () => {
    setFormError("");
    setProfileMessage("");
    setIsUploadingPhoto(true);
    try {
      await callAuthFunction("remove-profile-photo");
      setProfilePhoto("");
      syncSessionPhoto("");
      setProfileMessage("Profile photo removed.");
    } catch (error) {
      setFormError(error.message);
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  const handleProfileSave = async (event) => {
    event.preventDefault();
    setProfileMessage("");
    setFormError("");
    const emailChanged =
      profile.email.trim().toLowerCase() !== originalEmail.trim().toLowerCase();
    if (emailChanged && !currentPassword) {
      setFormError("Enter your current password to change your email address.");
      return;
    }
    setIsSavingProfile(true);
    try {
      const { profile: savedProfile } = await callAuthFunction("update-profile", {
        firstName: profile.firstName,
        lastName: profile.lastName,
        email: profile.email,
        phone: profile.phone,
        ...(emailChanged ? { currentPassword } : {}),
      });

      setProfile({
        ...splitDisplayName(savedProfile.name),
        email: savedProfile.email,
        phone: savedProfile.phone,
        title: savedProfile.title,
      });
      setOriginalEmail(savedProfile.email);
      setCurrentPassword("");
      setBranch(savedProfile.branch ?? branch);
      setRole(savedProfile.role ?? role);
      setProfilePhoto(savedProfile.photoUrl ?? "");

      const currentSession = getSession();
      if (currentSession?.user) {
        setSession({
          ...currentSession,
          user: {
            ...currentSession.user,
            name: savedProfile.name,
            email: savedProfile.email,
            phone: savedProfile.phone,
            title: savedProfile.title,
            photoUrl: savedProfile.photoUrl ?? "",
          },
        });
        window.dispatchEvent(new Event("account-updated"));
      }
      setProfileMessage("Personal information saved.");
    } catch (error) {
      setFormError(error.message);
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handlePasswordChange = async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const currentPassword = formData.get("currentPassword");
    const newPassword = formData.get("newPassword");
    const confirmPassword = formData.get("confirmPassword");

    if (newPassword !== confirmPassword) {
      setFormError("The new passwords do not match.");
      setSuccessMessage("");
      return;
    }

    try {
      await callAuthFunction("change-password", {
        currentPassword,
        newPassword,
      });
      setFormError("");
      setSuccessMessage("Your password has been updated.");
      form.reset();
    } catch (error) {
      setFormError(error.message);
      setSuccessMessage("");
    }
  };

  const emailChanged =
    profile.email.trim().toLowerCase() !== originalEmail.trim().toLowerCase();

  return (
    <main className="flex h-screen overflow-hidden bg-[#202123] font-sans text-[#174f9a] max-[1024px]:block">
      <Sidebar />
      <section className="h-screen w-full min-w-0 flex-1 overflow-y-auto bg-[#edf7ff] max-[1024px]:h-[100dvh]">
        <TopBar />
        <div className="px-8 pb-8 pt-8 max-[1024px]:px-6 max-[1024px]:pb-20 max-[1024px]:pt-5 max-[620px]:px-3">
          <header className="mb-7 max-[620px]:mb-4">
            <p className="mb-1 text-[10px] font-bold uppercase tracking-[.1em] text-[#818b94] max-[620px]:text-[8px]">
              Workspace / Settings
            </p>
            <h1 className="m-0 text-[30px] font-bold tracking-[-.5px] max-[1024px]:text-[24px] max-[620px]:text-[20px]">
              Settings
            </h1>
            <p className="mb-0 mt-2 text-[14px] text-[#8b949c] max-[620px]:text-[10px]">
              Manage your account security and preferences.
            </p>
          </header>

          <div className="grid max-w-[1180px] grid-cols-[minmax(0,1.25fr)_minmax(280px,.75fr)] items-start gap-[18px] max-[850px]:grid-cols-1">
            <section className="col-span-full overflow-hidden rounded-[10px] border border-[#dfe6ec] bg-white shadow-[0_3px_8px_rgb(31_59_82_/_10%)]">
              <header className="border-b border-[#e1e6eb] px-6 py-5 max-[620px]:px-4 max-[620px]:py-4">
                <div className="flex items-center gap-3">
                  <span className="grid h-10 w-10 place-items-center rounded-[6px] bg-[#d6e6fb] text-[#1954a0]">
                    <span className="material-symbols-outlined text-[21px]">
                      person
                    </span>
                  </span>
                  <div>
                    <h2 className="m-0 text-[17px] font-bold max-[620px]:text-[15px]">
                      Personal information
                    </h2>
                    <p className="mb-0 mt-1 text-[12px] text-[#8b949c]">
                      Keep your profile details up to date.
                    </p>
                  </div>
                </div>
              </header>
              <form
                className="grid grid-cols-2 gap-4 p-6 max-[620px]:grid-cols-1 max-[620px]:gap-3 max-[620px]:p-4"
                onSubmit={handleProfileSave}
              >
                <div className="col-span-full flex items-center gap-4 rounded-[7px] border border-[#e1e6eb] bg-[#f8fbff] p-4 max-[620px]:items-start max-[620px]:p-3">
                  {profilePhoto ? (
                    <img
                      className="h-16 w-16 rounded-full object-cover ring-2 ring-[#d6e6fb]"
                      src={profilePhoto}
                      alt="Profile preview"
                    />
                  ) : (
                    <span className="grid h-16 w-16 flex-none place-items-center rounded-full bg-[#ff4825] text-[18px] font-bold text-white">
                      {initialsFor(profile.firstName, profile.lastName, role) || "?"}
                    </span>
                  )}
                  <div className="min-w-0">
                    <p className="m-0 text-[13px] font-bold text-[#45515c]">
                      Profile photo
                    </p>
                    <p className="m-0 mt-1 text-[11px] text-[#89939b]">
                      JPEG, PNG, or WebP, up to 5 MB. Square images look best.
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <label
                        className={`inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-[5px] bg-[#1250a0] px-3 text-[11px] font-bold text-white transition hover:bg-[#0e4389] ${
                          isUploadingPhoto ? "pointer-events-none opacity-60" : ""
                        }`}
                      >
                        <span className="material-symbols-outlined text-[16px]">
                          upload
                        </span>
                        {isUploadingPhoto ? "Uploading..." : "Upload photo"}
                        <input
                          className="sr-only"
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          disabled={isUploadingPhoto}
                          onChange={handlePhotoChange}
                        />
                      </label>
                      {profilePhoto && (
                        <button
                          className="h-8 rounded-[5px] border border-[#d6dee6] bg-white px-3 text-[11px] font-semibold text-[#68798a] transition hover:border-[#e05b45] hover:text-[#e05b45] disabled:opacity-50"
                          onClick={handlePhotoRemove}
                          type="button"
                          disabled={isUploadingPhoto}
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  </div>
                </div>
                <label className="flex flex-col gap-1.5 text-[12px] font-semibold text-[#45515c]">
                  First name
                  <input
                    className="h-11 rounded-[6px] border border-[#d6dee6] bg-white px-3 text-[13px] text-[#273746] outline-none transition focus:border-[#14519f] focus:ring-2 focus:ring-[#14519f]/15"
                    name="firstName"
                    value={profile.firstName}
                    onChange={(event) =>
                      setProfile({ ...profile, firstName: event.target.value })
                    }
                    required
                  />
                </label>
                <label className="flex flex-col gap-1.5 text-[12px] font-semibold text-[#45515c]">
                  Last name
                  <input
                    className="h-11 rounded-[6px] border border-[#d6dee6] bg-white px-3 text-[13px] text-[#273746] outline-none transition focus:border-[#14519f] focus:ring-2 focus:ring-[#14519f]/15"
                    name="lastName"
                    value={profile.lastName}
                    onChange={(event) =>
                      setProfile({ ...profile, lastName: event.target.value })
                    }
                    required
                  />
                </label>
                <label className="flex flex-col gap-1.5 text-[12px] font-semibold text-[#45515c]">
                  Email address
                  <input
                    className="h-11 rounded-[6px] border border-[#d6dee6] bg-white px-3 text-[13px] text-[#273746] outline-none transition focus:border-[#14519f] focus:ring-2 focus:ring-[#14519f]/15"
                    name="email"
                    type="email"
                    value={profile.email}
                    onChange={(event) =>
                      setProfile({ ...profile, email: event.target.value })
                    }
                    required
                  />
                </label>
                {emailChanged && (
                  <label className="col-span-full flex flex-col gap-1.5 rounded-[7px] border border-[#f0dcb4] bg-[#fffbf2] p-3 text-[12px] font-semibold text-[#7a5a12]">
                    Current password
                    <input
                      className="h-11 rounded-[6px] border border-[#e6d3a6] bg-white px-3 text-[13px] text-[#273746] outline-none transition focus:border-[#14519f] focus:ring-2 focus:ring-[#14519f]/15"
                      type="password"
                      name="currentPassword"
                      autoComplete="current-password"
                      value={currentPassword}
                      onChange={(event) => setCurrentPassword(event.target.value)}
                      placeholder="Required to change your sign-in email"
                      required
                    />
                    <span className="text-[10px] font-normal text-[#8a6a1f]">
                      Your email is how you sign in, so changing it needs your
                      current password.
                    </span>
                  </label>
                )}
                <label className="flex flex-col gap-1.5 text-[12px] font-semibold text-[#45515c]">
                  Phone number
                  <input
                    className="h-11 rounded-[6px] border border-[#d6dee6] bg-white px-3 text-[13px] text-[#273746] outline-none transition focus:border-[#14519f] focus:ring-2 focus:ring-[#14519f]/15"
                    name="phone"
                    type="tel"
                    value={profile.phone}
                    onChange={(event) =>
                      setProfile({ ...profile, phone: event.target.value })
                    }
                    placeholder="e.g. +63 917 123 4567"
                  />
                </label>
                <label className="flex flex-col gap-1.5 text-[12px] font-semibold text-[#45515c]">
                  Job title
                  <input
                    className="h-11 rounded-[6px] border border-[#d6dee6] bg-[#f2f4f6] px-3 text-[13px] text-[#5e6b78] outline-none"
                    name="title"
                    value={profile.title}
                    readOnly
                    disabled
                  />
                  <span className="text-[10px] font-normal text-[#8b949c]">
                    Set automatically from your role.
                  </span>
                </label>
                <label className="flex flex-col gap-1.5 text-[12px] font-semibold text-[#45515c]">
                  Branch
                  <input
                    className="h-11 rounded-[6px] border border-[#d6dee6] bg-[#f2f4f6] px-3 text-[13px] text-[#5e6b78] outline-none"
                    value={
                      branch
                        ? branch.replace(/^./, (letter) => letter.toUpperCase())
                        : ""
                    }
                    readOnly
                    disabled
                  />
                  <span className="text-[10px] font-normal text-[#8b949c]">
                    Managed by an administrator.
                  </span>
                </label>
                <label className="flex flex-col gap-1.5 text-[12px] font-semibold text-[#45515c]">
                  Role
                  <input
                    className="h-11 rounded-[6px] border border-[#d6dee6] bg-[#f2f4f6] px-3 text-[13px] text-[#5e6b78] outline-none"
                    value={role}
                    readOnly
                    disabled
                  />
                  <span className="text-[10px] font-normal text-[#8b949c]">
                    Your access follows this role.
                  </span>
                </label>
                {profileMessage && (
                  <p
                    className="col-span-full m-0 rounded-[5px] border border-[#a8dfb7] bg-[#effaf2] px-3 py-2 text-[12px] text-[#267340]"
                    role="status"
                  >
                    {profileMessage}
                  </p>
                )}
                <div className="col-span-full grid grid-cols-2 gap-4 max-[620px]:grid-cols-1 max-[620px]:gap-3">
                  <button
                    className="col-start-2 flex h-11 w-full items-center justify-center gap-2 rounded-[6px] border-0 bg-[#1250a0] px-4 text-[13px] font-bold text-white transition hover:bg-[#0e4389] disabled:cursor-wait disabled:opacity-60 max-[620px]:col-start-1"
                    type="submit"
                    disabled={isSavingProfile || isLoadingProfile}
                  >
                    <span className="material-symbols-outlined text-[18px]">
                      save
                    </span>
                    {isSavingProfile
                      ? "Saving..."
                      : isLoadingProfile
                        ? "Loading profile..."
                        : "Save personal information"}
                  </button>
                </div>
              </form>
            </section>
            <section className="overflow-hidden rounded-[10px] border border-[#dfe6ec] bg-white shadow-[0_3px_8px_rgb(31_59_82_/_10%)]">
              <header className="border-b border-[#e1e6eb] px-6 py-5 max-[620px]:px-4 max-[620px]:py-4">
                <div className="flex items-center gap-3">
                  <span className="grid h-10 w-10 place-items-center rounded-[6px] bg-[#d6e6fb] text-[#1954a0]">
                    <span className="material-symbols-outlined text-[21px]">
                      lock_reset
                    </span>
                  </span>
                  <div>
                    <h2 className="m-0 text-[17px] font-bold max-[620px]:text-[15px]">
                      Change password
                    </h2>
                    <p className="mb-0 mt-1 text-[12px] text-[#8b949c]">
                      Update the password used for admin login.
                    </p>
                  </div>
                </div>
              </header>

              <form
                className="flex max-w-none flex-col gap-4 p-6 max-[620px]:gap-3 max-[620px]:p-4"
                onSubmit={handlePasswordChange}
              >
                <label className="flex flex-col gap-1.5 text-[12px] font-semibold text-[#45515c]">
                  Current password
                  <div className="relative">
                    <input
                      className="h-11 w-full rounded-[6px] border border-[#d6dee6] bg-white px-3 pr-11 text-[13px] text-[#273746] outline-none transition focus:border-[#14519f] focus:ring-2 focus:ring-[#14519f]/15"
                      name="currentPassword"
                      type={showPasswords ? "text" : "password"}
                      autoComplete="current-password"
                      required
                    />
                    <button
                      aria-label={
                        showPasswords ? "Hide passwords" : "Show passwords"
                      }
                      className="absolute right-2 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center border-0 bg-transparent text-[#6f7f91] hover:text-[#14519f]"
                      onClick={() =>
                        setShowPasswords((isVisible) => !isVisible)
                      }
                      type="button"
                    >
                      <span className="material-symbols-outlined text-[17px]">
                        {showPasswords ? "visibility" : "visibility_off"}
                      </span>
                    </button>
                  </div>
                </label>
                <label className="flex flex-col gap-1.5 text-[12px] font-semibold text-[#45515c]">
                  New password
                  <div className="relative">
                    <input
                      className="h-11 w-full rounded-[6px] border border-[#d6dee6] bg-white px-3 pr-11 text-[13px] text-[#273746] outline-none transition focus:border-[#14519f] focus:ring-2 focus:ring-[#14519f]/15"
                      name="newPassword"
                      type={showPasswords ? "text" : "password"}
                      autoComplete="new-password"
                      minLength={8}
                      required
                    />
                    <button
                      aria-label={
                        showPasswords ? "Hide passwords" : "Show passwords"
                      }
                      className="absolute right-2 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center border-0 bg-transparent text-[#6f7f91] hover:text-[#14519f]"
                      onClick={() =>
                        setShowPasswords((isVisible) => !isVisible)
                      }
                      type="button"
                    >
                      <span className="material-symbols-outlined text-[17px]">
                        {showPasswords ? "visibility" : "visibility_off"}
                      </span>
                    </button>
                  </div>
                </label>
                <label className="flex flex-col gap-1.5 text-[12px] font-semibold text-[#45515c]">
                  Confirm new password
                  <div className="relative">
                    <input
                      className="h-11 w-full rounded-[6px] border border-[#d6dee6] bg-white px-3 pr-11 text-[13px] text-[#273746] outline-none transition focus:border-[#14519f] focus:ring-2 focus:ring-[#14519f]/15"
                      name="confirmPassword"
                      type={showPasswords ? "text" : "password"}
                      autoComplete="new-password"
                      minLength={8}
                      required
                    />
                    <button
                      aria-label={
                        showPasswords ? "Hide passwords" : "Show passwords"
                      }
                      className="absolute right-2 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center border-0 bg-transparent text-[#6f7f91] hover:text-[#14519f]"
                      onClick={() =>
                        setShowPasswords((isVisible) => !isVisible)
                      }
                      type="button"
                    >
                      <span className="material-symbols-outlined text-[17px]">
                        {showPasswords ? "visibility" : "visibility_off"}
                      </span>
                    </button>
                  </div>
                </label>

                {formError && (
                  <p
                    className="m-0 rounded-[5px] border border-[#f0b8b0] bg-[#fff1ee] px-3 py-2 text-[12px] text-[#b64132]"
                    role="alert"
                  >
                    {formError}
                  </p>
                )}
                {successMessage && (
                  <p
                    className="m-0 rounded-[5px] border border-[#a8dfb7] bg-[#effaf2] px-3 py-2 text-[12px] text-[#267340]"
                    role="status"
                  >
                    {successMessage}
                  </p>
                )}

                <button
                  className="mt-1 flex h-11 items-center justify-center gap-2 rounded-[6px] border-0 bg-[#1250a0] px-4 text-[13px] font-bold text-white transition hover:bg-[#0e4389]"
                  type="submit"
                >
                  <span className="material-symbols-outlined text-[18px]">
                    save
                  </span>
                  Update password
                </button>
              </form>
            </section>

            <aside className="rounded-[10px] border border-[#dfe6ec] bg-[#f8fbff] p-5 shadow-[0_3px_8px_rgb(31_59_82_/_8%)] max-[620px]:p-4">
              <span className="material-symbols-outlined text-[24px] text-[#1954a0]">
                security
              </span>
              <h2 className="m-0 mt-3 text-[16px] font-bold text-[#174f9a]">
                Account security
              </h2>
              <p className="m-0 mt-2 text-[12px] leading-relaxed text-[#7f8b96]">
                Use a password with at least 8 characters. You will need the new
                password the next time you sign in as admin.
              </p>
            </aside>
          </div>
        </div>
      </section>
    </main>
  );
}

export default Settings;
