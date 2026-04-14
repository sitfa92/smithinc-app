import React from "react";
import { supabase } from "../supabase";
import { useAuth } from "../auth";
import { isMissingColumnError, sendZapierEvent, sendBackendWebhook } from "../utils";
import { MetricCard } from "../analyticsUtils";

export default function Models() {
  const { role } = useAuth();
  const [models, setModels] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const [saveLoading, setSaveLoading] = React.useState(false);
  const [saveError, setSaveError] = React.useState("");
  const [form, setForm] = React.useState({
    name: "",
    email: "",
    instagram: "",
    height: "",
    status: "pending",
  });

  const canAddModels = ["admin", "agent", "user"].includes(role);

  const fetchModels = async () => {
    try {
      setError("");
      const { data, error } = await supabase
        .from("models")
        .select("*")
        .order("submitted_at", { ascending: false });
      if (error) throw error;
      setModels(data || []);
    } catch (err) {
      setError(err.message || "Failed to load models");
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    fetchModels();
  }, []);

  const saveModel = async (e) => {
    e.preventDefault();
    if (!canAddModels) return;

    setSaveLoading(true);
    setSaveError("");
    try {
      const basePayload = {
        name: form.name.trim(),
        email: form.email.trim(),
        instagram: form.instagram.trim(),
        height: form.height.trim(),
        status: form.status,
        submitted_at: new Date().toISOString(),
      };

      const payload = {
        ...basePayload,
        pipeline_stage: "submitted",
        priority_level: "medium",
        scouting_notes: "",
        internal_notes: "",
        agency_name: "",
        last_updated: new Date().toISOString(),
      };

      if (!payload.name || !payload.email) {
        throw new Error("Name and email are required");
      }

      let { error } = await supabase.from("models").insert([payload]);
      if (error && isMissingColumnError(error)) {
        const retry = await supabase.from("models").insert([basePayload]);
        error = retry.error;
      }
      if (error) throw error;

      sendZapierEvent("model.created", {
        name: payload.name,
        email: payload.email,
        instagram: payload.instagram,
        status: payload.status,
      });

      sendBackendWebhook("model_signup", {
        name: payload.name,
        instagram: payload.instagram,
        height: payload.height,
        status: payload.status,
      });

      setForm({ name: "", email: "", instagram: "", height: "", status: "pending" });
      fetchModels();
    } catch (err) {
      setSaveError(err.message || "Failed to add model");
    } finally {
      setSaveLoading(false);
    }
  };

  const approved = models.filter((m) => m.status === "approved").length;
  const pending = models.filter((m) => m.status === "pending").length;

  return (
    <div style={{ padding: 20, maxWidth: 1200, margin: "0 auto" }}>
      <h1>Talent Tracking</h1>

      {canAddModels && (
        <form onSubmit={saveModel} style={{ display: "grid", gap: 10, marginBottom: 20 }}>
          <input value={form.name} placeholder="Model name" onChange={(e) => setForm({ ...form, name: e.target.value })} required
            style={{ padding: 10, border: "1px solid #ccc", borderRadius: 4 }} />
          <input value={form.email} placeholder="Model email" type="email" onChange={(e) => setForm({ ...form, email: e.target.value })} required
            style={{ padding: 10, border: "1px solid #ccc", borderRadius: 4 }} />
          <input value={form.instagram} placeholder="Instagram" onChange={(e) => setForm({ ...form, instagram: e.target.value })}
            style={{ padding: 10, border: "1px solid #ccc", borderRadius: 4 }} />
          <input value={form.height} placeholder="Height (optional)" onChange={(e) => setForm({ ...form, height: e.target.value })}
            style={{ padding: 10, border: "1px solid #ccc", borderRadius: 4 }} />
          <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}
            style={{ padding: 10, border: "1px solid #ccc", borderRadius: 4 }}>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
          {saveError && <p style={{ color: "#d32f2f", margin: 0 }}>{saveError}</p>}
          <button disabled={saveLoading}
            style={{ padding: 10, border: "none", borderRadius: 4, background: saveLoading ? "#999" : "#333", color: "#fff", cursor: saveLoading ? "not-allowed" : "pointer" }}>
            {saveLoading ? "Saving..." : "Add Model Manually"}
          </button>
        </form>
      )}

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 18 }}>
        <MetricCard label="Total Models" value={models.length} color="#333" />
        <MetricCard label="Approved Talent" value={approved} color="#4caf50" />
        <MetricCard label="Pending Review" value={pending} color="#ff9800" />
      </div>
      {loading && <p>Loading models...</p>}
      {error && <p style={{ color: "#d32f2f" }}>{error}</p>}
      {!loading && models.map((model) => (
        <div key={model.id} style={{ border: "1px solid #e0e0e0", borderRadius: 8, padding: 14, marginBottom: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <strong>{model.name}</strong>
            {model.source === "manychat" && (
              <span style={{ padding: "2px 8px", backgroundColor: "#7b2ff7", color: "#fff", borderRadius: 10, fontSize: 11, fontWeight: "bold" }}>
                ManyChat
              </span>
            )}
          </div>
          <p style={{ margin: "6px 0", color: "#666" }}>{model.email}</p>
          <p style={{ margin: "6px 0", color: "#666" }}>{model.instagram || "No Instagram"}</p>
          <p style={{ margin: 0, color: "#666" }}>Status: {model.status}</p>
        </div>
      ))}
    </div>
  );
}
