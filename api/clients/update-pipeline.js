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
    const {
      data: { user },
      error,
    } = await admin.auth.getUser(token);

    if (error || !user?.email || !ADMIN_EMAILS.has(normalizeEmail(user.email))) {
      res.status(403).json({ error: "Forbidden" });
      return false;
    }
  } catch (_err) {
    res.status(401).json({ error: "Authentication failed" });
    return false;
  }

  return true;
}

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

  if (!(await requireBusinessAccess(req, res))) return;

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
