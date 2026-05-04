-- Create partners table for brand ambassador and partner submissions
create table if not exists public.partners (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  email        text,
  company      text,
  website      text,
  notes        text,
  status       text default 'pending',
  source       text default 'manual',
  submitted_at timestamptz default now(),
  created_at   timestamptz default now(),
  last_updated timestamptz default now()
);

-- Safe add any columns that may be missing on existing tables
alter table public.partners add column if not exists company      text;
alter table public.partners add column if not exists website      text;
alter table public.partners add column if not exists notes        text;
alter table public.partners add column if not exists status       text default 'pending';
alter table public.partners add column if not exists source       text default 'manual';
alter table public.partners add column if not exists submitted_at timestamptz default now();
alter table public.partners add column if not exists last_updated timestamptz default now();

-- Backfill nulls
update public.partners
set
  status       = coalesce(status, 'pending'),
  source       = coalesce(source, 'manual'),
  submitted_at = coalesce(submitted_at, now()),
  last_updated = coalesce(last_updated, now())
where status is null or source is null or submitted_at is null or last_updated is null;

-- Disable RLS for service-role access (staff reads go through service role key)
alter table public.partners disable row level security;
