import { forwardToGa4Measurement } from "../_lib/ga4-measurement.js";

const ANALYTICS_INGEST_SECRET = String(process.env.ANALYTICS_INGEST_SECRET || "").trim();
const TRUSTED_ANALYTICS_ORIGINS = String(
  process.env.ANALYTICS_TRUSTED_ORIGINS ||
    "https://meet-serenity.online,https://www.meet-serenity.online,http://localhost:5173,http://localhost:4173"
)
  .split(",")
  .map((item) => item.trim())
  .filter(Boolean);

const TRUSTED_ANALYTICS_HOSTS = new Set(
  TRUSTED_ANALYTICS_ORIGINS.map((origin) => {
    try {
      return new URL(origin).host.toLowerCase();
    } catch {
      return "";
    }
  }).filter(Boolean)
);

function applyCors(req, res) {
  const origin = String(req.headers.origin || "").trim();
  if (origin) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
  } else {
    res.setHeader("Access-Control-Allow-Origin", "*");
  }
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, x-analytics-secret");
}

function cleanToken(value, max = 120) {
  return String(value || "")
    .trim()
    .slice(0, max)
    .replace(/[^a-zA-Z0-9_\- ]/g, "")
    .trim();
}

function normalizeEventName(value) {
  const raw = cleanToken(value || "unified_event", 60).toLowerCase();
  return raw.replace(/\s+/g, "_") || "unified_event";
}

function normalizePath(value) {
  return String(value || "").trim().slice(0, 400);
}

function getSharedSecret(req) {
  return String(req.headers["x-analytics-secret"] || req.headers.authorization || "").replace(/^Bearer\s+/i, "").trim();
}

function hostFromUrl(value) {
  const input = String(value || "").trim();
  if (!input) return "";

  try {
    return new URL(input).host.toLowerCase();
  } catch {
    return "";
  }
}

function cleanHost(value) {
  return String(value || "").trim().toLowerCase().replace(/:\d+$/, "");
}

function isTrustedFirstPartyRequest(req) {
  const originHost = hostFromUrl(req.headers.origin);
  const refererHost = hostFromUrl(req.headers.referer);
  const hostHeader = cleanHost(req.headers.host || req.headers["x-forwarded-host"]);

  return [originHost, refererHost, hostHeader].some((host) => host && TRUSTED_ANALYTICS_HOSTS.has(host));
}

function authFailed(req) {
  if (!ANALYTICS_INGEST_SECRET) return false;

  const provided = getSharedSecret(req);
  if (!provided && isTrustedFirstPartyRequest(req)) {
    return false;
  }

  return provided !== ANALYTICS_INGEST_SECRET;
}

export default async function handler(req, res) {
  applyCors(req, res);

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  if (authFailed(req)) {
    return res.status(401).json({ ok: false, error: "Unauthorized" });
  }

  const body = req.body && typeof req.body === "object" ? req.body : {};
  const eventName = normalizeEventName(body.eventName || body.name || "unified_event");
  const source = cleanToken(body.source || "unknown", 80) || "unknown";
  const app = cleanToken(body.app || "", 80);
  const platform = cleanToken(body.platform || "", 80);
  const path = normalizePath(body.path || body.route || "");
  const href = String(body.href || body.url || "").trim().slice(0, 1200);
  const referrer = String(body.referrer || "").trim().slice(0, 1200);
  const clientId = String(body.clientId || "").trim().slice(0, 120);
  const userId = String(body.userId || "").trim().slice(0, 120);
  const payload = body.payload && typeof body.payload === "object" ? body.payload : {};

  const ga4Result = await forwardToGa4Measurement({
    eventName,
    clientId,
    userId,
    params: {
      source,
      app,
      platform,
      page_path: path,
      page_location: href,
      page_referrer: referrer,
      ...payload,
    },
  });

  return res.status(200).json({
    ok: true,
    eventName,
    source,
    ga4Forwarded: Boolean(ga4Result?.ok),
    ga4Skipped: Boolean(ga4Result?.skipped),
  });
}
