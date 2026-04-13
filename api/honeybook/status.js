import {
  getSupabaseAdmin,
  missingConfig,
  loadTokenRecord,
  TOKEN_SETUP_SQL,
} from "./lib.js";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const missing = missingConfig();
  const supabase = getSupabaseAdmin();

  if (!supabase) {
    return res.status(500).json({
      connected: false,
      configured: false,
      error: "Missing SUPABASE_URL/VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY",
      missing,
      setupSql: TOKEN_SETUP_SQL,
    });
  }

  try {
    const token = await loadTokenRecord(supabase);

    const connected = !!token?.access_token;
    return res.status(200).json({
      connected,
      configured: missing.length === 0,
      missing,
      expiresAt: token?.expires_at || null,
      needsReconnect: token?.expires_at ? new Date(token.expires_at).getTime() < Date.now() : false,
      setupSql: TOKEN_SETUP_SQL,
    });
  } catch (err) {
    const msg = err?.message || "Failed to check HoneyBook status";
    const missingTable = msg.toLowerCase().includes("relation") || msg.toLowerCase().includes("integration_tokens");

    return res.status(200).json({
      connected: false,
      configured: missing.length === 0,
      missing,
      dbReady: !missingTable,
      error: msg,
      setupSql: TOKEN_SETUP_SQL,
    });
  }
}
