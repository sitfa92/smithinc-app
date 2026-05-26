import { supabase } from "./supabase";

export const DEFAULT_ROLE_BY_EMAIL = {
  "sitfa92@gmail.com": "owner",
  "sita92@gmail.com": "owner",
  "marthajohn223355@gmail.com": "va",
  "chizzyboi72@gmail.com": "agent",
  "melissaluke_@hotmail.com": "agency_admin",
};

export const STATIC_ALLOWED_EMAILS = new Set(Object.keys(DEFAULT_ROLE_BY_EMAIL));
export const isStaticallyAllowed = (email) =>
  STATIC_ALLOWED_EMAILS.has((email || "").trim().toLowerCase());

export const ANALYTICS_ALLOWED_EMAILS = new Set([
  "sitfa92@gmail.com",
  "sita92@gmail.com",
  "marthajohn223355@gmail.com",
]);
export const canAccessAnalyticsForEmail = (email) =>
  ANALYTICS_ALLOWED_EMAILS.has((email || "").trim().toLowerCase());

export const EMAIL_LOCKED_ROUTE_KEYS = new Set([
  "analytics",
  "integrations",
  "voice-reviews",
  "email-log",
]);

export const canAccessEmailLockedRoute = (routeKey, email, role = "") => {
  const normalizedRole = String(role || "").trim().toLowerCase();
  if (normalizedRole === "owner") return true;
  if (!EMAIL_LOCKED_ROUTE_KEYS.has(String(routeKey || ""))) return true;
  return canAccessAnalyticsForEmail(email);
};

export const BACKEND_BASE_URL = (import.meta.env.VITE_BACKEND_URL || "").trim();
export const PUBLIC_APP_BASE_URL = String(import.meta.env.VITE_PUBLIC_APP_URL || "")
  .trim()
  .replace(/\/+$/, "");

export const getAppBaseUrl = () => {
  if (PUBLIC_APP_BASE_URL) return PUBLIC_APP_BASE_URL;
  if (typeof window !== "undefined" && window.location?.origin) {
    return window.location.origin;
  }
  return "";
};

export const buildPublicAppUrl = (path = "/") => {
  const base = getAppBaseUrl();
  const safePath = String(path || "/").startsWith("/") ? String(path || "/") : `/${String(path || "")}`;
  return `${base}${safePath}`;
};

export const BRAND_AMBASSADOR_REFERRAL_PREFIX = "ambassador:";

export const buildBrandAmbassadorReferralCode = (ambassadorId = "") => {
  const normalizedId = String(ambassadorId || "").trim();
  if (!normalizedId) return "";
  return `${BRAND_AMBASSADOR_REFERRAL_PREFIX}${normalizedId}`;
};

export const buildBrandAmbassadorReferralLink = ({ ambassadorId = "", ambassadorName = "", intent = "become-model" } = {}) => {
  const code = buildBrandAmbassadorReferralCode(ambassadorId);
  if (!code) return "";
  const params = new URLSearchParams();
  params.set("intent", intent || "become-model");
  params.set("ref", code);
  if (String(ambassadorName || "").trim()) params.set("ref_name", String(ambassadorName || "").trim());
  params.set("utm_source", "brand_ambassador");
  params.set("utm_medium", "referral");
  params.set("utm_campaign", code.replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, ""));
  return buildPublicAppUrl(`/model-signup?${params.toString()}`);
};

export const parseBrandAmbassadorReferral = (search = "") => {
  const params = new URLSearchParams(String(search || ""));
  const rawRef = String(params.get("ref") || params.get("ambassador") || params.get("ambassador_ref") || "").trim();
  if (!rawRef) return null;

  const code = rawRef.startsWith(BRAND_AMBASSADOR_REFERRAL_PREFIX)
    ? rawRef
    : buildBrandAmbassadorReferralCode(rawRef);
  const ambassadorId = code.replace(BRAND_AMBASSADOR_REFERRAL_PREFIX, "").trim();
  if (!ambassadorId) return null;

  return {
    code,
    ambassadorId,
    ambassadorName: String(params.get("ref_name") || params.get("ambassador_name") || "").trim(),
    sourceLabel: "Brand Ambassador Referral",
  };
};

export const extractBrandAmbassadorReferralCode = (text = "") => {
  const match = String(text || "").match(/Referral code:\s*(ambassador:[^|\n]+)/i);
  return match ? match[1].trim() : "";
};

const parseNumericRevenue = (value) => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const cleaned = String(value || "").replace(/[^0-9.-]+/g, "");
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
};

