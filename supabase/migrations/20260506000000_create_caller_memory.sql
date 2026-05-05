create table if not exists public.caller_memory (
	id uuid primary key default gen_random_uuid(),
	caller_key text unique not null,
	phone text,
	name text,
	email text,
	preferred_language text,
	last_intent text,
	last_summary text,
	last_transcript_excerpt text,
	total_calls integer not null default 0,
	first_call_at timestamptz default now(),
	last_call_at timestamptz,
	metadata jsonb not null default '{}'::jsonb,
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now()
);

create index if not exists idx_caller_memory_phone on public.caller_memory(phone);
create index if not exists idx_caller_memory_last_call_at on public.caller_memory(last_call_at desc);

alter table public.caller_memory disable row level security;
