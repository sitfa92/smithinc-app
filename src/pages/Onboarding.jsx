import React from "react";
import { Link } from "react-router-dom";
import "../App.css";

const STEPS = [
  {
    number: "01",
    title: "Build your profile",
    summary: "Share your basics so the team can understand your look and goals.",
  },
  {
    number: "02",
    title: "Submit digitals",
    summary: "Upload clean digitals and images for the first review stage.",
  },
  {
    number: "03",
    title: "Get reviewed",
    summary: "The team checks your submission and decides next-step fit.",
  },
  {
    number: "04",
    title: "Join program",
    summary: "Qualified applicants move into the next phase of support and development.",
  },
];

export default function Onboarding() {
  const handleStart = () => {
    try {
      window.localStorage.setItem("ms-intent", "get-signed");
    } catch {
      // ignore storage issues
    }
  };

  return (
    <div className="lx-auth-screen" style={{ alignItems: "flex-start", paddingTop: 32, paddingBottom: 32 }}>
      <div className="lx-auth-panel wide" style={{ maxWidth: 1100, width: "min(1100px, 100%)", padding: "40px 32px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap", marginBottom: 20 }}>
          <div>
            <div className="lx-auth-brand">Meet Serenity</div>
            <h1 className="lx-auth-title" style={{ marginBottom: 6 }}>Your next steps</h1>
            <p className="lx-auth-sub" style={{ maxWidth: 640 }}>
              Instead of random features, follow the path from application to review.
            </p>
          </div>

          <Link
            to="/login"
            style={{
              textDecoration: "none",
              padding: "10px 16px",
              borderRadius: 10,
              border: "1px solid #e8e4dc",
              color: "#111",
              fontSize: 12,
              fontWeight: 600,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
            }}
          >
            Team login
          </Link>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1.1fr 0.9fr", gap: 20 }}>
          <div style={{ display: "grid", gap: 12 }}>
            {STEPS.map((step) => (
              <div
                key={step.number}
                style={{
                  textAlign: "left",
                  padding: "18px 18px",
                  borderRadius: 14,
                  border: "1px solid #e8e4dc",
                  background: "#ffffff",
                }}
              >
                <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
                  <div style={{ minWidth: 40, height: 40, borderRadius: 999, background: "#111111", color: "#ffffff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, letterSpacing: "0.08em" }}>
                    {step.number}
                  </div>
                  <div>
                    <div style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 28, color: "#111", marginBottom: 4 }}>
                      {step.title}
                    </div>
                    <div style={{ color: "#4a4a4a", fontSize: 14, lineHeight: 1.6 }}>{step.summary}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div style={{ background: "linear-gradient(180deg, #faf8f4 0%, #f5f2ec 100%)", border: "1px solid #e8e4dc", borderRadius: 16, padding: 22 }}>
            <div style={{ fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: "#888", marginBottom: 10 }}>
              Start here
            </div>
            <h2 style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 34, lineHeight: 1.05, color: "#111", margin: "0 0 10px" }}>
              Begin with your application
            </h2>
            <p style={{ color: "#4a4a4a", fontSize: 14, lineHeight: 1.7, marginBottom: 16 }}>
              The first move is to build your profile and submit your digitals. From there, the agency can review and place you into the right program.
            </p>

            <div style={{ display: "grid", gap: 10, marginBottom: 20 }}>
              {[
                "Clear step-by-step path",
                "Focused on profile, digitals, and review",
                "Built to guide applicants into the program",
              ].map((item) => (
                <div key={item} style={{ display: "flex", alignItems: "center", gap: 10, color: "#111", fontSize: 14 }}>
                  <span style={{ color: "#c9a84c", fontSize: 16 }}>✦</span>
                  <span>{item}</span>
                </div>
              ))}
            </div>

            <Link
              to="/model-signup?intent=get-signed"
              onClick={handleStart}
              className="lx-btn lx-btn-primary"
              style={{ display: "inline-flex", textDecoration: "none", padding: "14px 18px", fontSize: 12 }}
            >
              Start Step 1
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
