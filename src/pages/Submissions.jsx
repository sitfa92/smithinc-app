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
  const [statusFilter, setStatusFilter] = React.useState("active");

  React.useEffect(() => {
    fetchSubmissions();
  }, []);

  const fetchSubmissions = async () => {
    try {
      setError("");
      const { data, error: supabaseError } = await supabase
        .from("models")
        .select("id, name, email, instagram, status, source, image_url, submitted_at")
        .order("submitted_at", { ascending: false })
        .limit(500);

      if (supabaseError) throw supabaseError;
      setSubmissions(data || []);
    } catch (err) {
      setError(err.message || "Failed to load submissions");
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

  const C = { ink:"#111111", slate:"#4a4a4a", dust:"#888888", smoke:"#e8e4dc", ivory:"#faf8f4", canvas:"#f5f2ec", white:"#ffffff", err:"#9b1c1c", warn:"#92560a", ok:"#1a6636", okBg:"#edf7ee", warnBg:"#fef8ec", errBg:"#fef2f2" };
  const btnS = (bg,clr,extra={}) => ({ padding:"9px 16px", background:bg, color:clr, border:"none", borderRadius:8, fontSize:12, fontWeight:600, letterSpacing:"0.07em", textTransform:"uppercase", cursor:"pointer", fontFamily:"'Inter',sans-serif", ...extra });
  const badge = (st) => {
    const m = { approved:[C.okBg,C.ok], rejected:[C.errBg,C.err], pending:[C.warnBg,C.warn] };
    const [bg,clr] = m[st] || [C.ivory,C.slate];
    return { display:"inline-flex", alignItems:"center", padding:"3px 10px", borderRadius:99, fontSize:11, fontWeight:600, letterSpacing:"0.06em", textTransform:"uppercase", background:bg, color:clr };
  };

  return (
    <div style={{ padding:"32px 24px", maxWidth:1200, margin:"0 auto" }}>
      <div style={{ display:"flex", alignItems:"flex-end", justifyContent:"space-between", flexWrap:"wrap", gap:12, marginBottom:24 }}>
        <div>
          <h1 style={{ fontFamily:"'Cormorant Garamond',Georgia,serif", fontSize:"clamp(26px,4vw,38px)", fontWeight:500, color:C.ink, letterSpacing:"-0.02em", margin:"0 0 4px" }}>Model Applications</h1>
          <p style={{ color:C.dust, fontSize:13, margin:0 }}>Review and manage incoming talent submissions.</p>
        </div>
        <div style={{ display:"flex", gap:10, alignItems:"center", flexWrap:"wrap" }}>
          <select value={statusFilter} onChange={(e)=>setStatusFilter(e.target.value)}
            style={{ padding:"9px 12px", border:`1px solid ${C.smoke}`, borderRadius:8, fontSize:13, background:C.white, color:C.slate, outline:"none", fontFamily:"'Inter',sans-serif", appearance:"none", cursor:"pointer" }}>
            <option value="active">Hide Rejected</option>
            <option value="all">All Statuses</option>
            <option value="pending">Pending only</option>
            <option value="approved">Approved only</option>
            <option value="rejected">Rejected only</option>
          </select>
          <select value={sourceFilter} onChange={(e)=>setSourceFilter(e.target.value)}
            style={{ padding:"9px 12px", border:`1px solid ${C.smoke}`, borderRadius:8, fontSize:13, background:C.white, color:C.slate, outline:"none", fontFamily:"'Inter',sans-serif", appearance:"none", cursor:"pointer" }}>
            <option value="all">All Sources</option>
            <option value="manychat">ManyChat only</option>
            <option value="direct">Direct only</option>
          </select>
          <button onClick={deleteAllRejectedApplicants} disabled={bulkDeleteLoading}
            style={btnS(C.errBg,C.err,{ border:`1px solid rgba(155,28,28,0.2)`, opacity:bulkDeleteLoading?0.55:1, cursor:bulkDeleteLoading?"not-allowed":"pointer" })}>
            {bulkDeleteLoading ? "Deleting…" : "Clear Rejected"}
          </button>
        </div>
      </div>

      {loading && <p style={{ color:C.dust }}>Loading applications…</p>}
      {error && <div style={{ background:C.errBg, border:`1px solid rgba(155,28,28,0.2)`, borderRadius:10, padding:"12px 16px", marginBottom:20, color:C.err, fontSize:13 }}>Error: {error}</div>}
      {!loading && submissions.length === 0 && <p style={{ color:C.dust }}>No submissions yet.</p>}

      {!loading && submissions
        .filter(m => {
          if (statusFilter === "active") { if (m.status === "rejected") return false; }
          else if (statusFilter !== "all") { if (m.status !== statusFilter) return false; }
          if (sourceFilter === "manychat") return m.source === "manychat";
          if (sourceFilter === "direct") return m.source !== "manychat";
          return true;
        })
        .map(model => (
          <div key={model.id} style={{ display:"flex", gap:18, padding:18, marginBottom:16, border:`1px solid ${C.smoke}`, borderRadius:12, background:C.white, boxShadow:"0 1px 4px rgba(17,17,17,0.04)", flexWrap:"wrap" }}>
            <div style={{ flex:"0 0 140px", minWidth:0 }}>
              {model.image_url ? (
                <img src={model.image_url} alt={model.name} loading="lazy" decoding="async" style={{ width:"100%", height:185, objectFit:"cover", borderRadius:10, display:"block" }} />
              ) : (
                <div style={{ width:"100%", height:185, background:C.ivory, display:"flex", alignItems:"center", justifyContent:"center", borderRadius:10, color:C.dust, fontSize:13 }}>No Image</div>
              )}
            </div>
            <div style={{ flex:1, minWidth:200 }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", flexWrap:"wrap", gap:8, marginBottom:8 }}>
                <h3 style={{ margin:0, fontSize:17, fontWeight:600, color:C.ink }}>{model.name}</h3>
                <div style={{ display:"flex", gap:6 }}>
                  {model.source === "manychat" && <span style={{ ...badge(""), background:"rgba(123,47,247,0.1)", color:"#7b2ff7" }}>ManyChat</span>}
                  <span style={badge(model.status)}>{model.status}</span>
                </div>
              </div>
              <p style={{ margin:"0 0 3px", color:C.dust, fontSize:13 }}>{model.email}</p>
              {model.instagram && <p style={{ margin:"0 0 3px", color:C.dust, fontSize:13 }}>@{model.instagram}</p>}
              <p style={{ margin:"0 0 14px", color:C.dust, fontSize:12 }}>Submitted: {new Date(model.submitted_at).toLocaleString()}</p>
              {model.status === "pending" && (
                <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
                  <button onClick={()=>updateModelStatus(model.id,"approved")} disabled={actionLoading[model.id]}
                    style={btnS(C.okBg,C.ok,{ border:`1px solid rgba(26,102,54,0.2)`, opacity:actionLoading[model.id]?0.55:1, cursor:actionLoading[model.id]?"not-allowed":"pointer" })}>
                    {actionLoading[model.id] ? "…" : "✓ Approve"}
                  </button>
                  <button onClick={()=>updateModelStatus(model.id,"rejected")} disabled={actionLoading[model.id]}
                    style={btnS(C.errBg,C.err,{ border:`1px solid rgba(155,28,28,0.2)`, opacity:actionLoading[model.id]?0.55:1, cursor:actionLoading[model.id]?"not-allowed":"pointer" })}>
                    {actionLoading[model.id] ? "…" : "✕ Reject"}
                  </button>
                </div>
              )}
              {(model.status === "rejected" || model.status === "approved") && (
                <button onClick={()=>deleteApplicant(model.id,model.name)} disabled={actionLoading[model.id]}
                  style={btnS(C.errBg,C.err,{ border:`1px solid rgba(155,28,28,0.2)`, opacity:actionLoading[model.id]?0.55:1, cursor:actionLoading[model.id]?"not-allowed":"pointer" })}>
                  {actionLoading[model.id] ? "Deleting…" : "Delete Applicant"}
                </button>
              )}
            </div>
          </div>
        ))}
    </div>
  );
}
