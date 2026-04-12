import { supabase } from "./supabase";

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

    // Upload file to Supabase Storage
    const { data, error: uploadError } = await supabase.storage
      .from("model-images")
      .upload(filePath, file);

    if (uploadError) throw uploadError;

    // Get public URL
    const { data: publicData } = supabase.storage
      .from("model-images")
      .getPublicUrl(filePath);

    return publicData.publicUrl;
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
    // Extract file path from URL
    const urlParts = imageUrl.split("/storage/v1/object/public/model-images/");
    if (urlParts.length < 2) {
      console.warn("Could not extract file path from URL");
      return;
    }

    const filePath = decodeURIComponent(urlParts[1]);

    const { error } = await supabase.storage
      .from("model-images")
      .remove([filePath]);

    if (error) throw error;
  } catch (error) {
    console.error("Image deletion error:", error);
    // Don't throw - deletion failure shouldn't break the app
  }
};
