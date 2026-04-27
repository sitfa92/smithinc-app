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

const allowedMimeTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
]);

// Module-scope client reused across warm invocations
const admin = supabaseUrl && serviceRoleKey ? createClient(supabaseUrl, serviceRoleKey) : null;

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!supabaseUrl || !serviceRoleKey) {
    console.error("Missing Supabase server environment variables");
    return res.status(503).json({ error: "Server configuration error. Please contact support." });
  }

  const origin = (req.headers.origin || req.headers.referer || "").split("/").slice(0, 3).join("/");
  if (origin && !ALLOWED_ORIGINS.has(origin)) {
    console.warn("Blocked request from origin:", origin);
    return res.status(403).json({ error: "Forbidden" });
  }

  const { fileName, contentType, folder = "models" } = req.body || {};

  if (!fileName || !contentType) {
    return res.status(400).json({ error: "Missing fileName or contentType" });
  }

  if (!allowedMimeTypes.has(contentType)) {
    return res.status(400).json({ error: "Invalid file type. Allowed: JPEG, PNG, GIF, WebP" });
  }

  const extension = String(fileName).split(".").pop() || "jpg";
  const timestamp = Date.now();
  const random = Math.random().toString(36).slice(2, 8);
  const filePath = `${folder}/${timestamp}-${random}.${extension}`;

  let lastError = null;
  for (const bucket of candidateBuckets) {
    try {
      const { data, error } = await admin.storage.from(bucket).createSignedUploadUrl(filePath);

      if (error) {
        lastError = error;
        const msg = (error.message || "").toLowerCase();
        if (msg.includes("bucket") && msg.includes("not found")) {
          continue;
        }
        console.error(`Sign upload error for bucket ${bucket}:`, error.message);
        continue;
      }

      return res.status(200).json({
        bucket,
        path: filePath,
        token: data?.token,
        signedUrl: data?.signedUrl,
      });
    } catch (err) {
      console.error(`Exception signing upload for bucket ${bucket}:`, err.message);
      lastError = err;
    }
  }

  console.error("No valid storage bucket found. Last error:", lastError?.message);
  return res.status(500).json({
    error: "Unable to prepare upload. Please check your connection and try again.",
    detail: process.env.NODE_ENV === "development" ? lastError?.message : undefined,
  });
}