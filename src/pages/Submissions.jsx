import React from "react";
import { supabase } from "../supabase";
import { sendModelStatusUpdateEmail } from "../emailService";
import { isMissingColumnError, createInAppAlerts, sendInternalTeamEmailAlert } from "../utils";
import { uploadImage } from "../imageUpload";

export default function Submissions() {
  const [submissions, setSubmissions] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const [actionLoading, setActionLoading] = React.useState({});
  const [bulkDeleteLoading, setBulkDeleteLoading] = React.useState(false);
  const [sourceFilter, setSourceFilter] = React.useState("all");
  const [statusFilter, setStatusFilter] = React.useState("active");
  const [champFilter, setChampFilter] = React.useState("all");
  const [avatarUploadLoading, setAvatarUploadLoading] = React.useState({});
  const avatarInputRef = React.useRef({});

  React.useEffect(() => {
    fetchSubmissions();
  }, []);

  const submissionById = React.useMemo(
    () => Object.fromEntries(submissions.map((submission) => [submission.id, submission])),
    [submissions]
  );

  const rejectedCount = React.useMemo(
    () => submissions.filter((m) => m.status === "rejected").length,
    [submissions]
  );

  const getSubmissionChampRecommendation = (submission) => {
    if (submission.champ_recommendation) return submission.champ_recommendation;
    const total = Number(submission.champ_total || 0);
    if (total >= 9) return "sign_now";
    if (total >= 6) return "nurture";
    return "decline";
  };

  const filteredSubmissions = React.useMemo(
    () => submissions.filter((m) => {
      if (statusFilter === "active") {
        if (m.status === "rejected") return false;
      } else if (statusFilter !== "all") {
        if (m.status !== statusFilter) return false;
      }

      if (sourceFilter === "manychat") return m.source === "manychat";
      if (sourceFilter === "direct") return m.source !== "manychat";
      if (champFilter !== "all" && getSubmissionChampRecommendation(m) !== champFilter) return false;
      return true;
    }),
    [submissions, statusFilter, sourceFilter, champFilter]
  );

  const fetchSubmissions = async () => {
    try {
      setError("");
      const { data, error: supabaseError } = await supabase
        .from("models")
        .select("id, name, email, instagram, status, source, image_url, submitted_at, champ_total, champ_recommendation")
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
    const model = submissionById[modelId];
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

      sendModelStatusUpdateEmail(
        model,
        newStatus,
        newStatus === "approved" ? `${window.location.origin}/digitals/${modelId}` : ""
      );

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

  const quickApproveAndPipeline = async (modelId) => {
    const model = submissionById[modelId];
    if (!model) return;
    if (!window.confirm(`Approve ${model.name || "this applicant"} and move them into the signing pipeline?`)) return;
    setActionLoading(prev => ({ ...prev, [modelId]: true }));
    try {
      const updates = { status: "approved", pipeline_stage: "reviewing", last_updated: new Date().toISOString() };
      let { error: supabaseError } = await supabase.from("models").update(updates).eq("id", modelId);
      if (supabaseError && isMissingColumnError(supabaseError)) {
        const retry = await supabase.from("models").update({ status: "approved" }).eq("id", modelId);
        supabaseError = retry.error;
      }
      if (supabaseError) throw supabaseError;
      sendModelStatusUpdateEmail(model, "approved", `${window.location.origin}/digitals/${modelId}`);
      createInAppAlerts([{ title: "Model approved & pipelined", message: `${model.name || "A submission"} was approved and added to the signing pipeline.`, audience_role: "admin", source_type: "model_status", source_id: modelId, level: "success" }]);
      sendInternalTeamEmailAlert({ subject: `Approved & Pipelined: ${model.name || "Submission"}`, message: `${model.name || "A submission"} was approved and moved to the signing pipeline.\nEmail: ${model.email || "N/A"}`, roles: ["admin", "agent"], submissionEmail: model.email || "" });
      setSubmissions(prev => prev.map(m => m.id === modelId ? { ...m, status: "approved" } : m));
    } catch (err) {
      alert(`Failed to approve: ${err.message}`);
    } finally {
      setActionLoading(prev => ({ ...prev, [modelId]: false }));
    }
  };

  const moveToBrandAmbassador = async (modelId) => {
    const model = submissionById[modelId];
    if (!model) return;

    const confirmed = window.confirm(
      `Move ${model.name || "this model"} to Brand Ambassador management? This will remove the record from Model Applications.`
    );
    if (!confirmed) return;

    setActionLoading((prev) => ({ ...prev, [modelId]: true }));
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const createResp = await fetch("/api/models/move-to-brand-ambassador", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token || ""}`,
        },
        body: JSON.stringify({ modelId }),
      });

      const createJson = await createResp.json().catch(() => ({}));
      if (!createResp.ok) {
        throw new Error(createJson.error || "Failed to create brand ambassador record");
      }

      const { error: deleteError } = await supabase.from("models").delete().eq("id", modelId);
      if (deleteError) throw deleteError;

      createInAppAlerts([
        {
          title: "Submission moved to Brand Ambassador",
          message: `${model.name || "A model"} was moved from model submissions to brand ambassador management.`,
          audience_role: "admin",
          source_type: "brand_ambassador",
          source_id: (model.email || "").toLowerCase(),
          level: "info",
        },
      ]);

      sendInternalTeamEmailAlert({
        subject: `Moved to Brand Ambassador: ${model.name || "Submission"}`,
        message: `${model.name || "A model"} (${model.email || "no-email"}) was moved from model submissions to brand ambassador management.`,
        roles: ["admin", "va"],
        submissionEmail: model.email || "",
      });

      setSubmissions((prev) => prev.filter((item) => item.id !== modelId));
    } catch (err) {
      alert(err.message || "Failed to move submission");
    } finally {
      setActionLoading((prev) => ({ ...prev, [modelId]: false }));
    }
  };

  const uploadModelAvatar = async (model, file) => {
    if (!model?.id || !file) return;

    setAvatarUploadLoading((prev) => ({ ...prev, [model.id]: true }));
    try {
      const imageUrl = await uploadImage(file, `models/${model.id}`);
      const { error: updateError } = await supabase
        .from("models")
        .update({ image_url: imageUrl })
        .eq("id", model.id);

      if (updateError) throw updateError;

      setSubmissions((prev) =>
        prev.map((item) => (item.id === model.id ? { ...item, image_url: imageUrl } : item))
      );
    } catch (err) {
      alert(err.message || "Failed to upload avatar");
    } finally {
      setAvatarUploadLoading((prev) => ({ ...prev, [model.id]: false }));
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

  const FOLLOWUP_TEMPLATES = [
    { label: "Request Digitals",       template: (n) => `Hi ${n}, thank you for applying to SmithInc. The Fashion Agency. To move your application forward, please send your digital photos — full length, close-up, and profile — along with your current measurements (height, bust, waist, hips, shoe size, and location).` },
    { label: "Request Measurements",   template: (n) => `Hi ${n}, we are reviewing your profile at SmithInc. Please send your current measurements: height, bust, waist, hips, shoe size, and location so we can continue.` },
    { label: "Book Evaluation Call",   template: (n) => `Hi ${n}, we would like to schedule a brief evaluation call to discuss your application. Please reply with your availability and we will confirm a time.` },
    { label: "Decline — Not a Fit",    template: (n) => `Hi ${n}, thank you for your interest in SmithInc. The Fashion Agency. After careful review, we have decided not to move forward at this time. We appreciate you applying and wish you well.` },
  ];
  const btnS = (bg,clr,extra={}) => ({ padding:"9px 16px", background:bg, color:clr, border:"none", borderRadius:8, fontSize:12, fontWeight:600, letterSpacing:"0.07em", textTransform:"uppercase", cursor:"pointer", fontFamily:"'Inter',sans-serif", ...extra });
  const badge = (st) => {
    const m = { approved:[C.okBg,C.ok], rejected:[C.errBg,C.err], pending:[C.warnBg,C.warn] };
    const [bg,clr] = m[st] || [C.ivory,C.slate];
    return { display:"inline-flex", alignItems:"center", padding:"3px 10px", borderRadius:99, fontSize:11, fontWeight:600, letterSpacing:"0.06em", textTransform:"uppercase", background:bg, color:clr };
  };
  const champBadge = (rec) => {
    if (rec === "sign_now") return { background:C.okBg, color:C.ok, label:"Sign now" };
    if (rec === "decline") return { background:C.errBg, color:C.err, label:"Decline" };
    return { background:C.warnBg, color:C.warn, label:"Nurture" };
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

      <div style={{ display:"flex", gap:8, flexWrap:"wrap", marginBottom:18 }}>
        {[
          ["all", "All CHAMP"],
          ["sign_now", "Sign now"],
          ["nurture", "Nurture"],
          ["decline", "Decline"],
        ].map(([value, label]) => {
          const count = value === "all" ? submissions.length : submissions.filter((s) => getSubmissionChampRecommendation(s) === value).length;
          const active = champFilter === value;
          return (
            <button
              key={value}
              onClick={() => setChampFilter(value)}
              style={{
                padding:"6px 12px",
                borderRadius:99,
                border:`1px solid ${active ? C.ink : C.smoke}`,
                background:active ? C.ink : C.white,
                color:active ? C.white : C.slate,
                fontSize:11,
                fontWeight:700,
                letterSpacing:"0.05em",
                textTransform:"uppercase",
                cursor:"pointer",
                fontFamily:"'Inter',sans-serif",
              }}
            >
              {label}{count > 0 ? ` · ${count}` : ""}
            </button>
          );
        })}
      </div>

      {loading && <p style={{ color:C.dust }}>Loading applications…</p>}
      {error && <div style={{ background:C.errBg, border:`1px solid rgba(155,28,28,0.2)`, borderRadius:10, padding:"12px 16px", marginBottom:20, color:C.err, fontSize:13 }}>Error: {error}</div>}
      {!loading && submissions.length === 0 && <p style={{ color:C.dust }}>No submissions yet.</p>}
      {!loading && submissions.length > 0 && filteredSubmissions.length === 0 && <p style={{ color:C.dust }}>No submissions match the current filters.</p>}

      {!loading && filteredSubmissions.map(model => (
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
                  <span
                    style={{
                      ...badge(""),
                      background: champBadge(model.champ_recommendation).background,
                      color: champBadge(model.champ_recommendation).color,
                    }}
                  >
                    CHAMP {Number(model.champ_total || 0)}/12 · {champBadge(model.champ_recommendation).label}
                  </span>
                </div>
              </div>
              <p style={{ margin:"0 0 3px", color:C.dust, fontSize:13 }}>{model.email}</p>
              {model.instagram && <p style={{ margin:"0 0 3px", color:C.dust, fontSize:13 }}>@{model.instagram}</p>}
              <p style={{ margin:"0 0 14px", color:C.dust, fontSize:12 }}>Submitted: {new Date(model.submitted_at).toLocaleString()}</p>
              <div style={{ display:"flex", gap:8, flexWrap:"wrap", marginBottom:12 }}>
                <button
                  type="button"
                  onClick={() => avatarInputRef.current[model.id]?.click()}
                  disabled={avatarUploadLoading[model.id]}
                  style={btnS(C.ivory, C.slate, { border:`1px solid ${C.smoke}`, opacity:avatarUploadLoading[model.id]?0.55:1, cursor:avatarUploadLoading[model.id]?"not-allowed":"pointer" })}
                >
                  {avatarUploadLoading[model.id] ? "Uploading…" : "Upload Avatar"}
                </button>
                <input
                  ref={(el) => { avatarInputRef.current[model.id] = el; }}
                  type="file"
                  accept="image/*"
                  style={{ display:"none" }}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    uploadModelAvatar(model, file);
                    e.target.value = "";
                  }}
                />
              </div>

              {/* Follow-up templates */}
              <div style={{ marginBottom:12 }}>
                <p style={{ margin:"0 0 6px", fontSize:10, fontWeight:700, letterSpacing:"0.1em", textTransform:"uppercase", color:C.dust }}>Follow-up Templates</p>
                <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
                  {FOLLOWUP_TEMPLATES.map(({ label, template }) => (
                    <button
                      key={label}
                      onClick={() => navigator.clipboard.writeText(template(model.name || "there"))}
                      title={`Copy "${label}" message to clipboard`}
                      style={btnS(C.ivory, C.slate, { border:`1px solid ${C.smoke}`, padding:"6px 11px", fontSize:11 })}
                    >
                      📋 {label}
                    </button>
                  ))}
                </div>
              </div>
              {model.status === "pending" && (
                <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
                  <button onClick={()=>quickApproveAndPipeline(model.id)} disabled={actionLoading[model.id]}
                    style={btnS(C.okBg,C.ok,{ border:`1px solid rgba(26,102,54,0.4)`, opacity:actionLoading[model.id]?0.55:1, cursor:actionLoading[model.id]?"not-allowed":"pointer", fontWeight:800 })}>
                    {actionLoading[model.id] ? "…" : "⚡ Approve & Pipeline"}
                  </button>
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
              <div style={{ display:"flex", gap:8, flexWrap:"wrap", marginTop: model.status === "pending" ? 8 : 0 }}>
                <button onClick={()=>moveToBrandAmbassador(model.id)} disabled={actionLoading[model.id]}
                  style={btnS("rgba(8,145,178,0.09)","#0e7490",{ border:"1px solid rgba(8,145,178,0.25)", opacity:actionLoading[model.id]?0.55:1, cursor:actionLoading[model.id]?"not-allowed":"pointer" })}>
                  {actionLoading[model.id] ? "…" : "Move to Brand Ambassador"}
                </button>
              </div>
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
