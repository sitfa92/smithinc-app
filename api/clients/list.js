import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

const ADMIN_EMAILS = new Set(["sitfa92@gmail.com", "chizzyboi72@gmail.com", "marthajohn223355@gmail.com"]);
const normalizeEmail = (v) => (v || "").trim().toLowerCase();

const admin = supabaseUrl && serviceRoleKey ? createClient(supabaseUrl, serviceRoleKey) : null;

async function requireBusinessAccess(req, res) {
  const authHeader = req.headers.authorization || "";
  if (!authHeader.startsWith("Bearer ")) {
    res.status(401).json({ error: "Authentication required" });
    return false;
  }
  const token = authHeader.slice(7).trim();
  try {
    const { data: { user }, error } = await admin.auth.getUser(token);
    if (error || !user?.email || !ADMIN_EMAILS.has(normalizeEmail(user.email))) {
      res.status(403).json({ error: "Forbidden" });
      return false;
    }
  } catch {
    res.status(401).json({ error: "Authentication failed" });
    return false;
  }
  return true;
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!supabaseUrl || !serviceRoleKey || !admin) {
    return res.status(503).json({ error: "Missing Supabase server environment variables" });
  }

  if (!(await requireBusinessAccess(req, res))) return;

  const selectFields = [
    "id", "name", "email", "project", "service_type", "status",
    "invoice_status", "invoice_paid", "contract_signed", "client_value",
    "source", "avatar_url", "pipeline_stage", "priority_level",
    "internal_notes", "next_step", "last_updated", "created_at",
  ].join(", ");

  // First try full select with pipeline columns
  let { data, error } = await admin
    .from("clients")
    .select(selectFields)
    .order("last_updated", { ascending: false });

  if (error) {
    // Fallback: strip pipeline columns if schema not yet updated
    const fallbackFields = "id, name, email, project, service_type, status, invoice_status, invoice_paid, contract_signed, client_value, source, avatar_url, created_at";
    const fallback = await admin
      .from("clients")
      .select(fallbackFields)
      .order("created_at", { ascending: false });

    if (fallback.error) {
      return res.status(500).json({ error: fallback.error.message || "Failed to load clients" });
    }
    data = fallback.data;
  }

  return res.status(200).json({ clients: data || [] });
}
