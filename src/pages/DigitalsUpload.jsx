import React from "react";
import { useParams } from "react-router-dom";
import { supabase } from "../supabase";
import { uploadImage, listFilesInFolder, deleteImage } from "../imageUpload";
import "../App.css";

export default function DigitalsUpload() {
  const { id } = useParams();
  const [model, setModel] = React.useState(null);
  const [files, setFiles] = React.useState([]);
  const [selectedFiles, setSelectedFiles] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [uploading, setUploading] = React.useState(false);
  const [error, setError] = React.useState("");
  const [success, setSuccess] = React.useState("");

  const folder = React.useMemo(() => `digitals/${id}`, [id]);

  const normalizeModel = React.useCallback((row = {}) => ({
    id: row.id || id,
    name: row.name || "",
    status: row.status || "approved",
    pipeline_stage: row.pipeline_stage || "digitals_pending",
    agency_name: row.agency_name || "",
  }), [id]);

  const loadDigitals = React.useCallback(async () => {
    if (!id) return;
    try {
      const results = await listFilesInFolder(folder);
      setFiles(results);
    } catch (err) {
      setError(err.message || "Failed to load uploaded digitals");
    }
  }, [folder, id]);

  React.useEffect(() => {
    const load = async () => {
      if (!id) {
        setError("Missing model link.");
        setLoading(false);
        return;
      }

      try {
        setError("");
        setSuccess("");

        let modelData = null;
        let modelError = null;

        const primary = await supabase
          .from("models")
          .select("id, name, status, pipeline_stage, agency_name")
          .eq("id", id)
          .maybeSingle();

        modelData = primary.data;
        modelError = primary.error;

        if (modelError) {
          const fallback = await supabase
            .from("models")
            .select("id, name, status")
            .eq("id", id)
            .maybeSingle();

          modelData = fallback.data ? normalizeModel(fallback.data) : null;
          modelError = fallback.error;
        }

        if (modelData) {
          setModel(normalizeModel(modelData));
        } else {
          setModel(normalizeModel());
          setSuccess("Your upload link is ready. You can add your digitals below.");
        }

        await loadDigitals();
      } catch {
        setModel(normalizeModel());
        setSuccess("Your upload link is ready. You can add your digitals below.");
        await loadDigitals();
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [id, loadDigitals, normalizeModel]);

  const handleUpload = async () => {
    if (!selectedFiles.length || !id) return;

    setUploading(true);
    setError("");
    setSuccess("");

    try {
      for (const file of selectedFiles) {
        await uploadImage(file, folder);
      }

      setSelectedFiles([]);
      await loadDigitals();
      setSuccess("Digitals uploaded successfully.");
    } catch (err) {
      setError(err.message || "Upload failed. Please try again.");
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
      await loadDigitals();
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

        {isEligible && (
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
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#888" }}>
              Uploaded digitals{files.length > 0 ? ` · ${files.length}` : ""}
            </div>
          </div>
          {!files.length ? (
            <p style={{ margin: 0, color: "#888", fontSize: 13 }}>No digitals uploaded yet.</p>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))", gap: 12 }}>
              {files.map((file) => (
                <div key={file.path} style={{ borderRadius: 10, overflow: "hidden", border: "1px solid #e8e4dc", background: "#faf8f4", display: "flex", flexDirection: "column" }}>
                  <a href={file.url} target="_blank" rel="noopener noreferrer" style={{ display: "block", aspectRatio: "3/4", overflow: "hidden" }}>
                    <img
                      src={file.url}
                      alt={file.name}
                      loading="lazy"
                      style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                    />
                  </a>
                  <div style={{ padding: "8px 10px", display: "flex", gap: 6, justifyContent: "flex-end" }}>
                    <button
                      type="button"
                      onClick={() => handleDownload(file)}
                      title="Download"
                      style={{ padding: "4px 10px", background: "transparent", color: "#4a4a4a", border: "1px solid #e8e4dc", borderRadius: 6, fontSize: 11, fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase", cursor: "pointer", fontFamily: "'Inter',sans-serif" }}
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(file)}
                      title="Delete"
                      style={{ padding: "4px 10px", background: "transparent", color: "#9b1c1c", border: "1px solid rgba(155,28,28,0.25)", borderRadius: 6, fontSize: 11, fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase", cursor: "pointer", fontFamily: "'Inter',sans-serif" }}
                    >
                      ✕
                    </button>
                  </div>
                  <div style={{ padding: "0 10px 8px", fontSize: 11, color: "#888", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={file.name}>
                    {file.name}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
