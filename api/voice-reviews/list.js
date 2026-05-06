import { createClient } from "@supabase/supabase-js";
import { requireBusinessAccess } from "../_business-access.js";

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(503).json({ ok: false, error: "Missing Supabase server env vars" });
  }

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const allowed = await requireBusinessAccess({ req, res, admin, allowedRoles: ["admin", "va"] });
  if (!allowed) return;

  const status = String(req.query?.status || "all").trim().toLowerCase();
  const source = String(req.query?.source || "all").trim().toLowerCase();
  const limit = Math.min(Math.max(Number(req.query?.limit || 200), 1), 500);

  let query = admin
    .from("voice_reviews")
    .select("id, source, call_id, reviewer_name, reviewer_email, reviewer_phone, language, from_country, caller_country, review_type, review_text, rating, status, admin_notes, share_caption, share_approved, metadata, created_at, updated_at")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (status !== "all") query = query.eq("status", status);
  if (source !== "all") query = query.eq("source", source);

  const { data, error } = await query;
  if (error) {
    return res.status(500).json({ ok: false, error: error.message || "Failed to fetch voice reviews" });
  }

  return res.status(200).json({ ok: true, reviews: data || [] });
}
