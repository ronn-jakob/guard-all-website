import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import Sidebar from "./Sidebar.jsx";
import TopBar from "./TopBar.jsx";
import { getSession } from "../lib/auth.js";
import {
  createJobFromTemplate,
  getSchedule,
  listClients,
  listTechnicians,
  updateSchedule,
} from "../lib/api/scheduling.js";
import { listJobTemplates } from "../lib/api/templates.js";
import { dateParamKey } from "../lib/dates.js";

const fieldClass =
  "mt-1.5 h-11 w-full rounded-[6px] border border-[#d6dee6] bg-white px-3 text-[13px] text-[#273746] outline-none transition focus:border-[#14519f] focus:ring-2 focus:ring-[#14519f]/15";
const labelClass = "flex flex-col text-[12px] font-semibold text-[#45515c]";
const sectionClass =
  "rounded-[10px] border border-[#dfe6ec] bg-white p-5 shadow-[0_3px_8px_rgb(31_59_82_/_10%)] max-[620px]:p-4";

const branches = [
  { value: "makati", label: "Makati" },
  { value: "cebu", label: "Cebu" },
];

const jobTypeLabels = {
  installation: "Installation",
  maintenance: "Preventive maintenance",
  repair: "Service call",
  inspection: "Inspection",
};

const formatPeso = (value) =>
  `₱${Number(value || 0).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const todayKey = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
    now.getDate(),
  ).padStart(2, "0")}`;
};

