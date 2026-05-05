import React from "react";
import { supabase } from "../supabase";
import { useAuth } from "../auth";
import { isMissingColumnError } from "../utils";

const EMERGENCY_AMBASSADOR_EMAILS = new Set([
  "kouassibenedicta46@gmail.com",
]);

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
const nextStageOf = (current) => {
  const idx = STAGES.indexOf(current);
  return idx >= 0 && idx < STAGES.length - 1 ? STAGES[idx + 1] : null;
};

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
  const [viewMode, setViewMode] = React.useState("kanban");
  const [bannerDismissed, setBannerDismissed] = React.useState(() => {
    try { return localStorage.getItem("cp_banner_dismissed") === "1"; } catch { return false; }
  });
  const [filters, setFilters] = React.useState({ stage: "all", priority: "all", status: "all", sortBy: "recent" });

  const canEditPipeline = role === "admin" || role === "va";

  const isAmbassadorClient = React.useCallback((item) => {
    const source = String(item?.source || "").toLowerCase();
    const serviceType = String(item?.service_type || "").toLowerCase();
    const project = String(item?.project || "").toLowerCase();
    const notes = String(item?.internal_notes || item?.notes || "").toLowerCase();
    const email = String(item?.email || "").toLowerCase().trim();
    return (
      EMERGENCY_AMBASSADOR_EMAILS.has(email) ||
      source === "brand_ambassador" ||
      serviceType.includes("brand ambassador") ||
      project.includes("brand ambassador") ||
      notes.includes("moved from model")
    );
  }, []);

  const getClientAvatarSrc = React.useCallback((avatarUrl) => {
    const raw = String(avatarUrl || "").trim();
    if (!raw) return "";

    if (/^https?:\/\//i.test(raw)) {
      const signMarker = "/storage/v1/object/sign/";
      const signIndex = raw.indexOf(signMarker);
      if (signIndex >= 0) {
        const signedPath = raw.slice(signIndex + signMarker.length).split("?")[0];
        return `${raw.slice(0, signIndex)}/storage/v1/object/public/${signedPath}`;
      }
      return raw;
    }

    const cleanPath = raw.replace(/^\/+/, "");
    if (!cleanPath) return "";

    const bucketCandidates = ["model-images", "models", "images"];
    if (cleanPath.includes("/")) {
      const [firstSegment, ...rest] = cleanPath.split("/");
      if (bucketCandidates.includes(firstSegment) && rest.length) {
        const fromBucketPath = rest.join("/");
        const { data } = supabase.storage.from(firstSegment).getPublicUrl(fromBucketPath);
        return data?.publicUrl || "";
      }
    }

    const { data } = supabase.storage.from("model-images").getPublicUrl(cleanPath);
    return data?.publicUrl || "";
  }, []);

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
    avatar_url: row.avatar_url || "",
    last_updated: row.last_updated || row.updated_at || row.created_at,
  });

  const fetchClients = async () => {
    try {
      setError("");
      const selectFields = "id, name, email, project, service_type, status, client_value, source, avatar_url, pipeline_stage, priority_level, internal_notes, next_step, last_updated, created_at";
      const { data, error: fetchError } = await supabase
        .from("clients")
        .select(selectFields)
        .order("last_updated", { ascending: false });

      if (fetchError) {
        if (isMissingColumnError(fetchError)) {
          setPipelineSchemaReady(false);
          const fallback = await supabase
            .from("clients")
            .select("id, name, email, project, service_type, status, client_value, source, avatar_url, created_at")
            .order("created_at", { ascending: false });
          if (fallback.error) throw fallback.error;
          setClients((fallback.data || []).map(normalizeClient));
          return;
        }
        throw fetchError;
      }

      setPipelineSchemaReady(true);
      let nextClients = (data || []).map(normalizeClient);

      if (isBrandAmbassadorView) {
        const { data: partnerRows, error: partnerRowsError } = await supabase
          .from("partners")
          .select("id, name, email, company, notes, source, status, created_at, submitted_at")
          .order("created_at", { ascending: false })
          .limit(500);

        if (!partnerRowsError) {
          const synthesized = (partnerRows || [])
            .filter((row) => isAmbassadorClient(row))
            .map((row) => normalizeClient({
              id: `partner-${row.id}`,
              name: row.name || "",
              email: row.email || "",
              project: row.company || "Brand Ambassador",
              service_type: row.company || "Brand Ambassador",
              status: String(row.status || "pending").toLowerCase() === "approved"
                ? "active"
                : String(row.status || "pending").toLowerCase() === "rejected"
                  ? "inactive"
                  : "lead",
              source: "brand_ambassador",
              avatar_url: "",
              pipeline_stage: "lead",
              priority_level: "medium",
              internal_notes: row.notes || "",
              next_step: "",
              created_at: row.created_at || row.submitted_at || new Date().toISOString(),
              last_updated: row.created_at || row.submitted_at || new Date().toISOString(),
            }));

          const deduped = new Set(nextClients.map((row) => String(row.email || "").toLowerCase().trim()).filter(Boolean));
          synthesized.forEach((row) => {
            const key = String(row.email || "").toLowerCase().trim();
            if (key && deduped.has(key)) return;
            if (key) deduped.add(key);
            nextClients.push(row);
          });
        }
      }

      setClients(nextClients);
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

  const scopedClients = clients
    .filter((client) => (isBrandAmbassadorView ? isAmbassadorClient(client) : !isAmbassadorClient(client)));

  const filteredClients = scopedClients
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

  const stageCounts = React.useMemo(
    () => STAGES.reduce((acc, stage) => {
      acc[stage] = scopedClients.filter((client) => client.pipeline_stage === stage).length;
      return acc;
    }, {}),
    [scopedClients]
  );

  const C = { ink: "#111111", slate: "#4a4a4a", dust: "#888888", smoke: "#e8e4dc", ivory: "#faf8f4", white: "#ffffff", warn: "#92560a", warnBg: "#fef8ec", ok: "#1a6636", okBg: "#edf7ee", err: "#9b1c1c", errBg: "#fef2f2" };
  const accent = C.ink;
  const accentBg = C.ivory;
  const accentMid = C.smoke;
  const sel = { padding: "10px 12px", border: `1px solid ${C.smoke}`, borderRadius: 8, fontSize: 13, background: C.white, color: C.slate, outline: "none", fontFamily: "'Inter',sans-serif", appearance: "none", cursor: "pointer" };
  const ta = { padding: "10px 12px", border: `1px solid ${C.smoke}`, borderRadius: 8, fontSize: 13, background: C.white, color: C.slate, outline: "none", fontFamily: "'Inter',sans-serif", width: "100%", resize: "vertical", minHeight: 64, boxSizing: "border-box" };
  const priorityBadge = { high: [C.errBg, C.err], medium: [C.warnBg, C.warn], low: [C.ivory, C.dust] };

  return (
    <div style={{ padding: "32px 24px", maxWidth: 1300, margin: "0 auto" }}>
      <h1 style={{ fontFamily: "'Cormorant Garamond',Georgia,serif", fontSize: "clamp(26px,4vw,38px)", fontWeight: 500, color: C.ink, letterSpacing: "-0.02em", margin: "0 0 4px" }}>
        {isBrandAmbassadorView ? "Brand Ambassador Pipeline" : "Partner Pipeline"}
      </h1>
      <p style={{ color: C.dust, marginBottom: 20, fontSize: 13 }}>
        {isBrandAmbassadorView ? "Structured tracking from ambassador lead to active campaign collaborator." : "Structured tracking from lead to retained partner."}
      </p>

      {!loading && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14 }}>
          {STAGES.map((stage) => {
            const isActive = filters.stage === stage;
            return (
              <button
                key={stage}
                onClick={() => setFilters((prev) => ({ ...prev, stage: isActive ? "all" : stage }))}
                style={{
                  padding: "5px 12px",
                  borderRadius: 99,
                  border: `1px solid ${isActive ? C.ink : C.smoke}`,
                  background: isActive ? C.ink : C.white,
                  color: isActive ? C.white : C.slate,
                  fontSize: 11,
                  fontWeight: 600,
                  cursor: "pointer",
                  fontFamily: "'Inter',sans-serif",
                  whiteSpace: "nowrap",
                }}
              >
                {STAGE_LABELS[stage]}{stageCounts[stage] > 0 ? ` · ${stageCounts[stage]}` : ""}
              </button>
            );
          })}
          {filters.stage !== "all" && (
            <button
              onClick={() => setFilters((prev) => ({ ...prev, stage: "all" }))}
              style={{ padding: "5px 12px", borderRadius: 99, border: `1px solid ${C.smoke}`, background: C.ivory, color: C.slate, fontSize: 11, cursor: "pointer", fontFamily: "'Inter',sans-serif" }}
            >
              All ×
            </button>
          )}
        </div>
      )}

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

      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 10 }}>
        {["kanban", "grid"].map((mode) => (
          <button
            key={mode}
            onClick={() => setViewMode(mode)}
            style={{
              padding: "7px 14px",
              background: viewMode === mode ? C.ink : C.white,
              color: viewMode === mode ? C.white : C.slate,
              border: `1px solid ${C.smoke}`,
              borderRadius: mode === "kanban" ? "8px 0 0 8px" : "0 8px 8px 0",
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
              fontFamily: "'Inter',sans-serif",
              letterSpacing: "0.04em",
              lineHeight: 1,
            }}
          >
            {mode === "kanban" ? "⊞ Kanban" : "≡ List"}
          </button>
        ))}
      </div>

      {loading && <p style={{ color: C.dust }}>Loading pipeline…</p>}
      {error && <p style={{ color: C.err, fontSize: 13 }}>{error}</p>}

      {!loading && (
        <div style={viewMode === "kanban" ? { display: "flex", gap: 16, overflowX: "auto", paddingBottom: 16, alignItems: "flex-start" } : { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", gap: 16 }}>
          {STAGES.map((stage) => (
            <div key={stage} style={{ background: C.ivory, border: `1px solid ${C.smoke}`, borderRadius: 12, padding: 14, ...(viewMode === "kanban" ? { flex: "0 0 280px", maxHeight: "78vh", overflowY: "auto" } : {}) }}>
              <p style={{ fontFamily: "'Cormorant Garamond',Georgia,serif", fontSize: 17, fontWeight: 500, color: C.ink, margin: "0 0 12px", letterSpacing: "-0.01em" }}>
                {STAGE_LABELS[stage]} <span style={{ fontSize: 13, color: C.dust, fontFamily: "'Inter',sans-serif", fontWeight: 400 }}>({grouped[stage]?.length || 0})</span>
              </p>

              {(grouped[stage] || []).map((client) => {
                const notesPreview = client.internal_notes || "No notes yet";
                const isBusy = !!actionLoading[client.id];
                const [pbg, pclr] = priorityBadge[client.priority_level] || [C.ivory, C.dust];
                const avatarSrc = getClientAvatarSrc(client.avatar_url);

                return (
                  <div key={client.id} style={{ background: C.white, border: `1px solid ${C.smoke}`, borderRadius: 10, padding: 12, marginBottom: 10 }}>
                    <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 8 }}>
                      {avatarSrc ? (
                        <img src={avatarSrc} alt={client.name} loading="lazy" decoding="async" style={{ width: 48, height: 48, borderRadius: 8, objectFit: "cover", flexShrink: 0, border: `1px solid ${C.smoke}` }} />
                      ) : (
                        <div style={{ width: 48, height: 48, borderRadius: 8, background: C.ivory, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", color: C.dust, fontFamily: "'Cormorant Garamond',Georgia,serif", fontSize: 20, fontWeight: 600 }}>
                          {(client.name || "?")[0].toUpperCase()}
                        </div>
                      )}
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

                    {canEditPipeline && pipelineSchemaReady && nextStageOf(client.pipeline_stage) && (
                      <button
                        onClick={() => updatePartnerPipeline(client.id, { pipeline_stage: nextStageOf(client.pipeline_stage) })}
                        disabled={isBusy}
                        style={{ width: "100%", marginBottom: 8, padding: "10px", background: C.ink, color: "#ffffff", border: "none", borderRadius: 7, fontSize: 12, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", cursor: isBusy ? "not-allowed" : "pointer", fontFamily: "'Inter',sans-serif", opacity: isBusy ? 0.6 : 1 }}
                      >
                        {`→ ${STAGE_LABELS[nextStageOf(client.pipeline_stage)]}`}
                      </button>
                    )}

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
