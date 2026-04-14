import { supabase } from "./supabase";

export const DEFAULT_ROLE_BY_EMAIL = {
  "sitfa92@gmail.com": "admin",
  "marthajohn223355@gmail.com": "va",
  "chizzyboi72@gmail.com": "agent",
};

export const STATIC_ALLOWED_EMAILS = new Set(Object.keys(DEFAULT_ROLE_BY_EMAIL));
export const isStaticallyAllowed = (email) =>
  STATIC_ALLOWED_EMAILS.has((email || "").trim().toLowerCase());

export const BACKEND_BASE_URL = (import.meta.env.VITE_BACKEND_URL || "").trim();

export const PIPELINE_STAGES = [
  "submitted",
  "reviewing",
  "development",
  "digitals_pending",
  "ready_to_pitch",
  "pitched",
  "in_talks",
  "signed",
  "rejected",
];

export const PIPELINE_STAGE_LABELS = {
  submitted: "Submitted",
  reviewing: "Reviewing",
  development: "Development",
  digitals_pending: "Digitals Pending",
  ready_to_pitch: "Ready to Pitch",
  pitched: "Pitched",
  in_talks: "In Talks",
  signed: "Signed",
  rejected: "Rejected",
};

export const PRIORITY_LEVELS = ["low", "medium", "high"];
export const PRIORITY_RANK = { high: 3, medium: 2, low: 1 };

export const normalizePipelineStage = (value) =>
  PIPELINE_STAGES.includes(value) ? value : "submitted";

export const normalizePriorityLevel = (value) =>
  PRIORITY_LEVELS.includes(value) ? value : "medium";

export const isMissingColumnError = (err) =>
  err?.code === "42703" ||
  err?.message?.toLowerCase().includes("column") ||
  err?.message?.toLowerCase().includes("does not exist");

export const buildFallbackTasksFromBookings = (bookings) =>
  (bookings || [])
    .filter((b) => ["pending", "confirmed"].includes(b.status))
    .slice(0, 6)
    .map((b) => ({
      _id: `fallback-${b.id}`,
      role: "MJ",
      task: `${b.status === "pending" ? "Review" : "Complete"} booking for ${b.name}`,
      status: b.status === "pending" ? "pending" : "in_progress",
    }));

export const sendZapierEvent = async (eventType, payload) => {
  try {
    await fetch("/api/zapier/forward", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ eventType, payload }),
    });
  } catch (_err) {
    // Intentionally ignored to keep core user flows uninterrupted.
  }
};

export const sendBackendWebhook = async (type, data) => {
  if (!BACKEND_BASE_URL) return;
  try {
    await fetch(`${BACKEND_BASE_URL}/webhook/zapier`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, data }),
    });
  } catch (_err) {
    // Keep frontend flows unaffected if backend is down or not reachable.
  }
};

export const runAuthenticatedCurrentDataSync = async () => {
  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();

  if (sessionError) throw sessionError;
  if (!session?.access_token) {
    throw new Error("Your session expired. Please log in again.");
  }

  const resp = await fetch("/api/admin/sync-current-data", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.access_token}`,
    },
  });

  const json = await resp.json();
  if (!resp.ok || !json.ok) {
    throw new Error(json.error || "Sync failed");
  }

  return json;
};

export const createInAppAlerts = async (alerts) => {
  const payload = (alerts || [])
    .filter((item) => item?.title)
    .map((item) => ({
      title: item.title,
      message: item.message || "",
      audience_role: item.audience_role || null,
      audience_email: (item.audience_email || "").trim().toLowerCase() || null,
      source_type: item.source_type || "system",
      source_id: item.source_id ? String(item.source_id) : "",
      level: item.level || "info",
      status: "unread",
      created_at: new Date().toISOString(),
    }));

  if (payload.length === 0) return;

  try {
    await supabase.from("alerts").insert(payload);
  } catch (_err) {
    // Alerts are additive only.
  }
};

export const sendInternalTeamEmailAlert = async ({
  subject,
  message,
  roles = [],
  submissionEmail = "",
  extraRecipients = [],
}) => {
  try {
    await fetch("/api/alerts/team-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subject, message, roles, submissionEmail, extraRecipients }),
    });
  } catch (_err) {
    // Email alerts are additive only.
  }
};

export const buildPrefilledLoginLink = (email) =>
  `${window.location.origin}/login?email=${encodeURIComponent(
    (email || "").trim().toLowerCase()
  )}`;

export const canAccessRoute = (role, routeKey) => {
  if (role === "admin") return true;
  if (role === "va") {
    return ["dashboard", "models", "model-pipeline", "bookings", "clients", "integrations", "workflows"].includes(routeKey);
  }
  if (role === "agent") {
    return ["dashboard", "models", "model-pipeline", "submissions", "analytics"].includes(routeKey);
  }
  if (role === "user") {
    return ["dashboard", "models"].includes(routeKey);
  }
  return false;
};
