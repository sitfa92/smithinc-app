import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

const ALLOWED_FIELDS = new Set([
  "pipeline_stage",
  "agency_name",
  "scouting_notes",
  "internal_notes",
  "priority_level",
  "status",
  "last_updated",
]);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!supabaseUrl || !serviceRoleKey) {
    return res.status(503).json({ error: "Missing Supabase server environment variables" });
  }

  const { modelId, updates } = req.body || {};
  if (!modelId || !updates || typeof updates !== "object") {
    return res.status(400).json({ error: "Missing modelId or updates" });
  }

  const cleaned = Object.fromEntries(
    Object.entries(updates).filter(([key]) => ALLOWED_FIELDS.has(key))
  );

  if (Object.keys(cleaned).length === 0) {
    return res.status(400).json({ error: "No valid fields to update" });
  }

  const admin = createClient(supabaseUrl, serviceRoleKey);
  const { error } = await admin
    .from("models")
    .update(cleaned)
    .eq("id", modelId);

  if (error) {
    return res.status(500).json({ error: error.message || "Failed to update model pipeline" });
  }

  return res.status(200).json({ ok: true });
}