export default function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const secretConfigured = !!process.env.MANYCHAT_WEBHOOK_SECRET;
  const widgetConfigured = !!process.env.VITE_MANYCHAT_PAGE_ID;

  return res.status(200).json({
    configured: secretConfigured,
    widgetConfigured,
    webhookPath: "/api/manychat/webhook",
    events: ["model.lead", "client.lead"],
  });
}
