import React from "react";
import { Link, useParams } from "react-router-dom";
import { getInsightArticle, getRelatedGuides } from "../content/insights";

const C = {
  ink: "#111111",
  slate: "#4a4a4a",
  dust: "#888888",
  smoke: "#e8e4dc",
  canvas: "#f5f2ec",
  white: "#ffffff",
  gold: "#c9a84c",
};

export default function InsightsArticle() {
  const { slug = "" } = useParams();
  const article = getInsightArticle(slug);
  const related = getRelatedGuides(slug);

  if (!article) {
    return (
      <div style={{ minHeight: "100vh", background: C.canvas, padding: "26px 16px" }}>
        <div style={{ maxWidth: 900, margin: "0 auto", background: C.white, border: `1px solid ${C.smoke}`, borderRadius: 14, padding: "24px 18px" }}>
          <h1 style={{ margin: "0 0 10px", color: C.ink, fontFamily: "'Cormorant Garamond',Georgia,serif", fontSize: 34 }}>Insight not found</h1>
          <p style={{ margin: "0 0 14px", color: C.slate, lineHeight: 1.7 }}>The requested guide does not exist yet. Return to the insights hub and choose an available article.</p>
          <Link to="/insights" style={ctaStyle}>Back to Insights Hub</Link>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: C.canvas, padding: "0 0 48px" }}>
      <div style={{ borderBottom: `1px solid ${C.smoke}`, background: "rgba(255,255,255,0.92)", backdropFilter: "blur(14px)", padding: "16px 18px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <Link to="/insights" style={{ textDecoration: "none", color: C.ink, fontSize: 12, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>Back to Insights</Link>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Link to="/book" style={topLinkStyle}>Book</Link>
          <Link to="/model-signup" style={topLinkStyle}>Apply</Link>
          <Link to="/contact-team" style={topLinkStyle}>Contact</Link>
        </div>
      </div>

      <main style={{ maxWidth: 920, margin: "0 auto", padding: "34px 16px 0" }}>
        <article style={{ background: C.white, border: `1px solid ${C.smoke}`, borderRadius: 14, padding: "22px 16px" }}>
          <h1 style={{ margin: "0 0 10px", color: C.ink, fontFamily: "'Cormorant Garamond',Georgia,serif", fontSize: "clamp(30px,4.8vw,50px)", lineHeight: 1.08 }}>
            {article.title}
          </h1>
          <p style={{ margin: "0 0 18px", color: C.slate, fontSize: 15, lineHeight: 1.8 }}>{article.intro}</p>

          {article.sections.map((section) => (
            <section key={section.heading} style={{ marginBottom: 16 }}>
              <h2 style={{ margin: "0 0 6px", color: C.ink, fontFamily: "'Cormorant Garamond',Georgia,serif", fontSize: 30, lineHeight: 1.1 }}>
                {section.heading}
              </h2>
              <p style={{ margin: 0, color: C.slate, fontSize: 15, lineHeight: 1.85 }}>{section.body}</p>
            </section>
          ))}

          <section style={{ marginTop: 8, borderTop: `1px solid ${C.smoke}`, paddingTop: 14 }}>
            <h2 style={{ margin: "0 0 10px", color: C.ink, fontFamily: "'Cormorant Garamond',Georgia,serif", fontSize: 28 }}>Frequently asked questions</h2>
            {(article.faqs || []).map((item) => (
              <article key={item.q} style={{ marginBottom: 10 }}>
                <h3 style={{ margin: "0 0 4px", color: C.ink, fontSize: 16, fontWeight: 700 }}>{item.q}</h3>
                <p style={{ margin: 0, color: C.slate, fontSize: 14, lineHeight: 1.7 }}>{item.a}</p>
              </article>
            ))}
          </section>
        </article>

        <div style={{ marginTop: 14, background: C.white, border: `1px solid ${C.smoke}`, borderRadius: 14, padding: "16px 14px" }}>
          {related.length > 0 && (
            <section style={{ marginBottom: 12, borderBottom: `1px solid ${C.smoke}`, paddingBottom: 12 }}>
              <h2 style={{ margin: "0 0 10px", color: C.ink, fontFamily: "'Cormorant Garamond',Georgia,serif", fontSize: 24 }}>Related guides</h2>
              <div style={{ display: "grid", gap: 8 }}>
                {related.map((item) => (
                  <Link key={item.slug} to={`/insights/${item.slug}`} style={{ textDecoration: "none", color: "#111", border: "1px solid #e8e4dc", borderRadius: 10, padding: "10px 12px", fontSize: 13, lineHeight: 1.5 }}>
                    {item.title}
                  </Link>
                ))}
              </div>
            </section>
          )}

          <h2 style={{ margin: "0 0 10px", color: C.ink, fontFamily: "'Cormorant Garamond',Georgia,serif", fontSize: 24 }}>Continue with action</h2>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Link to="/book" style={ctaStyle}>Book a Consultation</Link>
            <Link to="/model-signup" style={ctaStyle}>Apply as a Model</Link>
            <Link to="/partner-submit" style={ctaStyle}>Partner Submission</Link>
            <Link to="/brand-ambassador-submit" style={ctaStyle}>Ambassador Submission</Link>
            <Link to="/insights" style={ctaStyle}>More Insights</Link>
          </div>
        </div>
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
