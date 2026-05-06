import React from "react";
import { Link } from "react-router-dom";

const C = {
  ink: "#111111",
  slate: "#4a4a4a",
  dust: "#7b7b7b",
  line: "#e8e4dc",
  ivory: "#faf8f4",
  white: "#ffffff",
  gold: "#c9a84c",
  ok: "#1a6636",
  okBg: "#edf7ee",
  err: "#b42318",
  errBg: "#fef2f2",
};

export default function LeaveReview() {
  const [loading, setLoading] = React.useState(false);
  const [success, setSuccess] = React.useState("");
  const [error, setError] = React.useState("");
  const [form, setForm] = React.useState({
    reviewer_name: "",
    reviewer_email: "",
    review_type: "program",
    rating: "",
    review_text: "",
  });

  const submit = async (e) => {
    e.preventDefault();
    if (loading) return;

    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const resp = await fetch("/api/voice-reviews/public-submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reviewer_name: form.reviewer_name,
          reviewer_email: form.reviewer_email,
          review_type: form.review_type,
          rating: form.rating === "" ? null : Number(form.rating),
          review_text: form.review_text,
        }),
      });
      const json = await resp.json().catch(() => ({}));
      if (!resp.ok || !json.ok) throw new Error(json.error || "Could not submit review.");
      setSuccess("Thank you. Your review has been received and sent to our admin team.");
      setForm({ reviewer_name: "", reviewer_email: "", review_type: "program", rating: "", review_text: "" });
    } catch (err) {
      setError(err.message || "Could not submit review.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(180deg, #faf8f4 0%, #ffffff 68%)", padding: "28px 14px 54px" }}>
      <div style={{ maxWidth: 760, margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", marginBottom: 8 }}>
          <div style={{ fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: C.dust, fontWeight: 700 }}>
            Meet Serenity Reviews
          </div>
          <Link to="/" style={{ textDecoration: "none", fontSize: 12, color: C.slate, border: `1px solid ${C.line}`, borderRadius: 8, padding: "7px 10px" }}>
            Back to home
          </Link>
        </div>

        <h1 style={{ margin: "0 0 8px", fontFamily: "'Cormorant Garamond', Georgia, serif", color: C.ink, fontSize: "clamp(30px,6vw,44px)", lineHeight: 1.04 }}>
          Leave a review
        </h1>
        <p style={{ margin: "0 0 16px", color: C.slate, fontSize: 14, lineHeight: 1.6 }}>
          Share your experience using the app, coaching process, or your interaction with our team.
        </p>

        {success && (
          <div style={{ background: C.okBg, border: "1px solid rgba(26,102,54,0.2)", color: C.ok, borderRadius: 10, padding: "10px 12px", marginBottom: 12, fontSize: 13 }}>
            {success}
          </div>
        )}
        {error && (
          <div style={{ background: C.errBg, border: "1px solid rgba(180,35,24,0.2)", color: C.err, borderRadius: 10, padding: "10px 12px", marginBottom: 12, fontSize: 13 }}>
            {error}
          </div>
        )}

        <form onSubmit={submit} style={{ background: C.white, border: `1px solid ${C.line}`, borderRadius: 14, boxShadow: "0 8px 22px rgba(17,17,17,0.05)", padding: "16px 14px", display: "grid", gap: 10 }}>
          <input value={form.reviewer_name} onChange={(e) => setForm((p) => ({ ...p, reviewer_name: e.target.value }))} placeholder="Your name (optional)" style={{ border: `1px solid ${C.line}`, borderRadius: 8, padding: "10px 11px", fontSize: 14 }} />
          <input value={form.reviewer_email} onChange={(e) => setForm((p) => ({ ...p, reviewer_email: e.target.value }))} placeholder="Email (optional)" style={{ border: `1px solid ${C.line}`, borderRadius: 8, padding: "10px 11px", fontSize: 14 }} />

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <select value={form.review_type} onChange={(e) => setForm((p) => ({ ...p, review_type: e.target.value }))} style={{ border: `1px solid ${C.line}`, borderRadius: 8, padding: "10px 11px", fontSize: 14 }}>
              <option value="program">Program experience</option>
              <option value="company">Company/service experience</option>
            </select>
            <input type="number" min="1" max="5" value={form.rating} onChange={(e) => setForm((p) => ({ ...p, rating: e.target.value }))} placeholder="Rating 1-5 (optional)" style={{ width: 180, border: `1px solid ${C.line}`, borderRadius: 8, padding: "10px 11px", fontSize: 14 }} />
          </div>

          <textarea value={form.review_text} onChange={(e) => setForm((p) => ({ ...p, review_text: e.target.value }))} rows={6} placeholder="Tell us about your experience..." style={{ border: `1px solid ${C.line}`, borderRadius: 8, padding: "10px 11px", fontSize: 14, resize: "vertical", lineHeight: 1.6 }} />

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <div style={{ fontSize: 12, color: C.dust }}>
              Reviews are moderated before publishing.
            </div>
            <button type="submit" disabled={loading || !form.review_text.trim()} style={{ border: "none", borderRadius: 999, padding: "10px 16px", background: loading ? "#bbb" : C.gold, color: C.ink, fontSize: 12, letterSpacing: "0.08em", textTransform: "uppercase", fontWeight: 700, cursor: loading ? "not-allowed" : "pointer" }}>
              {loading ? "Sending..." : "Submit review"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
