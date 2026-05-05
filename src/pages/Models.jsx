import React from "react";
import { supabase } from "../supabase";
import { useAuth } from "../auth";
import { isMissingColumnError, sendZapierEvent, sendBackendWebhook } from "../utils";
import { listDigitalsForModel } from "../imageUpload";
import LuxuryPhotoCarousel from "../components/LuxuryPhotoCarousel";

export default function Models() {
  const { role } = useAuth();
  const [models, setModels] = React.useState([]);
  const [imageLoadFailed, setImageLoadFailed] = React.useState({});
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
  const canViewTemplates = role === "admin" || role === "va";

  const MODEL_FOLLOWUP_TEMPLATES = [
    { label: "Request Digitals",     template: (n) => `Hi ${n}, thank you for applying to SmithInc. The Fashion Agency. To move your application forward, please send your digital photos — full length, close-up, and profile — along with your current measurements (height, bust, waist, hips, shoe size, and location).` },
    { label: "Request Measurements", template: (n) => `Hi ${n}, we are reviewing your profile at SmithInc. Please send your current measurements: height, bust, waist, hips, shoe size, and location so we can continue.` },
    { label: "Book Eval Call",       template: (n) => `Hi ${n}, we would like to schedule a brief evaluation call to discuss your application. Please reply with your availability and we will confirm a time.` },
    { label: "Decline — Not a Fit",  template: (n) => `Hi ${n}, thank you for your interest in SmithInc. The Fashion Agency. After careful review, we have decided not to move forward at this time. We appreciate you applying and wish you well.` },
    { label: "Welcome — Signed",     template: (n) => `Hi ${n}, welcome to SmithInc. The Fashion Agency. We are pleased to confirm your signing. Our team will be in touch shortly with your onboarding details.` },
  ];

  const [expandedDigitals, setExpandedDigitals] = React.useState({});   // { [modelId]: { open, loading, files } }
  const [copiedTpl, setCopiedTpl] = React.useState({});

  const toggleDigitals = async (model) => {
    const modelId = model?.id;
    if (!modelId) return;
    setExpandedDigitals(prev => {
      const cur = prev[modelId];
      if (cur?.open) return { ...prev, [modelId]: { ...cur, open: false } };
      return { ...prev, [modelId]: { open: true, loading: true, files: cur?.files || [] } };
    });
    try {
      const files = await listDigitalsForModel({
        id: modelId,
        email: model.email,
        instagram: model.instagram,
        folder: `digitals/${modelId}`,
      });
      setExpandedDigitals(prev => ({ ...prev, [modelId]: { open: true, loading: false, files } }));
    } catch {
      setExpandedDigitals(prev => ({ ...prev, [modelId]: { open: true, loading: false, files: [] } }));
    }
  };

  const fetchModels = async () => {
    try {
      setError("");
      const { data, error } = await supabase
        .from("models")
        .select("id, name, email, instagram, status, source, image_url, submitted_at, created_at")
        .order("submitted_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      setModels(data || []);
      setImageLoadFailed({});
    } catch (err) {
      setError(err.message || "Failed to load models");
    } finally {
      setLoading(false);
    }
  };

  const getModelImageSrc = React.useCallback((imageUrl) => {
    const raw = String(imageUrl || "").trim();
    if (!raw) return "";

    // Some older records stored signed URLs that expire. Convert to public URL shape.
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

  const approved = React.useMemo(() => models.filter((m) => m.status === "approved").length, [models]);
  const pending = React.useMemo(() => models.filter((m) => m.status === "pending").length, [models]);
  const modelMetricCards = React.useMemo(
    () => [
      { label: "Total Models", value: models.length },
      { label: "Approved Talent", value: approved },
      { label: "Pending Review", value: pending },
    ],
    [models.length, approved, pending]
  );

  const C = { ink:"#111111", slate:"#4a4a4a", dust:"#888888", smoke:"#e8e4dc", ivory:"#faf8f4", white:"#ffffff", warn:"#92560a", warnBg:"#fef8ec", ok:"#1a6636", okBg:"#edf7ee", err:"#9b1c1c", errBg:"#fef2f2" };
  const card = { background:C.white, border:`1px solid ${C.smoke}`, borderRadius:12, padding:"16px 18px", marginBottom:12, boxShadow:"0 1px 4px rgba(17,17,17,0.04)" };
  const inp = { padding:"11px 13px", fontSize:13, color:C.ink, background:C.white, border:`1px solid ${C.smoke}`, borderRadius:8, outline:"none", fontFamily:"'Inter',sans-serif", width:"100%", boxSizing:"border-box" };
  const statusStyle = { pending:[C.warnBg,C.warn], approved:[C.okBg,C.ok], rejected:[C.errBg,C.err] };

  return (
    <div style={{ padding:"32px 24px", maxWidth:1200, margin:"0 auto" }}>
      <h1 style={{ fontFamily:"'Cormorant Garamond',Georgia,serif", fontSize:"clamp(26px,4vw,38px)", fontWeight:500, color:C.ink, letterSpacing:"-0.02em", margin:"0 0 4px" }}>
        Talent Tracking
      </h1>
      <p style={{ color:C.dust, fontSize:13, marginBottom:28 }}>Manage your model roster and track submission status.</p>

      {canAddModels && (
        <div style={{ ...card, marginBottom:24, padding:"22px 22px" }}>
          <p style={{ fontFamily:"'Cormorant Garamond',Georgia,serif", fontSize:18, fontWeight:500, color:C.ink, margin:"0 0 14px" }}>Add Model Manually</p>
          <form onSubmit={saveModel} style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
            <input value={form.name} placeholder="Model name" onChange={(e)=>setForm({...form,name:e.target.value})} required style={inp} />
            <input value={form.email} placeholder="Model email" type="email" onChange={(e)=>setForm({...form,email:e.target.value})} required style={inp} />
            <input value={form.instagram} placeholder="Instagram" onChange={(e)=>setForm({...form,instagram:e.target.value})} style={inp} />
            <input value={form.height} placeholder="Height (optional)" onChange={(e)=>setForm({...form,height:e.target.value})} style={inp} />
            <select value={form.status} onChange={(e)=>setForm({...form,status:e.target.value})} style={{ ...inp, appearance:"none", gridColumn:"1/-1" }}>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
            </select>
            {saveError && <p style={{ color:C.err, margin:0, gridColumn:"1/-1", fontSize:13 }}>{saveError}</p>}
            <button disabled={saveLoading} style={{ gridColumn:"1/-1", padding:"12px 20px", background:C.ink, color:C.white, border:"none", borderRadius:8, fontSize:12, fontWeight:600, letterSpacing:"0.08em", textTransform:"uppercase", cursor:saveLoading?"not-allowed":"pointer", opacity:saveLoading?0.55:1, fontFamily:"'Inter',sans-serif" }}>
              {saveLoading ? "Saving…" : "Add Model"}
            </button>
          </form>
        </div>
      )}

      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(130px,1fr))", gap:12, marginBottom:24 }}>
        {modelMetricCards.map(m=>(
          <div key={m.label} style={{ background:C.white, border:`1px solid ${C.smoke}`, borderRadius:12, padding:18, boxShadow:"0 1px 4px rgba(17,17,17,0.04)" }}>
            <p style={{ margin:"0 0 4px", fontSize:11, fontWeight:600, letterSpacing:"0.1em", textTransform:"uppercase", color:C.dust }}>{m.label}</p>
            <p style={{ margin:0, fontFamily:"'Cormorant Garamond',Georgia,serif", fontSize:32, fontWeight:500, color:C.ink, lineHeight:1 }}>{m.value}</p>
          </div>
        ))}
      </div>

      {loading && <p style={{ color:C.dust }}>Loading models…</p>}
      {error && <p style={{ color:C.err }}>{error}</p>}
      {!loading && models.map(model => {
        const [bg,clr] = statusStyle[model.status] || [C.ivory,C.slate];
        const dState = expandedDigitals[model.id];
        const imageSrc = getModelImageSrc(model.image_url);
        const showImage = Boolean(imageSrc) && !imageLoadFailed[model.id];
        return (
          <div key={model.id} style={card}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:12, flexWrap:"wrap" }}>
              {/* Avatar + info */}
              <div style={{ display:"flex", alignItems:"flex-start", gap:12 }}>
                {showImage ? (
                  <img
                    src={imageSrc}
                    alt={model.name}
                    loading="lazy"
                    decoding="async"
                    onError={() => setImageLoadFailed((prev) => ({ ...prev, [model.id]: true }))}
                    style={{ width:52, height:52, borderRadius:10, objectFit:"cover", flexShrink:0, border:`1px solid ${C.smoke}`, background:C.ivory }}
                  />
                ) : (
                  <div style={{ width:52, height:52, borderRadius:10, background:C.ivory, border:`1px solid ${C.smoke}`, flexShrink:0, display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"'Cormorant Garamond',Georgia,serif", fontSize:20, color:C.dust }}>
                    {(model.name || "?")[0].toUpperCase()}
                  </div>
                )}
                <div>
                  <p style={{ margin:"0 0 4px", fontSize:15, fontWeight:600, color:C.ink }}>{model.name}</p>
                  <p style={{ margin:"0 0 2px", fontSize:13, color:C.dust }}>{model.email}</p>
                  <p style={{ margin:0, fontSize:13, color:C.dust }}>{model.instagram || "No Instagram"}</p>
                </div>
              </div>
              <div style={{ display:"flex", gap:8, alignItems:"center", flexWrap:"wrap" }}>
                {model.source === "manychat" && (
                  <span style={{ padding:"3px 10px", background:"rgba(123,47,247,0.1)", color:"#7b2ff7", borderRadius:99, fontSize:11, fontWeight:600, letterSpacing:"0.05em", textTransform:"uppercase" }}>ManyChat</span>
                )}
                <span style={{ padding:"3px 10px", background:bg, color:clr, borderRadius:99, fontSize:11, fontWeight:600, letterSpacing:"0.06em", textTransform:"uppercase" }}>{model.status}</span>
                <button
                  onClick={() => navigator.clipboard.writeText(`${window.location.origin}/digitals/${model.id}`)}
                  title="Copy digitals upload link"
                  style={{ padding:"4px 10px", background:C.okBg, color:C.ok, border:`1px solid rgba(26,102,54,0.2)`, borderRadius:7, fontSize:11, fontWeight:600, letterSpacing:"0.05em", textTransform:"uppercase", cursor:"pointer", fontFamily:"'Inter',sans-serif" }}
                >
                  Copy Digitals Link
                </button>
                <button
                  onClick={() => window.open(`${window.location.origin}/digitals/${model.id}`, "_blank", "noopener,noreferrer")}
                  title="Open digitals portal"
                  style={{ padding:"4px 10px", background:C.ink, color:C.white, border:`1px solid ${C.ink}`, borderRadius:7, fontSize:11, fontWeight:600, letterSpacing:"0.05em", textTransform:"uppercase", cursor:"pointer", fontFamily:"'Inter',sans-serif" }}
                >
                  Open Digitals
                </button>
                <button
                  onClick={() => navigator.clipboard.writeText(`${window.location.origin}/talent/${model.id}`)}
                  title="Copy public portfolio link"
                  style={{ padding:"4px 10px", background:C.ivory, color:C.dust, border:`1px solid ${C.smoke}`, borderRadius:7, fontSize:11, fontWeight:600, letterSpacing:"0.05em", textTransform:"uppercase", cursor:"pointer", fontFamily:"'Inter',sans-serif" }}
                >
                  Copy Public Portfolio
                </button>
                <button
                  onClick={() => navigator.clipboard.writeText(`${window.location.origin}/portfolio/${model.id}`)}
                  title="Copy portfolio upload link"
                  style={{ padding:"4px 10px", background:C.okBg, color:C.ok, border:`1px solid rgba(26,102,54,0.2)`, borderRadius:7, fontSize:11, fontWeight:600, letterSpacing:"0.05em", textTransform:"uppercase", cursor:"pointer", fontFamily:"'Inter',sans-serif" }}
                >
                  Copy Portfolio Upload
                </button>
                <button
                  onClick={() => window.open(`${window.location.origin}/portfolio/${model.id}`, "_blank", "noopener,noreferrer")}
                  title="Open portfolio upload portal"
                  style={{ padding:"4px 10px", background:C.ink, color:C.white, border:`1px solid ${C.ink}`, borderRadius:7, fontSize:11, fontWeight:600, letterSpacing:"0.05em", textTransform:"uppercase", cursor:"pointer", fontFamily:"'Inter',sans-serif" }}
                >
                  Open Portfolio Upload
                </button>
              </div>
            </div>

            {/* Follow-up templates for admin / support lead */}
            {canViewTemplates && (
              <div style={{ marginTop:10, paddingTop:10, borderTop:`1px solid ${C.smoke}` }}>
                <p style={{ margin:"0 0 6px", fontSize:10, fontWeight:700, letterSpacing:"0.1em", textTransform:"uppercase", color:C.dust }}>Follow-up Templates</p>
                <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
                  {MODEL_FOLLOWUP_TEMPLATES.map(({ label, template }) => {
                    const tplKey = `${model.id}-${label}`;
                    const copied = !!copiedTpl[tplKey];
                    return (
                      <button
                        key={label}
                        onClick={() => {
                          navigator.clipboard.writeText(template(model.name || "there"));
                          setCopiedTpl(prev => ({ ...prev, [tplKey]: true }));
                          setTimeout(() => setCopiedTpl(prev => ({ ...prev, [tplKey]: false })), 2000);
                        }}
                        title={`Copy "${label}" message`}
                        style={{ padding:"5px 10px", background: copied ? C.okBg : C.ivory, color: copied ? C.ok : C.slate, border:`1px solid ${copied ? "rgba(26,102,54,0.3)" : C.smoke}`, borderRadius:7, fontSize:11, fontWeight:600, letterSpacing:"0.05em", textTransform:"uppercase", cursor:"pointer", fontFamily:"'Inter',sans-serif" }}
                      >
                        {copied ? "✓ Copied" : `📋 ${label}`}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Inline digitals toggle */}
            <div style={{ marginTop:10, borderTop:`1px solid ${C.smoke}`, paddingTop:10, display:"flex", alignItems:"center", gap:8 }}>
              <button
                onClick={() => toggleDigitals(model)}
                style={{ padding:"4px 12px", background:"transparent", color:C.slate, border:`1px solid ${C.smoke}`, borderRadius:7, fontSize:11, fontWeight:600, letterSpacing:"0.05em", textTransform:"uppercase", cursor:"pointer", fontFamily:"'Inter',sans-serif" }}
              >
                {dState?.open ? "Hide Digitals" : "View Digitals"}
              </button>
              {dState?.open && !dState.loading && dState.files.length > 0 && (
                <span style={{ fontSize:11, color:C.dust }}>{dState.files.length} photo{dState.files.length !== 1 ? "s" : ""}</span>
              )}
            </div>

            {dState?.open && (
              <div style={{ marginTop:10 }}>
                {dState.loading && <p style={{ color:C.dust, fontSize:13, margin:0 }}>Loading…</p>}
                {!dState.loading && dState.files.length === 0 && (
                  <p style={{ color:C.dust, fontSize:13, margin:0 }}>No digitals uploaded yet.</p>
                )}
                {!dState.loading && dState.files.length > 0 && (
                  <LuxuryPhotoCarousel files={dState.files} title="Digitals archive" />
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
