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

  return (
    <div style={{ padding: 20, maxWidth: 1300, margin: "0 auto" }}>
      <h1>Model Pipeline</h1>
      <p style={{ color: "#666", marginTop: 0 }}>
        Structured tracking from first submission to agency signing.
      </p>

      {!pipelineSchemaReady && (
        <div style={{ background: "#fff3e0", border: "1px solid #ff9800", borderRadius: 8, padding: 16, marginBottom: 18 }}>
          <strong style={{ color: "#e65100" }}>Pipeline fields need one-time database setup</strong>
          <p style={{ margin: "8px 0", color: "#555" }}>
            Run this SQL in the{" "}
            <a href="https://supabase.com/dashboard/project/jjmmakbnjzzxbuflucck/sql" target="_blank" rel="noreferrer">
              Supabase SQL Editor
            </a>.
          </p>
          <pre style={{ background: "#f5f5f5", padding: 12, borderRadius: 6, fontSize: 12, overflowX: "auto", whiteSpace: "pre-wrap" }}>{PIPELINE_SETUP_SQL}</pre>
          <button
            onClick={() => navigator.clipboard.writeText(PIPELINE_SETUP_SQL)}
            style={{ marginTop: 8, padding: "8px 14px", background: "#333", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer" }}
          >
            Copy SQL
          </button>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10, marginBottom: 16 }}>
        <select value={filters.stage} onChange={(e) => setFilters((prev) => ({ ...prev, stage: e.target.value }))} style={{ padding: 10, border: "1px solid #ccc", borderRadius: 4 }}>
          <option value="all">All Stages</option>
          {PIPELINE_STAGES.map((stage) => (
            <option key={stage} value={stage}>{PIPELINE_STAGE_LABELS[stage]}</option>
          ))}
        </select>
        <select value={filters.priority} onChange={(e) => setFilters((prev) => ({ ...prev, priority: e.target.value }))} style={{ padding: 10, border: "1px solid #ccc", borderRadius: 4 }}>
          <option value="all">All Priority</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
        <select value={filters.status} onChange={(e) => setFilters((prev) => ({ ...prev, status: e.target.value }))} style={{ padding: 10, border: "1px solid #ccc", borderRadius: 4 }}>
          <option value="all">All Status</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
        </select>
        <select value={filters.sortBy} onChange={(e) => setFilters((prev) => ({ ...prev, sortBy: e.target.value }))} style={{ padding: 10, border: "1px solid #ccc", borderRadius: 4 }}>
          <option value="recent">Most Recently Updated</option>
          <option value="priority">Priority Level</option>
        </select>
      </div>

      {loading && <p>Loading pipeline...</p>}
      {error && <p style={{ color: "#d32f2f" }}>{error}</p>}

      {!loading && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 14 }}>
          {visibleStages.map((stage) => (
            <div key={stage} style={{ border: "1px solid #e0e0e0", borderRadius: 10, padding: 12, background: "#fafafa" }}>
              <h3 style={{ marginTop: 0 }}>{PIPELINE_STAGE_LABELS[stage]} ({grouped[stage]?.length || 0})</h3>

              {(grouped[stage] || []).map((model) => {
                const notesPreview = model.scouting_notes || model.internal_notes || "No notes yet";
                const isBusy = !!actionLoading[model.id];

                return (
                  <div key={model.id} style={{ border: "1px solid #ececec", borderRadius: 8, padding: 10, marginBottom: 10, background: "#fff" }}>
                    <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                      {model.image_url ? (
                        <img src={model.image_url} alt={model.name} style={{ width: 54, height: 54, borderRadius: 8, objectFit: "cover", flexShrink: 0 }} />
                      ) : (
                        <div style={{ width: 54, height: 54, borderRadius: 8, background: "#efefef", flexShrink: 0 }} />
                      )}
                      <div style={{ minWidth: 0 }}>
                        <p style={{ margin: 0, fontWeight: 700 }}>{model.name}</p>
                        <p style={{ margin: "4px 0 0", color: "#666", fontSize: 13 }}>Status: {model.status || "pending"}</p>
                        {model.source === "manychat" && (
                          <span style={{ display: "inline-block", marginTop: 4, padding: "2px 8px", backgroundColor: "#7b2ff7", color: "white", borderRadius: 10, fontSize: 11, fontWeight: "bold" }}>
                            ManyChat
                          </span>
                        )}
                      </div>
                    </div>

                    <p style={{ margin: "8px 0", color: "#666", fontSize: 13 }}>Priority: <strong>{model.priority_level}</strong></p>
                    <p style={{ margin: "8px 0", color: "#555", fontSize: 13 }}>
                      {String(notesPreview).slice(0, 120)}{String(notesPreview).length > 120 ? "..." : ""}
                    </p>

                    {canEditPipeline && pipelineSchemaReady && (
                      <div style={{ display: "grid", gap: 8 }}>
                        <select value={model.pipeline_stage} onChange={(e) => updateModelPipeline(model.id, { pipeline_stage: e.target.value })} disabled={isBusy}
                          style={{ padding: 8, border: "1px solid #ccc", borderRadius: 4 }}>
                          {PIPELINE_STAGES.map((item) => (
                            <option key={item} value={item}>{PIPELINE_STAGE_LABELS[item]}</option>
                          ))}
                        </select>

                        <select value={model.priority_level} onChange={(e) => updateModelPipeline(model.id, { priority_level: e.target.value })} disabled={isBusy}
                          style={{ padding: 8, border: "1px solid #ccc", borderRadius: 4 }}>
                          <option value="high">High Priority</option>
                          <option value="medium">Medium Priority</option>
                          <option value="low">Low Priority</option>
                        </select>

                        <textarea
                          value={model.scouting_notes || ""}
                          placeholder="Scouting notes"
                          onChange={(e) => setModels((prev) => prev.map((m) => (m.id === model.id ? { ...m, scouting_notes: e.target.value } : m)))}
                          onBlur={() => updateModelPipeline(model.id, { scouting_notes: model.scouting_notes || "" })}
                          disabled={isBusy}
                          style={{ minHeight: 70, padding: 8, border: "1px solid #ccc", borderRadius: 4, resize: "vertical" }}
                        />

                        <textarea
                          value={model.internal_notes || ""}
                          placeholder="Internal notes"
                          onChange={(e) => setModels((prev) => prev.map((m) => (m.id === model.id ? { ...m, internal_notes: e.target.value } : m)))}
                          onBlur={() => updateModelPipeline(model.id, { internal_notes: model.internal_notes || "" })}
                          disabled={isBusy}
                          style={{ minHeight: 70, padding: 8, border: "1px solid #ccc", borderRadius: 4, resize: "vertical" }}
                        />

                        <input
                          value={model.agency_name || ""}
                          placeholder="Agency name (for signed talent)"
                          onChange={(e) => setModels((prev) => prev.map((m) => (m.id === model.id ? { ...m, agency_name: e.target.value } : m)))}
                          onBlur={() => updateModelPipeline(model.id, { agency_name: model.agency_name || "" })}
                          disabled={isBusy}
                          style={{ padding: 8, border: "1px solid #ccc", borderRadius: 4 }}
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
