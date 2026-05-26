const GA4_MEASUREMENT_ID = String(process.env.GA4_MEASUREMENT_ID || "").trim();
const GA4_API_SECRET = String(process.env.GA4_API_SECRET || "").trim();

function isPrimitive(value) {
  return typeof value === "string" || typeof value === "number" || typeof value === "boolean";
}

function normalizeParams(params = {}) {
  const output = {};
  Object.entries(params || {}).forEach(([key, value]) => {
    if (!key || value === undefined || value === null) return;
    if (isPrimitive(value)) {
      output[key] = value;
      return;
    }
    output[key] = JSON.stringify(value);
  });
  return output;
}

function makeFallbackClientId() {
  const rand = Math.random().toString(16).slice(2);
  return `srv.${Date.now()}.${rand}`;
}

export const ga4MeasurementConfigured = () => Boolean(GA4_MEASUREMENT_ID && GA4_API_SECRET);

export async function forwardToGa4Measurement({
  eventName,
  params = {},
  clientId,
  userId,
}) {
  if (!ga4MeasurementConfigured() || !eventName) {
    return { ok: false, skipped: true };
  }

  const normalizedClientId = String(clientId || "").trim() || makeFallbackClientId();
  const normalizedUserId = String(userId || "").trim();
  const body = {
    client_id: normalizedClientId,
    events: [
      {
        name: String(eventName).trim().slice(0, 40) || "custom_event",
        params: normalizeParams(params),
      },
    ],
  };

  if (normalizedUserId) {
    body.user_id = normalizedUserId.slice(0, 128);
  }

  const url = `https://www.google-analytics.com/mp/collect?measurement_id=${encodeURIComponent(GA4_MEASUREMENT_ID)}&api_secret=${encodeURIComponent(GA4_API_SECRET)}`;

  try {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return { ok: true };
  } catch (err) {
    console.warn("[ga4-measurement] forward failed", err?.message || err);
    return { ok: false, error: err?.message || "ga4-forward-failed" };
  }
}
