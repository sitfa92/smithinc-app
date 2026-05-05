import { createClient } from "@supabase/supabase-js";
import { requireBusinessAccess } from "../_business-access.js";

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

const admin = supabaseUrl && serviceRoleKey ? createClient(supabaseUrl, serviceRoleKey) : null;

const ALLOWED_FIELDS = new Set([
  "pipeline_stage",
  "priority_level",
  "internal_notes",
  "next_step",
  "status",
  "last_updated",
]);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!supabaseUrl || !serviceRoleKey || !admin) {
    return res.status(503).json({ error: "Missing Supabase server environment variables" });
  }

  if (!(await requireBusinessAccess({ req, res, admin }))) return;

  const { clientId, partnerId, updates } = req.body || {};
  const recordId = partnerId || clientId;
  if (!recordId || !updates || typeof updates !== "object") {
    return res.status(400).json({ error: "Missing partnerId (or clientId) or updates" });
  }

  const cleaned = Object.fromEntries(Object.entries(updates).filter(([key]) => ALLOWED_FIELDS.has(key)));
  if (Object.keys(cleaned).length === 0) {
    return res.status(400).json({ error: "No valid fields to update" });
  }

  const { error } = await admin.from("clients").update(cleaned).eq("id", recordId);
  if (error) {
    return res.status(500).json({ error: error.message || "Failed to update partner pipeline" });
  }

  return res.status(200).json({ ok: true });
}
