import React from "react";
import { supabase } from "../supabase";
import { createInAppAlerts, sendInternalTeamEmailAlert } from "../utils";

const getAvatarSrc = (url) => {
  const raw = String(url || "").trim();
  if (!raw) return "";
  if (/^https?:\/\//i.test(raw)) {
    const signMarker = "/storage/v1/object/sign/";
    const idx = raw.indexOf(signMarker);
    if (idx >= 0) {
      const path = raw.slice(idx + signMarker.length).split("?")[0];
      return `${raw.slice(0, idx)}/storage/v1/object/public/${path}`;
    }
    return raw;
  }
  return raw;
};

const EMERGENCY_AMBASSADOR_EMAILS = new Set([
  "kouassibenedicta46@gmail.com",
]);

const isTableMissingError = (err) =>
  err?.code === "42P01" ||
  err?.message?.toLowerCase().includes("does not exist") ||
  err?.message?.toLowerCase().includes("relation");

export default function PartnerSubmissions() {
  const isBrandAmbassadorView = React.useMemo(() => {
    if (typeof window === "undefined") return false;
    return window.location.pathname.startsWith("/brand-ambassador-submissions");
  }, []);
  const [submissions, setSubmissions] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [tableReady, setTableReady] = React.useState(true);
  const [psBannerDismissed, setPsBannerDismissed] = React.useState(() => {
    try { return localStorage.getItem("ps_banner_dismissed") === "1"; } catch { return false; }
  });
  const [error, setError] = React.useState("");
  const [saveError, setSaveError] = React.useState("");
  const [actionLoading, setActionLoading] = React.useState({});
  const [bulkDeleteLoading, setBulkDeleteLoading] = React.useState(false);
  const [statusFilter, setStatusFilter] = React.useState("active");
  const [sourceFilter, setSourceFilter] = React.useState(() => (isBrandAmbassadorView ? "brand_ambassador" : "all"));
  const showSourceFilter = !isBrandAmbassadorView;
  const [uploadingId, setUploadingId] = React.useState("");
  const avatarInputRef = React.useRef({});
  const [form, setForm] = React.useState({
    name: "",
    email: "",
    company: "",
    website: "",
    notes: "",
    source: isBrandAmbassadorView ? "brand_ambassador" : "manual",
  });

  const isAmbassadorSubmission = React.useCallback((item) => {
    const source = String(item?.source || "").toLowerCase();
    const company = String(item?.company || "").toLowerCase();
    const notes = String(item?.notes || item?.internal_notes || "").toLowerCase();
    const serviceType = String(item?.service_type || "").toLowerCase();
    const project = String(item?.project || "").toLowerCase();
    const email = String(item?.email || "").toLowerCase().trim();
    return (
      EMERGENCY_AMBASSADOR_EMAILS.has(email) ||
      source === "brand_ambassador" ||
      company.includes("brand ambassador") ||
      serviceType.includes("brand ambassador") ||
      project.includes("brand ambassador") ||
      notes.includes("moved from model")
    );
  }, []);

  const getAuthHeaders = async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session?.access_token || ""}`,
    };
  };

  const uploadAvatar = async (submissionId, file) => {
    if (!file || !submissionId || String(submissionId).startsWith("booking-")) return;
    setUploadingId(String(submissionId));
    try {
      const signResp = await fetch("/api/storage/sign-upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileName: file.name || `avatar-${submissionId}`,
          contentType: file.type || "image/jpeg",
          folder: "avatars-ambassadors",
        }),
      });
      const signJson = await signResp.json().catch(() => ({}));
      if (!signResp.ok) throw new Error(signJson.error || "Failed to prepare upload");

      const { bucket, path, token } = signJson;
      if (!bucket || !path || !token) throw new Error("Invalid upload token");

      const { error: uploadErr } = await supabase.storage.from(bucket).uploadToSignedUrl(path, token, file);
      if (uploadErr) throw uploadErr;

      const { data: pubData } = supabase.storage.from(bucket).getPublicUrl(path);
      const publicUrl = pubData?.publicUrl || "";
      if (!publicUrl) throw new Error("Failed to resolve avatar URL");

      const headers = await getAuthHeaders();
      const idStr = String(submissionId);
      let saveResp;
      if (idStr.startsWith("client-")) {
        saveResp = await fetch("/api/clients/update-pipeline", {
          method: "POST",
          headers,
          body: JSON.stringify({ partnerId: idStr.slice("client-".length), updates: { avatar_url: publicUrl, last_updated: new Date().toISOString() } }),
        });
      } else {
        saveResp = await fetch("/api/clients/update-pipeline", {
          method: "POST",
          headers,
          body: JSON.stringify({ partnerId: submissionId, updates: { avatar_url: publicUrl, last_updated: new Date().toISOString() } }),
        });
      }
      const saveJson = await saveResp.json().catch(() => ({}));
      if (!saveResp.ok) throw new Error(saveJson.error || "Failed to save avatar");

      setSubmissions(prev => prev.map(s => s.id === submissionId ? { ...s, avatar_url: publicUrl } : s));
    } catch (err) {
      alert(err.message || "Failed to upload avatar");
    } finally {
      setUploadingId("");
    }
  };

  const SETUP_SQL = `create table if not exists public.partners (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text,
  company text,
  website text,
  notes text,
  status text default 'pending',
  source text default 'manual',
  submitted_at timestamptz default now(),
  created_at timestamptz default now(),
  last_updated timestamptz default now()
);

