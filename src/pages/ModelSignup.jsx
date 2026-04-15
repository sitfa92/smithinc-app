import React from "react";
import { supabase } from "../supabase";
import { uploadImage } from "../imageUpload";
import { sendModelSubmissionEmail } from "../emailService";
import {
  isMissingColumnError,
  createInAppAlerts,
  sendInternalTeamEmailAlert,
  sendBackendWebhook,
} from "../utils";
import "../App.css";

const inp = {
  width:"100%", padding:"12px 14px", fontSize:14, color:"#111",
  background:"#fff", border:"1px solid #e8e4dc", borderRadius:8,
  outline:"none", fontFamily:"'Inter',sans-serif", boxSizing:"border-box",
};

export default function ModelSignup() {
  const intent = React.useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get("intent") || window.localStorage.getItem("ms-intent") || "become-model";
  }, []);

  const content = intent === "get-signed"
    ? {
        title: "Get Signed to the Agency",
        sub: "Apply for representation and share your details for review.",
        button: "Apply for Representation",
        success: "Thank you for applying for representation.",
      }
    : {
        title: "Model Application",
        sub: "Join our talent roster. We'll be in touch after reviewing your submission.",
        button: "Submit Application",
        success: "Thank you for applying to Meet Serenity.",
      };

  const [form, setForm] = React.useState({ name:"", email:"", instagram:"" });
  const [image, setImage] = React.useState(null);
  const [imagePreview, setImagePreview] = React.useState("");
  const [imageMeta, setImageMeta] = React.useState(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");
  const [success, setSuccess] = React.useState(false);
  const [assistantQuestion, setAssistantQuestion] = React.useState("Am I ready to be a model?");
  const [assistantReply, setAssistantReply] = React.useState("");

  const completion = React.useMemo(() => {
    const checks = [form.name.trim(), form.email.trim(), form.instagram.trim(), image];
    return Math.round((checks.filter(Boolean).length / checks.length) * 100);
  }, [form, image]);

  const profileScore = React.useMemo(() => {
    let score = 0;
    if (form.name.trim()) score += 20;
    if (form.email.trim()) score += 20;
    if (form.instagram.trim()) score += 15;
    if (image) score += 20;
    if ((imageMeta?.width || 0) >= 1200 && (imageMeta?.height || 0) >= 1600) score += 15;
    if ((imageMeta?.height || 0) > (imageMeta?.width || 0)) score += 5;
    if ((imageMeta?.sizeMb || 0) > 0 && (imageMeta?.sizeMb || 0) <= 5) score += 5;
    return Math.min(score, 100);
  }, [form, image, imageMeta]);

  const readiness = React.useMemo(() => {
    if (profileScore >= 85) return { label: "Agency Ready", color: "#1a6636", bg: "#edf7ee", note: "Your submission looks polished and review-ready." };
    if (profileScore >= 65) return { label: "Strong Submission", color: "#1e3a5f", bg: "#eff6ff", note: "A few more details can elevate your chances." };
    if (profileScore >= 40) return { label: "Building Profile", color: "#92560a", bg: "#fef8ec", note: "Complete the basics to strengthen your application." };
    return { label: "Getting Started", color: "#888888", bg: "#faf8f4", note: "Add your profile details to unlock a stronger score." };
  }, [profileScore]);

  const photoFeedback = React.useMemo(() => {
    if (!image) {
      return ["Upload a clean headshot or digital to unlock instant review feedback."];
    }

    const feedback = [];
    if ((imageMeta?.type || "").includes("jpeg") || (imageMeta?.type || "").includes("png")) {
      feedback.push("Accepted format detected — great for agency review.");
    } else {
      feedback.push("Use a JPG or PNG image for the smoothest review process.");
    }

    if ((imageMeta?.width || 0) >= 1200 && (imageMeta?.height || 0) >= 1600) {
      feedback.push("Resolution looks strong and presentation-ready.");
    } else {
      feedback.push("A higher-resolution image would improve clarity for scouts.");
    }

    if ((imageMeta?.height || 0) > (imageMeta?.width || 0)) {
      feedback.push("Portrait framing detected — ideal for model digitals.");
    } else {
      feedback.push("A portrait-oriented photo usually performs better for submissions.");
    }

    if ((imageMeta?.sizeMb || 0) > 5) {
      feedback.push("The file is above the 5 MB target, so a lighter export is recommended.");
    } else {
      feedback.push("File size is reviewer-friendly and easy to process.");
    }

    return feedback;
  }, [image, imageMeta]);

  const improvementList = React.useMemo(() => {
    const items = [];
    if (!form.name.trim()) items.push("Add your full name so the team can identify your submission clearly.");
    if (!form.email.trim()) items.push("Include a working email so scouts can contact you quickly.");
    if (!form.instagram.trim()) items.push("Add your Instagram or portfolio handle to strengthen your profile.");
    if (!image) items.push("Upload clean digitals or a strong headshot to unlock visual review.");
    if (image && (imageMeta?.width || 0) < 1200) items.push("Use a sharper, higher-resolution image for better presentation.");
    if (image && (imageMeta?.height || 0) <= (imageMeta?.width || 0)) items.push("A portrait-oriented image will feel more agency-ready.");
    return items.slice(0, 3);
  }, [form, image, imageMeta]);

  const buildAssistantReply = React.useCallback((questionText) => {
    const q = (questionText || "").trim().toLowerCase();
    const name = form.name.trim() || "there";

    if (q.includes("ready")) {
      return `${name}, based on your current profile, you are ${completion}% complete with a profile score of ${profileScore}/100. Your current status is ${readiness.label}. ${readiness.note} ${improvementList.length ? `To improve further, focus on ${improvementList[0].toLowerCase()}` : "You look ready to submit."}`;
    }

    if (q.includes("improve") || q.includes("better")) {
      return improvementList.length
        ? `Here’s what I would improve next: ${improvementList.join(" ")}`
        : "Your profile is already in a strong place. The next best move is to submit and wait for review.";
    }

    if (q.includes("photo") || q.includes("upload") || q.includes("digitals")) {
      return `From your current upload review: ${photoFeedback.join(" ")}`;
    }

    return `Your next step is to complete the remaining profile fields, upload your strongest image, and submit for review. Right now you are ${completion}% complete and rated ${profileScore}/100.`;
  }, [completion, form.name, improvementList, photoFeedback, profileScore, readiness.label, readiness.note]);

  const askAssistant = (questionText) => {
    const nextQuestion = (questionText || assistantQuestion || "Am I ready to be a model?").trim();
    setAssistantQuestion(nextQuestion);
    setAssistantReply(buildAssistantReply(nextQuestion));
  };

  React.useEffect(() => {
    setAssistantReply(buildAssistantReply(assistantQuestion));
  }, [assistantQuestion, buildAssistantReply]);

  const handleImageChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) {
      setImage(null);
      setImagePreview("");
      setImageMeta(null);
      return;
    }

    setError("");
    setImage(file);
    setImageMeta({ type: file.type, sizeMb: Number((file.size / (1024 * 1024)).toFixed(1)), width: 0, height: 0 });

    const objectUrl = URL.createObjectURL(file);
    const previewImage = new Image();
    previewImage.onload = () => {
      setImageMeta({
        type: file.type,
        sizeMb: Number((file.size / (1024 * 1024)).toFixed(1)),
        width: previewImage.width,
        height: previewImage.height,
      });
      URL.revokeObjectURL(objectUrl);
    };
    previewImage.onerror = () => URL.revokeObjectURL(objectUrl);
    previewImage.src = objectUrl;

    const reader = new FileReader();
    reader.onloadend = () => setImagePreview(reader.result);
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(""); setLoading(true);
    try {
      if (!form.name.trim() || !form.email.trim()) throw new Error("Name and email are required");
      if (!image) throw new Error("Please upload a profile image");

      let imageUrl = "";
      try { imageUrl = await uploadImage(image); }
      catch (uploadErr) { throw new Error(`Image upload failed: ${uploadErr.message}`); }

      const base = { name:form.name.trim(), email:form.email.trim(), instagram:form.instagram.trim(), image_url:imageUrl, status:"pending", submitted_at:new Date().toISOString() };
      const payload = { ...base, pipeline_stage:"submitted", priority_level:"medium", scouting_notes:"", internal_notes:"", agency_name:"", last_updated:new Date().toISOString() };

      let { error: supabaseError } = await supabase.from("models").insert([payload]);
      if (supabaseError && isMissingColumnError(supabaseError)) {
        const retry = await supabase.from("models").insert([base]);
        supabaseError = retry.error;
      }
      if (supabaseError) throw supabaseError;

      sendModelSubmissionEmail({ name:form.name.trim(), email:form.email.trim(), instagram:form.instagram.trim() });
      createInAppAlerts([
        { title:"New model submission", message:`${form.name.trim()} submitted a new application.`, audience_role:"admin", source_type:"model", source_id:form.email.trim().toLowerCase() },
        { title:"Model review needed", message:`${form.name.trim()} is ready for review in submissions.`, audience_role:"agent", source_type:"model", source_id:form.email.trim().toLowerCase() },
      ]);
      sendInternalTeamEmailAlert({ subject:`New model submission: ${form.name.trim()}`, message:`${form.name.trim()} submitted a model application.\nEmail: ${form.email.trim()}\nInstagram: ${form.instagram.trim()||"N/A"}`, roles:["admin","agent"], submissionEmail:form.email.trim() });
      sendBackendWebhook("model_signup", { name:form.name.trim(), instagram:form.instagram.trim(), height:"", status:"pending" });

      setSuccess(true);
      setForm({ name:"", email:"", instagram:"" });
      setImage(null); setImagePreview(""); setImageMeta(null);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err.message || "Failed to submit. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="lx-auth-screen">
        <div className="lx-auth-panel" style={{ textAlign:"center" }}>
          <div style={{ fontSize:48, marginBottom:16 }}>✦</div>
          <h1 className="lx-auth-title">Application Received</h1>
          <p style={{ color:"#888", fontSize:14, lineHeight:1.7, marginTop:8 }}>
            {content.success}<br/>We'll review your submission and be in touch.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="lx-auth-screen" style={{ alignItems:"flex-start", paddingTop:32, paddingBottom:32 }}>
      <div className="lx-auth-panel xwide" style={{ padding:"36px 28px" }}>
        <div className="lx-auth-brand" style={{ marginBottom:20, paddingBottom:18 }}>Meet Serenity</div>
        <h1 className="lx-auth-title" style={{ marginBottom:8 }}>{content.title}</h1>
        <p className="lx-auth-sub" style={{ maxWidth:620, margin:"0 auto 24px" }}>{content.sub}</p>

        <div className="lx-model-soft-card" style={{ marginBottom:20 }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", gap:12, flexWrap:"wrap", marginBottom:10 }}>
            <div>
              <div style={{ fontSize:11, fontWeight:700, letterSpacing:"0.1em", textTransform:"uppercase", color:"#888", marginBottom:4 }}>Application overview</div>
              <div style={{ color:"#111", fontSize:16, fontWeight:600 }}>A polished submission gives you a better first impression.</div>
            </div>
            <span style={{ display:"inline-flex", padding:"6px 10px", borderRadius:999, background:readiness.bg, color:readiness.color, fontSize:11, fontWeight:700, letterSpacing:"0.08em", textTransform:"uppercase" }}>{readiness.label}</span>
          </div>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", gap:12, marginBottom:8, flexWrap:"wrap" }}>
            <span style={{ fontSize:12, fontWeight:700, letterSpacing:"0.1em", textTransform:"uppercase", color:"#888" }}>Progress tracker</span>
            <span style={{ fontSize:13, fontWeight:600, color:"#111" }}>{completion}% complete</span>
          </div>
          <div style={{ height:10, background:"#e8e4dc", borderRadius:999, overflow:"hidden" }}>
            <div style={{ width:`${completion}%`, height:"100%", background:"linear-gradient(90deg, #111111 0%, #c9a84c 100%)", borderRadius:999, transition:"width 0.25s ease" }} />
          </div>
        </div>

        <div className="lx-model-grid">
          <div className="lx-model-stack">
            <div className="lx-model-card">
              <div style={{ fontSize:11, fontWeight:700, letterSpacing:"0.1em", textTransform:"uppercase", color:"#888", marginBottom:14 }}>Your details</div>
              <form onSubmit={handleSubmit}>
                <div className="lx-field">
                  <label className="lx-label">Full Name *</label>
                  <input value={form.name} placeholder="Your full name" onChange={(e)=>setForm({...form,name:e.target.value})} disabled={loading} style={inp} />
                </div>
                <div className="lx-field">
                  <label className="lx-label">Email *</label>
                  <input value={form.email} placeholder="your@email.com" type="email" onChange={(e)=>setForm({...form,email:e.target.value})} disabled={loading} style={inp} />
                </div>
                <div className="lx-field">
                  <label className="lx-label">Instagram Handle</label>
                  <input value={form.instagram} placeholder="@yourprofile" onChange={(e)=>setForm({...form,instagram:e.target.value})} disabled={loading} style={inp} />
                </div>
                <div className="lx-field" style={{ marginBottom:10 }}>
                  <label className="lx-label">Profile Image * (JPG, PNG — max 5 MB)</label>
                  <input type="file" accept="image/*" onChange={handleImageChange} disabled={loading}
                    style={{ ...inp, padding:"10px 14px", cursor:"pointer" }} />
                  {imagePreview && (
                    <div className="lx-model-preview">
                      <img src={imagePreview} alt="Preview" loading="lazy" decoding="async"
                        style={{ maxWidth:"100%", maxHeight:300, borderRadius:12, objectFit:"cover", border:"1px solid #e8e4dc" }} />
                    </div>
                  )}
                </div>

                {error && <div style={{ background:"#fef2f2", border:"1px solid rgba(155,28,28,0.2)", borderRadius:8, padding:"10px 14px", marginBottom:16, color:"#9b1c1c", fontSize:13 }}>{error}</div>}

                <button disabled={loading} className={`lx-btn lx-btn-primary lx-btn-full${loading?" lx-btn-disabled":""}`} style={{ marginTop:8, padding:"14px 22px", fontSize:12 }}>
                  {loading ? "Submitting…" : content.button}
                </button>
              </form>
            </div>
          </div>

          <div className="lx-model-stack">
            <div className="lx-model-inline-stats">
              <div className="lx-model-card">
                <div style={{ fontSize:11, fontWeight:700, letterSpacing:"0.1em", textTransform:"uppercase", color:"#888", marginBottom:6 }}>Profile score</div>
                <div style={{ fontFamily:"'Cormorant Garamond',Georgia,serif", fontSize:34, color:"#111" }}>{profileScore}<span style={{ fontSize:16 }}>/100</span></div>
              </div>
              <div className="lx-model-card">
                <div style={{ fontSize:11, fontWeight:700, letterSpacing:"0.1em", textTransform:"uppercase", color:"#888", marginBottom:8 }}>Agency note</div>
                <p style={{ margin:0, color:"#4a4a4a", fontSize:13, lineHeight:1.6 }}>{readiness.note}</p>
              </div>
            </div>

            <div className="lx-model-card">
              <div style={{ fontSize:11, fontWeight:700, letterSpacing:"0.1em", textTransform:"uppercase", color:"#888", marginBottom:10 }}>Photo feedback</div>
              <div style={{ display:"grid", gap:8 }}>
                {photoFeedback.slice(0, 3).map((item) => (
                  <div key={item} style={{ display:"flex", alignItems:"flex-start", gap:8, color:"#111", fontSize:13, lineHeight:1.55 }}>
                    <span style={{ color:"#c9a84c" }}>✦</span>
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="lx-model-soft-card">
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", gap:12, marginBottom:10, flexWrap:"wrap" }}>
                <div>
                  <div style={{ fontSize:11, fontWeight:700, letterSpacing:"0.1em", textTransform:"uppercase", color:"#888", marginBottom:4 }}>AI Talent Assistant</div>
                  <div style={{ color:"#111", fontSize:14, fontWeight:600 }}>Ask what to improve before you submit.</div>
                </div>
                <span style={{ display:"inline-flex", alignItems:"center", gap:6, padding:"5px 10px", borderRadius:999, background:"#111", color:"#fff", fontSize:11, fontWeight:700, letterSpacing:"0.08em", textTransform:"uppercase" }}>
                  AI advisor
                </span>
              </div>

              <div style={{ display:"flex", gap:8, flexWrap:"wrap", marginBottom:10 }}>
                {[
                  "Am I ready to be a model?",
                  "What should I improve?",
                  "How do my photos look?",
                ].map((question) => (
                  <button
                    key={question}
                    type="button"
                    onClick={() => askAssistant(question)}
                    style={{ padding:"8px 12px", borderRadius:999, border:"1px solid #e8e4dc", background:"#fff", color:"#111", fontSize:12, cursor:"pointer", fontFamily:"'Inter',sans-serif" }}>
                    {question}
                  </button>
                ))}
              </div>

              <div style={{ display:"flex", gap:8, flexWrap:"wrap", marginBottom:12 }}>
                <input
                  value={assistantQuestion}
                  onChange={(e) => setAssistantQuestion(e.target.value)}
                  placeholder="Ask about your readiness, photos, or improvements"
                  style={{ ...inp, flex:"1 1 220px", margin:0 }}
                />
                <button
                  type="button"
                  onClick={() => askAssistant(assistantQuestion)}
                  className="lx-btn lx-btn-primary"
                  style={{ padding:"12px 16px", fontSize:12 }}>
                  Ask AI
                </button>
              </div>

              <div style={{ background:"#fff", border:"1px solid #e8e4dc", borderRadius:10, padding:"12px 14px", color:"#4a4a4a", fontSize:13, lineHeight:1.65 }}>
                {assistantReply}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
