import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

const ADMIN_EMAILS = new Set(["sitfa92@gmail.com"]);
const normalizeEmail = (v) => (v || "").trim().toLowerCase();

// Module-scope client reused across warm invocations
const admin = supabaseUrl && serviceRoleKey ? createClient(supabaseUrl, serviceRoleKey) : null;

async function requireAdmin(req, res) {
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

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!supabaseUrl || !serviceRoleKey) {
    return res.status(503).json({ error: "Missing Supabase server environment variables" });
  }

  if (!(await requireAdmin(req, res))) return;

  const { modelId, deleteRejectedOnly } = req.body || {};

  try {
    if (modelId) {
      const { data, error } = await admin
        .from("models")
        .delete()
        .eq("id", modelId)
        .select("id");

      if (error) {
        return res.status(500).json({ error: error.message || "Failed to delete model" });
      }

      return res.status(200).json({ ok: true, deletedCount: data?.length || 0 });
    }

    if (deleteRejectedOnly === true) {
      const { data, error } = await admin
        .from("models")
        .delete()
        .eq("status", "rejected")
        .select("id");

      if (error) {
        return res.status(500).json({ error: error.message || "Failed to delete rejected applicants" });
      }

      return res.status(200).json({ ok: true, deletedCount: data?.length || 0 });
    }

    return res.status(400).json({ error: "Provide modelId or deleteRejectedOnly: true" });
  } catch (err) {
    return res.status(500).json({ error: err.message || "Unexpected delete error" });
  }
}
