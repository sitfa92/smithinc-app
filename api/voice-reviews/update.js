import { createClient } from "@supabase/supabase-js";
import { requireBusinessAccess } from "../_business-access.js";

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

const allowedStatuses = new Set(["new", "reviewed", "approved", "archived"]);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(503).json({ ok: false, error: "Missing Supabase server env vars" });
  }

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const allowed = await requireBusinessAccess({ req, res, admin, allowedRoles: ["admin", "va"] });
  if (!allowed) return;

  const id = String(req.body?.id || "").trim();
  if (!id) {
    return res.status(400).json({ ok: false, error: "Missing review id" });
  }

  const payload = {
    updated_at: new Date().toISOString(),
  };

  if (typeof req.body?.review_text === "string") payload.review_text = req.body.review_text.trim().slice(0, 8000);
  if (typeof req.body?.review_type === "string") payload.review_type = req.body.review_type.trim().slice(0, 64);
  if (typeof req.body?.reviewer_name === "string") payload.reviewer_name = req.body.reviewer_name.trim().slice(0, 180);
  if (typeof req.body?.rating !== "undefined") {
    const rating = Number(req.body.rating);
    payload.rating = Number.isFinite(rating) && rating >= 1 && rating <= 5 ? Math.round(rating) : null;
  }
  if (typeof req.body?.admin_notes === "string") payload.admin_notes = req.body.admin_notes.trim().slice(0, 8000);
  if (typeof req.body?.share_caption === "string") payload.share_caption = req.body.share_caption.trim().slice(0, 1200);
  if (typeof req.body?.share_approved === "boolean") payload.share_approved = req.body.share_approved;
  if (typeof req.body?.status === "string") {
    const status = req.body.status.trim().toLowerCase();
    if (!allowedStatuses.has(status)) {
      return res.status(400).json({ ok: false, error: "Invalid status" });
    }
    payload.status = status;
  }

  const { data, error } = await admin
    .from("voice_reviews")
    .update(payload)
    .eq("id", id)
    .select("id, source, call_id, reviewer_name, reviewer_email, reviewer_phone, language, from_country, caller_country, review_type, review_text, rating, status, admin_notes, share_caption, share_approved, metadata, created_at, updated_at")
    .single();

  if (error) {
    return res.status(500).json({ ok: false, error: error.message || "Failed to update review" });
  }

  return res.status(200).json({ ok: true, review: data });
}
