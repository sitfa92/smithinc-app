import React from "react";
import { useParams } from "react-router-dom";
import { supabase } from "../supabase";
import { useAuth } from "../auth";
import { uploadImage, listPortfolioForModel, deleteImage } from "../imageUpload";
import LuxuryPhotoCarousel from "../components/LuxuryPhotoCarousel";
import "../App.css";

export default function PortfolioUpload() {
  const { user, role } = useAuth();
  const { id } = useParams();
  const [model, setModel] = React.useState(null);
  const [files, setFiles] = React.useState([]);
  const [selectedFiles, setSelectedFiles] = React.useState([]);
  const [uploadProgress, setUploadProgress] = React.useState({});
  const [isDragging, setIsDragging] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const [uploading, setUploading] = React.useState(false);
  const [error, setError] = React.useState("");
  const [success, setSuccess] = React.useState("Your portfolio upload link is ready.");

  const canDeletePortfolio = Boolean(user) && role === "admin";

  const folder = React.useMemo(() => `portfolio/${id}`, [id]);

  const loadPortfolio = React.useCallback(async (modelData) => {
    if (!id) return;
    try {
      const results = await listPortfolioForModel({
        id,
        email: modelData?.email || "",
        instagram: modelData?.instagram || "",
        folder,
      });
      setFiles(results);
    } catch (err) {
      console.warn("Failed to load existing portfolio:", err);
    }
  }, [folder, id]);

  React.useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (!id) {
        setError("Missing model ID. Please use your upload link.");
        setModel({ id: "", name: "", email: "", instagram: "", status: "approved", pipeline_stage: "portfolio_pending", agency_name: "" });
        setLoading(false);
        return;
      }

      try {
        setError("");
        setSuccess("Loading your portfolio upload portal...");

        let modelData = null;
        try {
          const { data } = await supabase
            .from("models")
            .select("id, name, email, instagram, status, pipeline_stage, agency_name")
            .eq("id", id)
            .maybeSingle();
          modelData = data;
        } catch (dbErr) {
          console.warn("Model lookup failed, using fallback:", dbErr);
        }

        const resolved = {
          id: modelData?.id || id,
          name: modelData?.name || "",
          email: modelData?.email || "",
          instagram: modelData?.instagram || "",
          status: modelData?.status || "approved",
          pipeline_stage: modelData?.pipeline_stage || "portfolio_pending",
          agency_name: modelData?.agency_name || "",
        };

        if (cancelled) return;
        setModel(resolved);
        await loadPortfolio(resolved);
        if (cancelled) return;
        setSuccess("Your portfolio upload link is ready. Upload your photos below.");
      } catch (err) {
        console.error("Portfolio upload portal load error:", err);
        if (cancelled) return;
        setModel({ id, name: "", email: "", instagram: "", status: "approved", pipeline_stage: "portfolio_pending", agency_name: "" });
        setSuccess("Your portfolio upload link is ready. Upload your photos below.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [id, loadPortfolio]);

  const getFileKey = React.useCallback((file) => `${file.name}-${file.size}-${file.lastModified}`, []);

  const handleUpload = async () => {
    if (!selectedFiles.length) {
      setError("Please select at least one file to upload.");
      return;
    }

    if (!id) {
      setError("Upload error: Missing model ID. Please reload and try again.");
      return;
    }

    setUploading(true);
    setError("");
    setSuccess("");

    try {
      const uploadedPaths = [];
      const failedFiles = [];

      setUploadProgress((prev) => {
        const next = { ...prev };
        for (const file of selectedFiles) {
          next[getFileKey(file)] = 0;
        }
        return next;
      });

      for (const file of selectedFiles) {
        const fileKey = getFileKey(file);
        try {
          await uploadImage(file, folder, {
            onProgress: (percent) => {
              setUploadProgress((prev) => ({ ...prev, [fileKey]: percent }));
            },
          });
          uploadedPaths.push(file.name);
        } catch (fileErr) {
          setUploadProgress((prev) => ({ ...prev, [fileKey]: -1 }));
          failedFiles.push(`${file.name}: ${fileErr.message}`);
          console.error("Portfolio file upload error:", fileErr);
        }
      }

      if (uploadedPaths.length > 0) {
        try {
          await loadPortfolio(model);
        } catch {
          // continue
        }
        setSelectedFiles([]);
      }

      if (failedFiles.length > 0 && uploadedPaths.length === 0) {
        setError(`Upload failed: ${failedFiles[0]}`);
      } else if (failedFiles.length > 0) {
        setSuccess(`${uploadedPaths.length} file(s) uploaded. ${failedFiles.length} failed: ${failedFiles.join(", ")}`);
      } else {
        setSuccess(`${uploadedPaths.length} file(s) uploaded successfully!`);
      }
    } catch (err) {
      console.error("Portfolio upload handler error:", err);
      setError(err.message || "Upload failed. Please try again or contact support.");
    } finally {
      setUploading(false);
    }
  };

  const mergeSelectedFiles = React.useCallback((incomingFiles) => {
    if (!incomingFiles.length) return;

    setSelectedFiles((prev) => {
      const seen = new Set(prev.map((file) => getFileKey(file)));
      const additions = incomingFiles.filter((file) => {
        const key = getFileKey(file);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      return [...prev, ...additions];
    });
  }, [getFileKey]);

  const onFileInputChange = (e) => {
    mergeSelectedFiles(Array.from(e.target.files || []));
    e.target.value = "";
  };

  const onDragOver = (e) => {
    e.preventDefault();
    if (!uploading) setIsDragging(true);
  };

  const onDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const onDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (uploading) return;
    mergeSelectedFiles(Array.from(e.dataTransfer?.files || []));
  };

  const removeSelectedFile = (fileToRemove) => {
    const fileKey = getFileKey(fileToRemove);
    setSelectedFiles((prev) => prev.filter((file) => getFileKey(file) !== fileKey));
    setUploadProgress((prev) => {
      const next = { ...prev };
      delete next[fileKey];
      return next;
    });
  };

  const clearSelectedFiles = () => {
    if (uploading) return;
    setSelectedFiles([]);
    setUploadProgress({});
  };

  const handleDelete = async (file) => {
    if (!canDeletePortfolio) {
      setError("Only signed-in admins can delete portfolio photos.");
      return;
    }

    const confirmed = window.confirm(`Delete ${file.name}?`);
    if (!confirmed) return;

    setError("");
    setSuccess("");

    try {
      await deleteImage(file.url);
      await loadPortfolio(model);
      setSuccess("File deleted successfully.");
    } catch (err) {
      setError(err.message || "Failed to delete file.");
    }
  };

  const handleDownload = async (file) => {
    try {
      const resp = await fetch(file.url);
      if (!resp.ok) throw new Error("Download failed");
      const blob = await resp.blob();
      const objectUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = file.name;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(objectUrl);
    } catch {
      window.open(file.url, "_blank", "noopener,noreferrer");
    }
  };

  if (loading) {
    return (
      <div className="lx-auth-screen">
        <div className="lx-auth-panel" style={{ textAlign: "center" }}>
          <p style={{ color: "#888" }}>Loading portfolio upload portal...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="lx-auth-screen" style={{ alignItems: "flex-start", paddingTop: 24, paddingBottom: 24 }}>
      <div className="lx-auth-panel xwide" style={{ maxWidth: 860, padding: "32px 24px" }}>
        <div className="lx-auth-brand" style={{ marginBottom: 18, paddingBottom: 14 }}>Meet Serenity</div>
        <h1 className="lx-auth-title" style={{ marginBottom: 8 }}>Portfolio Upload</h1>
        <p className="lx-auth-sub" style={{ marginBottom: 20 }}>
          {model?.name ? `${model.name}, upload your portfolio photos here.` : "Upload your portfolio photos here."}
        </p>

        {error && (
          <div style={{ background: "#fef2f2", border: "1px solid rgba(155,28,28,0.2)", borderRadius: 10, padding: "10px 14px", marginBottom: 16, color: "#9b1c1c", fontSize: 13 }}>
            {error}
          </div>
        )}

        {success && (
          <div style={{ background: "#edf7ee", border: "1px solid rgba(26,102,54,0.2)", borderRadius: 10, padding: "10px 14px", marginBottom: 16, color: "#1a6636", fontSize: 13 }}>
            {success}
          </div>
        )}

        <div style={{ background: "linear-gradient(180deg, #faf8f4 0%, #f5f2ec 100%)", border: "1px solid #e8e4dc", borderRadius: 14, padding: 18, marginBottom: 18 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#888", marginBottom: 8 }}>Portfolio status</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
            <span style={{ display: "inline-flex", padding: "5px 10px", borderRadius: 999, background: "#edf7ee", color: "#1a6636", fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>
              Upload enabled
            </span>
            {model?.agency_name ? (
              <span style={{ display: "inline-flex", padding: "5px 10px", borderRadius: 999, background: "#eff6ff", color: "#1e3a5f", fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>
                {model.agency_name}
              </span>
            ) : null}
          </div>
          <p style={{ margin: 0, color: "#4a4a4a", fontSize: 13, lineHeight: 1.6 }}>
            Upload polished portfolio images. Each file can be up to 25 MB.
          </p>
        </div>

        <div style={{ background: "#fff", border: "1px solid #e8e4dc", borderRadius: 14, padding: 18, marginBottom: 18 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#888", marginBottom: 10 }}>Upload files</div>
          <div
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
            style={{
              border: isDragging ? "2px dashed #1a6636" : "2px dashed #d9d4c9",
              background: isDragging ? "#f3faf5" : "#fcfbf8",
              borderRadius: 10,
              padding: "14px 12px",
              marginBottom: 12,
              color: "#6a6257",
              fontSize: 13,
              textAlign: "center",
            }}
          >
            Drag and drop portfolio photos here or use the file picker below.
          </div>
          <input
            type="file"
            accept="image/*"
            multiple
            onChange={onFileInputChange}
            style={{ width: "100%", padding: "10px 12px", border: "1px solid #e8e4dc", borderRadius: 8, background: "#fff", boxSizing: "border-box", marginBottom: 12 }}
          />
          {selectedFiles.length > 0 && (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 10 }}>
                <div style={{ color: "#4a4a4a", fontSize: 13 }}>
                  {selectedFiles.length} file{selectedFiles.length === 1 ? "" : "s"} selected
                </div>
                <button
                  type="button"
                  onClick={clearSelectedFiles}
                  disabled={uploading}
                  style={{
                    border: "1px solid #d8d2c8",
                    background: "#f8f6f1",
                    color: "#6a6257",
                    borderRadius: 7,
                    padding: "4px 8px",
                    fontSize: 11,
                    fontWeight: 600,
                    letterSpacing: "0.05em",
                    textTransform: "uppercase",
                    cursor: uploading ? "not-allowed" : "pointer",
                    opacity: uploading ? 0.6 : 1,
                  }}
                >
                  Clear All
                </button>
              </div>
              <div style={{ display: "grid", gap: 8, marginBottom: 12 }}>
                {selectedFiles.map((file) => {
                  const fileKey = getFileKey(file);
                  const progress = uploadProgress[fileKey];
                  const hasProgress = typeof progress === "number";
                  const isFailed = progress === -1;
                  const width = isFailed ? "100%" : `${Math.max(0, progress || 0)}%`;

                  return (
                    <div key={fileKey} style={{ border: "1px solid #ebe7df", borderRadius: 8, padding: "8px 10px", background: "#fff" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: hasProgress ? 6 : 0 }}>
                        <span style={{ color: "#4a4a4a", fontSize: 12, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", flex: 1 }}>{file.name}</span>
                        <span style={{ color: isFailed ? "#9b1c1c" : "#6a6257", fontSize: 11, fontWeight: 600, minWidth: 58, textAlign: "right" }}>
                          {isFailed ? "Failed" : hasProgress ? `${progress}%` : "Queued"}
                        </span>
                        <button
                          type="button"
                          onClick={() => removeSelectedFile(file)}
                          disabled={uploading}
                          title="Remove this file"
                          style={{
                            border: "1px solid #e7ddd0",
                            background: "#faf8f4",
                            color: "#7b7063",
                            borderRadius: 6,
                            padding: "3px 8px",
                            fontSize: 10,
                            fontWeight: 700,
                            letterSpacing: "0.06em",
                            textTransform: "uppercase",
                            cursor: uploading ? "not-allowed" : "pointer",
                            opacity: uploading ? 0.6 : 1,
                          }}
                        >
                          Remove
                        </button>
                      </div>
                      {hasProgress && (
                        <div style={{ height: 6, borderRadius: 999, background: "#eee9df", overflow: "hidden" }}>
                          <div
                            style={{
                              height: "100%",
                              width,
                              borderRadius: 999,
                              background: isFailed ? "#c14b4b" : "linear-gradient(90deg, #1a6636 0%, #2f855a 100%)",
                              transition: "width 160ms ease",
                            }}
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}
          <button
            type="button"
            onClick={handleUpload}
            disabled={uploading || !selectedFiles.length}
            className="lx-btn lx-btn-primary lx-btn-full"
          >
            {uploading ? "Uploading..." : "Upload Portfolio Photos"}
          </button>
        </div>

        <div style={{ background: "#fff", border: "1px solid #e8e4dc", borderRadius: 14, padding: 18 }}>
          {!canDeletePortfolio && (
            <p style={{ margin: "0 0 12px", color: "#888", fontSize: 12 }}>
              Delete controls are available to signed-in admins only.
            </p>
          )}
          {!files.length ? (
            <p style={{ margin: 0, color: "#888", fontSize: 13 }}>No portfolio photos uploaded yet.</p>
          ) : (
            <LuxuryPhotoCarousel
              files={files}
              title="Portfolio gallery"
              showDelete={canDeletePortfolio}
              onDelete={handleDelete}
              onDownload={handleDownload}
            />
          )}
        </div>
      </div>
    </div>
  );
}
