import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error("Missing required env vars: SUPABASE_URL and SUPABASE_ANON_KEY");
  process.exit(1);
}

const anon = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Test clients table (with pipeline columns and ordering)
const { data: clients, error: ce } = await anon
  .from("clients")
  .select("id, name, email, source, pipeline_stage, priority_level, internal_notes, next_step, last_updated")
  .order("last_updated", { ascending: false });

console.log("clients error:", ce?.message || ce?.code || "none");
console.log("clients count:", clients?.length ?? 0);

// Test partners table
const { data: partners, error: pe } = await anon
  .from("partners")
  .select("id, name, email, company, notes, source, status, created_at, submitted_at")
  .order("created_at", { ascending: false })
  .limit(50);

console.log("partners error:", pe?.message || pe?.code || "none");
console.log("partners count:", partners?.length ?? 0);
if (partners) {
  console.log("partners data:", JSON.stringify(partners.map(p => ({ name: p.name, email: p.email, source: p.source, status: p.status }))));
}
