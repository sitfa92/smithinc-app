const ALLOWED_ORIGINS = new Set([
  "https://meet-serenity.online",
  "https://www.meet-serenity.online",
  "https://smithinc-app.vercel.app",
  "http://localhost:5173",
  "http://localhost:3000",
]);

const PREVIEW_ORIGIN_PATTERN = /^https:\/\/[a-z0-9-]+-sitfa92s-projects\.vercel\.app$/;

function isAllowedOrigin(rawOrigin = "") {
  if (!rawOrigin) return true;
  const origin = String(rawOrigin).split("/").slice(0, 3).join("/").toLowerCase();
  return ALLOWED_ORIGINS.has(origin) || PREVIEW_ORIGIN_PATTERN.test(origin);
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const origin = req.headers.origin || req.headers.referer || "";
  if (!isAllowedOrigin(origin)) {
    return res.status(403).json({ ok: false, error: "Forbidden" });
  }

  const webhookUrl = process.env.ZAPIER_WEBHOOK_URL;
  if (!webhookUrl) {
    return res.status(503).json({
      ok: false,
      configured: false,
      error: "Missing ZAPIER_WEBHOOK_URL",
    });
  }

  const { eventType, payload, metadata } = req.body || {};
  if (!eventType) {
    return res.status(400).json({ ok: false, error: "Missing eventType" });
  }

  const body = {
    source: "meet-serenity-app",
    event_type: eventType,
    happened_at: new Date().toISOString(),
    payload: payload || {},
    metadata: {
      source: "meet-serenity-app",
      environment: process.env.VERCEL_ENV || "production",
      ...(metadata || {}),
    },
  };

  try {
    // Respond to Zapier within 3 seconds — fire request and return immediately
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4500);

    const zapierResp = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    }).finally(() => clearTimeout(timeout));

    if (!zapierResp.ok) {
      const text = await zapierResp.text();
      return res.status(502).json({
        ok: false,
        configured: true,
        error: `Zapier webhook failed: ${text}`,
      });
    }

    return res.status(200).json({ ok: true, configured: true, event_type: eventType });
  } catch (err) {
    const timedOut = err.name === "AbortError";
    return res.status(timedOut ? 504 : 500).json({
      ok: false,
      configured: true,
      error: timedOut ? "Zapier webhook timed out" : (err.message || "Unexpected error"),
    });
  }
}
