create extension if not exists pgcrypto;

create table if not exists public.voice_reviews (
  id uuid primary key default gen_random_uuid(),
  source text not null default 'twilio',
  call_id text,
  reviewer_name text,
  reviewer_email text,
  reviewer_phone text,
  language text,
  from_country text,
  caller_country text,
  review_type text not null default 'program',
  review_text text not null,
  rating integer,
  status text not null default 'new',
  admin_notes text,
  share_caption text,
  share_approved boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_voice_reviews_created_at on public.voice_reviews(created_at desc);
create index if not exists idx_voice_reviews_status on public.voice_reviews(status);
create index if not exists idx_voice_reviews_source on public.voice_reviews(source);
create index if not exists idx_voice_reviews_call_id on public.voice_reviews(call_id);

alter table public.voice_reviews disable row level security;
grant usage on schema public to anon, authenticated, service_role;
grant select, insert, update on public.voice_reviews to anon, authenticated, service_role;
