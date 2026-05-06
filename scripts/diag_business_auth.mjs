import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing required env vars: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_SECRET_KEY)");
  process.exit(1);
}

const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const users = await admin.from("users").select("email, role, is_active").limit(20);
console.log("users err:", users.error?.message || "none");
console.log("users rows:", users.data?.length ?? 0);
if (users.data?.length) {
  console.log(JSON.stringify(users.data, null, 2));
}

const clients = await admin.from("clients").select("id,name,email,source").limit(5);
console.log("clients err:", clients.error?.message || "none", "rows:", clients.data?.length ?? 0);
