import { useState } from "react";
import Sidebar from "./Sidebar.jsx";
import TopBar from "./TopBar.jsx";

function Settings() {
  const [profile, setProfile] = useState(() => ({
    name: localStorage.getItem("profileName") || "R. Jakob",
    email: localStorage.getItem("profileEmail") || "admin@gmail.com",
    phone: localStorage.getItem("profilePhone") || "",
    title: localStorage.getItem("profileTitle") || "Website Admin",
  }));
  const [formError, setFormError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [profileMessage, setProfileMessage] = useState("");
  const [profilePhoto, setProfilePhoto] = useState(
    () => localStorage.getItem("profilePhoto") || "",
  );
  const [showPasswords, setShowPasswords] = useState(false);

  const handlePhotoChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setProfileMessage("Please choose an image file.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const photo = String(reader.result);
      setProfilePhoto(photo);
      localStorage.setItem("profilePhoto", photo);
      window.dispatchEvent(new Event("profile-updated"));
      setProfileMessage("Profile photo updated.");
    };
    reader.readAsDataURL(file);
  };

  const handlePhotoRemove = () => {
    setProfilePhoto("");
    localStorage.removeItem("profilePhoto");
    window.dispatchEvent(new Event("profile-updated"));
    setProfileMessage("Profile photo removed.");
  };

  const handleProfileSave = (event) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const nextProfile = {
      name: formData.get("name").trim(),
      email: formData.get("email").trim().toLowerCase(),
      phone: formData.get("phone").trim(),
      title: formData.get("title").trim(),
    };

    setProfile(nextProfile);
    localStorage.setItem("profileName", nextProfile.name);
    localStorage.setItem("profileEmail", nextProfile.email);
    localStorage.setItem("profilePhone", nextProfile.phone);
    localStorage.setItem("profileTitle", nextProfile.title);
    setProfileMessage("Personal information saved.");
  };

  const handlePasswordChange = (event) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const currentPassword = formData.get("currentPassword");
    const newPassword = formData.get("newPassword");
    const confirmPassword = formData.get("confirmPassword");
    const storedPassword = localStorage.getItem("adminPassword") || "admin123";

    if (currentPassword !== storedPassword) {
      setFormError("Your current password is incorrect.");
      setSuccessMessage("");
      return;
    }

    if (newPassword !== confirmPassword) {
      setFormError("The new passwords do not match.");
      setSuccessMessage("");
      return;
    }

    localStorage.setItem("adminPassword", newPassword);
    setFormError("");
    setSuccessMessage("Your password has been updated.");
    event.currentTarget.reset();
  };

  return (
    <main className="flex h-screen overflow-hidden bg-[#202123] font-sans text-[#174f9a] max-[1024px]:block">
      <Sidebar />
      <section className="h-screen min-w-0 flex-1 overflow-y-auto bg-[#edf7ff]">
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
                      RJ
                    </span>
                  )}
                  <div className="min-w-0">
                    <p className="m-0 text-[13px] font-bold text-[#45515c]">
                      Profile photo
                    </p>
                    <p className="m-0 mt-1 text-[11px] text-[#89939b]">
                      JPG, PNG, or GIF. Choose a square image for the best result.
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <label className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-[5px] bg-[#1250a0] px-3 text-[11px] font-bold text-white transition hover:bg-[#0e4389]">
                        <span className="material-symbols-outlined text-[16px]">
                          upload
                        </span>
                        Upload photo
                        <input
                          className="sr-only"
                          type="file"
                          accept="image/*"
                          onChange={handlePhotoChange}
                        />
                      </label>
                      {profilePhoto && (
                        <button
                          className="h-8 rounded-[5px] border border-[#d6dee6] bg-white px-3 text-[11px] font-semibold text-[#68798a] transition hover:border-[#e05b45] hover:text-[#e05b45]"
                          onClick={handlePhotoRemove}
                          type="button"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  </div>
                </div>
                <label className="flex flex-col gap-1.5 text-[12px] font-semibold text-[#45515c]">
                  Full name
                  <input
                    className="h-11 rounded-[6px] border border-[#d6dee6] bg-white px-3 text-[13px] text-[#273746] outline-none transition focus:border-[#14519f] focus:ring-2 focus:ring-[#14519f]/15"
                    name="name"
                    value={profile.name}
                    onChange={(event) => setProfile({ ...profile, name: event.target.value })}
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
                    onChange={(event) => setProfile({ ...profile, email: event.target.value })}
                    required
                  />
                </label>
                <label className="flex flex-col gap-1.5 text-[12px] font-semibold text-[#45515c]">
                  Phone number
                  <input
                    className="h-11 rounded-[6px] border border-[#d6dee6] bg-white px-3 text-[13px] text-[#273746] outline-none transition focus:border-[#14519f] focus:ring-2 focus:ring-[#14519f]/15"
                    name="phone"
                    type="tel"
                    value={profile.phone}
                    onChange={(event) => setProfile({ ...profile, phone: event.target.value })}
                    placeholder="e.g. +63 917 123 4567"
                  />
                </label>
                <label className="flex flex-col gap-1.5 text-[12px] font-semibold text-[#45515c]">
                  Job title
                  <input
                    className="h-11 rounded-[6px] border border-[#d6dee6] bg-white px-3 text-[13px] text-[#273746] outline-none transition focus:border-[#14519f] focus:ring-2 focus:ring-[#14519f]/15"
                    name="title"
                    value={profile.title}
                    onChange={(event) => setProfile({ ...profile, title: event.target.value })}
                    required
                  />
                </label>
                {profileMessage && (
                  <p className="col-span-full m-0 rounded-[5px] border border-[#a8dfb7] bg-[#effaf2] px-3 py-2 text-[12px] text-[#267340]" role="status">
                    {profileMessage}
                  </p>
                )}
                <button
                  className="col-start-2 flex h-11 items-center justify-center gap-2 rounded-[6px] border-0 bg-[#1250a0] px-4 text-[13px] font-bold text-white transition hover:bg-[#0e4389] max-[620px]:col-start-1"
                  type="submit"
                >
                  <span className="material-symbols-outlined text-[18px]">
                    save
                  </span>
                  Save personal information
                </button>
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
                      aria-label={showPasswords ? "Hide passwords" : "Show passwords"}
                      className="absolute right-2 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center border-0 bg-transparent text-[#6f7f91] hover:text-[#14519f]"
                      onClick={() => setShowPasswords((isVisible) => !isVisible)}
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
                      aria-label={showPasswords ? "Hide passwords" : "Show passwords"}
                      className="absolute right-2 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center border-0 bg-transparent text-[#6f7f91] hover:text-[#14519f]"
                      onClick={() => setShowPasswords((isVisible) => !isVisible)}
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
                      aria-label={showPasswords ? "Hide passwords" : "Show passwords"}
                      className="absolute right-2 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center border-0 bg-transparent text-[#6f7f91] hover:text-[#14519f]"
                      onClick={() => setShowPasswords((isVisible) => !isVisible)}
                      type="button"
                    >
                      <span className="material-symbols-outlined text-[17px]">
                        {showPasswords ? "visibility" : "visibility_off"}
                      </span>
                    </button>
                  </div>
                </label>

                {formError && (
                  <p className="m-0 rounded-[5px] border border-[#f0b8b0] bg-[#fff1ee] px-3 py-2 text-[12px] text-[#b64132]" role="alert">
                    {formError}
                  </p>
                )}
                {successMessage && (
                  <p className="m-0 rounded-[5px] border border-[#a8dfb7] bg-[#effaf2] px-3 py-2 text-[12px] text-[#267340]" role="status">
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
                Use a password with at least 8 characters. You will need the new password the next time you sign in as admin.
              </p>
            </aside>
          </div>
        </div>
      </section>
    </main>
  );
}

export default Settings;
