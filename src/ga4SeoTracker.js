const ANALYTICS_CLIENT_ID_KEY = "ms-analytics-client-id";
const SEO_LAST_TRACKED_KEY = "ms-seo-last-route-view";
const ATTRIBUTION_CONTEXT_KEY = "ms-attribution-context";
const PERPLEXITY_TOUCH_KEY = "ms-perplexity-touch-sent";

// ── Client-side GA4 (gtag) ───────────────────────────────────────────────────
const GA4_ID = String(import.meta.env.VITE_GA4_MEASUREMENT_ID || "").trim();
const GOOGLE_ADS_ID = String(import.meta.env.VITE_GOOGLE_ADS_ID || "").trim();
const GA4_SCRIPT_ID = "ms-ga4-gtag";
let _gtag_ready = false;

function initGtag() {
  if (!GA4_ID || typeof window === "undefined" || _gtag_ready) return;
  window.dataLayer = window.dataLayer || [];
  if (typeof window.gtag !== "function") {
    window.gtag = function gtag() { window.dataLayer.push(arguments); };
  }
  if (!document.getElementById(GA4_SCRIPT_ID)) {
    const s = document.createElement("script");
    s.id = GA4_SCRIPT_ID;
    s.async = true;
    s.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(GA4_ID)}`;
    document.head.appendChild(s);
  }
  window.gtag("js", new Date());
  window.gtag("config", GA4_ID, { send_page_view: false, anonymize_ip: true });
  if (GOOGLE_ADS_ID) {
    window.gtag("config", GOOGLE_ADS_ID);
  }
  _gtag_ready = true;
}

function fireGtag(eventName, params) {
  if (!GA4_ID || typeof window === "undefined") return;
  initGtag();
  if (typeof window.gtag !== "function") return;
  window.gtag("event", String(eventName), params || {});
}

function parseValue(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function trackGoogleAdsConversion({ label, value, currency = "USD", transactionId } = {}) {
  if (typeof window === "undefined") return;
  if (!GOOGLE_ADS_ID) return;

  const conversionLabel = String(label || "").trim();
  if (!conversionLabel) return;

  initGtag();
  if (typeof window.gtag !== "function") return;

  const params = {
    send_to: `${GOOGLE_ADS_ID}/${conversionLabel}`,
    currency: String(currency || "USD").toUpperCase(),
  };

  const normalizedValue = parseValue(value);
  if (normalizedValue !== undefined) params.value = normalizedValue;
  if (transactionId) params.transaction_id = String(transactionId).slice(0, 100);

  window.gtag("event", "conversion", params);
}
// ─────────────────────────────────────────────────────────────────────────────

const ATTR_KEYS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
  "gclid",
  "wbraid",
  "gbraid",
];

function getClientId() {
  if (typeof window === "undefined") return "";

  try {
    const existing = String(window.localStorage.getItem(ANALYTICS_CLIENT_ID_KEY) || "").trim();
    if (existing) return existing;

    const generated = `ms.${Date.now()}.${Math.random().toString(16).slice(2)}`;
    window.localStorage.setItem(ANALYTICS_CLIENT_ID_KEY, generated);
    return generated;
  } catch {
    return `ms.${Date.now()}.${Math.random().toString(16).slice(2)}`;
  }
}

function wasTracked(routeKey) {
  if (typeof window === "undefined") return false;
  try {
    return window.sessionStorage.getItem(SEO_LAST_TRACKED_KEY) === routeKey;
  } catch {
    return false;
  }
}

function markTracked(routeKey) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(SEO_LAST_TRACKED_KEY, routeKey);
  } catch {
    // no-op
  }
}

function readAttributionContext() {
  if (typeof window === "undefined") return {};
  try {
    const raw = String(window.sessionStorage.getItem(ATTRIBUTION_CONTEXT_KEY) || "").trim();
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeAttributionContext(context) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(ATTRIBUTION_CONTEXT_KEY, JSON.stringify(context));
  } catch {
    // no-op
  }
}

function getCurrentAttributionParams() {
  if (typeof window === "undefined") return {};

  const params = new URLSearchParams(window.location.search || "");
  const next = {};

  for (const key of ATTR_KEYS) {
    const value = String(params.get(key) || "").trim();
    if (value) next[key] = value.slice(0, 200);
  }

  return next;
}

function getAttributionContext() {
  const stored = readAttributionContext();
  const current = getCurrentAttributionParams();
  const merged = { ...stored, ...current };

  if (Object.keys(current).length) {
    writeAttributionContext(merged);
  }

  return merged;
}

function referrerHost(value) {
  const input = String(value || "").trim();
  if (!input) return "";
  try {
    return new URL(input).host.toLowerCase();
  } catch {
    return "";
  }
}

function isPerplexityReferrer(value) {
  const host = referrerHost(value);
  return host === "perplexity.ai" || host.endsWith(".perplexity.ai");
}

function hasPerplexityUtm(attribution) {
  const source = String(attribution?.utm_source || "").toLowerCase();
  return source.includes("perplexity");
}

function hasPerplexityRefParam() {
  if (typeof window === "undefined") return false;
  const params = new URLSearchParams(window.location.search || "");
  const ref = String(params.get("ref") || "").toLowerCase();
  return ref.includes("perplexity");
}

function getPerplexityAttribution(attribution) {
  const next = { ...(attribution || {}) };
  const referrer = typeof document !== "undefined" ? document.referrer || "" : "";
  const viaReferrer = isPerplexityReferrer(referrer);
  const viaUtm = hasPerplexityUtm(next);
  const viaRefParam = hasPerplexityRefParam();

  if (!viaReferrer && !viaUtm && !viaRefParam) {
    return { attribution: next, isPerplexityTraffic: false };
  }

  if (!String(next.utm_source || "").trim()) next.utm_source = "perplexity";
  if (!String(next.utm_medium || "").trim()) next.utm_medium = "referral";
  next.traffic_origin = "perplexity";

  return { attribution: next, isPerplexityTraffic: true };
}

function wasPerplexityTouchSent() {
  if (typeof window === "undefined") return false;
  try {
    return window.sessionStorage.getItem(PERPLEXITY_TOUCH_KEY) === "1";
  } catch {
    return false;
  }
}

function markPerplexityTouchSent() {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(PERPLEXITY_TOUCH_KEY, "1");
  } catch {
    // no-op
  }
}

function trackPerplexityTouch({ path, attribution, clientId }) {
  if (typeof window === "undefined") return;
  if (wasPerplexityTouchSent()) return;

  const body = {
    path: String(path || `${window.location.pathname}${window.location.search || ""}`).slice(0, 400),
    href: window.location.href,
    referrer: document.referrer || "",
    clientId,
    payload: {
      ...(attribution || {}),
      traffic_origin: "perplexity",
    },
  };

  const data = JSON.stringify(body);
  markPerplexityTouchSent();

  if (navigator.sendBeacon) {
    const blob = new Blob([data], { type: "application/json" });
    navigator.sendBeacon("/api/analytics/perplexity-touch", blob);
    return;
  }

  fetch("/api/analytics/perplexity-touch", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: data,
    keepalive: true,
  }).catch(() => {});
}

export function trackSeoRouteView({
  path,
  search,
  title,
  robots,
  routeLabel,
  isPrivate,
  isIndexable,
}) {
  if (typeof window === "undefined") return;

  const routeKey = `${path || "/"}${search || ""}`;
  if (wasTracked(routeKey)) return;
  markTracked(routeKey);
  const attributionContext = getAttributionContext();
  const { attribution, isPerplexityTraffic } = getPerplexityAttribution(attributionContext);
  const clientId = getClientId();

  if (isPerplexityTraffic) {
    trackPerplexityTouch({ path: routeKey, attribution, clientId });
  }

  // Dual-fire: client-side gtag (instant, real-time) + server-side Measurement Protocol (ad-blocker resistant)
  fireGtag("page_view", {
    page_title: String(title || "").slice(0, 120),
    page_location: window.location.href,
    page_path: routeKey,
    ...attribution,
  });

  const body = {
    eventName: "seo_route_view",
    source: "meet_serenity_seo",
    app: "meet_serenity_web",
    platform: "web",
    path: routeKey,
    href: window.location.href,
    referrer: document.referrer || "",
    clientId,
    payload: {
      page_title: String(title || "").slice(0, 120),
      route_label: String(routeLabel || "").slice(0, 120),
      robots: String(robots || "").slice(0, 80),
      route_type: isPrivate ? "private" : "public",
      is_indexable: Boolean(isIndexable),
      has_query_params: Boolean(search),
      ...attribution,
    },
  };

  const payload = JSON.stringify(body);

  if (navigator.sendBeacon) {
    const blob = new Blob([payload], { type: "application/json" });
    navigator.sendBeacon("/api/analytics/unified-event", blob);
    return;
  }

  fetch("/api/analytics/unified-event", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: payload,
    keepalive: true,
  }).catch(() => {});
}

export function trackUnifiedGa4Event({
  eventName,
  path,
  payload = {},
  source = "meet_serenity_web",
}) {
  if (typeof window === "undefined") return;
  if (!eventName) return;
  const attributionContext = getAttributionContext();
  const { attribution, isPerplexityTraffic } = getPerplexityAttribution(attributionContext);
  const routePath = String(path || `${window.location.pathname}${window.location.search || ""}`).slice(0, 400);
  const clientId = getClientId();

  if (isPerplexityTraffic) {
    trackPerplexityTouch({ path: routePath, attribution, clientId });
  }

  // Dual-fire: client-side gtag (instant, real-time) + server-side Measurement Protocol
  fireGtag(eventName, { ...payload, page_path: routePath, ...attribution });

  const body = {
    eventName,
    source,
    app: "meet_serenity_web",
    platform: "web",
    path: routePath,
    href: window.location.href,
    referrer: document.referrer || "",
    clientId,
    payload: {
      ...payload,
      ...attribution,
    },
  };

  const data = JSON.stringify(body);

  if (navigator.sendBeacon) {
    const blob = new Blob([data], { type: "application/json" });
    navigator.sendBeacon("/api/analytics/unified-event", blob);
    return;
  }

  fetch("/api/analytics/unified-event", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: data,
    keepalive: true,
  }).catch(() => {});
}
