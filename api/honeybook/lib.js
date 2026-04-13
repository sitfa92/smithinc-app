import { createClient } from "@supabase/supabase-js";

const TOKEN_TABLE = "integration_tokens";
const TOKEN_PROVIDER = "honeybook";

export const TOKEN_SETUP_SQL = `create table if not exists public.integration_tokens (
  provider text primary key,
  access_token text not null,
  refresh_token text,
  expires_at timestamptz,
  updated_at timestamptz not null default now()
);\n\nalter table public.integration_tokens disable row level security;`;

export function getHoneyBookConfig() {
  return {
    clientId: process.env.HONEYBOOK_CLIENT_ID,
    clientSecret: process.env.HONEYBOOK_CLIENT_SECRET,
    redirectUri: process.env.HONEYBOOK_REDIRECT_URI,
    authUrl: process.env.HONEYBOOK_AUTH_URL || "https://api.honeybook.com/oauth/authorize",
    tokenUrl: process.env.HONEYBOOK_TOKEN_URL || "https://api.honeybook.com/oauth/token",
    apiBaseUrl: process.env.HONEYBOOK_API_BASE_URL || "https://api.honeybook.com/v1",
    scopes: process.env.HONEYBOOK_SCOPES || "contacts.read projects.read",
  };
}

export function getSupabaseAdmin() {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    return null;
  }

  return createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: { persistSession: false },
  });
}

export function missingConfig() {
  const cfg = getHoneyBookConfig();
  const missing = [];

  if (!cfg.clientId) missing.push("HONEYBOOK_CLIENT_ID");
  if (!cfg.clientSecret) missing.push("HONEYBOOK_CLIENT_SECRET");
  if (!cfg.redirectUri) missing.push("HONEYBOOK_REDIRECT_URI");

  return missing;
}

export async function loadTokenRecord(supabase) {
  const { data, error } = await supabase
    .from(TOKEN_TABLE)
    .select("provider, access_token, refresh_token, expires_at")
    .eq("provider", TOKEN_PROVIDER)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

export async function saveTokenRecord(supabase, tokenPayload) {
  const expiresAt = tokenPayload.expires_in
    ? new Date(Date.now() + tokenPayload.expires_in * 1000).toISOString()
    : null;

  const { error } = await supabase.from(TOKEN_TABLE).upsert(
    {
      provider: TOKEN_PROVIDER,
      access_token: tokenPayload.access_token,
      refresh_token: tokenPayload.refresh_token || null,
      expires_at: expiresAt,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "provider" }
  );

  if (error) {
    throw error;
  }
}

async function exchangeRefreshToken(config, refreshToken) {
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    client_id: config.clientId,
    client_secret: config.clientSecret,
    redirect_uri: config.redirectUri,
  });

  const resp = await fetch(config.tokenUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });

  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`HoneyBook refresh failed: ${errText}`);
  }

  return resp.json();
}

export async function getValidAccessToken(supabase) {
  const config = getHoneyBookConfig();
  const token = await loadTokenRecord(supabase);

  if (!token?.access_token) {
    return null;
  }

  if (!token.expires_at) {
    return token.access_token;
  }

  const expiry = new Date(token.expires_at).getTime();
  const now = Date.now();

  if (expiry - now > 60_000) {
    return token.access_token;
  }

  if (!token.refresh_token) {
    return token.access_token;
  }

  const refreshed = await exchangeRefreshToken(config, token.refresh_token);
  await saveTokenRecord(supabase, refreshed);
  return refreshed.access_token;
}
