import React from "react";
import { supabase } from "../supabase";
import { useAuth } from "../auth";
import { isMissingColumnError } from "../utils";

const STAGES = ["lead", "contacted", "qualified", "proposal_sent", "negotiation", "active", "completed", "inactive"];
const STAGE_LABELS = {
  lead: "Lead",
  contacted: "Contacted",
  qualified: "Qualified",
  proposal_sent: "Proposal Sent",
  negotiation: "Negotiation",
  active: "Active Partner",
  completed: "Completed",
  inactive: "Inactive",
};
const PRIORITY_RANK = { high: 3, medium: 2, low: 1 };

const inferStageFromStatus = (status) => {
  const s = String(status || "").toLowerCase();
  if (s === "active") return "active";
  if (s === "completed") return "completed";
  if (s === "inactive" || s === "churned") return "inactive";
  return "lead";
};

const normalizeStage = (value, status) => (STAGES.includes(value) ? value : inferStageFromStatus(status));
const normalizePriority = (value) => (["high", "medium", "low"].includes(value) ? value : "medium");

export default function PartnerPipeline() {
  const isBrandAmbassadorView = React.useMemo(() => {
    if (typeof window === "undefined") return false;
    return window.location.pathname.startsWith("/brand-ambassador-pipeline");
  }, []);
  const { role } = useAuth();
  const [clients, setClients] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const [actionLoading, setActionLoading] = React.useState({});
  const [pipelineSchemaReady, setPipelineSchemaReady] = React.useState(true);
  const [bannerDismissed, setBannerDismissed] = React.useState(() => {
    try { return localStorage.getItem("cp_banner_dismissed") === "1"; } catch { return false; }
  });
  const [filters, setFilters] = React.useState({ stage: "all", priority: "all", status: "all", sortBy: "recent" });

  const canEditPipeline = role === "admin" || role === "va";

  const PIPELINE_SETUP_SQL = `alter table public.clients
  add column if not exists pipeline_stage text default 'lead',
  add column if not exists priority_level text default 'medium',
  add column if not exists internal_notes text,
  add column if not exists next_step text,
  add column if not exists last_updated timestamptz default now();

update public.clients
set
  pipeline_stage = coalesce(pipeline_stage, 'lead'),
  priority_level = coalesce(priority_level, 'medium'),
  last_updated = coalesce(last_updated, now());

alter table public.clients disable row level security;`;

  const normalizeClient = (row) => ({
    ...row,
    pipeline_stage: normalizeStage(row.pipeline_stage, row.status),
    priority_level: normalizePriority(row.priority_level),
    internal_notes: row.internal_notes || "",
    next_step: row.next_step || "",
    service_type: row.service_type || row.project || "General",
    last_updated: row.last_updated || row.updated_at || row.created_at,
  });

  const fetchClients = async () => {
    try {
      setError("");
      const selectFields = "id, name, email, project, service_type, status, client_value, source, pipeline_stage, priority_level, internal_notes, next_step, last_updated, created_at";
      const { data, error: fetchError } = await supabase
        .from("clients")
        .select(selectFields)
        .order("last_updated", { ascending: false });

      if (fetchError) {
        if (isMissingColumnError(fetchError)) {
          setPipelineSchemaReady(false);
          const fallback = await supabase
            .from("clients")
            .select("id, name, email, project, service_type, status, client_value, source, created_at")
            .order("created_at", { ascending: false });
          if (fallback.error) throw fallback.error;
          setClients((fallback.data || []).map(normalizeClient));
          return;
        }
        throw fetchError;
      }

      setPipelineSchemaReady(true);
      setClients((data || []).map(normalizeClient));
    } catch (err) {
      setError(err.message || "Failed to load partner pipeline");
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    fetchClients();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const updatePartnerPipeline = async (clientId, updates) => {
    if (!canEditPipeline || !pipelineSchemaReady) return;

    setActionLoading((prev) => ({ ...prev, [clientId]: true }));
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const resp = await fetch("/api/partners/update-pipeline", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token || ""}` },
        body: JSON.stringify({ partnerId: clientId, updates: { ...updates, last_updated: new Date().toISOString() } }),
      });

      const json = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(json.error || "Partner pipeline update failed");

      setClients((prev) =>
        prev.map((client) =>
          client.id === clientId
            ? normalizeClient({ ...client, ...updates, last_updated: new Date().toISOString() })
            : client
        )
      );
    } catch (err) {
      setError(err.message || "Failed to update partner");
    } finally {
      setActionLoading((prev) => ({ ...prev, [clientId]: false }));
    }
  };

  const filteredClients = clients
    .filter((client) => (isBrandAmbassadorView ? (client.source || "") === "brand_ambassador" : true))
    .filter((client) => (filters.stage === "all" ? true : client.pipeline_stage === filters.stage))
    .filter((client) => (filters.priority === "all" ? true : client.priority_level === filters.priority))
    .filter((client) => (filters.status === "all" ? true : client.status === filters.status))
    .sort((a, b) => {
      if (filters.sortBy === "priority") {
        return (PRIORITY_RANK[b.priority_level] || 0) - (PRIORITY_RANK[a.priority_level] || 0);
      }
      const aTime = new Date(a.last_updated || 0).getTime();
      const bTime = new Date(b.last_updated || 0).getTime();
      return bTime - aTime;
    });

  const grouped = STAGES.reduce((acc, stage) => {
    acc[stage] = filteredClients.filter((client) => client.pipeline_stage === stage);
    return acc;
  }, {});

  const C = { ink: "#111111", slate: "#4a4a4a", dust: "#888888", smoke: "#e8e4dc", ivory: "#faf8f4", white: "#ffffff", warn: "#92560a", warnBg: "#fef8ec", ok: "#1a6636", okBg: "#edf7ee", err: "#9b1c1c", errBg: "#fef2f2" };
  const accent = isBrandAmbassadorView ? "#0891b2" : C.ink;
  const accentBg = isBrandAmbassadorView ? "rgba(8,145,178,0.08)" : C.ivory;
  const accentMid = isBrandAmbassadorView ? "rgba(8,145,178,0.20)" : C.smoke;
  const sel = { padding: "10px 12px", border: `1px solid ${C.smoke}`, borderRadius: 8, fontSize: 13, background: C.white, color: C.slate, outline: "none", fontFamily: "'Inter',sans-serif", appearance: "none", cursor: "pointer" };
  const ta = { padding: "10px 12px", border: `1px solid ${C.smoke}`, borderRadius: 8, fontSize: 13, background: C.white, color: C.slate, outline: "none", fontFamily: "'Inter',sans-serif", width: "100%", resize: "vertical", minHeight: 64, boxSizing: "border-box" };
  const priorityBadge = { high: [C.errBg, C.err], medium: [C.warnBg, C.warn], low: [C.ivory, C.dust] };

  return (
    <div style={{ padding: "32px 24px", maxWidth: 1300, margin: "0 auto" }}>
      {isBrandAmbassadorView && (
        <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: accentBg, border: `1px solid ${accentMid}`, borderRadius: 99, padding: "4px 12px", marginBottom: 10 }}>
          <span style={{ width: 7, height: 7, borderRadius: "50%", background: accent, display: "inline-block" }} />
          <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: accent }}>Brand Ambassador</span>
        </div>
      )}
      <h1 style={{ fontFamily: "'Cormorant Garamond',Georgia,serif", fontSize: "clamp(26px,4vw,38px)", fontWeight: 500, color: isBrandAmbassadorView ? accent : C.ink, letterSpacing: "-0.02em", margin: "0 0 4px" }}>
        {isBrandAmbassadorView ? "Brand Ambassador Pipeline" : "Partner Pipeline"}
      </h1>
      <p style={{ color: C.dust, marginBottom: 20, fontSize: 13 }}>
        {isBrandAmbassadorView ? "Structured tracking from ambassador lead to active campaign collaborator." : "Structured tracking from lead to retained partner."}
      </p>

      {!pipelineSchemaReady && !bannerDismissed && (
        <div style={{ background: C.warnBg, border: `1px solid rgba(146,86,10,0.2)`, borderRadius: 12, padding: "18px 22px", marginBottom: 24 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
            <p style={{ margin: 0, fontWeight: 600, color: C.warn, fontSize: 14 }}>
              {isBrandAmbassadorView ? "Brand ambassador pipeline fields need one-time database setup" : "Partner pipeline fields need one-time database setup"}
            </p>
            <button onClick={() => { setBannerDismissed(true); try { localStorage.setItem("cp_banner_dismissed", "1"); } catch { /* ignore */ } }} style={{ background: "none", border: "none", cursor: "pointer", color: C.dust, fontSize: 18, lineHeight: 1, padding: "0 0 0 12px", fontFamily: "'Inter',sans-serif" }} title="Dismiss">×</button>
          </div>
          <p style={{ margin: "0 0 10px", color: C.slate, fontSize: 13 }}>
            Run this SQL in the <a href="https://supabase.com/dashboard/project/jjmmakbnjzzxbuflucck/sql/new" target="_blank" rel="noreferrer" style={{ color: C.ink, fontWeight: 600 }}>Supabase SQL Editor ↗</a> then refresh this page.
          </p>
          <pre style={{ background: C.ivory, border: `1px solid ${C.smoke}`, padding: "12px 14px", borderRadius: 8, fontSize: 11, overflowX: "auto", whiteSpace: "pre-wrap", color: C.slate, maxHeight: 180, overflow: "auto" }}>{PIPELINE_SETUP_SQL}</pre>
          <button onClick={() => navigator.clipboard.writeText(PIPELINE_SETUP_SQL)} style={{ marginTop: 10, padding: "9px 16px", background: C.ink, color: C.white, border: "none", borderRadius: 8, fontSize: 12, fontWeight: 600, letterSpacing: "0.07em", textTransform: "uppercase", cursor: "pointer", fontFamily: "'Inter',sans-serif" }}>Copy SQL</button>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 10, marginBottom: 20 }}>
        {[
          { val: filters.stage, opts: [["all", "All Stages"], ...STAGES.map((s) => [s, STAGE_LABELS[s]])], cb: (v) => setFilters((p) => ({ ...p, stage: v })) },
          { val: filters.priority, opts: [["all", "All Priority"], ["high", "High"], ["medium", "Medium"], ["low", "Low"]], cb: (v) => setFilters((p) => ({ ...p, priority: v })) },
          { val: filters.status, opts: [["all", "All Status"], ["lead", "Lead"], ["active", "Active"], ["completed", "Completed"], ["inactive", "Inactive"], ["churned", "Churned"]], cb: (v) => setFilters((p) => ({ ...p, status: v })) },
          { val: filters.sortBy, opts: [["recent", "Most Recent"], ["priority", "Priority"]], cb: (v) => setFilters((p) => ({ ...p, sortBy: v })) },
        ].map((f, i) => (
          <select key={i} value={f.val} onChange={(e) => f.cb(e.target.value)} style={sel}>
            {f.opts.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        ))}
      </div>

      {loading && <p style={{ color: C.dust }}>Loading pipeline…</p>}
      {error && <p style={{ color: C.err, fontSize: 13 }}>{error}</p>}

      {!loading && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", gap: 16 }}>
          {STAGES.map((stage) => (
            <div key={stage} style={{ background: isBrandAmbassadorView ? accentBg : C.ivory, border: `1px solid ${isBrandAmbassadorView ? accentMid : C.smoke}`, borderTop: isBrandAmbassadorView ? `3px solid ${accent}` : `1px solid ${C.smoke}`, borderRadius: 12, padding: 14 }}>
              <p style={{ fontFamily: "'Cormorant Garamond',Georgia,serif", fontSize: 17, fontWeight: 500, color: C.ink, margin: "0 0 12px", letterSpacing: "-0.01em" }}>
                {STAGE_LABELS[stage]} <span style={{ fontSize: 13, color: C.dust, fontFamily: "'Inter',sans-serif", fontWeight: 400 }}>({grouped[stage]?.length || 0})</span>
              </p>

              {(grouped[stage] || []).map((client) => {
                const notesPreview = client.internal_notes || "No notes yet";
                const isBusy = !!actionLoading[client.id];
                const [pbg, pclr] = priorityBadge[client.priority_level] || [C.ivory, C.dust];

                return (
                  <div key={client.id} style={{ background: C.white, border: `1px solid ${C.smoke}`, borderRadius: 10, padding: 12, marginBottom: 10 }}>
                    <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 8 }}>
                      <div style={{ width: 48, height: 48, borderRadius: 8, background: isBrandAmbassadorView ? accentMid : C.ivory, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", color: isBrandAmbassadorView ? accent : C.dust, fontFamily: "'Cormorant Garamond',Georgia,serif", fontSize: 20, fontWeight: 600 }}>
                        {(client.name || "?")[0].toUpperCase()}
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <p style={{ margin: 0, fontWeight: 600, fontSize: 14, color: C.ink }}>{client.name}</p>
                        <p style={{ margin: "2px 0 0", color: C.dust, fontSize: 12 }}>{client.email || "No email"}</p>
                        <p style={{ margin: "2px 0 0", color: C.dust, fontSize: 12 }}>{client.service_type || "General"}</p>
                      </div>
                    </div>

                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                      <span style={{ padding: "3px 9px", borderRadius: 99, background: pbg, color: pclr, fontSize: 10, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase" }}>{client.priority_level}</span>
                    </div>

                    <p style={{ margin: "0 0 10px", color: C.slate, fontSize: 12, lineHeight: 1.5 }}>
                      {String(notesPreview).slice(0, 100)}{String(notesPreview).length > 100 ? "…" : ""}
                    </p>

                    {canEditPipeline && pipelineSchemaReady && (
                      <div style={{ display: "grid", gap: 8 }}>
                        <select value={client.pipeline_stage} onChange={(e) => updatePartnerPipeline(client.id, { pipeline_stage: e.target.value })} disabled={isBusy} style={sel}>
                          {STAGES.map((item) => <option key={item} value={item}>{STAGE_LABELS[item]}</option>)}
                        </select>
                        <select value={client.priority_level} onChange={(e) => updatePartnerPipeline(client.id, { priority_level: e.target.value })} disabled={isBusy} style={sel}>
                          <option value="high">High Priority</option>
                          <option value="medium">Medium Priority</option>
                          <option value="low">Low Priority</option>
                        </select>
                        <textarea
                          value={client.internal_notes || ""}
                          placeholder="Internal notes…"
                          onChange={(e) => setClients((p) => p.map((c) => (c.id === client.id ? { ...c, internal_notes: e.target.value } : c)))}
                          onBlur={() => updatePartnerPipeline(client.id, { internal_notes: client.internal_notes || "" })}
                          disabled={isBusy}
                          style={ta}
                        />
                        <input
                          value={client.next_step || ""}
                          placeholder="Next step…"
                          onChange={(e) => setClients((p) => p.map((c) => (c.id === client.id ? { ...c, next_step: e.target.value } : c)))}
                          onBlur={() => updatePartnerPipeline(client.id, { next_step: client.next_step || "" })}
                          disabled={isBusy}
                          style={{ ...sel, width: "100%", boxSizing: "border-box" }}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
