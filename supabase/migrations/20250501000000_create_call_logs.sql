-- Create call_logs table for Vapi post-call webhook
create table if not exists public.call_logs (
  id               uuid primary key default gen_random_uuid(),
  call_id          text,
  caller_phone     text,
  transcript       text,
  summary          text,
  duration_seconds integer,
  ended_reason     text,
  started_at       timestamptz,
  ended_at         timestamptz,
  created_at       timestamptz default now()
);

-- RLS: only service role (backend) can read/write
alter table public.call_logs enable row level security;

-- Staff (authenticated users) can read all logs
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename  = 'call_logs'
      and policyname = 'call_logs_staff_read'
  ) then
    create policy "call_logs_staff_read"
      on public.call_logs
      for select
      using (auth.role() = 'authenticated');
  end if;
end $$;
