import { supabase } from "./supabase";

const configuredBucket = (import.meta.env.VITE_SUPABASE_STORAGE_BUCKET || "").trim();
const STORAGE_BUCKETS = [configuredBucket, "model-images", "models", "images"].filter(Boolean);

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

  try {
    // Create unique filename
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    const extension = file.name.split(".").pop();
    const fileName = `${timestamp}-${random}.${extension}`;
    const filePath = `${folder}/${fileName}`;

    let lastError = null;

    for (const bucket of STORAGE_BUCKETS) {
      const { error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(filePath, file);

      if (uploadError) {
        lastError = uploadError;
        const msg = (uploadError.message || "").toLowerCase();
        if (msg.includes("bucket") && msg.includes("not found")) {
          continue;
        }
        throw uploadError;
      }

      const { data: publicData } = supabase.storage
        .from(bucket)
        .getPublicUrl(filePath);

      return publicData.publicUrl;
    }

    throw new Error(
      lastError?.message ||
        "Image upload failed: no valid Supabase Storage bucket found. Configure VITE_SUPABASE_STORAGE_BUCKET or create a bucket named model-images."
    );
  } catch (error) {
    console.error("Image upload error:", error);
    throw error;
  }
};

/**
 * Delete image from Supabase Storage
 * @param {string} imageUrl - Public URL of image to delete
 */
export const deleteImage = async (imageUrl) => {
  try {
    const publicSegment = "/storage/v1/object/public/";
    const publicIndex = imageUrl.indexOf(publicSegment);

    if (publicIndex < 0) {
      console.warn("Could not extract file path from URL");
      return;
    }

    const objectPath = imageUrl.slice(publicIndex + publicSegment.length);
    const firstSlash = objectPath.indexOf("/");
    if (firstSlash < 0) {
      console.warn("Could not extract bucket and file path from URL");
      return;
    }

    const bucket = objectPath.slice(0, firstSlash);
    const filePath = decodeURIComponent(objectPath.slice(firstSlash + 1));

    const { error } = await supabase.storage.from(bucket).remove([filePath]);

    if (error) throw error;
  } catch (error) {
    console.error("Image deletion error:", error);
    // Don't throw - deletion failure shouldn't break the app
  }
};
