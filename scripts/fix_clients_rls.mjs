import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing required env vars: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_SECRET_KEY)");
  process.exit(1);
}

const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Disable RLS on clients table using service role
const { error } = await admin.from("clients").select("id").limit(1);
console.log("service role clients read error:", error?.message || "none");

// Try to figure out clients table structure
const { data: cols, error: colsErr } = await admin
  .from("clients")
  .select("*")
  .limit(0);
console.log("columns fetch error:", colsErr?.message || "none");
console.log("Sample:", JSON.stringify(cols));
