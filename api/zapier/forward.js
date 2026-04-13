const ALLOWED_ORIGINS = new Set([
  "https://meet-serenity.online",
  "https://smithinc-app.vercel.app",
  "http://localhost:5173",
  "http://localhost:3000",
]);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const origin = req.headers.origin || req.headers.referer || "";
  const originBase = origin.split("/").slice(0, 3).join("/");
  if (origin && !ALLOWED_ORIGINS.has(originBase)) {
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

  const { eventType, payload } = req.body || {};
  if (!eventType) {
    return res.status(400).json({ ok: false, error: "Missing eventType" });
  }

  const body = {
    source: "meet-serenity-app",
    eventType,
    happenedAt: new Date().toISOString(),
    payload: payload || {},
  };

  try {
    const zapierResp = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!zapierResp.ok) {
      const text = await zapierResp.text();
      return res.status(502).json({
        ok: false,
        configured: true,
        error: `Zapier webhook failed: ${text}`,
      });
    }

    return res.status(200).json({ ok: true, configured: true });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      configured: true,
      error: err.message || "Unexpected Zapier forward error",
    });
  }
}
