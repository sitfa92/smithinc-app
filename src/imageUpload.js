import { supabase } from "./supabase";

const configuredBucket = (import.meta.env.VITE_SUPABASE_STORAGE_BUCKET || "").trim();
const STORAGE_BUCKETS = [configuredBucket, "model-images", "models", "images"].filter(Boolean);

export const listFilesInFolder = async (folder = "") => {
  let fallbackResults = [];

  for (const bucket of STORAGE_BUCKETS) {
    const { data, error } = await supabase.storage.from(bucket).list(folder, {
      limit: 100,
      sortBy: { column: "name", order: "desc" },
    });

    if (error) continue;

    const mapped = (data || [])
      .filter((item) => item?.name)
      .map((item) => {
        const path = folder ? `${folder}/${item.name}` : item.name;
        const { data: publicData } = supabase.storage.from(bucket).getPublicUrl(path);

        return {
          bucket,
          name: item.name,
          path,
          url: publicData?.publicUrl || "",
          updatedAt: item.updated_at || item.created_at || "",
        };
      });

    if (mapped.length) return mapped;
    fallbackResults = mapped;
  }

  return fallbackResults;
};

const pushUnique = (arr, value) => {
  if (!value) return;
  if (!arr.includes(value)) arr.push(value);
};

const buildDigitalsFolderCandidates = ({ id = "", email = "", instagram = "", folder = "" } = {}) => {
  const normalizedId = String(id || "").trim();
  const normalizedEmail = String(email || "").trim().toLowerCase();
  const normalizedHandle = String(instagram || "").replace(/^@+/, "").trim().toLowerCase();
  const folders = [];

  pushUnique(folders, folder ? String(folder).trim() : "");
  pushUnique(folders, normalizedId ? `digitals/${normalizedId}` : "");
  pushUnique(folders, normalizedId ? `digitals/${normalizedId.toLowerCase()}` : "");

  if (normalizedEmail) {
    pushUnique(folders, `digitals/${normalizedEmail}`);
    const localPart = normalizedEmail.split("@")[0];
    pushUnique(folders, localPart ? `digitals/${localPart}` : "");
  }

  pushUnique(folders, normalizedHandle ? `digitals/${normalizedHandle}` : "");

  return folders.filter(Boolean);
};

export const listDigitalsForModel = async (modelRef = {}) => {
  const folders = buildDigitalsFolderCandidates(modelRef);
  if (!folders.length) return [];

  const seen = new Set();
  const merged = [];

  for (const folder of folders) {
    const files = await listFilesInFolder(folder);
    for (const file of files) {
      const key = file.url || `${file.bucket || ""}/${file.path || file.name}`;
      if (!key || seen.has(key)) continue;
      seen.add(key);
      merged.push(file);
    }
  }

  return merged.sort((a, b) => {
    const aTime = Date.parse(a.updatedAt || "") || 0;
    const bTime = Date.parse(b.updatedAt || "") || 0;
    return bTime - aTime;
  });
};

/**
 * Upload image to Supabase Storage and return public URL
 * @param {File} file - Image file to upload
 * @param {string} folder - Optional folder path in storage
 * @returns {Promise<string>} Public URL of uploaded image
 */
export const uploadImage = async (file, folder = "models") => {
  if (!file) throw new Error("No file provided");

  // Validate file type
  const allowedTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"];
  if (!allowedTypes.includes(file.type)) {
    throw new Error("Invalid file type. Please upload JPG, PNG, GIF, or WebP.");
  }

  // Validate file size by upload type
  const isDigitalsUpload = String(folder || "").startsWith("digitals");
  const maxSize = isDigitalsUpload ? 10 * 1024 * 1024 : 5 * 1024 * 1024;
  if (file.size > maxSize) {
    throw new Error(`File too large. Maximum size is ${isDigitalsUpload ? "10MB" : "5MB"}.`);
  }

  const signResp = await fetch("/api/storage/sign-upload", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      fileName: file.name,
      contentType: file.type,
      folder,
    }),
  });

  if (!signResp.ok) {
    const errData = await signResp.json().catch(() => ({}));
    throw new Error(errData.error || "Failed to prepare image upload");
  }

  const signed = await signResp.json();
  if (!signed?.bucket || !signed?.path || !signed?.token) {
    throw new Error("Upload signature response was incomplete");
  }

  const { error: uploadError } = await supabase.storage
    .from(signed.bucket)
    .uploadToSignedUrl(signed.path, signed.token, file);

  if (uploadError) {
    throw uploadError;
  }

  const { data: publicData } = supabase.storage
    .from(signed.bucket)
    .getPublicUrl(signed.path);

  return publicData.publicUrl;
};

/**
 * Delete image from Supabase Storage
 * @param {string} imageUrl - Public URL of image to delete
 */
export const deleteImage = async (imageUrl) => {
  try {
    const resp = await fetch("/api/storage/delete-file", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ imageUrl }),
    });

    if (resp.ok) {
      return true;
    }

    const publicSegment = "/storage/v1/object/public/";
    const publicIndex = imageUrl.indexOf(publicSegment);

    if (publicIndex < 0) {
      throw new Error("Could not extract file path from URL");
    }

    const objectPath = imageUrl.slice(publicIndex + publicSegment.length);
    const firstSlash = objectPath.indexOf("/");
    if (firstSlash < 0) {
      throw new Error("Could not extract bucket and file path from URL");
    }

    const bucket = objectPath.slice(0, firstSlash);
    const filePath = decodeURIComponent(objectPath.slice(firstSlash + 1));

    const { error } = await supabase.storage.from(bucket).remove([filePath]);

    if (error) throw error;
    return true;
  } catch (error) {
    console.error("Image deletion error:", error);
    throw error;
  }
};
