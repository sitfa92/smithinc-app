import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
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

const normalizeFolder = (value = "") => String(value || "").replace(/^\/+/, "").trim();

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

  const folder = normalizeFolder(req.body?.folder || "");
  if (!folder || !folder.startsWith("digitals/")) {
    return res.status(400).json({ error: "Invalid folder" });
  }

  let fallback = [];
  for (const bucket of candidateBuckets) {
    const { data, error } = await admin.storage.from(bucket).list(folder, {
      limit: 200,
      sortBy: { column: "name", order: "desc" },
    });

    if (error) {
      const msg = (error.message || "").toLowerCase();
      if (msg.includes("bucket") && msg.includes("not found")) {
        continue;
      }
      return res.status(500).json({ error: error.message || "Failed to list files" });
    }

    const files = (data || [])
      .filter((item) => item?.name)
      .map((item) => {
        const path = `${folder}/${item.name}`;
        const { data: publicData } = admin.storage.from(bucket).getPublicUrl(path);
        return {
          bucket,
          name: item.name,
          path,
          url: publicData?.publicUrl || "",
          updatedAt: item.updated_at || item.created_at || "",
        };
      });

    if (files.length > 0) {
      return res.status(200).json({ files });
    }

    fallback = files;
  }

  return res.status(200).json({ files: fallback });
}