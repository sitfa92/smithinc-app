import React from "react";
import { supabase } from "../supabase";
import { useAuth } from "../auth";

const C = {
  ink: "#111111",
  slate: "#4a4a4a",
  dust: "#888888",
  smoke: "#e8e4dc",
  ivory: "#faf8f4",
  white: "#ffffff",
  gold: "#c9a96e",
  okBg: "rgba(26,102,54,0.08)",
  ok: "#1a6636",
  errBg: "rgba(180,28,28,0.08)",
  err: "#b41c1c",
  warnBg: "rgba(180,120,0,0.08)",
  warn: "#a06000",
};

const ADMIN_EMAIL = "sitfa92@gmail.com";
const CHIZZY_EMAIL = "chizzyboi72@gmail.com";
const MJ_EMAIL = "marthajohn223355@gmail.com";

const configuredBucket = (typeof import.meta !== "undefined" && import.meta.env?.VITE_SUPABASE_STORAGE_BUCKET || "").trim();
const STORAGE_BUCKETS = [configuredBucket, "model-images", "models", "images"].filter(Boolean);

const MEMBERS = [
  { key: "chizzy", label: "Chizzy", email: CHIZZY_EMAIL, folder: "team-docs/chizzy", accent: "#7b2ff7", accentBg: "rgba(123,47,247,0.06)", accentMid: "rgba(123,47,247,0.2)" },
  { key: "mj",     label: "MJ",     email: MJ_EMAIL,    folder: "team-docs/mj",     accent: "#1a6636", accentBg: "rgba(26,102,54,0.06)",    accentMid: "rgba(26,102,54,0.2)"    },
];

async function listFolderFiles(folder) {
  for (const bucket of STORAGE_BUCKETS) {
    const { data, error } = await supabase.storage.from(bucket).list(folder, {
      limit: 200,
      sortBy: { column: "name", order: "asc" },
    });
    if (error) continue;
    const files = (data || []).filter(f => f.name && !f.name.endsWith("/"));
    if (files.length > 0 || data) {
      return files.map(f => {
        const path = `${folder}/${f.name}`;
        const { data: pubData } = supabase.storage.from(bucket).getPublicUrl(path);
        return { name: f.name, path, url: pubData?.publicUrl || "", bucket, size: f.metadata?.size || 0, updatedAt: f.updated_at || f.created_at || "" };
      });
    }
  }
  return [];
}

async function uploadFile(folder, file) {
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const ts = Date.now();
  const fileName = `${ts}_${safeName}`;
  const path = `${folder}/${fileName}`;
  for (const bucket of STORAGE_BUCKETS) {
    const { error } = await supabase.storage.from(bucket).upload(path, file, { upsert: false, contentType: file.type });
    if (error) continue;
    const { data: pubData } = supabase.storage.from(bucket).getPublicUrl(path);
    return { name: fileName, path, url: pubData?.publicUrl || "", bucket };
  }
  throw new Error("Upload failed — no storage bucket accepted the file.");
}

async function deleteFile(bucket, path) {
  const { error } = await supabase.storage.from(bucket).remove([path]);
  if (error) throw error;
}