export const getRecordedProgramRevenue = (enrollment = {}) => {
  return Math.max(parseNumericRevenue(enrollment?.paid_amount), 0);
};

export const PIPELINE_STAGES = [
  "submitted",
  "reviewing",
  "development",
  "digitals_pending",
  "ready_to_pitch",
  "pitched",
  "in_talks",
  "signed",
  "inactive",
  "rejected",
];

export const PIPELINE_STAGE_LABELS = {
  submitted:       "New Submission",
  reviewing:       "Under Review",
  development:     "In Development",
  digitals_pending: "Digitals Pending",
  ready_to_pitch:  "Ready to Pitch",
  pitched:         "Pitched",
  in_talks:        "In Talks",
  signed:          "Signed",
  inactive:        "Inactive",
  rejected:        "Not a Fit",
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

export const sendZapierEvent = async (eventType, payload, metadata = {}) => {
  try {
    await fetch("/api/zapier/forward", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        eventType,
        payload: {
          ...payload,
          happened_at: new Date().toISOString(),
        },
        metadata: {
          source: typeof window !== "undefined" ? "web" : "server",
          ...metadata,
        },
      }),
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

  const raw = await resp.text();
  let json = null;
  try {
    json = raw ? JSON.parse(raw) : null;
  } catch (_err) {
    json = null;
  }

  if (!json) {
    const statusNote = `HTTP ${resp.status}`;
    const fallbackMessage = raw?.trim() || "Empty or invalid JSON response";
    throw new Error(`Sync failed (${statusNote}): ${fallbackMessage}`);
  }

  if (!resp.ok || !json.ok) {
    throw new Error(json.error || "Sync failed");
  }

  return json;
};

export const createInAppAlerts = async (alerts) => {
  const isReadAlert = (item) => {
    if (item?.read_at) return true;
    const normalized = String(item?.status || "").trim().toLowerCase();
    return normalized === "read" || normalized === "seen" || normalized === "dismissed";
  };

  const keyForAlert = (item) => [
    String(item.title || "").trim().toLowerCase(),
    String(item.message || "").trim().toLowerCase(),
    String(item.audience_role || "").trim().toLowerCase(),
    String(item.audience_email || "").trim().toLowerCase(),
    String(item.source_type || "system").trim().toLowerCase(),
    String(item.source_id || "").trim().toLowerCase(),
    String(item.level || "info").trim().toLowerCase(),
  ].join("|");

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

  const uniquePayload = [];
  const seen = new Set();
  for (const item of payload) {
    const key = keyForAlert(item);
    if (seen.has(key)) continue;
    seen.add(key);
    uniquePayload.push(item);
  }

  if (uniquePayload.length === 0) return;

  let insertPayload = uniquePayload;

  try {
    const since = new Date(Date.now() - 1000 * 60 * 60 * 4).toISOString();
    const titles = [...new Set(uniquePayload.map((item) => item.title))];
    const sourceTypes = [...new Set(uniquePayload.map((item) => item.source_type))];

    const { data: existing } = await supabase
      .from("alerts")
      .select("title, message, audience_role, audience_email, source_type, source_id, level, status, read_at, created_at")
      .in("title", titles)
      .in("source_type", sourceTypes)
      .gte("created_at", since)
      .limit(500);

    const existingKeys = new Set(
      (existing || [])
        .filter((item) => !isReadAlert(item))
        .map((item) => keyForAlert(item))
    );

    insertPayload = uniquePayload.filter((item) => !existingKeys.has(keyForAlert(item)));
  } catch (_err) {
    insertPayload = uniquePayload;
  }

  if (insertPayload.length === 0) return;

  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    const resp = await fetch("/api/alerts/create", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
      },
      body: JSON.stringify({ alerts: insertPayload }),
    });

    if (resp.ok) {
      return;
    }
  } catch (_err) {
    // Fall through to direct insert fallback.
  }

  try {
    await supabase.from("alerts").insert(insertPayload);
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
  `${window.location.origin}/team-login?email=${encodeURIComponent(
    (email || "").trim().toLowerCase()
  )}`;

export const canAccessRoute = (role, routeKey) => {
  if (role === "admin") return true;
  if (role === "va") {
    return ["dashboard", "models", "model-pipeline", "bookings", "partners", "partner-pipeline", "partner-submissions", "brand-ambassadors", "brand-ambassador-pipeline", "brand-ambassador-submissions", "integrations", "workflows"].includes(routeKey);
  }
  if (role === "agent") {
    return ["dashboard", "models", "model-pipeline", "submissions", "analytics"].includes(routeKey);
  }
  if (role === "user") {
    return ["dashboard", "models"].includes(routeKey);
  }
  return false;
};
