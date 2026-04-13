import { createClient } from "@supabase/supabase-js";

const supabaseUrl =
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const configuredBucket = (process.env.SUPABASE_STORAGE_BUCKET || "").trim();
const candidateBuckets = [configuredBucket, "model-images", "models", "images"].filter(Boolean);

const allowedMimeTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
]);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!supabaseUrl || !serviceRoleKey) {
    return res.status(503).json({ error: "Missing Supabase server environment variables" });
  }

  const { fileName, contentType, folder = "models" } = req.body || {};

  if (!fileName || !contentType) {
    return res.status(400).json({ error: "Missing fileName or contentType" });
  }

  if (!allowedMimeTypes.has(contentType)) {
    return res.status(400).json({ error: "Invalid file type" });
  }

  const extension = String(fileName).split(".").pop() || "jpg";
  const timestamp = Date.now();
  const random = Math.random().toString(36).slice(2, 8);
  const filePath = `${folder}/${timestamp}-${random}.${extension}`;

  const admin = createClient(supabaseUrl, serviceRoleKey);

  let lastError = null;
  for (const bucket of candidateBuckets) {
    const { data, error } = await admin.storage.from(bucket).createSignedUploadUrl(filePath);

    if (error) {
      lastError = error;
      const msg = (error.message || "").toLowerCase();
      if (msg.includes("bucket") && msg.includes("not found")) {
        continue;
      }
      return res.status(500).json({ error: error.message || "Failed to sign upload" });
    }

    return res.status(200).json({
      bucket,
      path: filePath,
      token: data?.token,
      signedUrl: data?.signedUrl,
    });
  }

  return res.status(500).json({
    error:
      lastError?.message ||
      "No valid storage bucket found for model uploads",
  });
}