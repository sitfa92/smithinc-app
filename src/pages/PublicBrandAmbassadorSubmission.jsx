import React from "react";
import "../App.css";

const inp = {
  width: "100%",
  padding: "12px 14px",
  fontSize: 14,
  color: "#111",
  background: "#fff",
  border: "1px solid #e8e4dc",
  borderRadius: 8,
  outline: "none",
  fontFamily: "'Inter',sans-serif",
  boxSizing: "border-box",
};

export default function PublicBrandAmbassadorSubmission() {
  const [form, setForm] = React.useState({
    name: "",
    email: "",
    company: "",
    website: "",
    notes: "",
    referral_source: "",
    referral_name: "",
  });
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");
  const [success, setSuccess] = React.useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const referralNote = [
        form.referral_source ? `How they heard: ${form.referral_source}` : "",
        form.referral_name.trim() ? `Referred by: ${form.referral_name.trim()}` : "",
      ].filter(Boolean).join(" | ");

      const payload = {
        name: form.name.trim(),
        email: form.email.trim().toLowerCase(),
        company: form.company.trim(),
        website: form.website.trim(),
        notes: [form.notes.trim(), referralNote].filter(Boolean).join("\n"),
        source: "brand_ambassador",
      };

      if (!payload.name || !payload.email) {
        throw new Error("Name and email are required");
      }

      const res = await fetch("/api/partners/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.ok) {
        throw new Error(json.error || "Failed to submit brand ambassador application");
      }

      setSuccess(true);
      setForm({ name: "", email: "", company: "", website: "", notes: "", referral_source: "", referral_name: "" });
      setTimeout(() => setSuccess(false), 3500);
    } catch (err) {
      setError(err.message || "Failed to submit brand ambassador application.");
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="lx-auth-screen">
        <div className="lx-auth-panel" style={{ textAlign: "center" }}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>✦</div>
          <h1 className="lx-auth-title">Submission Received</h1>
          <p style={{ color: "#888", fontSize: 14, lineHeight: 1.7, marginTop: 8 }}>
            Thanks for applying as a brand ambassador with Meet Serenity.<br />
            Our team will review your submission and follow up shortly.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="lx-auth-screen" style={{ alignItems: "flex-start", paddingTop: 48 }}>
      <div className="lx-auth-panel wide" style={{ padding: "48px 44px", maxWidth: 720 }}>
        <div className="lx-auth-brand">Meet Serenity</div>
        <h1 className="lx-auth-title">Brand Ambassador Submission</h1>
        <p className="lx-auth-sub">
          Submit your profile to collaborate as a brand ambassador. Our team will review fit, alignment, and next steps.
        </p>

        <form onSubmit={handleSubmit}>
          <div className="lx-field">
            <label className="lx-label">Full Name *</label>
            <input
              value={form.name}
              placeholder="Your full name"
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              disabled={loading}
              style={inp}
            />
          </div>

          <div className="lx-field">
            <label className="lx-label">Email *</label>
            <input
              value={form.email}
              placeholder="you@brand.com"
              type="email"
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              disabled={loading}
              style={inp}
            />
          </div>

          <div className="lx-field">
            <label className="lx-label">Company / Platform</label>
            <input
              value={form.company}
              placeholder="Your brand or platform"
              onChange={(e) => setForm({ ...form, company: e.target.value })}
              disabled={loading}
              style={inp}
            />
          </div>

          <div className="lx-field">
            <label className="lx-label">Website / Social Link</label>
            <input
              value={form.website}
              placeholder="https://..."
              onChange={(e) => setForm({ ...form, website: e.target.value })}
              disabled={loading}
              style={inp}
            />
          </div>

          <div className="lx-field">
            <label className="lx-label">Notes</label>
            <textarea
              value={form.notes}
              placeholder="Tell us about your audience, niche, and collaboration goals..."
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              disabled={loading}
              style={{ ...inp, minHeight: 120, resize: "vertical" }}
            />
          </div>

          <div style={{ borderTop: "1px solid #e8e4dc", margin: "20px 0 18px", paddingTop: 18 }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#888", marginBottom: 14 }}>How did you find us?</div>
            <div className="lx-field">
              <label className="lx-label">How did you hear about us?</label>
              <select value={form.referral_source} onChange={(e) => setForm({ ...form, referral_source: e.target.value })} disabled={loading} style={inp}>
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
                <input value={form.referral_name} placeholder="e.g. Jane Smith or @janedoe" onChange={(e) => setForm({ ...form, referral_name: e.target.value })} disabled={loading} style={inp} />
              </div>
            )}
          </div>

          {error && (
            <div style={{ background: "#fef2f2", border: "1px solid rgba(155,28,28,0.2)", borderRadius: 8, padding: "10px 14px", marginBottom: 16, color: "#9b1c1c", fontSize: 13 }}>
              {error}
            </div>
          )}

          <button
            disabled={loading}
            className={`lx-btn lx-btn-primary lx-btn-full${loading ? " lx-btn-disabled" : ""}`}
            style={{ marginTop: 4, padding: "14px 22px", fontSize: 12 }}
          >
            {loading ? "Submitting..." : "Submit Brand Ambassador Application"}
          </button>
        </form>
      </div>
    </div>
  );
}
