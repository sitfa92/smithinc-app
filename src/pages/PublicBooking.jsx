import React from "react";
import { supabase } from "../supabase";
import { sendBookingConfirmationEmail } from "../emailService";
import { createInAppAlerts, sendInternalTeamEmailAlert, sendZapierEvent, sendBackendWebhook } from "../utils";
import "../App.css";

const inp = {
  width:"100%", padding:"12px 14px", fontSize:14, color:"#111",
  background:"#fff", border:"1px solid #e8e4dc", borderRadius:8,
  outline:"none", fontFamily:"'Inter',sans-serif", boxSizing:"border-box",
};

export default function PublicBooking() {
  const intent = React.useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get("intent") || window.localStorage.getItem("ms-intent") || "portfolio";
  }, []);

  const bookingContent = intent === "industry"
    ? {
        title: "Industry Guidance Session",
        sub: "Ask questions, get direction, and learn the industry with a tailored consultation.",
        service: "Consultation",
        button: "Book Industry Consult",
        success: "Your consultation request is in.",
      }
    : {
        title: "Build Your Portfolio",
        sub: "Book a portfolio-focused session for creative direction, photos, and positioning.",
        service: "Photoshoot",
        button: "Book Portfolio Session",
        success: "Your portfolio session request is in.",
      };

  const [form, setForm] = React.useState({ name:"", email:"", company:"", service_type:bookingContent.service, preferred_date:"", message:"", referral_source:"", referral_name:"" });
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");
  const [success, setSuccess] = React.useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault(); setError(""); setLoading(true);
    try {
      if (!form.name.trim() || !form.email.trim() || !form.company.trim())
        throw new Error("Name, email, and company are required");

      const referralNote = [
        form.referral_source ? `How they heard: ${form.referral_source}` : "",
        form.referral_name.trim() ? `Referred by: ${form.referral_name.trim()}` : "",
      ].filter(Boolean).join(" | ");
      const fullMessage = [form.message.trim(), referralNote].filter(Boolean).join("\n");

      const { error: supabaseError } = await supabase.from("bookings").insert([{
        name:form.name.trim(), email:form.email.trim(), company:form.company.trim(),
        service_type:form.service_type, preferred_date:form.preferred_date,
        message:fullMessage, status:"pending", created_at:new Date().toISOString(),
      }]);
      if (supabaseError) throw supabaseError;

      sendBookingConfirmationEmail({ name:form.name.trim(), email:form.email.trim(), company:form.company.trim(), service_type:form.service_type, preferred_date:form.preferred_date });
      createInAppAlerts([
        { title:"New booking request", message:`${form.name.trim()} from ${form.company.trim()} submitted a booking request.`, audience_role:"admin", source_type:"booking", source_id:form.email.trim().toLowerCase() },
        { title:"Booking follow-up needed", message:`${form.name.trim()} submitted a booking request that needs confirmation.`, audience_role:"va", source_type:"booking", source_id:form.email.trim().toLowerCase() },
      ]);
      sendInternalTeamEmailAlert({ subject:`New booking request: ${form.name.trim()}`, message:`${form.name.trim()} from ${form.company.trim()} submitted a booking request.\nEmail: ${form.email.trim()}\nService: ${form.service_type}`, roles:["admin","va"], submissionEmail:form.email.trim() });
      sendZapierEvent("booking.created", { name:form.name.trim(), email:form.email.trim(), company:form.company.trim(), service_type:form.service_type, preferred_date:form.preferred_date, message:form.message.trim() });
      sendBackendWebhook("booking", { client:form.company.trim(), name:form.name.trim(), email:form.email.trim(), service_type:form.service_type, preferred_date:form.preferred_date });

      setSuccess(true);
      setForm({ name:"", email:"", company:"", service_type:bookingContent.service, preferred_date:"", message:"", referral_source:"", referral_name:"" });
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err.message || "Failed to submit booking. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="lx-auth-screen">
        <div className="lx-auth-panel" style={{ textAlign:"center" }}>
          <div style={{ fontSize:40, marginBottom:16 }}>✦</div>
          <h1 className="lx-auth-title">Request Received</h1>
          <p style={{ color:"#888", fontSize:14, lineHeight:1.7, marginTop:8 }}>
            {bookingContent.success}<br/>We'll confirm your booking shortly.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="lx-auth-screen" style={{ alignItems:"flex-start", paddingTop:48 }}>
      <div className="lx-auth-panel wide" style={{ padding:"48px 44px" }}>
        <div className="lx-auth-brand">Meet Serenity</div>
        <h1 className="lx-auth-title">{bookingContent.title}</h1>
        <p className="lx-auth-sub">{bookingContent.sub}</p>

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
            <label className="lx-label">Company / Brand *</label>
            <input value={form.company} placeholder="Your company name" onChange={(e)=>setForm({...form,company:e.target.value})} disabled={loading} style={inp} />
          </div>
          <div className="lx-field">
            <label className="lx-label">Service Type</label>
            <select value={form.service_type} onChange={(e)=>setForm({...form,service_type:e.target.value})} disabled={loading} style={inp}>
              <option value="Model Booking">Model Booking</option>
              <option value="Creative Direction">Creative Direction</option>
              <option value="Photoshoot">Photoshoot</option>
              <option value="Consultation">Consultation</option>
            </select>
          </div>
          <div className="lx-field">
            <label className="lx-label">Preferred Date</label>
            <input value={form.preferred_date} type="date" onChange={(e)=>setForm({...form,preferred_date:e.target.value})} disabled={loading} style={inp} />
          </div>
          <div className="lx-field">
            <label className="lx-label">Message / Notes</label>
            <textarea value={form.message} placeholder="Tell us more about your project…" onChange={(e)=>setForm({...form,message:e.target.value})} disabled={loading}
              style={{ ...inp, minHeight:110, resize:"vertical" }} />
          </div>

          <div style={{ borderTop:"1px solid #e8e4dc", margin:"20px 0 18px", paddingTop:18 }}>
            <div style={{ fontSize:11, fontWeight:700, letterSpacing:"0.1em", textTransform:"uppercase", color:"#888", marginBottom:14 }}>How did you find us?</div>
            <div className="lx-field">
              <label className="lx-label">How did you hear about us?</label>
              <select value={form.referral_source} onChange={(e)=>setForm({...form,referral_source:e.target.value})} disabled={loading} style={inp}>
                <option value="">Select an option…</option>
                <option value="Instagram">Instagram</option>
                <option value="TikTok">TikTok</option>
                <option value="Google">Google</option>
                <option value="Referred by a friend or contact">Referred by a friend or contact</option>
                <option value="Event">Event</option>
                <option value="Word of mouth">Word of mouth</option>
                <option value="Other">Other</option>
              </select>
            </div>
            {(form.referral_source === "Referred by a friend or contact" || form.referral_source === "Other" || form.referral_source === "Word of mouth") && (
              <div className="lx-field">
                <label className="lx-label">Referred by (name or @handle)</label>
                <input value={form.referral_name} placeholder="e.g. Jane Smith or @janedoe" onChange={(e)=>setForm({...form,referral_name:e.target.value})} disabled={loading} style={inp} />
              </div>
            )}
          </div>

          {error && <div style={{ background:"#fef2f2", border:"1px solid rgba(155,28,28,0.2)", borderRadius:8, padding:"10px 14px", marginBottom:16, color:"#9b1c1c", fontSize:13 }}>{error}</div>}

          <button disabled={loading} className={`lx-btn lx-btn-primary lx-btn-full${loading?" lx-btn-disabled":""}`} style={{ marginTop:4, padding:"14px 22px", fontSize:12 }}>
            {loading ? "Sending…" : bookingContent.button}
          </button>
        </form>
      </div>
    </div>
  );
}
