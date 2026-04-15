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

  // Validate file size (max 5MB)
  const maxSize = 5 * 1024 * 1024; // 5MB
  if (file.size > maxSize) {
    throw new Error("File too large. Maximum size is 5MB.");
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
