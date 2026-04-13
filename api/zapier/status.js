export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const webhookUrl = process.env.ZAPIER_WEBHOOK_URL;
  return res.status(200).json({
    configured: !!webhookUrl,
    events: ["booking.created", "client.created", "booking.confirmed"],
  });
}
