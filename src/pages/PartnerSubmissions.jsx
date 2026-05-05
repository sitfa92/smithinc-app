import React from "react";
import { supabase } from "../supabase";
import { createInAppAlerts, sendInternalTeamEmailAlert } from "../utils";

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
  const [statusFilter, setStatusFilter] = React.useState("active");
  const [sourceFilter, setSourceFilter] = React.useState(() => (isBrandAmbassadorView ? "brand_ambassador" : "all"));
  const showSourceFilter = !isBrandAmbassadorView;
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
    return (
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

  const fetchSubmissions = async () => {
    try {
      setError("");
      const headers = await getAuthHeaders();
      const resp = await fetch("/api/partners/admin-submissions", { headers });
      const json = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        if (json.code === "TABLE_SETUP_REQUIRED") {
          setTableReady(false);
          setSubmissions([]);
          return;
        }
        throw new Error(json.error || "Failed to load partner submissions");
      }

      setTableReady(true);
      let nextRows = json.data || [];

      if (isBrandAmbassadorView) {
        const { data: ambassadorClients, error: ambassadorClientsError } = await supabase
          .from("clients")
          .select("id, name, email, project, service_type, source, status, internal_notes, created_at")
          .order("created_at", { ascending: false })
          .limit(500);

        if (!ambassadorClientsError) {
          const synthesized = (ambassadorClients || [])
            .filter((item) => isAmbassadorSubmission(item))
            .map((item) => ({
              id: `client-${item.id}`,
              name: item.name,
              email: item.email,
              company: item.project || item.service_type || "Brand Ambassador",
              website: "",
              notes: item.internal_notes || "Moved from model flow",
              source: "brand_ambassador",
              status: ["inactive", "churned", "rejected"].includes(String(item.status || "").toLowerCase())
                ? "rejected"
                : ["active", "completed", "approved"].includes(String(item.status || "").toLowerCase())
                  ? "approved"
                  : "pending",
              submitted_at: item.created_at,
              created_at: item.created_at,
              isClientRecord: true,
            }));

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
      }

      setSubmissions(nextRows);
    } catch (err) {
      if (isTableMissingError(err)) {
        setTableReady(false);
        setSubmissions([]);
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

  const pendingCount = React.useMemo(() => submissions.filter((s) => s.status === "pending").length, [submissions]);
  const approvedCount = React.useMemo(() => submissions.filter((s) => s.status === "approved").length, [submissions]);
  const metrics = React.useMemo(
    () => [
      { label: isBrandAmbassadorView ? "Total Applications" : "Total Submissions", value: submissions.length },
      { label: "Pending", value: pendingCount },
      { label: "Approved", value: approvedCount },
    ],
    [isBrandAmbassadorView, submissions.length, pendingCount, approvedCount]
  );

  const C = { ink: "#111111", slate: "#4a4a4a", dust: "#888888", smoke: "#e8e4dc", ivory: "#faf8f4", white: "#ffffff", err: "#9b1c1c", warn: "#92560a", ok: "#1a6636", okBg: "#edf7ee", warnBg: "#fef8ec", errBg: "#fef2f2" };
  const accent = isBrandAmbassadorView ? "#0891b2" : C.ink;
  const accentBg = isBrandAmbassadorView ? "rgba(8,145,178,0.08)" : "transparent";
  const accentMid = isBrandAmbassadorView ? "rgba(8,145,178,0.18)" : C.smoke;
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
          {isBrandAmbassadorView && (
            <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: accentBg, border: `1px solid ${accentMid}`, borderRadius: 99, padding: "4px 12px", marginBottom: 10 }}>
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: accent, display: "inline-block" }} />
              <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: accent }}>Brand Ambassador</span>
            </div>
          )}
          <h1 style={{ fontFamily: "'Cormorant Garamond',Georgia,serif", fontSize: "clamp(26px,4vw,38px)", fontWeight: 500, color: isBrandAmbassadorView ? accent : C.ink, letterSpacing: "-0.02em", margin: "0 0 4px" }}>
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
        </div>
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(130px,1fr))", gap:12, marginBottom:24 }}>
        {metrics.map((m) => (
          <div key={m.label} style={{ background:C.white, border:`1px solid ${C.smoke}`, borderRadius:12, padding:18, boxShadow:"0 1px 4px rgba(17,17,17,0.04)" }}>
            <p style={{ margin:"0 0 4px", fontSize:11, fontWeight:600, letterSpacing:"0.1em", textTransform:"uppercase", color:C.dust }}>{m.label}</p>
            <p style={{ margin:0, fontFamily:"'Cormorant Garamond',Georgia,serif", fontSize:32, fontWeight:500, color:C.ink, lineHeight:1 }}>{m.value}</p>
          </div>
        ))}
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
        <div style={{ background: C.white, border: `1px solid ${isBrandAmbassadorView ? accentMid : C.smoke}`, borderTop: isBrandAmbassadorView ? `3px solid ${accent}` : `1px solid ${C.smoke}`, borderRadius: 12, padding: "22px 22px", marginBottom: 24, boxShadow: "0 1px 4px rgba(17,17,17,0.04)" }}>
          <p style={{ fontFamily: "'Cormorant Garamond',Georgia,serif", fontSize: 18, fontWeight: 500, color: isBrandAmbassadorView ? accent : C.ink, margin: "0 0 14px" }}>
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
        return (
          <div key={partner.id} style={{ display:"flex", gap:18, padding:18, marginBottom:16, border:`1px solid ${isBrandAmbassadorView ? accentMid : C.smoke}`, borderRadius:12, background:C.white, boxShadow:"0 1px 4px rgba(17,17,17,0.04)", flexWrap:"wrap" }}>
            <div style={{ flex:"0 0 120px", minWidth:0 }}>
              <div style={{ width:"100%", height:150, borderRadius:10, border:`1px solid ${C.smoke}`, background:isBrandAmbassadorView ? accentBg : C.ivory, color:isBrandAmbassadorView ? accent : C.dust, display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"'Cormorant Garamond',Georgia,serif", fontSize:30 }}>
                {initials || "?"}
              </div>
            </div>
            <div style={{ flex:1, minWidth:220 }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", flexWrap:"wrap", gap:8, marginBottom:8 }}>
                <h3 style={{ margin:0, fontSize:17, fontWeight:600, color:C.ink }}>{partner.name}</h3>
                <div style={{ display:"flex", gap:6, alignItems:"center", flexWrap:"wrap" }}>
                  <span style={badge(partner.status)}>{partner.status}</span>
                  <span style={{ ...badge("pending"), background:C.ivory, color:C.dust }}>{partner.source || "manual"}</span>
                  {partner.isClientRecord && (
                    <span style={{ ...badge("pending"), background:accentBg, color:accent }}>Moved Model</span>
                  )}
                </div>
              </div>
              <p style={{ margin:"0 0 3px", color:C.dust, fontSize:13 }}>{partner.email}</p>
              {partner.company && <p style={{ margin:"0 0 3px", color:C.dust, fontSize:13 }}>{partner.company}</p>}
              {partner.website && <p style={{ margin:"0 0 6px", color:C.dust, fontSize:13 }}>{partner.website}</p>}
              {partner.notes && <p style={{ margin:"0 0 10px", color:C.slate, fontSize:13, lineHeight:1.6, whiteSpace:"pre-wrap" }}>{partner.notes}</p>}
              <p style={{ margin:"0 0 14px", color:C.dust, fontSize:12 }}>Submitted: {new Date(partner.submitted_at || partner.created_at).toLocaleString()}</p>

              {partner.status === "pending" && !partner.isClientRecord && (
                <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
                  <button
                    onClick={() => updateSubmissionStatus(partner.id, "approved")}
                    disabled={actionLoading[partner.id]}
                    style={btnS(C.okBg, C.ok, { border:"1px solid rgba(26,102,54,0.2)", opacity:actionLoading[partner.id] ? 0.55 : 1, cursor:actionLoading[partner.id] ? "not-allowed" : "pointer" })}
                  >
                    {actionLoading[partner.id] ? "…" : "✓ Approve"}
                  </button>
                  <button
                    onClick={() => updateSubmissionStatus(partner.id, "rejected")}
                    disabled={actionLoading[partner.id]}
                    style={btnS(C.errBg, C.err, { border:"1px solid rgba(155,28,28,0.2)", opacity:actionLoading[partner.id] ? 0.55 : 1, cursor:actionLoading[partner.id] ? "not-allowed" : "pointer" })}
                  >
                    {actionLoading[partner.id] ? "…" : "✕ Reject"}
                  </button>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