function FolderPanel({ member, userEmail, userRole }) {
  const [files, setFiles] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [uploading, setUploading] = React.useState(false);
  const [deletingPath, setDeletingPath] = React.useState("");
  const [notice, setNotice] = React.useState("");
  const inputRef = React.useRef(null);

  const isAdmin = (userEmail || "").toLowerCase() === ADMIN_EMAIL.toLowerCase() || userRole === "admin";
  const isOwner = (userEmail || "").toLowerCase() === member.email.toLowerCase();
  const canWrite = isAdmin || isOwner;

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const result = await listFolderFiles(member.folder);
      setFiles(result);
    } catch {
      setFiles([]);
    } finally {
      setLoading(false);
    }
  }, [member.folder]);

  React.useEffect(() => { load(); }, [load]);

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploading(true);
    setNotice("");
    try {
      const uploaded = await uploadFile(member.folder, file);
      setFiles(prev => [...prev, uploaded]);
      setNotice("File uploaded successfully.");
    } catch (err) {
      setNotice(err.message || "Upload failed.");
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (file) => {
    if (!window.confirm(`Delete "${file.name}"?`)) return;
    setDeletingPath(file.path);
    setNotice("");
    try {
      await deleteFile(file.bucket, file.path);
      setFiles(prev => prev.filter(f => f.path !== file.path));
      setNotice("File deleted.");
    } catch (err) {
      setNotice(err.message || "Delete failed.");
    } finally {
      setDeletingPath("");
    }
  };

  const formatSize = (bytes) => {
    if (!bytes) return "";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div style={{ border: `1px solid ${member.accentMid}`, borderTop: `4px solid ${member.accent}`, borderRadius: 14, background: member.accentBg, padding: "22px 22px 18px", flex: "1 1 320px", minWidth: 0 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, flexWrap: "wrap", gap: 8 }}>
        <div>
          <p style={{ fontFamily: "'Cormorant Garamond',Georgia,serif", fontSize: 20, fontWeight: 600, color: member.accent, margin: 0 }}>{member.label}</p>
          <p style={{ fontSize: 12, color: C.dust, margin: "2px 0 0" }}>{member.email}</p>
        </div>
        {canWrite && (
          <>
            <button
              onClick={() => inputRef.current?.click()}
              disabled={uploading}
              style={{ padding: "8px 16px", background: member.accent, color: C.white, border: "none", borderRadius: 8, fontSize: 12, fontWeight: 600, letterSpacing: "0.07em", textTransform: "uppercase", cursor: uploading ? "not-allowed" : "pointer", opacity: uploading ? 0.6 : 1, fontFamily: "'Inter',sans-serif" }}
            >
              {uploading ? "Uploading…" : "+ Upload File"}
            </button>
            <input ref={inputRef} type="file" style={{ display: "none" }} onChange={handleUpload} />
          </>
        )}
      </div>

      {notice && (
        <p style={{ fontSize: 12, color: notice.toLowerCase().includes("fail") || notice.toLowerCase().includes("error") ? C.err : C.ok, background: notice.toLowerCase().includes("fail") || notice.toLowerCase().includes("error") ? C.errBg : C.okBg, padding: "6px 10px", borderRadius: 6, marginBottom: 12 }}>
          {notice}
        </p>
      )}

      {loading && <p style={{ color: C.dust, fontSize: 13 }}>Loading files…</p>}

      {!loading && files.length === 0 && (
        <p style={{ color: C.dust, fontSize: 13 }}>No files yet.{canWrite ? " Upload the first one above." : ""}</p>
      )}

      {!loading && files.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {files.map(file => (
            <div key={file.path} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", background: C.white, border: `1px solid ${C.smoke}`, borderRadius: 9 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: C.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={file.name}>
                  {file.name.replace(/^\d+_/, "")}
                </p>
                {file.size > 0 && <p style={{ margin: "2px 0 0", fontSize: 11, color: C.dust }}>{formatSize(file.size)}</p>}
              </div>
              <a
                href={file.url}
                target="_blank"
                rel="noopener noreferrer"
                style={{ padding: "5px 10px", background: C.ivory, color: C.slate, border: `1px solid ${C.smoke}`, borderRadius: 6, fontSize: 11, fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase", cursor: "pointer", textDecoration: "none", fontFamily: "'Inter',sans-serif", flexShrink: 0 }}
              >
                Open
              </a>
              {canWrite && (
                <button
                  onClick={() => handleDelete(file)}
                  disabled={deletingPath === file.path}
                  style={{ padding: "5px 10px", background: C.errBg, color: C.err, border: `1px solid rgba(180,28,28,0.2)`, borderRadius: 6, fontSize: 11, fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase", cursor: deletingPath === file.path ? "not-allowed" : "pointer", opacity: deletingPath === file.path ? 0.6 : 1, fontFamily: "'Inter',sans-serif", flexShrink: 0 }}
                >
                  {deletingPath === file.path ? "…" : "Delete"}
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      <button
        onClick={load}
        style={{ marginTop: 14, padding: "6px 12px", background: "transparent", color: C.dust, border: `1px solid ${C.smoke}`, borderRadius: 7, fontSize: 11, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", cursor: "pointer", fontFamily: "'Inter',sans-serif" }}
      >
        Refresh
      </button>
    </div>
  );
}

export default function TeamDocs() {
  const { user, role } = useAuth();
  const userEmail = (user?.email || "").toLowerCase();
  const isAdmin = userEmail === ADMIN_EMAIL.toLowerCase() || role === "admin";

  // Non-admin team members only see their own folder
  const visibleMembers = isAdmin
    ? MEMBERS
    : MEMBERS.filter(m => m.email.toLowerCase() === userEmail);

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "32px 20px 60px" }}>
      <p style={{ fontFamily: "'Cormorant Garamond',Georgia,serif", fontSize: 28, fontWeight: 500, color: C.ink, margin: "0 0 6px" }}>
        Team Documents
      </p>
      <p style={{ fontSize: 14, color: C.dust, margin: "0 0 28px" }}>
        Onboarding materials, work documents, and shared files for each team member.
      </p>

      <div style={{ display: "flex", gap: 20, flexWrap: "wrap", alignItems: "flex-start" }}>
        {visibleMembers.map(member => (
          <FolderPanel
            key={member.key}
            member={member}
            userEmail={userEmail}
            userRole={role}
          />
        ))}
      </div>

      {visibleMembers.length === 0 && (
        <p style={{ color: C.dust, fontSize: 14 }}>No document folders available for your account.</p>
      )}
    </div>
  );
}
