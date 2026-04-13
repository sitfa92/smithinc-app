import { Client } from "pg";

const CONNECTION_STRING =
  process.env.POSTGRES_URL_NON_POOLING || process.env.POSTGRES_URL || "";
const SYNC_SECRET =
  (process.env.SYNC_CURRENT_DATA_SECRET ||
    process.env.ZAPIER_WEBHOOK_SECRET ||
    process.env.MANYCHAT_WEBHOOK_SECRET ||
    "").trim();

const DEFAULT_TEST_EMAIL = "sitfa92@gmail.com";

const ALERTS_SQL = `
create extension if not exists pgcrypto;

create table if not exists public.alerts (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  message text default '',
  audience_role text,
  audience_email text,
  source_type text default 'system',
  source_id text default '',
  level text not null default 'info',
  status text not null default 'unread',
  created_at timestamptz default now(),
  read_at timestamptz
);

create index if not exists idx_alerts_audience_role on public.alerts(audience_role);
create index if not exists idx_alerts_audience_email on public.alerts(audience_email);
create index if not exists idx_alerts_status on public.alerts(status);
create index if not exists idx_alerts_created_at on public.alerts(created_at desc);

alter table public.alerts disable row level security;
grant usage on schema public to anon, authenticated, service_role;
grant select, insert, update on public.alerts to anon, authenticated, service_role;
`;

function isAuthorized(req) {
  if (!SYNC_SECRET) return false;

  const providedSecret =
    (req.headers["x-sync-secret"] ||
      req.headers["x-zapier-secret"] ||
      req.headers["x-manychat-secret"] ||
      "").trim();

  return Boolean(providedSecret) && providedSecret === SYNC_SECRET;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!CONNECTION_STRING) {
    return res.status(503).json({ error: "Missing Postgres connection string" });
  }

  if (!isAuthorized(req)) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const client = new Client({
    connectionString: CONNECTION_STRING,
    ssl: { rejectUnauthorized: false },
  });

  try {
    await client.connect();
    await client.query(ALERTS_SQL);

    const shouldSeedTest = req.body?.seedTest !== false;
    let seededAlert = null;

    if (shouldSeedTest) {
      const audienceEmail = String(req.body?.audienceEmail || DEFAULT_TEST_EMAIL)
        .trim()
        .toLowerCase();
      const title = String(req.body?.title || "Notification test").slice(0, 160);
      const message = String(
        req.body?.message || "This is a live test notification created from the production admin setup route."
      ).slice(0, 2000);

      const insertResult = await client.query(
        `
          insert into public.alerts (
            title,
            message,
            audience_role,
            audience_email,
            source_type,
            source_id,
            level,
            status
          )
          values ($1, $2, $3, $4, $5, $6, $7, $8)
          returning id, title, audience_email, status, created_at
        `,
        [
          title,
          message,
          "admin",
          audienceEmail,
          "system",
          "provision-alerts",
          "info",
          "unread",
        ]
      );

      seededAlert = insertResult.rows[0] || null;
    }

    return res.status(200).json({
      ok: true,
      tableReady: true,
      seededAlert,
    });
  } catch (error) {
    return res.status(500).json({
      error: error.message || "Failed to provision alerts",
    });
  } finally {
    await client.end().catch(() => {});
  }
}