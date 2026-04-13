import { getHoneyBookConfig, getSupabaseAdmin, saveTokenRecord, TOKEN_SETUP_SQL } from "./lib.js";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).send("Method not allowed");
  }

  const { code, error, error_description: errorDescription } = req.query;
  if (error) {
    return res.status(400).send(`HoneyBook auth failed: ${error} ${errorDescription || ""}`);
  }

  if (!code) {
    return res.status(400).send("Missing OAuth code");
  }

  const config = getHoneyBookConfig();
  const supabase = getSupabaseAdmin();

  if (!supabase) {
    return res.status(500).send("Missing SUPABASE_URL/VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }

  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    client_id: config.clientId,
    client_secret: config.clientSecret,
    redirect_uri: config.redirectUri,
  });

  try {
    const tokenResp = await fetch(config.tokenUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
    });

    if (!tokenResp.ok) {
      const text = await tokenResp.text();
      return res.status(400).send(`Token exchange failed: ${text}`);
    }

    const tokenPayload = await tokenResp.json();

    try {
      await saveTokenRecord(supabase, tokenPayload);
    } catch (dbErr) {
      return res.status(500).send(
        `Failed to store token. Ensure integration_tokens table exists. SQL:\n\n${TOKEN_SETUP_SQL}\n\nError: ${dbErr.message}`
      );
    }

    return res.redirect("/integrations?honeybook=connected");
  } catch (err) {
    return res.status(500).send(`Unexpected callback error: ${err.message}`);
  }
}