function JobFormPage() {
  const navigate = useNavigate();
  const { order } = useParams();
  const [searchParams] = useSearchParams();
  const isEdit = Boolean(order);
  const sessionUser = getSession()?.user;
  const defaultBranch = sessionUser?.branch === "cebu" ? "cebu" : "makati";
  const isAdmin = sessionUser?.role === "Admin";

  const [loadError, setLoadError] = useState("");
  const [saveError, setSaveError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  // Templates
  const [templates, setTemplates] = useState([]);
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(true);
  const [templateSearch, setTemplateSearch] = useState("");
  const [templateId, setTemplateId] = useState("");

  // Client
  const [clientMode, setClientMode] = useState("existing");
  const [clients, setClients] = useState([]);
  const [clientSearch, setClientSearch] = useState("");
  const [clientId, setClientId] = useState("");
  const [isSearchingClients, setIsSearchingClients] = useState(false);
  const clientTimer = useRef(null);
  const [newClient, setNewClient] = useState({
    firstName: "",
    lastName: "",
    clientType: "individual",
    companyName: "",
    email: "",
    phone: "",
  });

  // Schedule
  const [branch, setBranch] = useState(defaultBranch);
  // Starts on the day the scheduler was viewing; still freely editable here.
  const [date, setDate] = useState(
    () => dateParamKey(searchParams.get("date")) ?? todayKey(),
  );
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("10:00");
  const [siteAddress, setSiteAddress] = useState("");

  // Technicians
  const [technicians, setTechnicians] = useState([]);
  const [technicianSearch, setTechnicianSearch] = useState("");
  const [selectedTechnicians, setSelectedTechnicians] = useState([]);

  // Review
  // The quotation's representative is the signed-in account. The backend derives
  // the same value from the session, so this is display-only.
  const acceptedByName = sessionUser?.name ?? "";

  // Edit mode
  const [editJob, setEditJob] = useState(null);
  // A draft job is editable, branch included, until its assignment is confirmed.
  const isDraftJob = isEdit && Boolean(editJob) && !editJob.assignmentConfirmedAt;
  // A confirmed job is final: the page is read-only and the backend refuses edits.
  const isLockedJob = isEdit && Boolean(editJob?.assignmentConfirmedAt);

  useEffect(() => {
    let alive = true;
    listJobTemplates()
      .then(({ templates: incoming }) => {
        if (alive) setTemplates(Array.isArray(incoming) ? incoming : []);
      })
      .catch((error) => {
        if (alive) setLoadError(error.message);
      })
      .finally(() => {
        if (alive) setIsLoadingTemplates(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    let alive = true;
    const payload = {};
    if (date) payload.date = date;
    if (order) payload.excludeOrder = order;
    listTechnicians(payload)
      .then(({ technicians: incoming }) => {
        if (alive) setTechnicians(Array.isArray(incoming) ? incoming : []);
      })
      .catch(() => {
        if (alive) setTechnicians([]);
      });
    return () => {
      alive = false;
    };
  }, [date, order]);

  useEffect(() => {
    let alive = true;
    listClients({})
      .then(({ clients: incoming }) => {
        if (alive) setClients(Array.isArray(incoming) ? incoming : []);
      })
      .catch(() => {
        if (alive) setClients([]);
      });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!order) return undefined;
    let alive = true;
    getSchedule({ order })
      .then(({ job }) => {
        if (!alive || !job) return;
        setEditJob(job);
        setBranch(job.branch ?? defaultBranch);
        setDate(job.date ?? todayKey());
        setStartTime(job.time || "09:00");
        setEndTime(job.endTime || "10:00");
        setSiteAddress(job.siteAddress ?? "");
        setSelectedTechnicians(
          (job.technicians ?? []).map((technician) => technician.id),
        );
      })
      .catch((error) => {
        if (alive) setLoadError(error.message);
      });
    return () => {
      alive = false;
    };
  }, [order, defaultBranch]);

  const selectedTemplate =
    templates.find((template) => template.id === templateId) ?? null;

  const visibleTemplates = templates.filter((template) => {
    if (!template.isActive) return false;
    if (template.branch && template.branch !== branch) return false;
    const query = templateSearch.trim().toLowerCase();
    if (!query) return true;
    return `${template.name} ${template.description}`.toLowerCase().includes(query);
  });

  const selectedClient =
    clients.find((client) => client.id === clientId) ?? null;

  const visibleTechnicians = technicians.filter((technician) => {
    const query = technicianSearch.trim().toLowerCase();
    if (!query) return true;
    return technician.name.toLowerCase().includes(query);
  });

  const selectedTechnicianNames = selectedTechnicians
    .map((id) => technicians.find((technician) => technician.id === id)?.name)
    .filter(Boolean);

  function handleClientSearch(value) {
    setClientSearch(value);
    if (clientTimer.current) clearTimeout(clientTimer.current);
    clientTimer.current = setTimeout(() => {
      setIsSearchingClients(true);
      listClients({ search: value })
        .then(({ clients: incoming }) => {
          setClients(Array.isArray(incoming) ? incoming : []);
        })
        .catch(() => {})
        .finally(() => setIsSearchingClients(false));
    }, 300);
  }

  function selectClient(client) {
    setClientId(client.id);
    if (!siteAddress.trim()) setSiteAddress(client.address ?? "");
  }

  function toggleTechnician(id) {
    setSelectedTechnicians((current) =>
      current.includes(id)
        ? current.filter((value) => value !== id)
        : [...current, id],
    );
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSaveError("");

    if (!isEdit && !templateId) {
      setSaveError("Choose a job template — that is what prices the job.");
      return;
    }
    if (!siteAddress.trim()) {
      setSaveError("A site address is required.");
      return;
    }
    if (!endTime || !startTime || endTime <= startTime) {
      setSaveError("The end time must be after the start time.");
      return;
    }
    if (clientMode === "existing" && !clientId && !isEdit) {
      setSaveError("Select a client, or switch to a new client.");
      return;
    }
    if (clientMode === "new" && !isEdit) {
      if (
        newClient.clientType === "company"
          ? !newClient.companyName.trim()
          : !newClient.firstName.trim() || !newClient.lastName.trim()
      ) {
        setSaveError(
          newClient.clientType === "company"
            ? "A company name is required."
            : "First and last name are required.",
        );
        return;
      }
    }
    if (!isEdit && !acceptedByName.trim()) {
      setSaveError(
        "Your account has no name on record. Update your profile before creating a quote.",
      );
      return;
    }

    setIsSaving(true);
    try {
      if (isEdit) {
        await updateSchedule({
          order,
          serviceType: editJob?.service || "Service call",
          date,
          startTime,
          endTime,
          branch,
          siteAddress,
          technicianIds: selectedTechnicians,
        });
      } else {
        await createJobFromTemplate({
          clientId: clientMode === "existing" ? clientId : null,
          firstName: newClient.firstName,
          lastName: newClient.lastName,
          clientType: newClient.clientType,
          companyName: newClient.companyName,
          email: newClient.email,
          phone: newClient.phone,
          siteAddress,
          templateId,
          date,
          startTime,
          endTime,
          branch,
          technicianIds: selectedTechnicians,
        });
      }
      navigate("/scheduling");
    } catch (error) {
      setSaveError(error.message);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <main className="flex h-screen overflow-hidden bg-[#1f2022] font-sans text-[#063b7c] max-[1024px]:block">
      <Sidebar />
      <section className="h-screen w-full min-w-0 flex-1 overflow-y-auto bg-[#edf7ff] max-[1024px]:h-[100dvh]">
        <TopBar />
        <div className="px-8 pb-28 pt-8 max-[1024px]:px-6 max-[1024px]:pb-28 max-[1024px]:pt-5 max-[620px]:px-3">
          <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="mb-1 text-[10px] font-bold uppercase tracking-[.12em] text-[#818b94]">
                Operations / Jobs
              </p>
              <h1 className="m-0 text-[30px] font-bold tracking-[-.5px] max-[1024px]:text-[24px] max-[620px]:text-[19px]">
                {isEdit ? `Edit ${order}` : "Create job"}
              </h1>
              <p className="mb-0 mt-2 text-[14px] text-[#8b949c] max-[620px]:text-[9px]">
                {isEdit
                  ? isLockedJob
                    ? "This job is confirmed and can no longer be edited."
                    : "Editable until the draft is confirmed."
                  : "Price the job from a standard template, then schedule it."}
              </p>
            </div>
            <button
              type="button"
              onClick={() => navigate("/scheduling")}
              className="inline-flex items-center gap-1.5 rounded-[6px] border border-[#cbd8e7] bg-white px-4 py-2.5 text-[12px] font-semibold text-[#697a8c] hover:border-[#174f9a] hover:text-[#174f9a]"
            >
              <span className="material-symbols-outlined text-[17px]">
                arrow_back
              </span>
              Back to schedule
            </button>
          </header>

          {loadError && (
            <p
              className="mb-4 rounded-[6px] border border-[#f1b7af] bg-[#fff3f1] px-4 py-3 text-[12px] text-[#a83a2c]"
              role="alert"
            >
              {loadError}
            </p>
          )}

          <form
            onSubmit={handleSubmit}
            className="grid grid-cols-[minmax(0,1fr)_320px] items-start gap-4 max-[1100px]:grid-cols-1"
          >
            <div
              className={
                isLockedJob ? "space-y-4 pointer-events-none opacity-60" : "space-y-4"
              }
            >
              {/* 1. Client */}
              <section className={sectionClass}>
                <h2 className="m-0 text-[15px] font-bold text-[#263747]">
                  1. Client
                </h2>

                {isEdit ? (
                  <div className="mt-3 rounded-[6px] border border-[#e1e6eb] bg-[#f8fbff] px-3 py-2">
                    <span className="block text-[11px] font-bold uppercase tracking-[.06em] text-[#7d8994]">
                      Client
                    </span>
                    <strong className="mt-0.5 block text-[13px] text-[#174276]">
                      {editJob?.client || "—"}
                    </strong>
                  </div>
                ) : (
                  <>
                    <div className="mt-3 inline-flex rounded-[7px] bg-[#f4f7fb] p-1 text-[11px] font-bold">
                      {[
                        { value: "existing", label: "Existing client" },
                        { value: "new", label: "New client" },
                      ].map((option) => (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => setClientMode(option.value)}
                          className={`rounded-[6px] px-3 py-1.5 transition-all ${
                            clientMode === option.value
                              ? "bg-white text-[#174f9a] shadow-sm"
                              : "text-[#82909c] hover:text-[#174f9a]"
                          }`}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>

                    {clientMode === "existing" ? (
                      <div className="mt-3 space-y-2">
                        <label className={labelClass}>
                          Search client
                          <input
                            className={fieldClass}
                            value={clientSearch}
                            onChange={(event) => handleClientSearch(event.target.value)}
                            placeholder="Name, phone, or email"
                          />
                        </label>
                        <div className="max-h-56 divide-y divide-[#eef2f6] overflow-y-auto rounded-[6px] border border-[#e1e6eb]">
                          {isSearchingClients ? (
                            <p className="m-0 px-3 py-4 text-center text-[12px] text-[#8b949c]">
                              Searching...
                            </p>
                          ) : clients.length === 0 ? (
                            <p className="m-0 px-3 py-4 text-center text-[12px] text-[#8b949c]">
                              No matching clients.
                            </p>
                          ) : (
                            clients.map((client) => (
                              <button
                                key={client.id}
                                type="button"
                                onClick={() => selectClient(client)}
                                className={`block w-full px-3 py-2 text-left transition-colors ${
                                  clientId === client.id
                                    ? "bg-[#eef4ff] font-semibold text-[#174f9a]"
                                    : "hover:bg-[#f7faff]"
                                }`}
                              >
                                <strong className="block truncate text-[13px]">
                                  {client.name}
                                </strong>
                                <span className="block truncate text-[11px] text-[#8b949c]">
                                  {client.address || "No address"} ·{" "}
                                  {client.phone || "No phone"}
                                </span>
                              </button>
                            ))
                          )}
                        </div>
                        {selectedClient && (
                          <p className="m-0 text-[11px] text-[#267340]">
                            Selected: {selectedClient.name}
                          </p>
                        )}
                      </div>
                    ) : (
                      <div className="mt-3 space-y-3">
                        <div className="grid grid-cols-2 gap-3 max-[620px]:grid-cols-1">
                          <label className={labelClass}>
                            Client type
                            <select
                              className={fieldClass}
                              value={newClient.clientType}
                              onChange={(event) =>
                                setNewClient({
                                  ...newClient,
                                  clientType: event.target.value,
                                })
                              }
                            >
                              <option value="individual">Individual</option>
                              <option value="company">Company</option>
                            </select>
                          </label>
                          {newClient.clientType === "company" ? (
                            <label className={labelClass}>
                              Company name
                              <input
                                className={fieldClass}
                                value={newClient.companyName}
                                onChange={(event) =>
                                  setNewClient({
                                    ...newClient,
                                    companyName: event.target.value,
                                  })
                                }
                              />
                            </label>
                          ) : (
                            <span />
                          )}
                        </div>
                        {newClient.clientType === "individual" && (
                          <div className="grid grid-cols-2 gap-3 max-[620px]:grid-cols-1">
                            <label className={labelClass}>
                              First name
                              <input
                                className={fieldClass}
                                value={newClient.firstName}
                                onChange={(event) =>
                                  setNewClient({
                                    ...newClient,
                                    firstName: event.target.value,
                                  })
                                }
                              />
                            </label>
                            <label className={labelClass}>
                              Last name
                              <input
                                className={fieldClass}
                                value={newClient.lastName}
                                onChange={(event) =>
                                  setNewClient({
                                    ...newClient,
                                    lastName: event.target.value,
                                  })
                                }
                              />
                            </label>
                          </div>
                        )}
                        <div className="grid grid-cols-2 gap-3 max-[620px]:grid-cols-1">
                          <label className={labelClass}>
                            Contact email
                            <input
                              className={fieldClass}
                              type="email"
                              value={newClient.email}
                              onChange={(event) =>
                                setNewClient({
                                  ...newClient,
                                  email: event.target.value,
                                })
                              }
                            />
                          </label>
                          <label className={labelClass}>
                            Phone number
                            <input
                              className={fieldClass}
                              type="tel"
                              value={newClient.phone}
                              onChange={(event) =>
                                setNewClient({
                                  ...newClient,
                                  phone: event.target.value,
                                })
                              }
                            />
                          </label>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </section>

              {/* 2. Template */}
              {!isEdit && (
                <section className={sectionClass}>
                  <div className="flex flex-wrap items-end justify-between gap-3">
                    <div>
                      <h2 className="m-0 text-[15px] font-bold text-[#263747]">
                        2. Standard price
                      </h2>
                      <p className="m-0 mt-1 text-[12px] text-[#8b949c]">
                        Pick the template that matches the agreed deal.
                      </p>
                    </div>
                    <label className="flex h-9 min-w-[200px] items-center gap-2 rounded-[6px] border border-[#d9dfe4] bg-[#f8f9fa] px-3 text-[11px] text-[#174f9a] max-[620px]:w-full">
                      <span className="material-symbols-outlined text-[17px] text-[#9ba3aa]">
                        search
                      </span>
                      <input
                        className="w-full min-w-0 border-0 bg-transparent outline-none"
                        value={templateSearch}
                        onChange={(event) => setTemplateSearch(event.target.value)}
                        placeholder="Search templates"
                      />
                    </label>
                  </div>

                  {isLoadingTemplates ? (
                    <p className="m-0 mt-3 text-[13px] text-[#8b949c]">
                      Loading templates...
                    </p>
                  ) : visibleTemplates.length === 0 ? (
                    <p className="m-0 mt-3 rounded-[6px] border border-dashed border-[#cbd8e7] px-4 py-6 text-center text-[13px] text-[#778593]">
                      No templates for this branch. Ask Billing Staff to add one.
                    </p>
                  ) : (
                    <div className="mt-3 grid grid-cols-2 gap-3 max-[850px]:grid-cols-1">
                      {visibleTemplates.map((template) => (
                        <button
                          key={template.id}
                          type="button"
                          onClick={() => setTemplateId(template.id)}
                          className={`rounded-[8px] border p-4 text-left transition-colors ${
                            templateId === template.id
                              ? "border-[#1250a0] bg-[#eef4ff] ring-1 ring-[#1250a0]"
                              : "border-[#dfe6ec] bg-white hover:border-[#8eadd4] hover:bg-[#f7faff]"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <strong className="text-[14px] text-[#174f9a]">
                              {template.name}
                            </strong>
                            <span className="shrink-0 rounded-full border border-[#dfe6ec] bg-white px-2 py-0.5 text-[10px] font-semibold text-[#68798a]">
                              {jobTypeLabels[template.jobType] ?? template.jobType}
                            </span>
                          </div>
                          {template.description && (
                            <p className="m-0 mt-1 text-[12px] text-[#7d8994]">
                              {template.description}
                            </p>
                          )}
                          <div className="mt-3 flex items-end justify-between">
                            <strong className="text-[17px] text-[#1250a0]">
                              {formatPeso(template.total)}
                            </strong>
                            <span className="text-[11px] text-[#8b949c]">
                              {template.items.length}{" "}
                              {template.items.length === 1 ? "line" : "lines"}
                            </span>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </section>
              )}

              {/* 3. Schedule */}
              <section className={sectionClass}>
                <h2 className="m-0 text-[15px] font-bold text-[#263747]">
                  {isEdit ? "2. Schedule" : "3. Schedule"}
                </h2>
                <div className="mt-3 grid grid-cols-2 gap-3 max-[620px]:grid-cols-1">
                  <label className={labelClass}>
                    Branch
                    <select
                      className={`${fieldClass} disabled:bg-[#f2f4f6]`}
                      value={branch}
                      disabled={!isAdmin || (isEdit && !isDraftJob)}
                      onChange={(event) => setBranch(event.target.value)}
                    >
                      {branches.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                    {!isAdmin && (
                      <span className="mt-1 text-[10px] font-normal text-[#8b949c]">
                        Assigned to your account branch. Ask an Admin to change it.
                      </span>
                    )}
                    {isAdmin && isEdit && !isDraftJob && (
                      <span className="mt-1 text-[10px] font-normal text-[#8b949c]">
                        Fixed by the accepted quotation
                      </span>
                    )}
                    {isAdmin && isDraftJob && (
                      <span className="mt-1 text-[10px] font-normal text-[#8b949c]">
                        Editable until the draft is confirmed
                      </span>
                    )}
                  </label>
                  <label className={labelClass}>
                    Date
                    <input
                      className={fieldClass}
                      type="date"
                      value={date}
                      onChange={(event) => setDate(event.target.value)}
                      required
                    />
                  </label>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-3 max-[620px]:grid-cols-1">
                  <label className={labelClass}>
                    Start time
                    <input
                      className={fieldClass}
                      type="time"
                      value={startTime}
                      onChange={(event) => setStartTime(event.target.value)}
                      required
                    />
                  </label>
                  <label className={labelClass}>
                    End time
                    <input
                      className={fieldClass}
                      type="time"
                      value={endTime}
                      onChange={(event) => setEndTime(event.target.value)}
                      required
                    />
                  </label>
                </div>
                <label className={`${labelClass} mt-3`}>
                  Site address
                  <input
                    className={fieldClass}
                    value={siteAddress}
                    onChange={(event) => setSiteAddress(event.target.value)}
                    placeholder="Where the work happens"
                    required
                  />
                </label>
              </section>

              {/* 4. Technicians */}
              <section className={sectionClass}>
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <div>
                    <h2 className="m-0 text-[15px] font-bold text-[#263747]">
                      {isEdit ? "3. Technicians" : "4. Technicians"}
                    </h2>
                    <p className="m-0 mt-1 text-[12px] text-[#8b949c]">
                      Only technicians free on {date || "the chosen date"} are listed.
                    </p>
                  </div>
                  <label className="flex h-9 min-w-[200px] items-center gap-2 rounded-[6px] border border-[#d9dfe4] bg-[#f8f9fa] px-3 text-[11px] text-[#174f9a] max-[620px]:w-full">
                    <span className="material-symbols-outlined text-[17px] text-[#9ba3aa]">
                      search
                    </span>
                    <input
                      className="w-full min-w-0 border-0 bg-transparent outline-none"
                      value={technicianSearch}
                      onChange={(event) => setTechnicianSearch(event.target.value)}
                      placeholder="Search technician"
                    />
                  </label>
                </div>

                {selectedTechnicianNames.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {selectedTechnicians.map((id, index) => (
                      <span
                        key={id}
                        className="inline-flex items-center gap-1 rounded-full bg-[#e6effb] px-2.5 py-1 text-[11px] font-semibold text-[#17519a]"
                      >
                        {selectedTechnicianNames[index] ?? "Technician"}
                        <button
                          type="button"
                          onClick={() => toggleTechnician(id)}
                          aria-label="Remove technician"
                          className="border-0 bg-transparent p-0 text-[13px] leading-none text-[#5b7ba6] hover:text-[#b64132]"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                )}

                <div className="mt-3 max-h-56 divide-y divide-[#eef2f6] overflow-y-auto rounded-[6px] border border-[#e1e6eb]">
                  {visibleTechnicians.length === 0 ? (
                    <p className="m-0 px-3 py-4 text-center text-[12px] text-[#8b949c]">
                      No available technicians match.
                    </p>
                  ) : (
                    visibleTechnicians.map((technician) => (
                      <label
                        key={technician.id}
                        className="flex cursor-pointer items-center gap-2 px-3 py-2 text-[13px] text-[#3a434d] hover:bg-[#f7faff]"
                      >
                        <input
                          type="checkbox"
                          checked={selectedTechnicians.includes(technician.id)}
                          onChange={() => toggleTechnician(technician.id)}
                          className="h-4 w-4 rounded border-gray-300 text-[#1250a0] focus:ring-[#1250a0]"
                        />
                        <span className="min-w-0 flex-1 truncate">
                          {technician.name}
                        </span>
                        <span className="shrink-0 text-[11px] text-[#8b949c]">
                          {technician.branch
                            ? technician.branch.replace(/^./, (letter) =>
                                letter.toUpperCase(),
                              )
                            : ""}
                        </span>
                      </label>
                    ))
                  )}
                </div>
              </section>
            </div>

            {/* Sticky summary */}
            <aside className="sticky top-4 space-y-3 rounded-[10px] border border-[#dfe6ec] bg-white p-5 shadow-[0_3px_8px_rgb(31_59_82_/_10%)] max-[1100px]:static">
              <div>
                <p className="m-0 text-[10px] font-bold uppercase tracking-[.1em] text-[#818b94]">
                  {isEdit
                    ? isDraftJob
                      ? "Draft job"
                      : "Current job"
                    : "Quote summary"}
                </p>
                <h2 className="m-0 mt-1 text-[16px] font-bold text-[#263747]">
                  {isEdit
                    ? editJob?.service || "—"
                    : selectedTemplate?.name || "No template selected"}
                </h2>
              </div>

              {isEdit ? (
                <div className="space-y-1 text-[12px] text-[#68798a]">
                  <p className="m-0">
                    Branch:{" "}
                    <strong>{branch.replace(/^./, (l) => l.toUpperCase())}</strong>
                  </p>
                  <p className="m-0">
                    Quotation:{" "}
                    <strong>
                      {editJob?.quotationNumber || editJob?.quotationId || "—"}
                    </strong>
                  </p>
                  <p className="m-0">
                    Representative:{" "}
                    <strong>{editJob?.acceptedByName || "—"}</strong>
                  </p>
                </div>
              ) : selectedTemplate ? (
                <div className="space-y-1">
                  {selectedTemplate.items.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-baseline justify-between gap-2 text-[12px]"
                    >
                      <span className="min-w-0 truncate text-[#68798a]">
                        {item.quantity} × {item.description}
                      </span>
                      <span className="shrink-0 font-semibold text-[#263747]">
                        {formatPeso(item.lineTotalClient)}
                      </span>
                    </div>
                  ))}
                  <div className="mt-2 flex items-baseline justify-between border-t border-[#e1e6eb] pt-2">
                    <span className="text-[11px] font-bold uppercase tracking-[.06em] text-[#818b94]">
                      Client price
                    </span>
                    <strong className="text-[19px] text-[#1250a0]">
                      {formatPeso(selectedTemplate.total)}
                    </strong>
                  </div>
                </div>
              ) : (
                <p className="m-0 text-[12px] text-[#8b949c]">
                  Select a template to price this job.
                </p>
              )}

              {!isEdit && (
                <div className="border-t border-[#e1e6eb] pt-2">
                  <div className="flex items-baseline justify-between gap-2 text-[12px]">
                    <span className="text-[#68798a]">Representative</span>
                    <strong className="min-w-0 truncate text-right text-[#263747]">
                      {acceptedByName || "Not set"}
                    </strong>
                  </div>
                  <span className="mt-1 block text-[10px] text-[#8b949c]">
                    Taken from your account and recorded on the quotation.
                  </span>
                </div>
              )}

              {saveError && (
                <p
                  className="m-0 rounded-[5px] border border-[#f0b8b0] bg-[#fff1ee] px-3 py-2 text-[12px] text-[#b64132]"
                  role="alert"
                >
                  {saveError}
                </p>
              )}

              <button
                type="submit"
                disabled={isSaving || isLockedJob}
                className="flex w-full items-center justify-center gap-2 rounded-[6px] bg-[#1250a0] py-3 text-[12px] font-bold text-white hover:bg-[#0e4388] disabled:cursor-wait disabled:opacity-60"
              >
                <span className="material-symbols-outlined text-[18px]">
                  {isEdit ? "save" : "add_task"}
                </span>
                {isSaving
                  ? "Saving..."
                  : isLockedJob
                    ? "Job is locked"
                    : isEdit
                      ? "Save changes"
                      : "Create job"}
              </button>

              <button
                type="button"
                onClick={() => navigate("/scheduling")}
                className="w-full rounded-[6px] border border-[#d6dee6] bg-white py-2.5 text-[12px] font-semibold text-[#68798a] hover:bg-[#f7faff]"
              >
                Cancel
              </button>
            </aside>
          </form>
        </div>
      </section>
    </main>
  );
}

export default JobFormPage;
