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
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");
  const [success, setSuccess] = React.useState(false);

  const handleImageChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setImage(file);
      const reader = new FileReader();
      reader.onloadend = () => setImagePreview(reader.result);
      reader.readAsDataURL(file);
    }
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
      setImage(null); setImagePreview("");
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
    <div className="lx-auth-screen" style={{ alignItems:"flex-start", paddingTop:48 }}>
      <div className="lx-auth-panel wide" style={{ padding:"48px 44px" }}>
        <div className="lx-auth-brand">Meet Serenity</div>
        <h1 className="lx-auth-title">{content.title}</h1>
        <p className="lx-auth-sub">{content.sub}</p>

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
          <div className="lx-field">
            <label className="lx-label">Profile Image * (JPG, PNG — max 5 MB)</label>
            <input type="file" accept="image/*" onChange={handleImageChange} disabled={loading}
              style={{ ...inp, padding:"10px 14px", cursor:"pointer" }} />
            {imagePreview && (
              <div style={{ marginTop:16, textAlign:"center" }}>
                <img src={imagePreview} alt="Preview"
                  style={{ maxWidth:"100%", maxHeight:280, borderRadius:12, objectFit:"cover", border:"1px solid #e8e4dc" }} />
              </div>
            )}
          </div>

          {error && <div style={{ background:"#fef2f2", border:"1px solid rgba(155,28,28,0.2)", borderRadius:8, padding:"10px 14px", marginBottom:16, color:"#9b1c1c", fontSize:13 }}>{error}</div>}

          <button disabled={loading} className={`lx-btn lx-btn-primary lx-btn-full${loading?" lx-btn-disabled":""}`} style={{ marginTop:4, padding:"14px 22px", fontSize:12 }}>
            {loading ? "Submitting…" : content.button}
          </button>
        </form>
      </div>
    </div>
  );
}
