import { createClient } from "@supabase/supabase-js";
import { requireBusinessAccess } from "../_business-access.js";

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

const allowedSources = new Set(["facebook", "web", "twilio", "vapi"]);
const allowedTypes = new Set(["program", "company"]);

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

  const reviewerName = String(req.body?.reviewer_name || "").trim().slice(0, 180);
  const reviewText = String(req.body?.review_text || "").trim().slice(0, 8000);
  const reviewType = String(req.body?.review_type || "program").trim().toLowerCase();
  const source = String(req.body?.source || "facebook").trim().toLowerCase();
  const reviewUrl = String(req.body?.review_url || "").trim().slice(0, 1200);

  if (!reviewText) return res.status(400).json({ ok: false, error: "Review text is required" });
  if (!allowedSources.has(source)) return res.status(400).json({ ok: false, error: "Invalid source" });
  if (!allowedTypes.has(reviewType)) return res.status(400).json({ ok: false, error: "Invalid review type" });

  const now = new Date().toISOString();
  const rating = Number(req.body?.rating);

  const payload = {
    source,
    reviewer_name: reviewerName || "Reviewer",
    reviewer_email: String(req.body?.reviewer_email || "").trim().toLowerCase().slice(0, 240) || null,
    reviewer_phone: String(req.body?.reviewer_phone || "").trim().slice(0, 60) || null,
    review_type: reviewType,
    review_text: reviewText,
    rating: Number.isFinite(rating) && rating >= 1 && rating <= 5 ? Math.round(rating) : null,
    status: "new",
    metadata: {
      review_url: reviewUrl || null,
      imported_by: "admin-ui",
    },
    created_at: now,
    updated_at: now,
  };

  const { data, error } = await admin
    .from("voice_reviews")
    .insert(payload)
    .select("id, source, call_id, reviewer_name, reviewer_email, reviewer_phone, language, from_country, caller_country, review_type, review_text, rating, status, admin_notes, share_caption, share_approved, metadata, created_at, updated_at")
    .single();

  if (error) {
    return res.status(500).json({ ok: false, error: error.message || "Failed to create review" });
  }

  return res.status(200).json({ ok: true, review: data });
}
