import {
  getHoneyBookConfig,
  getSupabaseAdmin,
  getValidAccessToken,
  missingConfig,
  TOKEN_SETUP_SQL,
} from "./lib.js";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const missing = missingConfig();
  if (missing.length > 0) {
    return res.status(500).json({ error: "HoneyBook is not configured", missing });
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return res.status(500).json({
      error: "Missing SUPABASE_URL/VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY",
      setupSql: TOKEN_SETUP_SQL,
    });
  }

  try {
    const token = await getValidAccessToken(supabase);
    if (!token) {
      return res.status(401).json({ error: "HoneyBook not connected" });
    }

    const config = getHoneyBookConfig();
    const limit = Number.parseInt(req.query.limit, 10) || 10;

    const resp = await fetch(`${config.apiBaseUrl}/contacts?limit=${limit}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
    });

    if (!resp.ok) {
      const text = await resp.text();
      return res.status(resp.status).json({ error: `HoneyBook API error: ${text}` });
    }

    const data = await resp.json();
    return res.status(200).json(data);
  } catch (err) {
    return res.status(500).json({ error: err.message || "Failed to load HoneyBook contacts" });
  }
}
