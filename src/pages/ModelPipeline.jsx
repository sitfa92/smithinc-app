import React from "react";
import { supabase } from "../supabase";
import { useAuth } from "../auth";
import {
  PIPELINE_STAGES,
  PIPELINE_STAGE_LABELS,
  PRIORITY_RANK,
  normalizePipelineStage,
  normalizePriorityLevel,
  isMissingColumnError,
} from "../utils";

export default function ModelPipeline() {
  const { role } = useAuth();
  const [models, setModels] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const [actionLoading, setActionLoading] = React.useState({});
  const [moveLoading, setMoveLoading] = React.useState({});
  const [movedToBrandAmbassador, setMovedToBrandAmbassador] = React.useState({});
  const [pipelineSchemaReady, setPipelineSchemaReady] = React.useState(true);
  const [advanceLoading, setAdvanceLoading] = React.useState({});
  const [copiedField, setCopiedField] = React.useState({});
  const [viewMode, setViewMode] = React.useState("kanban");
  const [filters, setFilters] = React.useState({
    stage: "all",
    priority: "all",
    status: "all",
    champ: "all",
    sortBy: "recent",
  });

  const canEditPipeline = role === "admin" || role === "agent" || role === "va";
  const canMoveToBrandAmbassador = role === "admin" || role === "agent" || role === "va";
  const visibleStages = PIPELINE_STAGES;
  const CHAMP_FIELDS = [
    { letter: "C", label: "Challenges", scoreKey: "champ_c_score", notesKey: "champ_c_notes" },
    { letter: "H", label: "Authority", scoreKey: "champ_h_score", notesKey: "champ_h_notes" },
    { letter: "M", label: "Money", scoreKey: "champ_m_score", notesKey: "champ_m_notes" },
    { letter: "P", label: "Priority", scoreKey: "champ_p_score", notesKey: "champ_p_notes" },
  ];

  const getChampTotal = (model) =>
    Number(model.champ_c_score || 0) +
    Number(model.champ_h_score || 0) +
    Number(model.champ_m_score || 0) +
    Number(model.champ_p_score || 0);

  const getChampRecommendation = (total) => {
    if (total >= 9) return "sign_now";
    if (total >= 6) return "nurture";
    return "decline";
  };
  const getModelChampRecommendation = (model) =>
    model.champ_recommendation || getChampRecommendation(Number(model.champ_total || getChampTotal(model)));

  const PIPELINE_STAGES_FORWARD = PIPELINE_STAGES.filter(s => s !== "rejected");
  const nextStageOf = (current) => {
    const idx = PIPELINE_STAGES_FORWARD.indexOf(current);
    return idx >= 0 && idx < PIPELINE_STAGES_FORWARD.length - 1 ? PIPELINE_STAGES_FORWARD[idx + 1] : null;
  };
  const staleDays = (ts) => {
    if (!ts) return null;
    return Math.floor((Date.now() - new Date(ts).getTime()) / 86400000);
  };
  const copyField = (key, text) => {
    navigator.clipboard.writeText(text || "").then(() => {
      setCopiedField(prev => ({ ...prev, [key]: true }));
      setTimeout(() => setCopiedField(prev => ({ ...prev, [key]: false })), 2000);
    });
  };

  const NEXT_ACTION_TEMPLATES = {
    submitted:      { label: "Request Digitals",        template: (n) => `Hi ${n}, thank you for applying to SmithInc. The Fashion Agency. To move your application forward, please send your digital photos — full length, close-up, and profile — along with your current measurements (height, bust, waist, hips, shoe size, and location).` },
    reviewing:      { label: "Request Measurements",    template: (n) => `Hi ${n}, we are reviewing your profile at SmithInc. Please send your current measurements: height, bust, waist, hips, shoe size, and location so we can continue.` },
    development:    { label: "Book Evaluation Call",    template: (n) => `Hi ${n}, we would like to schedule a brief evaluation call to discuss next steps. Please reply with your availability and we will confirm a time.` },
    digitals_pending: { label: "Follow Up on Digitals", template: (n) => `Hi ${n}, we are still waiting on your digital photos. Please send them at your earliest convenience so we can continue reviewing your application.` },
    ready_to_pitch: { label: "Confirm Availability",   template: (n) => `Hi ${n}, your profile is ready to be presented. Please confirm your measurements and current availability are up to date so we can move forward.` },
    pitched:        { label: "Pitch Follow-Up",         template: (n) => `Hi ${n}, your profile has been submitted to our network. We will be in touch as soon as we receive a response. Thank you for your patience.` },
    in_talks:       { label: "Request Contract Info",   template: (n) => `Hi ${n}, we have a positive update on your application. Please reach out so we can discuss next steps toward signing.` },
    signed:         { label: "Welcome Message",         template: (n) => `Hi ${n}, welcome to SmithInc. The Fashion Agency. We are pleased to confirm your signing. Our team will be in touch shortly with your onboarding details.` },
  };

  const PIPELINE_SETUP_SQL = `alter table public.models
  add column if not exists pipeline_stage text default 'submitted',
  add column if not exists agency_name text,
  add column if not exists scouting_notes text,
  add column if not exists internal_notes text,
  add column if not exists priority_level text default 'medium',
  add column if not exists last_updated timestamptz default now(),
  add column if not exists source text,
  add column if not exists champ_c_score integer default 0,
  add column if not exists champ_h_score integer default 0,
  add column if not exists champ_m_score integer default 0,
  add column if not exists champ_p_score integer default 0,
  add column if not exists champ_c_notes text,
  add column if not exists champ_h_notes text,
  add column if not exists champ_m_notes text,
  add column if not exists champ_p_notes text,
  add column if not exists champ_total integer default 0,
  add column if not exists champ_recommendation text default 'nurture';

alter table public.bookings
  add column if not exists source text;

update public.models
set
  pipeline_stage = coalesce(pipeline_stage, 'submitted'),
  priority_level = coalesce(priority_level, 'medium'),
  last_updated = coalesce(last_updated, now());

alter table public.models disable row level security;`;

  const normalizeModel = (row) => ({
    ...row,
    pipeline_stage: normalizePipelineStage(row.pipeline_stage),
    priority_level: normalizePriorityLevel(row.priority_level),
    scouting_notes: row.scouting_notes || "",
    internal_notes: row.internal_notes || "",
    agency_name: row.agency_name || "",
    last_updated: row.last_updated || row.updated_at || row.submitted_at || row.created_at,
    champ_c_score: Number(row.champ_c_score || 0),
    champ_h_score: Number(row.champ_h_score || 0),
    champ_m_score: Number(row.champ_m_score || 0),
    champ_p_score: Number(row.champ_p_score || 0),
    champ_c_notes: row.champ_c_notes || "",
    champ_h_notes: row.champ_h_notes || "",
    champ_m_notes: row.champ_m_notes || "",
    champ_p_notes: row.champ_p_notes || "",
    champ_total: Number(row.champ_total || 0),
    champ_recommendation: row.champ_recommendation || "nurture",
  });

  const fetchModels = async () => {
    try {
      setError("");
      const selectFields = "id, name, email, instagram, image_url, status, submitted_at, created_at, pipeline_stage, agency_name, scouting_notes, internal_notes, priority_level, last_updated, source, champ_c_score, champ_h_score, champ_m_score, champ_p_score, champ_c_notes, champ_h_notes, champ_m_notes, champ_p_notes, champ_total, champ_recommendation";
      const { data, error: fetchError } = await supabase
        .from("models")
        .select(selectFields)
        .order("last_updated", { ascending: false });

      if (fetchError) {
        if (isMissingColumnError(fetchError)) {
          setPipelineSchemaReady(false);
          const fallback = await supabase
            .from("models")
            .select("*")
            .order("submitted_at", { ascending: false });
          if (fallback.error) throw fallback.error;
          setModels((fallback.data || []).map(normalizeModel));
          return;
        }
        throw fetchError;
      }

      setPipelineSchemaReady(true);
      setModels((data || []).map(normalizeModel));
    } catch (err) {
      setError(err.message || "Failed to load model pipeline");
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    fetchModels();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const moveToBrandAmbassador = async (model) => {
    if (!canMoveToBrandAmbassador || !model?.id) return;
    if (!window.confirm(`Move ${model.name || "this model"} to Brand Ambassador management?`)) return;

    setMoveLoading((prev) => ({ ...prev, [model.id]: true }));
    setError("");
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const resp = await fetch("/api/models/move-to-brand-ambassador", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token || ""}` },
        body: JSON.stringify({ modelId: model.id }),
      });

      const json = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        throw new Error(json.error || "Failed to move model to brand ambassador");
      }

      setMovedToBrandAmbassador((prev) => ({ ...prev, [model.id]: true }));
    } catch (err) {
      setError(err.message || "Failed to move model to brand ambassador");
    } finally {
      setMoveLoading((prev) => ({ ...prev, [model.id]: false }));
    }
  };

  const updateModelPipeline = async (modelId, updates) => {
    if (!canEditPipeline || !pipelineSchemaReady) return;

    setActionLoading((prev) => ({ ...prev, [modelId]: true }));
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const resp = await fetch("/api/models/update-pipeline", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token || ""}` },
        body: JSON.stringify({
          modelId,
          updates: { ...updates, last_updated: new Date().toISOString() },
        }),
      });

      const json = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        throw new Error(json.error || "Pipeline update failed");
      }

      setModels((prev) =>
        prev.map((model) =>
          model.id === modelId
            ? normalizeModel({ ...model, ...updates, last_updated: new Date().toISOString() })
            : model
        )
      );
    } catch (err) {
      setError(err.message || "Failed to update model");
    } finally {
      setActionLoading((prev) => ({ ...prev, [modelId]: false }));
    }
  };

  const updateChamp = async (model, patch) => {
    const merged = { ...model, ...patch };
    const champ_total = getChampTotal(merged);
    const champ_recommendation = getChampRecommendation(champ_total);
    await updateModelPipeline(model.id, { ...patch, champ_total, champ_recommendation });
  };

  const applyChampPreset = async (model, preset) => {
    const scoresByPreset = {
      strong: { champ_c_score: 3, champ_h_score: 3, champ_m_score: 2, champ_p_score: 3 },
      nurture: { champ_c_score: 2, champ_h_score: 2, champ_m_score: 2, champ_p_score: 2 },
      decline: { champ_c_score: 1, champ_h_score: 1, champ_m_score: 0, champ_p_score: 1 },
    };
    const scorePatch = scoresByPreset[preset] || scoresByPreset.nurture;
    setModels((prev) => prev.map((m) => (m.id === model.id ? { ...m, ...scorePatch } : m)));
    await updateChamp(model, scorePatch);
  };

  const advanceStage = async (model) => {
    const next = nextStageOf(model.pipeline_stage);
    if (!next || !canEditPipeline || !pipelineSchemaReady) return;
    if (!window.confirm(`Move "${model.name || "this model"}" to ${PIPELINE_STAGE_LABELS[next]}?`)) return;
    setAdvanceLoading(prev => ({ ...prev, [model.id]: true }));
    await updateModelPipeline(model.id, { pipeline_stage: next });
    setAdvanceLoading(prev => ({ ...prev, [model.id]: false }));
  };

  const filteredModels = models
    .filter((model) => (filters.stage === "all" ? true : model.pipeline_stage === filters.stage))
    .filter((model) => (filters.priority === "all" ? true : model.priority_level === filters.priority))
    .filter((model) => (filters.status === "all" ? true : model.status === filters.status))
    .filter((model) => (filters.champ === "all" ? true : getModelChampRecommendation(model) === filters.champ))
    .sort((a, b) => {
      if (filters.sortBy === "priority") {
        return (PRIORITY_RANK[b.priority_level] || 0) - (PRIORITY_RANK[a.priority_level] || 0);
      }
      const aTime = new Date(a.last_updated || 0).getTime();
      const bTime = new Date(b.last_updated || 0).getTime();
      return bTime - aTime;
    });

  const grouped = visibleStages.reduce((acc, stage) => {
    acc[stage] = filteredModels.filter((model) => model.pipeline_stage === stage);
    return acc;
  }, {});

  const C = { ink:"#111111", slate:"#4a4a4a", dust:"#888888", smoke:"#e8e4dc", ivory:"#faf8f4", white:"#ffffff", warn:"#92560a", warnBg:"#fef8ec", ok:"#1a6636", okBg:"#edf7ee", err:"#9b1c1c", errBg:"#fef2f2" };
  const sel = { padding:"10px 12px", border:`1px solid ${C.smoke}`, borderRadius:8, fontSize:13, background:C.white, color:C.slate, outline:"none", fontFamily:"'Inter',sans-serif", appearance:"none", cursor:"pointer" };
  const ta = { padding:"10px 12px", border:`1px solid ${C.smoke}`, borderRadius:8, fontSize:13, background:C.white, color:C.slate, outline:"none", fontFamily:"'Inter',sans-serif", width:"100%", resize:"vertical", minHeight:64, boxSizing:"border-box" };
  const priorityBadge = { high:[C.errBg,C.err], medium:[C.warnBg,C.warn], low:[C.ivory,C.dust] };

  return (
    <div style={{ padding:"32px 24px", maxWidth:1300, margin:"0 auto" }}>
      <h1 style={{ fontFamily:"'Cormorant Garamond',Georgia,serif", fontSize:"clamp(26px,4vw,38px)", fontWeight:500, color:C.ink, letterSpacing:"-0.02em", margin:"0 0 4px" }}>
        Model Pipeline
      </h1>
      <p style={{ color:C.dust, marginBottom:16, fontSize:13 }}>Structured tracking from first submission to agency signing.</p>

      {/* Stage tally bar */}
      {!loading && (
        <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginBottom:14 }}>
          {PIPELINE_STAGES.map(stage => {
            const cnt = models.filter(m => m.pipeline_stage === stage).length;
            const isActive = filters.stage === stage;
            return (
              <button key={stage} onClick={() => setFilters(p => ({...p, stage: isActive ? "all" : stage}))}
                style={{ padding:"5px 12px", borderRadius:99, border:`1px solid ${isActive ? C.ink : C.smoke}`, background: isActive ? C.ink : C.white, color: isActive ? C.white : C.slate, fontSize:11, fontWeight:600, cursor:"pointer", fontFamily:"'Inter',sans-serif", whiteSpace:"nowrap" }}>
                {PIPELINE_STAGE_LABELS[stage]}{cnt > 0 ? ` · ${cnt}` : ""}
              </button>
            );
          })}
          {filters.stage !== "all" && (
            <button onClick={() => setFilters(p => ({...p, stage:"all"}))} style={{ padding:"5px 12px", borderRadius:99, border:`1px solid ${C.smoke}`, background:C.ivory, color:C.slate, fontSize:11, cursor:"pointer", fontFamily:"'Inter',sans-serif" }}>All ×</button>
          )}
        </div>
      )}

      {!loading && (
        <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginBottom:14 }}>
          {[
            ["all", "All CHAMP"],
            ["sign_now", "Sign now"],
            ["nurture", "Nurture"],
            ["decline", "Decline"],
          ].map(([value, label]) => {
            const count = value === "all" ? models.length : models.filter((m) => getModelChampRecommendation(m) === value).length;
            const isActive = filters.champ === value;
            return (
              <button
                key={value}
                onClick={() => setFilters((p) => ({ ...p, champ: value }))}
                style={{
                  padding:"5px 12px",
                  borderRadius:99,
                  border:`1px solid ${isActive ? C.ink : C.smoke}`,
                  background:isActive ? C.ink : C.white,
                  color:isActive ? C.white : C.slate,
                  fontSize:11,
                  fontWeight:600,
                  cursor:"pointer",
                  fontFamily:"'Inter',sans-serif",
                  whiteSpace:"nowrap",
                }}
              >
                {label}{count > 0 ? ` · ${count}` : ""}
              </button>
            );
          })}
        </div>
      )}

      {!pipelineSchemaReady && (
        <div style={{ background:C.warnBg, border:`1px solid rgba(146,86,10,0.2)`, borderRadius:12, padding:"18px 22px", marginBottom:24 }}>
          <p style={{ margin:"0 0 6px", fontWeight:600, color:C.warn, fontSize:14 }}>Pipeline fields need one-time database setup</p>
          <p style={{ margin:"0 0 10px", color:C.slate, fontSize:13 }}>
            Run this SQL in the{" "}
            <a href="https://supabase.com/dashboard/project/jjmmakbnjzzxbuflucck/sql" target="_blank" rel="noreferrer" style={{ color:C.ink }}>Supabase SQL Editor</a>.
          </p>
          <pre style={{ background:C.ivory, border:`1px solid ${C.smoke}`, padding:"12px 14px", borderRadius:8, fontSize:11, overflowX:"auto", whiteSpace:"pre-wrap", color:C.slate, maxHeight:180, overflow:"auto" }}>{PIPELINE_SETUP_SQL}</pre>
          <button onClick={()=>navigator.clipboard.writeText(PIPELINE_SETUP_SQL)} style={{ marginTop:10, padding:"9px 16px", background:C.ink, color:C.white, border:"none", borderRadius:8, fontSize:12, fontWeight:600, letterSpacing:"0.07em", textTransform:"uppercase", cursor:"pointer", fontFamily:"'Inter',sans-serif" }}>Copy SQL</button>
        </div>
      )}

      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))", gap:10, marginBottom:20 }}>
        {[
          { val:filters.stage, opts:[["all","All Stages"],...PIPELINE_STAGES.map(s=>[s,PIPELINE_STAGE_LABELS[s]])], cb:(v)=>setFilters(p=>({...p,stage:v})) },
          { val:filters.priority, opts:[["all","All Priority"],["high","High"],["medium","Medium"],["low","Low"]], cb:(v)=>setFilters(p=>({...p,priority:v})) },
          { val:filters.status, opts:[["all","All Status"],["pending","Pending"],["approved","Approved"],["rejected","Rejected"]], cb:(v)=>setFilters(p=>({...p,status:v})) },
          { val:filters.sortBy, opts:[["recent","Most Recent"],["priority","Priority"]], cb:(v)=>setFilters(p=>({...p,sortBy:v})) },
        ].map((f,i) => (
          <select key={i} value={f.val} onChange={(e)=>f.cb(e.target.value)} style={sel}>
            {f.opts.map(([v,l])=><option key={v} value={v}>{l}</option>)}
          </select>
        ))}
      </div>

      <div style={{ display:"flex", justifyContent:"flex-end", marginBottom:10 }}>
        {["kanban","grid"].map(mode => (
          <button key={mode} onClick={() => setViewMode(mode)}
            style={{ padding:"7px 14px", background: viewMode === mode ? C.ink : C.white, color: viewMode === mode ? C.white : C.slate, border:`1px solid ${C.smoke}`, borderRadius: mode === "kanban" ? "8px 0 0 8px" : "0 8px 8px 0", fontSize:12, fontWeight:600, cursor:"pointer", fontFamily:"'Inter',sans-serif", letterSpacing:"0.04em", lineHeight:1 }}>
            {mode === "kanban" ? "⊞ Kanban" : "≡ List"}
          </button>
        ))}
      </div>

      {loading && <p style={{ color:C.dust }}>Loading pipeline…</p>}
      {error && <p style={{ color:C.err, fontSize:13 }}>{error}</p>}

      {!loading && (
        <div style={ viewMode === "kanban" ? { display:"flex", gap:16, overflowX:"auto", paddingBottom:16, alignItems:"flex-start" } : { display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(280px,1fr))", gap:16 } }>
          {visibleStages.map(stage => (
            <div key={stage} style={{ background:C.ivory, border:`1px solid ${C.smoke}`, borderRadius:12, padding:14, ...(viewMode === "kanban" ? { flex:"0 0 280px", maxHeight:"78vh", overflowY:"auto" } : {}) }}>
              <p style={{ fontFamily:"'Cormorant Garamond',Georgia,serif", fontSize:17, fontWeight:500, color:C.ink, margin:"0 0 12px", letterSpacing:"-0.01em" }}>
                {PIPELINE_STAGE_LABELS[stage]}{" "}
                <span style={{ fontSize:13, color:C.dust, fontFamily:"'Inter',sans-serif", fontWeight:400 }}>({grouped[stage]?.length || 0})</span>
              </p>
              {(grouped[stage] || []).map(model => {
                const notesPreview = model.scouting_notes || model.internal_notes || "No notes yet";
                const isBusy = !!actionLoading[model.id];
                const [pbg,pclr] = priorityBadge[model.priority_level] || [C.ivory,C.dust];
                const champTotal = Number(model.champ_total || getChampTotal(model));
                const champRec = getModelChampRecommendation(model);
                const champTone = champRec === "sign_now"
                  ? [C.okBg, C.ok, "Sign now"]
                  : champRec === "decline"
                    ? [C.errBg, C.err, "Decline"]
                    : [C.warnBg, C.warn, "Nurture"];
                return (
                  <div key={model.id} style={{ background:C.white, border:`1px solid ${C.smoke}`, borderRadius:10, padding:12, marginBottom:10 }}>
                    <div style={{ display:"flex", gap:10, alignItems:"center", marginBottom:8 }}>
                      {model.image_url
                        ? <img src={model.image_url} alt={model.name} loading="lazy" decoding="async" style={{ width:48, height:48, borderRadius:8, objectFit:"cover", flexShrink:0 }} />
                        : <div style={{ width:48, height:48, borderRadius:8, background:C.ivory, flexShrink:0 }} />
                      }
                      <div style={{ minWidth:0 }}>
                        <p style={{ margin:0, fontWeight:600, fontSize:14, color:C.ink }}>{model.name}</p>
                        <p style={{ margin:"2px 0 0", color:C.dust, fontSize:12 }}>{model.status || "pending"}</p>
                        {model.source === "manychat" && <span style={{ display:"inline-block", marginTop:3, padding:"2px 8px", background:"rgba(123,47,247,0.1)", color:"#7b2ff7", borderRadius:99, fontSize:10, fontWeight:700, textTransform:"uppercase" }}>ManyChat</span>}
                      </div>
                    </div>

                    {/* Contact copy + stale badge */}
                    <div style={{ display:"flex", gap:5, flexWrap:"wrap", marginBottom:8, alignItems:"center" }}>
                      {model.email && (
                        <button onClick={() => copyField(`${model.id}:email`, model.email)}
                          title={`Copy: ${model.email}`}
                          style={{ padding:"3px 9px", borderRadius:99, border:`1px solid ${C.smoke}`, background: copiedField[`${model.id}:email`] ? C.okBg : C.white, color: copiedField[`${model.id}:email`] ? C.ok : C.slate, fontSize:10, fontWeight:600, cursor:"pointer", fontFamily:"'Inter',sans-serif", whiteSpace:"nowrap" }}>
                          {copiedField[`${model.id}:email`] ? "✓ Copied" : "✉ Email"}
                        </button>
                      )}
                      {model.instagram && (
                        <button onClick={() => copyField(`${model.id}:ig`, `@${model.instagram}`)}
                          title={`Copy: @${model.instagram}`}
                          style={{ padding:"3px 9px", borderRadius:99, border:`1px solid ${C.smoke}`, background: copiedField[`${model.id}:ig`] ? C.okBg : C.white, color: copiedField[`${model.id}:ig`] ? C.ok : C.slate, fontSize:10, fontWeight:600, cursor:"pointer", fontFamily:"'Inter',sans-serif", whiteSpace:"nowrap" }}>
                          {copiedField[`${model.id}:ig`] ? "✓ Copied" : "IG Handle"}
                        </button>
                      )}
                      {(() => { const d = staleDays(model.last_updated); return d !== null && d >= 7 ? (
                        <span style={{ padding:"3px 9px", borderRadius:99, background:C.warnBg, color:C.warn, fontSize:10, fontWeight:700, whiteSpace:"nowrap" }}>⏱ {d}d stale</span>
                      ) : null; })()}
                    </div>

                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
                      <span style={{ padding:"3px 9px", borderRadius:99, background:pbg, color:pclr, fontSize:10, fontWeight:600, letterSpacing:"0.06em", textTransform:"uppercase" }}>{model.priority_level}</span>
                      {canMoveToBrandAmbassador && (
                        <button
                          onClick={() => moveToBrandAmbassador(model)}
                          disabled={!!moveLoading[model.id]}
                          style={{
                            border: "1px solid rgba(8,145,178,0.28)",
                            background: movedToBrandAmbassador[model.id] ? "rgba(8,145,178,0.12)" : "rgba(8,145,178,0.06)",
                            color: "#0e7490",
                            borderRadius: 999,
                            fontSize: 10,
                            fontWeight: 700,
                            letterSpacing: "0.06em",
                            textTransform: "uppercase",
                            padding: "4px 10px",
                            cursor: moveLoading[model.id] ? "not-allowed" : "pointer",
                            opacity: moveLoading[model.id] ? 0.6 : 1,
                          }}
                        >
                          {moveLoading[model.id] ? "Moving..." : movedToBrandAmbassador[model.id] ? "Moved" : "Move to Brand Ambassador"}
                        </button>
                      )}
                    </div>
                    <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:8, gap:8 }}>
                      <span style={{ color:C.slate, fontSize:11, fontWeight:600 }}>CHAMP: {champTotal}/12</span>
                      <span style={{ padding:"3px 9px", borderRadius:99, background:champTone[0], color:champTone[1], fontSize:10, fontWeight:700, letterSpacing:"0.06em", textTransform:"uppercase" }}>
                        {champTone[2]}
                      </span>
                    </div>
                    <p style={{ margin:"0 0 10px", color:C.slate, fontSize:12, lineHeight:1.5 }}>
                      {String(notesPreview).slice(0,100)}{String(notesPreview).length > 100 ? "…" : ""}
                    </p>

                    {canEditPipeline && NEXT_ACTION_TEMPLATES[model.pipeline_stage] && (() => {
                      const tpl = NEXT_ACTION_TEMPLATES[model.pipeline_stage];
                      return (
                        <button
                          onClick={() => navigator.clipboard.writeText(tpl.template(model.name || "there"))}
                          style={{ width:"100%", marginBottom:8, padding:"8px 10px", background:C.ivory, color:C.ink, border:`1px solid ${C.smoke}`, borderRadius:7, fontSize:11, fontWeight:700, letterSpacing:"0.06em", textTransform:"uppercase", cursor:"pointer", fontFamily:"'Inter',sans-serif", textAlign:"left" }}
                          title="Copy message template to clipboard"
                        >
                          📋 {tpl.label}
                        </button>
                      );
                    })()}

                    {canEditPipeline && pipelineSchemaReady && nextStageOf(model.pipeline_stage) && (
                      <button
                        onClick={() => advanceStage(model)}
                        disabled={!!advanceLoading[model.id] || !!actionLoading[model.id]}
                        style={{ width:"100%", marginBottom:8, padding:"10px", background: advanceLoading[model.id] ? C.ivory : C.ink, color: advanceLoading[model.id] ? C.slate : "#ffffff", border:"none", borderRadius:7, fontSize:12, fontWeight:700, letterSpacing:"0.05em", textTransform:"uppercase", cursor: advanceLoading[model.id] ? "not-allowed" : "pointer", fontFamily:"'Inter',sans-serif", opacity: advanceLoading[model.id] ? 0.6 : 1 }}
                      >
                        {advanceLoading[model.id] ? "Moving…" : `→ ${PIPELINE_STAGE_LABELS[nextStageOf(model.pipeline_stage)]}`}
                      </button>
                    )}

                    {canEditPipeline && pipelineSchemaReady && (
                      <div style={{ display:"grid", gap:8 }}>
                        <div style={{ border:`1px solid ${C.smoke}`, borderRadius:8, padding:10, background:C.ivory }}>
                          <p style={{ margin:"0 0 8px", color:C.ink, fontSize:11, fontWeight:700, letterSpacing:"0.08em", textTransform:"uppercase" }}>
                            CHAMP Qualification
                          </p>
                          <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginBottom:8 }}>
                            <button
                              onClick={() => applyChampPreset(model, "strong")}
                              disabled={isBusy}
                              style={{ padding:"5px 10px", borderRadius:99, border:`1px solid rgba(26,102,54,0.25)`, background:C.okBg, color:C.ok, fontSize:10, fontWeight:700, letterSpacing:"0.05em", textTransform:"uppercase", cursor:isBusy?"not-allowed":"pointer", fontFamily:"'Inter',sans-serif", opacity:isBusy?0.6:1 }}
                            >
                              Strong
                            </button>
                            <button
                              onClick={() => applyChampPreset(model, "nurture")}
                              disabled={isBusy}
                              style={{ padding:"5px 10px", borderRadius:99, border:`1px solid rgba(146,86,10,0.25)`, background:C.warnBg, color:C.warn, fontSize:10, fontWeight:700, letterSpacing:"0.05em", textTransform:"uppercase", cursor:isBusy?"not-allowed":"pointer", fontFamily:"'Inter',sans-serif", opacity:isBusy?0.6:1 }}
                            >
                              Nurture
                            </button>
                            <button
                              onClick={() => applyChampPreset(model, "decline")}
                              disabled={isBusy}
                              style={{ padding:"5px 10px", borderRadius:99, border:`1px solid rgba(155,28,28,0.25)`, background:C.errBg, color:C.err, fontSize:10, fontWeight:700, letterSpacing:"0.05em", textTransform:"uppercase", cursor:isBusy?"not-allowed":"pointer", fontFamily:"'Inter',sans-serif", opacity:isBusy?0.6:1 }}
                            >
                              Decline
                            </button>
                          </div>
                          <div style={{ display:"grid", gap:8 }}>
                            {CHAMP_FIELDS.map((field) => (
                              <div key={field.letter} style={{ display:"grid", gridTemplateColumns:"62px 1fr", gap:8, alignItems:"center" }}>
                                <select
                                  value={model[field.scoreKey] ?? 0}
                                  onChange={(e) => {
                                    const nextScore = Number(e.target.value);
                                    setModels((prev) => prev.map((m) => m.id === model.id ? { ...m, [field.scoreKey]: nextScore } : m));
                                    updateChamp(model, { [field.scoreKey]: nextScore });
                                  }}
                                  disabled={isBusy}
                                  style={{ ...sel, padding:"8px 8px", fontSize:12 }}
                                >
                                  <option value={0}>{field.letter}: 0</option>
                                  <option value={1}>{field.letter}: 1</option>
                                  <option value={2}>{field.letter}: 2</option>
                                  <option value={3}>{field.letter}: 3</option>
                                </select>
                                <input
                                  value={model[field.notesKey] || ""}
                                  placeholder={`${field.label} notes...`}
                                  onChange={(e) => setModels((prev) => prev.map((m) => m.id === model.id ? { ...m, [field.notesKey]: e.target.value } : m))}
                                  onBlur={() => updateChamp(model, { [field.notesKey]: model[field.notesKey] || "" })}
                                  disabled={isBusy}
                                  style={{ ...sel, width:"100%", boxSizing:"border-box", fontSize:12 }}
                                />
                              </div>
                            ))}
                          </div>
                        </div>
                        <select value={model.pipeline_stage} onChange={(e)=>updateModelPipeline(model.id,{pipeline_stage:e.target.value})} disabled={isBusy} style={sel}>
                          {PIPELINE_STAGES.map(item=><option key={item} value={item}>{PIPELINE_STAGE_LABELS[item]}</option>)}
                        </select>
                        <select value={model.priority_level} onChange={(e)=>updateModelPipeline(model.id,{priority_level:e.target.value})} disabled={isBusy} style={sel}>
                          <option value="high">High Priority</option>
                          <option value="medium">Medium Priority</option>
                          <option value="low">Low Priority</option>
                        </select>
                        <textarea value={model.scouting_notes||""} placeholder="Scouting notes…" onChange={(e)=>setModels(p=>p.map(m=>m.id===model.id?{...m,scouting_notes:e.target.value}:m))} onBlur={()=>updateModelPipeline(model.id,{scouting_notes:model.scouting_notes||""})} disabled={isBusy} style={ta} />
                        <textarea value={model.internal_notes||""} placeholder="Internal notes…" onChange={(e)=>setModels(p=>p.map(m=>m.id===model.id?{...m,internal_notes:e.target.value}:m))} onBlur={()=>updateModelPipeline(model.id,{internal_notes:model.internal_notes||""})} disabled={isBusy} style={ta} />
                        <input value={model.agency_name||""} placeholder="Agency name (for signed talent)" onChange={(e)=>setModels(p=>p.map(m=>m.id===model.id?{...m,agency_name:e.target.value}:m))} onBlur={()=>updateModelPipeline(model.id,{agency_name:model.agency_name||""})} disabled={isBusy}
                          style={{ ...sel, width:"100%", boxSizing:"border-box" }} />
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
