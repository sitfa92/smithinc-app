import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing required env vars: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_SECRET_KEY)");
  process.exit(1);
}

const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Check RLS status of clients table
const { data: rlsData, error: rlsError } = await admin.rpc("exec_sql", {
  sql: "select relname, relrowsecurity from pg_class where relname in ('clients','partners','models') and relnamespace = (select oid from pg_namespace where nspname = 'public');"
});
console.log("RLS check error:", rlsError?.message || "none");
console.log("RLS data:", JSON.stringify(rlsData));

// Simpler check: use information_schema
const { data: policies, error: policiesError } = await admin
  .from("pg_policies")
  .select("*")
  .in("tablename", ["clients", "partners", "models"]);
console.log("policies error:", policiesError?.message || "none");
console.log("policies:", JSON.stringify(policies));
