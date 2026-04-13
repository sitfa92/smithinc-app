import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!supabaseUrl || !serviceRoleKey) {
    return res.status(503).json({ error: "Missing Supabase server environment variables" });
  }

  const { modelId, deleteRejectedOnly } = req.body || {};
  const admin = createClient(supabaseUrl, serviceRoleKey);

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
