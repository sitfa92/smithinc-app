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
    dedupe_endpoint: "/api/zapier/dedupe",
    seo_backlog_endpoint: "/api/zapier/seo-backlog",
    payload_shape: {
      source: "meet-serenity-app",
      event_type: "<string>",
      happened_at: "<ISO 8601>",
      payload: {
        seo_pillar: "<sleep|stress|burnout|relationship|general>",
        dedupe_key: "<stable semantic key>",
        cluster_key: "<topic cluster key>",
      },
      metadata: { source: "meet-serenity-app", environment: "production" },
    },
    dedupe_contract: {
      request: {
        dedupe_key: "<required string>",
        event_type: "<string>",
        seo_pillar: "<string>",
        cluster_key: "<string>",
        ttl_hours: "<number, optional>",
        happened_at: "<ISO 8601, optional>",
      },
      response: {
        should_process: "<boolean>",
        duplicate: "<boolean>",
      },
    },
    seo_backlog_contract: {
      method: "GET",
      query: {
        lookback_days: "<number, optional, default 30>",
        stale_days: "<number, optional, default 90>",
        limit: "<number, optional, default 50>",
      },
      response: {
        clusters: "<array of cluster objects with count and stale_candidate>",
      },
    },
  });
}
