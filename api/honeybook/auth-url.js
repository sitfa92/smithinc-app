import { getHoneyBookConfig, missingConfig } from "./lib.js";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const missing = missingConfig();
  if (missing.length > 0) {
    return res.status(500).json({
      error: "HoneyBook is not configured",
      missing,
    });
  }

  const config = getHoneyBookConfig();
  const state = Buffer.from(JSON.stringify({ ts: Date.now() })).toString("base64url");

  const params = new URLSearchParams({
    client_id: config.clientId,
    response_type: "code",
    redirect_uri: config.redirectUri,
    scope: config.scopes,
    state,
  });

  const url = `${config.authUrl}?${params.toString()}`;
  return res.redirect(url);
}
