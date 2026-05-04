import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

const ADMIN_EMAILS = new Set(["sitfa92@gmail.com", "chizzyboi72@gmail.com"]);
const normalizeEmail = (v) => (v || "").trim().toLowerCase();

// Module-scope client reused across warm invocations
const admin = supabaseUrl && serviceRoleKey ? createClient(supabaseUrl, serviceRoleKey) : null;

async function requireAdminOrAgent(req, res) {
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
  } catch (_) {
    res.status(401).json({ error: "Authentication failed" });
    return false;
  }
  return true;
}

const ALLOWED_FIELDS = new Set([
  "pipeline_stage",
  "agency_name",
  "scouting_notes",
  "internal_notes",
  "priority_level",
  "status",
  "last_updated",
  "champ_c_score",
  "champ_h_score",
  "champ_m_score",
  "champ_p_score",
  "champ_c_notes",
  "champ_h_notes",
  "champ_m_notes",
  "champ_p_notes",
  "champ_total",
  "champ_recommendation",
]);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!supabaseUrl || !serviceRoleKey) {
    return res.status(503).json({ error: "Missing Supabase server environment variables" });
  }

  if (!(await requireAdminOrAgent(req, res))) return;

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

  const { error } = await admin
    .from("models")
    .update(cleaned)
    .eq("id", modelId);

  if (error) {
    return res.status(500).json({ error: error.message || "Failed to update model pipeline" });
  }

  return res.status(200).json({ ok: true });
}