alter table public.partners add column if not exists name text;
alter table public.partners add column if not exists email text;
alter table public.partners add column if not exists company text;
alter table public.partners add column if not exists website text;
alter table public.partners add column if not exists notes text;
alter table public.partners add column if not exists status text default 'pending';
alter table public.partners add column if not exists source text default 'manual';
alter table public.partners add column if not exists submitted_at timestamptz default now();
alter table public.partners add column if not exists last_updated timestamptz default now();

alter table public.partners disable row level security;`;

  const loadAmbassadorClientRows = React.useCallback(async () => {
    const headers = await getAuthHeaders();
    const resp = await fetch("/api/clients/list", { headers });
    const json = await resp.json().catch(() => ({}));
    if (!resp.ok) return [];

    const ambassadorClients = json.clients || [];

    return (ambassadorClients || [])
      .filter((item) => isAmbassadorSubmission(item))
      .map((item) => ({
        id: `client-${item.id}`,
        name: item.name,
        email: item.email,
        company: item.project || item.service_type || "Brand Ambassador",
        website: "",
        notes: item.internal_notes || "Moved from model flow",
        source: "brand_ambassador",
        avatar_url: item.avatar_url || "",
        status: ["inactive", "churned", "rejected"].includes(String(item.status || "").toLowerCase())
          ? "rejected"
          : ["active", "completed", "approved"].includes(String(item.status || "").toLowerCase())
            ? "approved"
            : "pending",
        submitted_at: item.created_at,
        created_at: item.created_at,
        isClientRecord: true,
      }));
  }, [isAmbassadorSubmission]);

  const fetchSubmissions = async () => {
    try {
      setError("");
      const headers = await getAuthHeaders();
      const resp = await fetch("/api/partners/admin-submissions", { headers });
      const json = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        if (json.code === "TABLE_SETUP_REQUIRED") {
          setTableReady(false);
          if (isBrandAmbassadorView) {
            const synthesized = await loadAmbassadorClientRows();
            setSubmissions(synthesized);
          } else {
            setSubmissions([]);
          }
          return;
        }
        throw new Error(json.error || "Failed to load partner submissions");
      }

      setTableReady(true);
      let nextRows = json.data || [];

      if (isBrandAmbassadorView) {
        const synthesized = await loadAmbassadorClientRows();
        const deduped = new Set(
          nextRows.map((row) => `${String(row.email || "").toLowerCase()}|${String(row.name || "").toLowerCase()}`)
        );
        synthesized.forEach((row) => {
          const key = `${String(row.email || "").toLowerCase()}|${String(row.name || "").toLowerCase()}`;
          if (deduped.has(key)) return;
          deduped.add(key);
          nextRows.push(row);
        });
      }

      setSubmissions(nextRows);
    } catch (err) {
      if (isTableMissingError(err)) {
        setTableReady(false);
        if (isBrandAmbassadorView) {
          const synthesized = await loadAmbassadorClientRows();
          setSubmissions(synthesized);
        } else {
          setSubmissions([]);
        }
      } else {
        setError(err.message || "Failed to load partner submissions");
      }
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    fetchSubmissions();
  }, [isBrandAmbassadorView]); // eslint-disable-line react-hooks/exhaustive-deps

  const saveSubmission = async (e) => {
    e.preventDefault();
    setSaveError("");

    try {
      const payload = {
        name: form.name.trim(),
        email: form.email.trim().toLowerCase(),
        company: form.company.trim(),
        website: form.website.trim(),
        notes: form.notes.trim(),
        source: form.source,
        status: "pending",
        submitted_at: new Date().toISOString(),
        last_updated: new Date().toISOString(),
      };

      if (!payload.name || !payload.email) throw new Error("Name and email are required");

      const headers = await getAuthHeaders();
      const resp = await fetch("/api/partners/admin-submissions", {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      });
      const json = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        if (json.code === "TABLE_SETUP_REQUIRED") {
          setTableReady(false);
          throw new Error("Partners table is not set up yet");
        }
        throw new Error(json.error || "Failed to save partner submission");
      }

      createInAppAlerts([
        {
          title: isBrandAmbassadorView ? "New brand ambassador submission" : "New partner submission",
          message: `${payload.name} submitted a ${isBrandAmbassadorView ? "brand ambassador" : "partner"} application.`,
          audience_role: "admin",
          source_type: isBrandAmbassadorView ? "brand_ambassador_submission" : "partner_submission",
          source_id: payload.email,
          level: "info",
        },
      ]);

      sendInternalTeamEmailAlert({
        subject: `${isBrandAmbassadorView ? "Brand ambassador" : "Partner"} submission: ${payload.name}`,
        message: `${payload.name} submitted a ${isBrandAmbassadorView ? "brand ambassador" : "partner"} application.\nEmail: ${payload.email}\nCompany: ${payload.company || "N/A"}`,
        roles: ["admin", "va"],
        submissionEmail: payload.email,
      });

      setForm({
        name: "",
        email: "",
        company: "",
        website: "",
        notes: "",
        source: isBrandAmbassadorView ? "brand_ambassador" : "manual",
      });
      fetchSubmissions();
    } catch (err) {
      setSaveError(err.message || "Failed to save partner submission");
    }
  };

  const updateSubmissionStatus = async (submissionId, nextStatus) => {
    const record = submissions.find((item) => item.id === submissionId);
    if (!record) return;

    setActionLoading((prev) => ({ ...prev, [submissionId]: true }));
    try {
      const headers = await getAuthHeaders();
      const resp = await fetch("/api/partners/admin-submissions", {
        method: "PATCH",
        headers,
        body: JSON.stringify({ submissionId, nextStatus }),
      });
      const json = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(json.error || "Failed to update partner submission");

      setSubmissions((prev) => prev.map((item) => (item.id === submissionId ? { ...item, status: nextStatus } : item)));
    } catch (err) {
      alert(`Failed to update status: ${err.message}`);
    } finally {
      setActionLoading((prev) => ({ ...prev, [submissionId]: false }));
    }
  };

  const filteredSubmissions = submissions
    .filter((item) => (isBrandAmbassadorView ? isAmbassadorSubmission(item) : !isAmbassadorSubmission(item)))
    .filter((item) => {
      if (statusFilter === "active") return item.status !== "rejected";
      if (statusFilter === "all") return true;
      return item.status === statusFilter;
    })
    .filter((item) => {
      if (!showSourceFilter) return true;
      if (sourceFilter === "all") return true;
      return (item.source || "manual") === sourceFilter;
    });

  const rejectedCount = React.useMemo(
    () => submissions
      .filter((item) => !item.isClientRecord)
      .filter((item) => (isBrandAmbassadorView ? isAmbassadorSubmission(item) : !isAmbassadorSubmission(item)))
      .filter((item) => item.status === "rejected").length,
    [submissions, isBrandAmbassadorView, isAmbassadorSubmission]
  );

  const deleteAllRejectedSubmissions = async () => {
    if (rejectedCount === 0) {
      alert("No rejected submissions to delete.");
      return;
    }

    const confirmed = window.confirm(
      `Delete all ${rejectedCount} rejected submission${rejectedCount === 1 ? "" : "s"}? This action cannot be undone.`
    );
    if (!confirmed) return;

    setBulkDeleteLoading(true);
    try {
      const headers = await getAuthHeaders();
      const resp = await fetch("/api/partners/admin-submissions", {
        method: "DELETE",
        headers,
        body: JSON.stringify({
          rejectedOnly: true,
          scope: isBrandAmbassadorView ? "brand_ambassador" : "partner",
        }),
      });
      const json = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(json.error || "Failed to delete rejected submissions");

      setSubmissions((prev) =>
        prev.filter((item) => {
          if (item.isClientRecord) return true;
          const inScope = isBrandAmbassadorView ? isAmbassadorSubmission(item) : !isAmbassadorSubmission(item);
          return !(inScope && item.status === "rejected");
        })
      );
      alert(`Deleted ${Number(json.deletedCount || 0)} rejected submission${Number(json.deletedCount || 0) === 1 ? "" : "s"}.`);
    } catch (err) {
      alert(err.message || "Failed to delete rejected submissions");
    } finally {
      setBulkDeleteLoading(false);
    }
  };

  const C = { ink: "#111111", slate: "#4a4a4a", dust: "#888888", smoke: "#e8e4dc", ivory: "#faf8f4", white: "#ffffff", err: "#9b1c1c", warn: "#92560a", ok: "#1a6636", okBg: "#edf7ee", warnBg: "#fef8ec", errBg: "#fef2f2" };
  const accent = C.ink;
  const accentBg = C.ivory;
  const accentMid = C.smoke;
  const inp = { width: "100%", padding: "11px 13px", fontSize: 13, color: C.ink, background: C.white, border: `1px solid ${C.smoke}`, borderRadius: 8, outline: "none", fontFamily: "'Inter',sans-serif", boxSizing: "border-box" };
  const btnS = (bg, clr, extra = {}) => ({ padding: "9px 16px", background: bg, color: clr, border: "none", borderRadius: 8, fontSize: 12, fontWeight: 600, letterSpacing: "0.07em", textTransform: "uppercase", cursor: "pointer", fontFamily: "'Inter',sans-serif", ...extra });
  const badge = (st) => {
    const m = { approved: [C.okBg, C.ok], rejected: [C.errBg, C.err], pending: [C.warnBg, C.warn] };
    const [bg, clr] = m[st] || [C.ivory, C.slate];
    return { display: "inline-flex", alignItems: "center", padding: "3px 10px", borderRadius: 99, fontSize: 11, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", background: bg, color: clr };
  };

  return (
    <div style={{ padding: "32px 24px", maxWidth: 1200, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: 24 }}>
        <div>
          <h1 style={{ fontFamily: "'Cormorant Garamond',Georgia,serif", fontSize: "clamp(26px,4vw,38px)", fontWeight: 500, color: C.ink, letterSpacing: "-0.02em", margin: "0 0 4px" }}>
            {isBrandAmbassadorView ? "Brand Ambassador Submissions" : "Partner Submissions"}
          </h1>
          <p style={{ color: C.dust, fontSize: 13, margin: 0 }}>
            {isBrandAmbassadorView ? "Review and manage incoming brand ambassador applications." : "Review and manage incoming partner applications."}
          </p>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={{ padding: "9px 12px", border: `1px solid ${C.smoke}`, borderRadius: 8, fontSize: 13, background: C.white, color: C.slate, outline: "none", fontFamily: "'Inter',sans-serif", appearance: "none", cursor: "pointer" }}>
            <option value="active">Hide Rejected</option>
            <option value="all">All Statuses</option>
            <option value="pending">Pending only</option>
            <option value="approved">Approved only</option>
            <option value="rejected">Rejected only</option>
          </select>
          {showSourceFilter && (
            <select value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value)} style={{ padding: "9px 12px", border: `1px solid ${C.smoke}`, borderRadius: 8, fontSize: 13, background: C.white, color: C.slate, outline: "none", fontFamily: "'Inter',sans-serif", appearance: "none", cursor: "pointer" }}>
              <option value="all">All Sources</option>
              <option value="manual">Manual</option>
              <option value="public">Public</option>
              <option value="zapier">Zapier</option>
            </select>
          )}
          <button
            onClick={deleteAllRejectedSubmissions}
            disabled={bulkDeleteLoading}
            style={btnS(C.errBg, C.err, { border: `1px solid rgba(155,28,28,0.2)`, opacity: bulkDeleteLoading ? 0.55 : 1, cursor: bulkDeleteLoading ? "not-allowed" : "pointer" })}
          >
            {bulkDeleteLoading ? "Deleting…" : "Clear Rejected"}
          </button>
        </div>
      </div>

      {!tableReady && !psBannerDismissed && (
        <div style={{ background: C.warnBg, border: `1px solid rgba(146,86,10,0.2)`, borderRadius: 12, padding: "18px 22px", marginBottom: 24 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
            <p style={{ margin: 0, fontWeight: 600, color: C.warn, fontSize: 14 }}>
              {isBrandAmbassadorView ? "Brand ambassador submissions table needs one-time setup" : "Partner submissions table needs one-time setup"}
            </p>
            <button onClick={() => { setPsBannerDismissed(true); try { localStorage.setItem("ps_banner_dismissed", "1"); } catch { /* ignore */ } }} style={{ background: "none", border: "none", cursor: "pointer", color: C.dust, fontSize: 18, lineHeight: 1, padding: "0 0 0 12px", fontFamily: "'Inter',sans-serif" }} title="Dismiss">×</button>
          </div>
          <p style={{ margin: "0 0 10px", color: C.slate, fontSize: 13 }}>
            Run this SQL in the <a href="https://supabase.com/dashboard/project/jjmmakbnjzzxbuflucck/sql/new" target="_blank" rel="noreferrer" style={{ color: C.ink, fontWeight: 600 }}>Supabase SQL Editor ↗</a> then refresh this page.
          </p>
          <pre style={{ background: C.ivory, border: `1px solid ${C.smoke}`, padding: "12px 14px", borderRadius: 8, fontSize: 11, overflowX: "auto", whiteSpace: "pre-wrap", color: C.slate, maxHeight: 180, overflow: "auto" }}>{SETUP_SQL}</pre>
          <button onClick={() => navigator.clipboard.writeText(SETUP_SQL)} style={{ marginTop: 10, ...btnS(C.ink, C.white) }}>Copy SQL</button>
        </div>
      )}

      {tableReady && (
        <div style={{ background: C.white, border: `1px solid ${C.smoke}`, borderRadius: 12, padding: "22px 22px", marginBottom: 24, boxShadow: "0 1px 4px rgba(17,17,17,0.04)" }}>
          <p style={{ fontFamily: "'Cormorant Garamond',Georgia,serif", fontSize: 18, fontWeight: 500, color: C.ink, margin: "0 0 14px" }}>
            {isBrandAmbassadorView ? "Add Brand Ambassador Submission" : "Add Partner Submission"}
          </p>
          <form onSubmit={saveSubmission} style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <input value={form.name} placeholder={isBrandAmbassadorView ? "Ambassador name" : "Partner name"} onChange={(e) => setForm({ ...form, name: e.target.value })} required style={inp} />
            <input value={form.email} placeholder={isBrandAmbassadorView ? "Ambassador email" : "Partner email"} type="email" onChange={(e) => setForm({ ...form, email: e.target.value })} required style={inp} />
            <input value={form.company} placeholder={isBrandAmbassadorView ? "Brand / platform" : "Company"} onChange={(e) => setForm({ ...form, company: e.target.value })} style={inp} />
            <input value={form.website} placeholder={isBrandAmbassadorView ? "Website / social" : "Website"} onChange={(e) => setForm({ ...form, website: e.target.value })} style={inp} />
            <select value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })} style={{ ...inp, appearance: "none" }}>
              <option value="manual">Manual</option>
              <option value="public">Public Form</option>
              <option value="brand_ambassador">Brand Ambassador</option>
              <option value="zapier">Zapier</option>
            </select>
            <div />
            <textarea value={form.notes} placeholder="Submission notes" onChange={(e) => setForm({ ...form, notes: e.target.value })} style={{ ...inp, minHeight: 90, resize: "vertical", gridColumn: "1/-1" }} />
            {saveError && <p style={{ color: C.err, margin: 0, gridColumn: "1/-1", fontSize: 13 }}>{saveError}</p>}
            <button style={{ gridColumn: "1/-1", ...btnS(accent, C.white), padding: "12px 20px" }}>
              {isBrandAmbassadorView ? "Save Ambassador Submission" : "Save Submission"}
            </button>
          </form>
        </div>
      )}

      {loading && <p style={{ color: C.dust }}>Loading submissions…</p>}
      {error && <div style={{ background: C.errBg, border: `1px solid rgba(155,28,28,0.2)`, borderRadius: 10, padding: "12px 16px", marginBottom: 20, color: C.err, fontSize: 13 }}>Error: {error}</div>}
      {!loading && tableReady && submissions.length === 0 && <p style={{ color: C.dust }}>{isBrandAmbassadorView ? "No brand ambassador submissions yet." : "No partner submissions yet."}</p>}
      {!loading && tableReady && submissions.length > 0 && filteredSubmissions.length === 0 && <p style={{ color: C.dust }}>No submissions match the current filters.</p>}

      {!loading && filteredSubmissions.map((partner) => {
        const initials = (partner.name || "?").split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
        const avatarSrc = getAvatarSrc(partner.avatar_url);
        const isBusy = !!actionLoading[partner.id];
        const isUploading = uploadingId === String(partner.id);
        const canUpload = !String(partner.id).startsWith("booking-");

        return (
          <div key={partner.id} style={{ background: C.white, border: `1px solid ${C.smoke}`, borderRadius: 12, padding: "16px 18px", marginBottom: 12, boxShadow: "0 1px 4px rgba(17,17,17,0.04)" }}>
            <div style={{ display: "flex", gap: 14, alignItems: "flex-start", flexWrap: "wrap" }}>

              {/* Avatar */}
              <div style={{ position: "relative", flexShrink: 0 }}>
                <div
                  onClick={() => canUpload && avatarInputRef.current[partner.id]?.click()}
                  title={canUpload ? "Click to change photo" : ""}
                  style={{ width: 56, height: 56, borderRadius: 10, overflow: "hidden", border: `1px solid ${C.smoke}`, background: C.ivory, display: "flex", alignItems: "center", justifyContent: "center", cursor: canUpload ? "pointer" : "default", position: "relative", flexShrink: 0 }}
                >
                  {avatarSrc ? (
                    <img src={avatarSrc} alt={partner.name} loading="lazy" decoding="async" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                  ) : (
                    <span style={{ fontSize: 20, color: C.dust, fontFamily: "'Cormorant Garamond',Georgia,serif", fontWeight: 600 }}>{initials || "?"}</span>
                  )}
                  {isUploading && (
                    <div style={{ position: "absolute", inset: 0, background: "rgba(255,255,255,0.75)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <span style={{ fontSize: 10, color: C.slate }}>…</span>
                    </div>
                  )}
                </div>
                {canUpload && (
                  <input
                    type="file"
                    accept="image/*"
                    style={{ display: "none" }}
                    ref={el => { avatarInputRef.current[partner.id] = el; }}
                    onChange={e => { const f = e.target.files?.[0]; if (f) uploadAvatar(partner.id, f); e.target.value = ""; }}
                  />
                )}
              </div>

              {/* Info */}
              <div style={{ flex: 1, minWidth: 180 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8, flexWrap: "wrap", marginBottom: 4 }}>
                  <p style={{ margin: 0, fontSize: 15, fontWeight: 600, color: C.ink, fontFamily: "'Inter',sans-serif" }}>{partner.name}</p>
                  <div style={{ display: "flex", gap: 5, flexWrap: "wrap", alignItems: "center" }}>
                    <span style={badge(partner.status)}>{partner.status}</span>
                    {partner.isClientRecord && (
                      <span style={{ ...badge("pending"), background: accentBg, color: accent }}>Moved Model</span>
                    )}
                  </div>
                </div>

                {partner.email && <p style={{ margin: "0 0 2px", fontSize: 13, color: C.dust }}>{partner.email}</p>}
                {partner.company && <p style={{ margin: "0 0 2px", fontSize: 13, color: C.dust }}>{partner.company}</p>}
                {partner.website && (
                  <p style={{ margin: "0 0 2px", fontSize: 12, color: C.dust }}>
                    <a href={partner.website.startsWith("http") ? partner.website : `https://${partner.website}`} target="_blank" rel="noreferrer" style={{ color: C.slate, textDecoration: "underline", textDecorationColor: C.smoke }}>
                      {partner.website.replace(/^https?:\/\//, "")}
                    </a>
                  </p>
                )}
                {partner.notes && (
                  <p style={{ margin: "4px 0 0", fontSize: 12, color: C.slate, lineHeight: 1.5, whiteSpace: "pre-wrap", maxHeight: 54, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical" }}>
                    {partner.notes}
                  </p>
                )}
              </div>
            </div>

            {/* Footer row */}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12, paddingTop: 10, borderTop: `1px solid ${C.smoke}`, alignItems: "center" }}>
              <span style={{ fontSize: 11, color: C.dust, marginRight: "auto" }}>
                {new Date(partner.submitted_at || partner.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
              </span>
              {canUpload && (
                <button
                  onClick={() => avatarInputRef.current[partner.id]?.click()}
                  style={{ padding: "5px 10px", background: C.ivory, color: C.slate, border: `1px solid ${C.smoke}`, borderRadius: 7, fontSize: 11, fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase", cursor: "pointer", fontFamily: "'Inter',sans-serif" }}
                >
                  {avatarSrc ? "Change Photo" : "Add Photo"}
                </button>
              )}
              {partner.status === "pending" && !partner.isClientRecord && (
                <>
                  <button
                    onClick={() => updateSubmissionStatus(partner.id, "approved")}
                    disabled={isBusy}
                    style={btnS(C.okBg, C.ok, { border: "1px solid rgba(26,102,54,0.2)", opacity: isBusy ? 0.55 : 1, cursor: isBusy ? "not-allowed" : "pointer" })}
                  >
                    {isBusy ? "…" : "✓ Approve"}
                  </button>
                  <button
                    onClick={() => updateSubmissionStatus(partner.id, "rejected")}
                    disabled={isBusy}
                    style={btnS(C.errBg, C.err, { border: "1px solid rgba(155,28,28,0.2)", opacity: isBusy ? 0.55 : 1, cursor: isBusy ? "not-allowed" : "pointer" })}
                  >
                    {isBusy ? "…" : "✕ Reject"}
                  </button>
                </>
              )}
              {partner.status === "approved" && !partner.isClientRecord && (
                <button
                  onClick={() => updateSubmissionStatus(partner.id, "rejected")}
                  disabled={isBusy}
                  style={btnS(C.ivory, C.slate, { border: `1px solid ${C.smoke}`, opacity: isBusy ? 0.55 : 1, cursor: isBusy ? "not-allowed" : "pointer" })}
                >
                  Revoke
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
