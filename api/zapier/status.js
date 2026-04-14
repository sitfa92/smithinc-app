export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const webhookUrl = process.env.ZAPIER_WEBHOOK_URL;
  return res.status(200).json({
    configured: !!webhookUrl,
    events: ["booking.created", "client.created", "booking.confirmed"],
    honeybook_events: [
      "honeybook.contact.created",
      "honeybook.project.created",
      "honeybook.project.stage_changed",
      "honeybook.invoice.sent",
      "honeybook.invoice.paid",
      "honeybook.contract.signed",
      "honeybook.payment.received",
    ],
    honeybook_webhook_url: "/api/honeybook/sync",
  });
}
