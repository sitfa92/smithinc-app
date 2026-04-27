import React from "react";
import { useParams } from "react-router-dom";
import { supabase } from "../supabase";
import { uploadImage, listDigitalsForModel, deleteImage } from "../imageUpload";
import LuxuryPhotoCarousel from "../components/LuxuryPhotoCarousel";
import "../App.css";

export default function DigitalsUpload() {
  const { id } = useParams();
  const [model, setModel] = React.useState(null);
  const [files, setFiles] = React.useState([]);
  const [selectedFiles, setSelectedFiles] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [uploading, setUploading] = React.useState(false);
  const [error, setError] = React.useState("");
  const [success, setSuccess] = React.useState("Your upload link is ready.");

  const folder = React.useMemo(() => `digitals/${id}`, [id]);

  // Stable ref so loadDigitals never causes the effect to re-run
  const loadDigitals = React.useCallback(async (modelData) => {
    if (!id) return;
    try {
      const results = await listDigitalsForModel({
        id,
        email: modelData?.email || "",
        instagram: modelData?.instagram || "",
        folder,
      });
      setFiles(results);
    } catch (err) {
      console.warn("Failed to load existing digitals:", err);
    }
  }, [folder, id]); // ← no `model` dep — avoids infinite loop

  React.useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!id) {
        setError("Missing model ID. Please use your upload link.");
        setModel({ id: "", name: "", email: "", instagram: "", status: "approved", pipeline_stage: "digitals_pending", agency_name: "" });
        setLoading(false);
        return;
      }

      try {
        setError("");
        setSuccess("Loading your upload portal…");

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
          pipeline_stage: modelData?.pipeline_stage || "digitals_pending",
          agency_name: modelData?.agency_name || "",
        };

        if (cancelled) return;
        setModel(resolved);
        await loadDigitals(resolved);
        if (cancelled) return;
        setSuccess("Your upload link is ready. Upload your digitals below.");
      } catch (err) {
        console.error("Upload portal load error:", err);
        if (cancelled) return;
        setModel({ id, name: "", email: "", instagram: "", status: "approved", pipeline_stage: "digitals_pending", agency_name: "" });
        setSuccess("Your upload link is ready. Upload your digitals below.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => { cancelled = true; }; // cleanup prevents stale state on remount
  }, [id, loadDigitals]); // ← normalizeModel removed; no longer needed here

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

      for (const file of selectedFiles) {
        try {
          await uploadImage(file, folder);
          uploadedPaths.push(file.name);
        } catch (fileErr) {
          failedFiles.push(`${file.name}: ${fileErr.message}`);
          console.error("File upload error:", fileErr);
        }
      }

      if (uploadedPaths.length > 0) {
        try {
          await loadDigitals(model);
        } catch {
          // Silently continue - files were uploaded even if we can't reload list
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
      console.error("Upload handler error:", err);
      setError(err.message || "Upload failed. Please try again or contact support.");
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (file) => {
    const confirmed = window.confirm(`Delete ${file.name}?`);
    if (!confirmed) return;

    setError("");
    setSuccess("");

    try {
      await deleteImage(file.url);
      await loadDigitals(model);
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

  const isEligible = ["approved", "active", "pending"].includes((model?.status || "approved").toLowerCase()) || ["development", "digitals_pending", "ready_to_pitch", "signed", "submitted"].includes(model?.pipeline_stage || "digitals_pending");

  if (loading) {
    return (
      <div className="lx-auth-screen">
        <div className="lx-auth-panel" style={{ textAlign: "center" }}>
          <p style={{ color: "#888" }}>Loading digitals portal…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="lx-auth-screen" style={{ alignItems: "flex-start", paddingTop: 24, paddingBottom: 24 }}>
      <div className="lx-auth-panel xwide" style={{ maxWidth: 860, padding: "32px 24px" }}>
        <div className="lx-auth-brand" style={{ marginBottom: 18, paddingBottom: 14 }}>Meet Serenity</div>
        <h1 className="lx-auth-title" style={{ marginBottom: 8 }}>Digitals Upload</h1>
        <p className="lx-auth-sub" style={{ marginBottom: 20 }}>
          {model?.name ? `${model.name}, upload your updated digitals here.` : "Upload your digitals here."}
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
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#888", marginBottom: 8 }}>Program status</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
            <span style={{ display: "inline-flex", padding: "5px 10px", borderRadius: 999, background: isEligible ? "#edf7ee" : "#fef8ec", color: isEligible ? "#1a6636" : "#92560a", fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>
              {isEligible ? "Upload enabled" : "Pending approval"}
            </span>
            {model?.agency_name ? (
              <span style={{ display: "inline-flex", padding: "5px 10px", borderRadius: 999, background: "#eff6ff", color: "#1e3a5f", fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>
                {model.agency_name}
              </span>
            ) : null}
          </div>
          <p style={{ margin: 0, color: "#4a4a4a", fontSize: 13, lineHeight: 1.6 }}>
            Please upload clean headshots, profile shots, and full-length digitals. Each file can be up to 10 MB.
          </p>
        </div>

        {(isEligible || !model?.name) && (
          <div style={{ background: "#fff", border: "1px solid #e8e4dc", borderRadius: 14, padding: 18, marginBottom: 18 }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#888", marginBottom: 10 }}>Upload files</div>
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={(e) => setSelectedFiles(Array.from(e.target.files || []))}
              style={{ width: "100%", padding: "10px 12px", border: "1px solid #e8e4dc", borderRadius: 8, background: "#fff", boxSizing: "border-box", marginBottom: 12 }}
            />
            {selectedFiles.length > 0 && (
              <div style={{ color: "#4a4a4a", fontSize: 13, marginBottom: 12 }}>
                {selectedFiles.length} file{selectedFiles.length === 1 ? "" : "s"} selected
              </div>
            )}
            <button
              type="button"
              onClick={handleUpload}
              disabled={uploading || !selectedFiles.length}
              className="lx-btn lx-btn-primary lx-btn-full"
            >
              {uploading ? "Uploading…" : "Upload Digitals"}
            </button>
          </div>
        )}

        <div style={{ background: "#fff", border: "1px solid #e8e4dc", borderRadius: 14, padding: 18 }}>
          {!files.length ? (
            <p style={{ margin: 0, color: "#888", fontSize: 13 }}>No digitals uploaded yet.</p>
          ) : (
            <LuxuryPhotoCarousel
              files={files}
              title="Uploaded digitals"
              showDelete
              onDelete={handleDelete}
              onDownload={handleDownload}
            />
          )}
        </div>
      </div>
    </div>
  );
}
