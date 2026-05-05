import { supabase } from "./supabase";

const configuredBucket = (import.meta.env.VITE_SUPABASE_STORAGE_BUCKET || "").trim();
const STORAGE_BUCKETS = [configuredBucket, "model-images", "models", "images"].filter(Boolean);

export const listFilesInFolder = async (folder = "") => {
  const normalizedFolder = String(folder || "").replace(/^\/+/, "").trim();

  if (normalizedFolder) {
    try {
      const resp = await fetch("/api/storage/list-files", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ folder: normalizedFolder }),
      });

      if (resp.ok) {
        const payload = await resp.json().catch(() => ({}));
        if (Array.isArray(payload?.files)) {
          return payload.files;
        }
      }
    } catch {
      // Fall back to client listing below when API route is unavailable.
    }
  }

  let fallbackResults = [];

  for (const bucket of STORAGE_BUCKETS) {
    const { data, error } = await supabase.storage.from(bucket).list(normalizedFolder, {
      limit: 100,
      sortBy: { column: "name", order: "desc" },
    });

    if (error) continue;

    const mapped = (data || [])
      .filter((item) => item?.name)
      .map((item) => {
        const path = normalizedFolder ? `${normalizedFolder}/${item.name}` : item.name;
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

const pushWithLegacyFolderVariants = (arr, value) => {
  const normalized = String(value || "").trim();
  if (!normalized) return;
  pushUnique(arr, normalized);

  // Legacy compatibility: older uploads flattened nested folders (e.g., digitals/123 -> digitals123).
  const flattened = normalized.replace(/[^a-zA-Z0-9_-]/g, "");
  if (flattened && flattened !== normalized) {
    pushUnique(arr, flattened);
  }
};

const buildDigitalsFolderCandidates = ({ id = "", email = "", instagram = "", folder = "" } = {}) => {
  const normalizedId = String(id || "").trim();
  const normalizedEmail = String(email || "").trim().toLowerCase();
  const normalizedHandle = String(instagram || "").replace(/^@+/, "").trim().toLowerCase();
  const folders = [];

  pushWithLegacyFolderVariants(folders, folder ? String(folder).trim() : "");
  pushWithLegacyFolderVariants(folders, normalizedId ? `digitals/${normalizedId}` : "");
  pushWithLegacyFolderVariants(folders, normalizedId ? `digitals/${normalizedId.toLowerCase()}` : "");

  if (normalizedEmail) {
    pushWithLegacyFolderVariants(folders, `digitals/${normalizedEmail}`);
    const localPart = normalizedEmail.split("@")[0];
    pushWithLegacyFolderVariants(folders, localPart ? `digitals/${localPart}` : "");
  }

  pushWithLegacyFolderVariants(folders, normalizedHandle ? `digitals/${normalizedHandle}` : "");

  return folders.filter(Boolean);
};

const buildPortfolioFolderCandidates = ({ id = "", email = "", instagram = "", folder = "" } = {}) => {
  const normalizedId = String(id || "").trim();
  const normalizedEmail = String(email || "").trim().toLowerCase();
  const normalizedHandle = String(instagram || "").replace(/^@+/, "").trim().toLowerCase();
  const folders = [];

  pushWithLegacyFolderVariants(folders, folder ? String(folder).trim() : "");
  pushWithLegacyFolderVariants(folders, normalizedId ? `portfolio/${normalizedId}` : "");
  pushWithLegacyFolderVariants(folders, normalizedId ? `portfolio/${normalizedId.toLowerCase()}` : "");

  if (normalizedEmail) {
    pushWithLegacyFolderVariants(folders, `portfolio/${normalizedEmail}`);
    const localPart = normalizedEmail.split("@")[0];
    pushWithLegacyFolderVariants(folders, localPart ? `portfolio/${localPart}` : "");
  }

  pushWithLegacyFolderVariants(folders, normalizedHandle ? `portfolio/${normalizedHandle}` : "");

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

export const listPortfolioForModel = async (modelRef = {}) => {
  const folders = buildPortfolioFolderCandidates(modelRef);
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
const resolveSignedUploadUrl = (signedUrl = "") => {
  const raw = String(signedUrl || "").trim();
  if (!raw) return "";
  if (raw.startsWith("http://") || raw.startsWith("https://")) return raw;

  const baseUrl = String(import.meta.env.VITE_SUPABASE_URL || "").trim().replace(/\/+$/, "");
  if (!baseUrl) return raw;

  if (raw.startsWith("/storage/v1/")) return `${baseUrl}${raw}`;
  if (raw.startsWith("/object/") || raw.startsWith("object/")) {
    const normalizedPath = raw.startsWith("/") ? raw : `/${raw}`;
    return `${baseUrl}/storage/v1${normalizedPath}`;
  }

  const normalizedPath = raw.startsWith("/") ? raw : `/${raw}`;
  return `${baseUrl}${normalizedPath}`;
};

const uploadViaSignedUrlWithProgress = (signedUrl, file, onProgress) =>
  new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", signedUrl);
    xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");

    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable || typeof onProgress !== "function") return;
      const percent = Math.min(100, Math.round((event.loaded / event.total) * 100));
      onProgress(percent);
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        if (typeof onProgress === "function") onProgress(100);
        resolve(true);
        return;
      }
      reject(new Error(`Upload failed with status ${xhr.status}`));
    };

    xhr.onerror = () => reject(new Error("Network error during upload"));
    xhr.onabort = () => reject(new Error("Upload was cancelled"));
    xhr.send(file);
  });

export const uploadImage = async (file, folder = "models", options = {}) => {
  if (!file) throw new Error("No file provided");

  // Validate file type
  const allowedTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"];
  if (!allowedTypes.includes(file.type)) {
    throw new Error("Invalid file type. Please upload JPG, PNG, GIF, or WebP.");
  }

  // Validate file size by upload type
  const normalizedFolder = String(folder || "");
  const isDigitalsUpload = normalizedFolder.startsWith("digitals");
  const isPortfolioUpload = normalizedFolder.startsWith("portfolio");
  const allowLargeImages = isDigitalsUpload || isPortfolioUpload;
  const maxSize = allowLargeImages ? 25 * 1024 * 1024 : 5 * 1024 * 1024;
  if (file.size > maxSize) {
    throw new Error(`File too large. Maximum size is ${allowLargeImages ? "25MB" : "5MB"}.`);
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

  const onProgress = typeof options?.onProgress === "function" ? options.onProgress : null;
  const signedUrl = resolveSignedUploadUrl(signed.signedUrl || "");

  if (onProgress && signedUrl) {
    await uploadViaSignedUrlWithProgress(signedUrl, file, onProgress);
  } else {
    const { error: uploadError } = await supabase.storage
      .from(signed.bucket)
      .uploadToSignedUrl(signed.path, signed.token, file);

    if (uploadError) {
      throw uploadError;
    }
    if (onProgress) onProgress(100);
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
