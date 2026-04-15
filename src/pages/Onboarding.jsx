import React from "react";
import { Link } from "react-router-dom";
import "../App.css";

const OPTIONS = [
  {
    id: "become-model",
    title: "Become a model",
    summary: "Apply to join the talent roster and start getting reviewed.",
    detail: "You’ll be guided straight into a model application with the right next steps for new talent.",
    href: "/model-signup?intent=become-model",
    cta: "Start model application",
    highlights: ["Upload your image", "Share your contact details", "Get reviewed by the team"],
  },
  {
    id: "get-signed",
    title: "Get signed to agency",
    summary: "Looking for representation? Start the signing process here.",
    detail: "We’ll tailor the application experience around agency representation and next-step review.",
    href: "/model-signup?intent=get-signed",
    cta: "Apply for representation",
    highlights: ["Agency-focused application", "Representation review", "Direct path to scouting"],
  },
  {
    id: "build-portfolio",
    title: "Build portfolio",
    summary: "Book a portfolio-building session to elevate your presentation.",
    detail: "This route takes you to a booking flow focused on portfolio shoots and creative direction.",
    href: "/book?intent=portfolio",
    cta: "Book a portfolio session",
    highlights: ["Portfolio-focused booking", "Photoshoot planning", "Creative direction support"],
  },
  {
    id: "learn-industry",
    title: "Learn industry",
    summary: "Get guidance, clarity, and advice on how the industry works.",
    detail: "You’ll be sent into a consultation flow built for questions, strategy, and career guidance.",
    href: "/book?intent=industry",
    cta: "Book an industry consult",
    highlights: ["Career guidance", "Industry Q&A", "Practical next steps"],
  },
];

function getStoredIntent() {
  try {
    return window.localStorage.getItem("ms-intent") || "become-model";
  } catch {
    return "become-model";
  }
}

export default function Onboarding() {
  const [selected, setSelected] = React.useState(getStoredIntent);

  const active = OPTIONS.find((option) => option.id === selected) || OPTIONS[0];

  const handleChoose = (intent) => {
    setSelected(intent);
    try {
      window.localStorage.setItem("ms-intent", intent);
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
            <h1 className="lx-auth-title" style={{ marginBottom: 6 }}>What are you here for?</h1>
            <p className="lx-auth-sub" style={{ maxWidth: 640 }}>
              Choose your path and the app will tailor the next step for you.
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
            {OPTIONS.map((option) => {
              const isActive = active.id === option.id;
              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => handleChoose(option.id)}
                  style={{
                    textAlign: "left",
                    padding: "18px 18px",
                    borderRadius: 14,
                    border: isActive ? "1px solid #111111" : "1px solid #e8e4dc",
                    background: isActive ? "#faf8f4" : "#ffffff",
                    cursor: "pointer",
                    boxShadow: isActive ? "0 8px 30px rgba(17,17,17,0.08)" : "none",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                    <div>
                      <div style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 28, color: "#111", marginBottom: 4 }}>
                        {option.title}
                      </div>
                      <div style={{ color: "#4a4a4a", fontSize: 14, lineHeight: 1.6 }}>{option.summary}</div>
                    </div>
                    <div
                      style={{
                        width: 18,
                        height: 18,
                        borderRadius: 999,
                        border: isActive ? "5px solid #111111" : "2px solid #cfc7bb",
                        flexShrink: 0,
                      }}
                    />
                  </div>
                </button>
              );
            })}
          </div>

          <div style={{ background: "linear-gradient(180deg, #faf8f4 0%, #f5f2ec 100%)", border: "1px solid #e8e4dc", borderRadius: 16, padding: 22 }}>
            <div style={{ fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: "#888", marginBottom: 10 }}>
              Recommended experience
            </div>
            <h2 style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 34, lineHeight: 1.05, color: "#111", margin: "0 0 10px" }}>
              {active.title}
            </h2>
            <p style={{ color: "#4a4a4a", fontSize: 14, lineHeight: 1.7, marginBottom: 16 }}>
              {active.detail}
            </p>

            <div style={{ display: "grid", gap: 10, marginBottom: 20 }}>
              {active.highlights.map((item) => (
                <div key={item} style={{ display: "flex", alignItems: "center", gap: 10, color: "#111", fontSize: 14 }}>
                  <span style={{ color: "#c9a84c", fontSize: 16 }}>✦</span>
                  <span>{item}</span>
                </div>
              ))}
            </div>

            <Link
              to={active.href}
              onClick={() => handleChoose(active.id)}
              className="lx-btn lx-btn-primary"
              style={{ display: "inline-flex", textDecoration: "none", padding: "14px 18px", fontSize: 12 }}
            >
              {active.cta}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
