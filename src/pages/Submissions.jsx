import React from "react";
import { supabase } from "../supabase";
import { sendModelStatusUpdateEmail } from "../emailService";
import { isMissingColumnError, createInAppAlerts, sendInternalTeamEmailAlert } from "../utils";

export default function Submissions() {
  const [submissions, setSubmissions] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const [actionLoading, setActionLoading] = React.useState({});
  const [bulkDeleteLoading, setBulkDeleteLoading] = React.useState(false);
  const [sourceFilter, setSourceFilter] = React.useState("all");

  React.useEffect(() => {
    fetchSubmissions();
  }, []);

  const fetchSubmissions = async () => {
    try {
      setError("");
      const { data, error: supabaseError } = await supabase
        .from("models")
        .select("*")
        .order("submitted_at", { ascending: false });

      if (supabaseError) throw supabaseError;
      setSubmissions(data || []);
    } catch (err) {
      setError(err.message || "Failed to load submissions");
      console.error("Fetch error:", err);
    } finally {
      setLoading(false);
    }
  };

  const updateModelStatus = async (modelId, newStatus) => {
    const model = submissions.find((m) => m.id === modelId);
    if (!model) return;

    setActionLoading((prev) => ({ ...prev, [modelId]: true }));
    try {
      const nextUpdate = { status: newStatus, last_updated: new Date().toISOString() };
      let { error: supabaseError } = await supabase
        .from("models")
        .update(nextUpdate)
        .eq("id", modelId);

      if (supabaseError && isMissingColumnError(supabaseError)) {
        const retry = await supabase
          .from("models")
          .update({ status: newStatus })
          .eq("id", modelId);
        supabaseError = retry.error;
      }

      if (supabaseError) throw supabaseError;

      sendModelStatusUpdateEmail(model, newStatus);

      createInAppAlerts([
        {
          title: `Model ${newStatus}`,
          message: `${model.name || "A submission"} was marked ${newStatus}.`,
          audience_role: "admin",
          source_type: "model_status",
          source_id: modelId,
          level: newStatus === "rejected" ? "warning" : "success",
        },
      ]);

      sendInternalTeamEmailAlert({
        subject: `Model ${newStatus}: ${model.name || "Submission"}`,
        message: `${model.name || "A submission"} was marked ${newStatus}.\nEmail: ${model.email || "N/A"}`,
        roles: ["admin", "agent"],
        submissionEmail: model.email || "",
      });

      setSubmissions((prev) =>
        prev.map((m) => (m.id === modelId ? { ...m, status: newStatus } : m))
      );
    } catch (err) {
      console.error("Update error:", err);
      alert(`Failed to update status: ${err.message}`);
    } finally {
      setActionLoading((prev) => ({ ...prev, [modelId]: false }));
    }
  };

  const deleteApplicant = async (modelId, modelName) => {
    const confirmed = window.confirm(`Delete applicant ${modelName || ""}? This cannot be undone.`);
    if (!confirmed) return;

    setActionLoading((prev) => ({ ...prev, [modelId]: true }));
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const resp = await fetch("/api/models/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token || ""}` },
        body: JSON.stringify({ modelId }),
      });

      const json = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        throw new Error(json.error || "Failed to delete applicant");
      }

      setSubmissions((prev) => prev.filter((m) => m.id !== modelId));
    } catch (err) {
      alert(err.message || "Failed to delete applicant");
    } finally {
      setActionLoading((prev) => ({ ...prev, [modelId]: false }));
    }
  };

  const deleteAllRejectedApplicants = async () => {
    const rejectedCount = submissions.filter((m) => m.status === "rejected").length;
    if (rejectedCount === 0) {
      alert("No rejected applicants to delete.");
      return;
    }

    const confirmed = window.confirm(
      `Delete all ${rejectedCount} rejected applicants? This action cannot be undone.`
    );
    if (!confirmed) return;

    setBulkDeleteLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const resp = await fetch("/api/models/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token || ""}` },
        body: JSON.stringify({ deleteRejectedOnly: true }),
      });

      const json = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        throw new Error(json.error || "Failed to delete rejected applicants");
      }

      const deletedCount = Number(json.deletedCount || 0);
      setSubmissions((prev) => prev.filter((m) => m.status !== "rejected"));
      alert(`Deleted ${deletedCount} rejected applicant${deletedCount === 1 ? "" : "s"}.`);
    } catch (err) {
      alert(err.message || "Failed to delete rejected applicants");
    } finally {
      setBulkDeleteLoading(false);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "approved": return "#4caf50";
      case "rejected": return "#f44336";
      case "pending":
      default: return "#ff9800";
    }
  };

  return (
    <div style={{ padding: "20px", maxWidth: "1200px", margin: "0 auto", boxSizing: "border-box" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10, marginBottom: 16 }}>
        <h1 style={{ fontSize: "clamp(24px, 5vw, 32px)", margin: 0 }}>Model Applications</h1>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <select
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value)}
            style={{ padding: "8px 12px", border: "1px solid #ccc", borderRadius: 4, fontSize: 14 }}
          >
            <option value="all">All Sources</option>
            <option value="manychat">ManyChat only</option>
            <option value="direct">Direct only</option>
          </select>
          <button
            onClick={deleteAllRejectedApplicants}
            disabled={bulkDeleteLoading}
            style={{
              padding: "8px 12px",
              backgroundColor: "#b71c1c",
              color: "white",
              border: "none",
              borderRadius: 4,
              cursor: bulkDeleteLoading ? "not-allowed" : "pointer",
              opacity: bulkDeleteLoading ? 0.7 : 1,
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            {bulkDeleteLoading ? "Deleting..." : "Delete All Rejected"}
          </button>
        </div>
      </div>

      {loading && <p>Loading applications...</p>}
      {error && <div style={{ color: "#d32f2f", marginBottom: 20, padding: 10, backgroundColor: "#ffebee", borderRadius: 4 }}>Error: {error}</div>}

      {!loading && submissions.length === 0 && (
        <p style={{ color: "#999", fontSize: 16 }}>No submissions yet.</p>
      )}

      {!loading && submissions
        .filter((m) => {
          if (sourceFilter === "manychat") return m.source === "manychat";
          if (sourceFilter === "direct") return m.source !== "manychat";
          return true;
        })
        .map((model) => {
          const isMobile = window.innerWidth <= 768;
          return (
            <div
              key={model.id}
              style={{
                display: "flex",
                flexDirection: isMobile ? "column" : "row",
                gap: isMobile ? "15px" : "20px",
                padding: "20px",
                marginBottom: "20px",
                border: "1px solid #e0e0e0",
                borderRadius: 8,
                backgroundColor: "#fafafa",
                boxSizing: "border-box",
              }}
            >
              <div style={{ flex: isMobile ? "1 1 100%" : "0 0 150px", minWidth: 0 }}>
                {model.image_url ? (
                  <img
                    src={model.image_url}
                    alt={model.name}
                    style={{ width: "100%", height: isMobile ? "250px" : "200px", objectFit: "cover", borderRadius: 8 }}
                  />
                ) : (
                  <div
                    style={{
                      width: "100%",
                      height: isMobile ? "250px" : "200px",
                      backgroundColor: "#e0e0e0",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      borderRadius: 8,
                      color: "#999",
                    }}
                  >
                    No Image
                  </div>
                )}
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ marginBottom: 10 }}>
                  <h3 style={{ margin: "0 0 5px 0", fontSize: "clamp(18px, 4vw, 20px)" }}>{model.name}</h3>
                  <p style={{ margin: "5px 0", color: "#666", wordBreak: "break-word" }}>
                    <strong>Email:</strong> {model.email}
                  </p>
                  {model.instagram && (
                    <p style={{ margin: "5px 0", color: "#666", wordBreak: "break-word" }}>
                      <strong>Instagram:</strong> @{model.instagram}
                    </p>
                  )}
                  <p style={{ margin: "5px 0", color: "#999", fontSize: "0.9em" }}>
                    Submitted: {new Date(model.submitted_at).toLocaleString()}
                  </p>
                </div>

                <div style={{ marginBottom: 15, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                  <span
                    style={{
                      display: "inline-block",
                      padding: "6px 12px",
                      backgroundColor: getStatusColor(model.status),
                      color: "white",
                      borderRadius: 20,
                      fontSize: "0.85em",
                      fontWeight: "bold",
                      textTransform: "uppercase",
                    }}
                  >
                    {model.status}
                  </span>
                  {model.source === "manychat" && (
                    <span
                      style={{
                        display: "inline-block",
                        padding: "4px 10px",
                        backgroundColor: "#7b2ff7",
                        color: "white",
                        borderRadius: 20,
                        fontSize: "0.78em",
                        fontWeight: "bold",
                        letterSpacing: "0.04em",
                      }}
                    >
                      ManyChat
                    </span>
                  )}
                </div>

                {model.status === "pending" && (
                  <div style={{ display: "flex", gap: 10, flexDirection: isMobile ? "column" : "row" }}>
                    <button
                      onClick={() => updateModelStatus(model.id, "approved")}
                      disabled={actionLoading[model.id]}
                      style={{
                        flex: isMobile ? "1 1 100%" : "auto",
                        padding: isMobile ? "10px 16px" : "8px 16px",
                        backgroundColor: "#4caf50",
                        color: "white",
                        border: "none",
                        borderRadius: 4,
                        cursor: actionLoading[model.id] ? "not-allowed" : "pointer",
                        opacity: actionLoading[model.id] ? 0.6 : 1,
                        fontSize: "14px",
                        fontWeight: 500,
                      }}
                    >
                      {actionLoading[model.id] ? "..." : "✓ Approve"}
                    </button>
                    <button
                      onClick={() => updateModelStatus(model.id, "rejected")}
                      disabled={actionLoading[model.id]}
                      style={{
                        flex: isMobile ? "1 1 100%" : "auto",
                        padding: isMobile ? "10px 16px" : "8px 16px",
                        backgroundColor: "#f44336",
                        color: "white",
                        border: "none",
                        borderRadius: 4,
                        cursor: actionLoading[model.id] ? "not-allowed" : "pointer",
                        opacity: actionLoading[model.id] ? 0.6 : 1,
                        fontSize: "14px",
                        fontWeight: 500,
                      }}
                    >
                      {actionLoading[model.id] ? "..." : "✕ Reject"}
                    </button>
                  </div>
                )}

                {model.status === "rejected" && (
                  <div style={{ marginTop: 8 }}>
                    <button
                      onClick={() => deleteApplicant(model.id, model.name)}
                      disabled={actionLoading[model.id]}
                      style={{
                        padding: "8px 12px",
                        backgroundColor: "#b71c1c",
                        color: "white",
                        border: "none",
                        borderRadius: 4,
                        cursor: actionLoading[model.id] ? "not-allowed" : "pointer",
                        opacity: actionLoading[model.id] ? 0.7 : 1,
                        fontSize: 13,
                        fontWeight: 600,
                      }}
                    >
                      {actionLoading[model.id] ? "Deleting..." : "Delete Applicant"}
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
