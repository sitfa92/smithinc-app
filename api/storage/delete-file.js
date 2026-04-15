import { createClient } from "@supabase/supabase-js";

const supabaseUrl =
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const configuredBucket = (process.env.SUPABASE_STORAGE_BUCKET || "").trim();
const candidateBuckets = [configuredBucket, "model-images", "models", "images"].filter(Boolean);

const ALLOWED_ORIGINS = new Set([
  "https://meet-serenity.online",
  "https://smithinc-app.vercel.app",
  "http://localhost:5173",
  "http://localhost:3000",
]);

const admin = supabaseUrl && serviceRoleKey ? createClient(supabaseUrl, serviceRoleKey) : null;

function parseStorageUrl(imageUrl = "") {
  const marker = "/storage/v1/object/public/";
  const idx = imageUrl.indexOf(marker);
  if (idx < 0) return null;

  const remainder = imageUrl.slice(idx + marker.length);
  const slashIndex = remainder.indexOf("/");
  if (slashIndex < 0) return null;

  const bucket = remainder.slice(0, slashIndex);
  const path = decodeURIComponent(remainder.slice(slashIndex + 1));
  return { bucket, path };
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!supabaseUrl || !serviceRoleKey || !admin) {
    return res.status(503).json({ error: "Missing Supabase server environment variables" });
  }

  const origin = req.headers.origin || req.headers.referer || "";
  const originBase = origin.split("/").slice(0, 3).join("/");
  if (origin && !ALLOWED_ORIGINS.has(originBase)) {
    return res.status(403).json({ error: "Forbidden" });
  }

  const { imageUrl = "" } = req.body || {};
  const parsed = parseStorageUrl(imageUrl);

  if (!parsed?.path || !parsed?.bucket) {
    return res.status(400).json({ error: "Invalid file URL" });
  }

  if (!parsed.path.startsWith("digitals/")) {
    return res.status(403).json({ error: "Only digitals files can be deleted here" });
  }

  if (!candidateBuckets.includes(parsed.bucket)) {
    return res.status(400).json({ error: "Invalid storage bucket" });
  }

  const { error } = await admin.storage.from(parsed.bucket).remove([parsed.path]);
  if (error) {
    return res.status(500).json({ error: error.message || "Failed to delete file" });
  }

  return res.status(200).json({ ok: true, removed: parsed.path });
}
