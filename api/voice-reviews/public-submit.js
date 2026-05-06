import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

const WINDOW_MS = 60 * 1000;
const MAX_REQUESTS = 8;

function getClientIp(req) {
  const forwarded = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim();
  return forwarded || req.socket?.remoteAddress || "unknown";
}

function isRateLimited(ip) {
  const now = Date.now();
  const store = (globalThis.__publicReviewRateLimit ||= new Map());
  const current = store.get(ip) || { count: 0, resetAt: now + WINDOW_MS };

  if (now > current.resetAt) {
    store.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return false;
  }

  current.count += 1;
  store.set(ip, current);
  return current.count > MAX_REQUESTS;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(503).json({ ok: false, error: "Missing Supabase server env vars" });
  }

  const ip = getClientIp(req);
  if (isRateLimited(ip)) {
    return res.status(429).json({ ok: false, error: "Too many requests. Please try again shortly." });
  }

  const reviewText = String(req.body?.review_text || "").trim().slice(0, 8000);
  const reviewerName = String(req.body?.reviewer_name || "").trim().slice(0, 180);
  const reviewerEmail = String(req.body?.reviewer_email || "").trim().toLowerCase().slice(0, 240);
  const rating = Number(req.body?.rating);
  const reviewTypeRaw = String(req.body?.review_type || "program").trim().toLowerCase();
  const reviewType = reviewTypeRaw === "company" ? "company" : "program";

  if (!reviewText || reviewText.length < 12) {
    return res.status(400).json({ ok: false, error: "Please share a longer review." });
  }

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const now = new Date().toISOString();

  const payload = {
    source: "web",
    reviewer_name: reviewerName || "Web Visitor",
    reviewer_email: reviewerEmail || null,
    review_type: reviewType,
    review_text: reviewText,
    rating: Number.isFinite(rating) && rating >= 1 && rating <= 5 ? Math.round(rating) : null,
    status: "new",
    metadata: {
      public_submit: true,
      user_agent: String(req.headers["user-agent"] || "").slice(0, 500),
    },
    created_at: now,
    updated_at: now,
  };

  const { data, error } = await admin
    .from("voice_reviews")
    .insert(payload)
    .select("id, source, reviewer_name, review_type, rating, status, created_at")
    .single();

  if (error) {
    return res.status(500).json({ ok: false, error: error.message || "Failed to submit review" });
  }

  return res.status(200).json({ ok: true, review: data });
}
