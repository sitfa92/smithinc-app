-- Add CHAMP qualification scoring columns to clients table
alter table public.clients
  add column if not exists champ_c_score        integer default 0,
  add column if not exists champ_h_score        integer default 0,
  add column if not exists champ_m_score        integer default 0,
  add column if not exists champ_p_score        integer default 0,
  add column if not exists champ_c_notes        text,
  add column if not exists champ_h_notes        text,
  add column if not exists champ_m_notes        text,
  add column if not exists champ_p_notes        text,
  add column if not exists champ_total          integer default 0,
  add column if not exists champ_recommendation text default 'nurture';

-- Ensure pipeline columns exist for ambassador workflow
alter table public.clients
  add column if not exists pipeline_stage text default 'lead',
  add column if not exists priority_level text default 'medium',
  add column if not exists internal_notes text,
  add column if not exists next_step text,
  add column if not exists last_updated timestamptz default now();

-- Backfill defaults
update public.clients
set
  champ_c_score        = coalesce(champ_c_score, 0),
  champ_h_score        = coalesce(champ_h_score, 0),
  champ_m_score        = coalesce(champ_m_score, 0),
  champ_p_score        = coalesce(champ_p_score, 0),
  champ_total          = coalesce(champ_total, 0),
  champ_recommendation = coalesce(champ_recommendation, 'nurture'),
  pipeline_stage       = coalesce(pipeline_stage, 'lead'),
  priority_level       = coalesce(priority_level, 'medium'),
  last_updated         = coalesce(last_updated, now())
where champ_c_score is null
   or pipeline_stage is null
   or priority_level is null
   or last_updated is null;
