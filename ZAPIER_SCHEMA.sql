-- Zapier Workflow System Schema
-- Run these SQL commands in Supabase SQL Editor to set up the workflow infrastructure

-- 1. LEADS TABLE - Capture all inbound CRM inquiries
CREATE TABLE IF NOT EXISTS public.leads (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  email text NOT NULL UNIQUE,
  phone text DEFAULT '',
  service_type text DEFAULT 'inquiry',
  message text DEFAULT '',
  honeybook_id text DEFAULT '',
  source text DEFAULT 'zapier',
  status text DEFAULT 'new' CHECK (status IN ('new', 'converted', 'lost')),
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);

-- 2. CLIENTS TABLE - Track converted leads (paying customers)
CREATE TABLE IF NOT EXISTS public.clients (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  email text NOT NULL UNIQUE,
  honeybook_id text DEFAULT '',
  service_type text DEFAULT 'general',
  client_value numeric DEFAULT 0,
  status text DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'churned')),
  contract_signed boolean DEFAULT false,
  invoice_paid boolean DEFAULT true,
  source text DEFAULT 'zapier',
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);

-- 3. PROGRAM_ENROLLMENTS TABLE - Track model development program enrollments
CREATE TABLE IF NOT EXISTS public.program_enrollments (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  student_name text NOT NULL,
  email text NOT NULL,
  program_name text NOT NULL,
  program_tier text DEFAULT 'standard' CHECK (program_tier IN ('starter', 'standard', 'premium')),
  start_date timestamp NOT NULL,
  honeybook_id text DEFAULT '',
  status text DEFAULT 'active' CHECK (status IN ('active', 'completed', 'paused', 'cancelled')),
  source text DEFAULT 'zapier',
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);

-- 4. WORKFLOW_EVENTS TABLE - Log all Zapier events for dashboard visibility
CREATE TABLE IF NOT EXISTS public.workflow_events (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  event_type text NOT NULL CHECK (event_type IN ('NEW_LEAD', 'CLIENT_CONVERTED', 'PROGRAM_ENROLLMENT')),
  event_data jsonb DEFAULT '{}',
  status text DEFAULT 'success' CHECK (status IN ('success', 'failed')),
  error_message text DEFAULT '',
  source text DEFAULT 'zapier',
  created_at timestamp DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_leads_email ON public.leads(email);
CREATE INDEX IF NOT EXISTS idx_leads_honeybook_id ON public.leads(honeybook_id);
CREATE INDEX IF NOT EXISTS idx_leads_created_at ON public.leads(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_clients_email ON public.clients(email);
CREATE INDEX IF NOT EXISTS idx_clients_honeybook_id ON public.clients(honeybook_id);
CREATE INDEX IF NOT EXISTS idx_clients_created_at ON public.clients(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_enrollments_client_id ON public.program_enrollments(client_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_email ON public.program_enrollments(email);
CREATE INDEX IF NOT EXISTS idx_enrollments_created_at ON public.program_enrollments(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_workflow_events_type ON public.workflow_events(event_type);
CREATE INDEX IF NOT EXISTS idx_workflow_events_created_at ON public.workflow_events(created_at DESC);
