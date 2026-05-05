-- Disable RLS on the clients table so the frontend (anon/authed key) can read it.
-- Admin-only writes go through service-role API routes which bypass RLS anyway.
alter table public.clients disable row level security;

-- Ensure pipeline columns exist (idempotent)
alter table public.clients add column if not exists pipeline_stage  text default 'lead';
alter table public.clients add column if not exists priority_level  text default 'medium';
alter table public.clients add column if not exists internal_notes  text;
alter table public.clients add column if not exists next_step       text;
alter table public.clients add column if not exists last_updated    timestamptz default now();

-- Backfill nulls
update public.clients
set
  pipeline_stage = coalesce(pipeline_stage, 'lead'),
  priority_level = coalesce(priority_level, 'medium'),
  last_updated   = coalesce(last_updated, now())
where pipeline_stage is null or priority_level is null or last_updated is null;
