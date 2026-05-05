create table if not exists public.zapier_dedupe_keys (
  dedupe_key text primary key,
  event_type text not null,
  seo_pillar text,
  cluster_key text,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  ttl_hours integer not null default 720,
  expires_at timestamptz not null,
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists zapier_dedupe_keys_expires_at_idx
  on public.zapier_dedupe_keys (expires_at);

alter table public.zapier_dedupe_keys disable row level security;
