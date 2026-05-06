import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !SUPABASE_ANON_KEY) {
  console.error("Missing required env vars: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_SECRET_KEY), and SUPABASE_ANON_KEY");
  process.exit(1);
}

const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Run each statement via the REST API using raw SQL via the pg endpoint
const statements = [
  "alter table public.clients disable row level security",
  "alter table public.clients add column if not exists pipeline_stage text default 'lead'",
  "alter table public.clients add column if not exists priority_level text default 'medium'",
  "alter table public.clients add column if not exists internal_notes text",
  "alter table public.clients add column if not exists next_step text",
  "alter table public.clients add column if not exists last_updated timestamptz default now()",
];

for (const sql of statements) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      "apikey": SUPABASE_SERVICE_ROLE_KEY,
    },
    body: JSON.stringify({ sql }),
  });
  const text = await res.text();
  console.log(`[${res.status}] ${sql.slice(0, 60)}: ${text.slice(0, 100)}`);
}

// Verify by reading with anon key
const anon = createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY
);
const { data, error } = await anon.from("clients").select("id,name,source,pipeline_stage").limit(10);
console.log("\nAnon read after fix — error:", error?.message || "none", "count:", data?.length ?? 0);
