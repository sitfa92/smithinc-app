import React from "react";
import { supabase } from "../supabase";
import { sendBookingConfirmationEmail } from "../emailService";
import { createInAppAlerts, sendInternalTeamEmailAlert, sendZapierEvent, sendBackendWebhook } from "../utils";

export default function PublicBooking() {
  const [form, setForm] = React.useState({
    name: "",
    email: "",
    company: "",
    service_type: "Model Booking",
    preferred_date: "",
    message: "",
  });
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");
  const [success, setSuccess] = React.useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (!form.name.trim() || !form.email.trim() || !form.company.trim()) {
        throw new Error("Name, email, and company are required");
      }

      const { error: supabaseError } = await supabase
        .from("bookings")
        .insert([
          {
            name: form.name.trim(),
            email: form.email.trim(),
            company: form.company.trim(),
            service_type: form.service_type,
            preferred_date: form.preferred_date,
            message: form.message.trim(),
            status: "pending",
            created_at: new Date().toISOString(),
          },
        ]);

      if (supabaseError) throw supabaseError;

      sendBookingConfirmationEmail({
        name: form.name.trim(),
        email: form.email.trim(),
        company: form.company.trim(),
        service_type: form.service_type,
        preferred_date: form.preferred_date,
      });

      createInAppAlerts([
        {
          title: "New booking request",
          message: `${form.name.trim()} from ${form.company.trim()} submitted a booking request.`,
          audience_role: "admin",
          source_type: "booking",
          source_id: form.email.trim().toLowerCase(),
        },
        {
          title: "Booking follow-up needed",
          message: `${form.name.trim()} submitted a booking request that needs confirmation.`,
          audience_role: "va",
          source_type: "booking",
          source_id: form.email.trim().toLowerCase(),
        },
      ]);

      sendInternalTeamEmailAlert({
        subject: `New booking request: ${form.name.trim()}`,
        message: `${form.name.trim()} from ${form.company.trim()} submitted a booking request.\nEmail: ${form.email.trim()}\nService: ${form.service_type}`,
        roles: ["admin", "va"],
        submissionEmail: form.email.trim(),
      });

      sendZapierEvent("booking.created", {
        name: form.name.trim(),
        email: form.email.trim(),
        company: form.company.trim(),
        service_type: form.service_type,
        preferred_date: form.preferred_date,
        message: form.message.trim(),
      });

      sendBackendWebhook("booking", {
        client: form.company.trim(),
        name: form.name.trim(),
        email: form.email.trim(),
        service_type: form.service_type,
        preferred_date: form.preferred_date,
      });

      setSuccess(true);
      setForm({ name: "", email: "", company: "", service_type: "Model Booking", preferred_date: "", message: "" });
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err.message || "Failed to submit booking. Please try again.");
      console.error("Booking error:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: "20px", maxWidth: "600px", margin: "0 auto", boxSizing: "border-box" }}>
      <h1 style={{ fontSize: "clamp(24px, 5vw, 32px)" }}>Book Our Services</h1>
      <p style={{ color: "#666", marginBottom: 30 }}>
        Interested in booking talent or services? Let's connect.
      </p>

      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: 20 }}>
          <label style={{ display: "block", marginBottom: 8, fontWeight: "bold" }}>Full Name *</label>
          <input value={form.name} placeholder="Your full name" onChange={(e) => setForm({ ...form, name: e.target.value })} disabled={loading}
            style={{ width: "100%", padding: "12px", boxSizing: "border-box", fontSize: "16px", border: "1px solid #ccc", borderRadius: "4px" }} />
        </div>

        <div style={{ marginBottom: 20 }}>
          <label style={{ display: "block", marginBottom: 8, fontWeight: "bold" }}>Email *</label>
          <input value={form.email} placeholder="your@email.com" type="email" onChange={(e) => setForm({ ...form, email: e.target.value })} disabled={loading}
            style={{ width: "100%", padding: "12px", boxSizing: "border-box", fontSize: "16px", border: "1px solid #ccc", borderRadius: "4px" }} />
        </div>

        <div style={{ marginBottom: 20 }}>
          <label style={{ display: "block", marginBottom: 8, fontWeight: "bold" }}>Company / Brand *</label>
          <input value={form.company} placeholder="Your company name" onChange={(e) => setForm({ ...form, company: e.target.value })} disabled={loading}
            style={{ width: "100%", padding: "12px", boxSizing: "border-box", fontSize: "16px", border: "1px solid #ccc", borderRadius: "4px" }} />
        </div>

        <div style={{ marginBottom: 20 }}>
          <label style={{ display: "block", marginBottom: 8, fontWeight: "bold" }}>Service Type *</label>
          <select value={form.service_type} onChange={(e) => setForm({ ...form, service_type: e.target.value })} disabled={loading}
            style={{ width: "100%", padding: "12px", boxSizing: "border-box", fontSize: "16px", border: "1px solid #ccc", borderRadius: "4px" }}>
            <option value="Model Booking">Model Booking</option>
            <option value="Creative Direction">Creative Direction</option>
            <option value="Photoshoot">Photoshoot</option>
            <option value="Consultation">Consultation</option>
          </select>
        </div>

        <div style={{ marginBottom: 20 }}>
          <label style={{ display: "block", marginBottom: 8, fontWeight: "bold" }}>Preferred Date</label>
          <input value={form.preferred_date} type="date" onChange={(e) => setForm({ ...form, preferred_date: e.target.value })} disabled={loading}
            style={{ width: "100%", padding: "12px", boxSizing: "border-box", fontSize: "16px", border: "1px solid #ccc", borderRadius: "4px" }} />
        </div>

        <div style={{ marginBottom: 20 }}>
          <label style={{ display: "block", marginBottom: 8, fontWeight: "bold" }}>Message / Notes</label>
          <textarea value={form.message} placeholder="Tell us more about your project..." onChange={(e) => setForm({ ...form, message: e.target.value })} disabled={loading}
            style={{ width: "100%", padding: "12px", boxSizing: "border-box", minHeight: 120, fontFamily: "inherit", fontSize: "16px", border: "1px solid #ccc", borderRadius: "4px" }} />
        </div>

        <button disabled={loading}
          style={{ width: "100%", padding: "12px", backgroundColor: loading ? "#ccc" : "#333", color: "white", border: "none", borderRadius: 4, fontSize: 16, fontWeight: "bold", cursor: loading ? "not-allowed" : "pointer" }}>
          {loading ? "Sending..." : "Send Booking Request"}
        </button>
      </form>

      {error && (
        <div style={{ color: "#d32f2f", marginTop: 20, padding: 15, backgroundColor: "#ffebee", borderRadius: 4 }}>{error}</div>
      )}
      {success && (
        <div style={{ color: "#388e3c", marginTop: 20, padding: 15, backgroundColor: "#e8f5e9", borderRadius: 4 }}>
          ✓ Booking request submitted! We'll get back to you shortly.
        </div>
      )}
    </div>
  );
}
