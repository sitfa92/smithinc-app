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
  const [pipelineSchemaReady, setPipelineSchemaReady] = React.useState(true);
  const [filters, setFilters] = React.useState({
    stage: "all",
    priority: "all",
    status: "all",
    sortBy: "recent",
  });

  const canEditPipeline = role === "admin" || role === "agent";
  const visibleStages = PIPELINE_STAGES;

  const PIPELINE_SETUP_SQL = `alter table public.models
  add column if not exists pipeline_stage text default 'submitted',
  add column if not exists agency_name text,
  add column if not exists scouting_notes text,
  add column if not exists internal_notes text,
  add column if not exists priority_level text default 'medium',
  add column if not exists last_updated timestamptz default now(),
  add column if not exists source text;

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
  });

  const fetchModels = async () => {
    try {
      setError("");
      const selectFields = "id, name, email, instagram, image_url, status, submitted_at, created_at, pipeline_stage, agency_name, scouting_notes, internal_notes, priority_level, last_updated, source";
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

  const filteredModels = models
    .filter((model) => (filters.stage === "all" ? true : model.pipeline_stage === filters.stage))
    .filter((model) => (filters.priority === "all" ? true : model.priority_level === filters.priority))
    .filter((model) => (filters.status === "all" ? true : model.status === filters.status))
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
      <p style={{ color:C.dust, marginBottom:20, fontSize:13 }}>Structured tracking from first submission to agency signing.</p>

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

      {loading && <p style={{ color:C.dust }}>Loading pipeline…</p>}
      {error && <p style={{ color:C.err, fontSize:13 }}>{error}</p>}

      {!loading && (
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(280px,1fr))", gap:16 }}>
          {visibleStages.map(stage => (
            <div key={stage} style={{ background:C.ivory, border:`1px solid ${C.smoke}`, borderRadius:12, padding:14 }}>
              <p style={{ fontFamily:"'Cormorant Garamond',Georgia,serif", fontSize:17, fontWeight:500, color:C.ink, margin:"0 0 12px", letterSpacing:"-0.01em" }}>
                {PIPELINE_STAGE_LABELS[stage]}{" "}
                <span style={{ fontSize:13, color:C.dust, fontFamily:"'Inter',sans-serif", fontWeight:400 }}>({grouped[stage]?.length || 0})</span>
              </p>
              {(grouped[stage] || []).map(model => {
                const notesPreview = model.scouting_notes || model.internal_notes || "No notes yet";
                const isBusy = !!actionLoading[model.id];
                const [pbg,pclr] = priorityBadge[model.priority_level] || [C.ivory,C.dust];
                return (
                  <div key={model.id} style={{ background:C.white, border:`1px solid ${C.smoke}`, borderRadius:10, padding:12, marginBottom:10 }}>
                    <div style={{ display:"flex", gap:10, alignItems:"center", marginBottom:8 }}>
                      {model.image_url
                        ? <img src={model.image_url} alt={model.name} style={{ width:48, height:48, borderRadius:8, objectFit:"cover", flexShrink:0 }} />
                        : <div style={{ width:48, height:48, borderRadius:8, background:C.ivory, flexShrink:0 }} />
                      }
                      <div style={{ minWidth:0 }}>
                        <p style={{ margin:0, fontWeight:600, fontSize:14, color:C.ink }}>{model.name}</p>
                        <p style={{ margin:"2px 0 0", color:C.dust, fontSize:12 }}>{model.status || "pending"}</p>
                        {model.source === "manychat" && <span style={{ display:"inline-block", marginTop:3, padding:"2px 8px", background:"rgba(123,47,247,0.1)", color:"#7b2ff7", borderRadius:99, fontSize:10, fontWeight:700, textTransform:"uppercase" }}>ManyChat</span>}
                      </div>
                    </div>

                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
                      <span style={{ padding:"3px 9px", borderRadius:99, background:pbg, color:pclr, fontSize:10, fontWeight:600, letterSpacing:"0.06em", textTransform:"uppercase" }}>{model.priority_level}</span>
                    </div>
                    <p style={{ margin:"0 0 10px", color:C.slate, fontSize:12, lineHeight:1.5 }}>
                      {String(notesPreview).slice(0,100)}{String(notesPreview).length > 100 ? "…" : ""}
                    </p>

                    {canEditPipeline && pipelineSchemaReady && (
                      <div style={{ display:"grid", gap:8 }}>
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
