import React from "react";
import { Link } from "react-router-dom";
import { getInsightGuides } from "../content/insights";

const guides = getInsightGuides();

const C = {
  ink: "#111111",
  slate: "#4a4a4a",
  dust: "#888888",
  smoke: "#e8e4dc",
  canvas: "#f5f2ec",
  white: "#ffffff",
  gold: "#c9a84c",
};

export default function InsightsHub() {
  return (
    <div style={{ minHeight: "100vh", background: C.canvas, padding: "0 0 56px" }}>
      <div style={{ borderBottom: `1px solid ${C.smoke}`, background: "rgba(255,255,255,0.92)", backdropFilter: "blur(14px)", padding: "18px 22px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <Link to="/" style={{ textDecoration: "none", color: C.ink, fontFamily: "'Cormorant Garamond',Georgia,serif", fontSize: 18, letterSpacing: "0.14em", textTransform: "uppercase" }}>
          Meet Serenity
        </Link>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Link to="/model-development" style={topLinkStyle}>Model Development</Link>
          <Link to="/book" style={topLinkStyle}>Book</Link>
          <Link to="/model-signup" style={topLinkStyle}>Apply</Link>
        </div>
      </div>

      <main style={{ maxWidth: 1040, margin: "0 auto", padding: "42px 18px 0" }}>
        <div style={{ marginBottom: 20 }}>
          <div style={{ color: C.gold, fontSize: 11, fontWeight: 700, letterSpacing: "0.13em", textTransform: "uppercase", marginBottom: 10 }}>
            Insight Library
          </div>
          <h1 style={{ margin: "0 0 10px", color: C.ink, fontFamily: "'Cormorant Garamond',Georgia,serif", fontSize: "clamp(32px,5vw,52px)", lineHeight: 1.05 }}>
            Fashion consulting and model growth guides
          </h1>
          <p style={{ margin: 0, maxWidth: 760, color: C.slate, fontSize: 15, lineHeight: 1.75 }}>
            Explore practical, plain-language guidance for portfolio quality, booking readiness, and long-term model development.
            Each guide is mapped to real submission and booking workflows inside Meet Serenity.
          </p>
        </div>

        <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: 14, marginBottom: 24 }}>
          {guides.map((guide) => (
            <article key={guide.slug} style={{ background: C.white, border: `1px solid ${C.smoke}`, borderRadius: 14, padding: "16px 14px" }}>
              <h2 style={{ margin: "0 0 8px", color: C.ink, fontSize: 18, fontFamily: "'Cormorant Garamond',Georgia,serif", lineHeight: 1.2 }}>{guide.title}</h2>
              <p style={{ margin: "0 0 10px", color: C.slate, fontSize: 13, lineHeight: 1.65 }}>{guide.snippet}</p>
              <p style={{ margin: 0, color: C.dust, fontSize: 11, lineHeight: 1.6 }}>
                Keywords: {guide.keywords.join(" · ")}
              </p>
              <Link to={`/insights/${guide.slug}`} style={{ display: "inline-flex", marginTop: 10, textDecoration: "none", color: "#111", border: "1px solid #111", borderRadius: 8, padding: "8px 10px", fontSize: 11, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase" }}>
                Read guide
              </Link>
            </article>
          ))}
        </section>

        <section style={{ background: C.white, border: `1px solid ${C.smoke}`, borderRadius: 14, padding: "16px 14px" }}>
          <h2 style={{ margin: "0 0 10px", color: C.ink, fontSize: 20, fontFamily: "'Cormorant Garamond',Georgia,serif" }}>
            Continue with a next action
          </h2>
          <p style={{ margin: "0 0 12px", color: C.slate, fontSize: 14, lineHeight: 1.7 }}>
            Use one of these pages to move from learning to action.
          </p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Link to="/book" style={ctaStyle}>Book a Consultation</Link>
            <Link to="/model-signup" style={ctaStyle}>Apply as a Model</Link>
            <Link to="/partner-submit" style={ctaStyle}>Partner Submission</Link>
            <Link to="/brand-ambassador-submit" style={ctaStyle}>Ambassador Submission</Link>
            <Link to="/contact-team" style={ctaStyle}>Contact Team</Link>
          </div>
        </section>
      </main>
    </div>
  );
}

const topLinkStyle = {
  textDecoration: "none",
  color: "#111",
  border: "1px solid #e8e4dc",
  borderRadius: 8,
  padding: "8px 12px",
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: "0.07em",
  textTransform: "uppercase",
  fontFamily: "'Inter',sans-serif",
};

const ctaStyle = {
  textDecoration: "none",
  color: "#111",
  border: "1px solid #111",
  borderRadius: 8,
  padding: "9px 12px",
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: "0.07em",
  textTransform: "uppercase",
  fontFamily: "'Inter',sans-serif",
  background: "#fff",
};
