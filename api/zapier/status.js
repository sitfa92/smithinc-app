export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const webhookUrl = process.env.ZAPIER_WEBHOOK_URL;
  return res.status(200).json({
    configured: !!webhookUrl,
    events: [
      "booking.created",
      "booking.confirmed",
      "model.created",
      "client.created",
      "brand_ambassador.created",
      "vapi.call.completed",
      "seo.question.captured",
      "seo.local_landing.signal",
      "seo.testimonial.candidate",
    ],
    webhook_endpoint: "/api/zapier/webhook",
    forward_endpoint: "/api/zapier/forward",
    payload_shape: {
      source: "meet-serenity-app",
      event_type: "<string>",
      happened_at: "<ISO 8601>",
      payload: "<object>",
      metadata: { source: "meet-serenity-app", environment: "production" },
    },
  });
}
