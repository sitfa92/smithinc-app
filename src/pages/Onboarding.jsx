import React from "react";
import { Link } from "react-router-dom";
import "../App.css";

const OPTIONS = [
  {
    id: "become-model",
    title: "Become a model",
    summary: "Apply to join our model development program and start your career.",
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
  const [isMobile, setIsMobile] = React.useState(() => window.innerWidth <= 768);

  React.useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

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
    <div className="lx-auth-screen" style={{ alignItems: "flex-start", paddingTop: isMobile ? 10 : 32, paddingBottom: isMobile ? 14 : 32 }}>
      <div className="lx-auth-panel wide" style={{ maxWidth: 1100, width: "min(1100px, 100%)", padding: isMobile ? "18px 14px" : "40px 32px" }}>
        <div className="lx-onboarding-header" style={{ display: "flex", alignItems: isMobile ? "stretch" : "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap", marginBottom: isMobile ? 14 : 20 }}>
          <div>
            <div className="lx-auth-brand" style={{ marginBottom: isMobile ? 12 : 20, paddingBottom: isMobile ? 10 : 18 }}>Meet Serenity</div>
            <h1 className="lx-auth-title" style={{ marginBottom: 6, fontSize: isMobile ? 24 : undefined }}>What are you here for?</h1>
            <p className="lx-auth-sub" style={{ maxWidth: 640, marginBottom: 0, fontSize: isMobile ? 12 : 13 }}>
              Choose your path and the app will tailor the next step for you.
            </p>
          </div>

          <Link
            to="/login"
            style={{
              textDecoration: "none",
              padding: isMobile ? "10px 12px" : "10px 16px",
              borderRadius: 10,
              border: "1px solid #e8e4dc",
              color: "#111",
              fontSize: 12,
              fontWeight: 600,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              width: isMobile ? "100%" : "auto",
              textAlign: "center",
              boxSizing: "border-box",
            }}
          >
            Team login
          </Link>
        </div>

        <div className="lx-onboarding-grid" style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1.1fr 0.9fr", gap: isMobile ? 14 : 20 }}>
          <div style={{ display: "grid", gap: 10, order: isMobile ? 2 : 1 }}>
            {OPTIONS.map((option) => {
              const isActive = active.id === option.id;
              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => handleChoose(option.id)}
                  style={{
                    textAlign: "left",
                    padding: isMobile ? "14px 14px" : "18px 18px",
                    borderRadius: 14,
                    border: isActive ? "1px solid #111111" : "1px solid #e8e4dc",
                    background: isActive ? "#faf8f4" : "#ffffff",
                    cursor: "pointer",
                    boxShadow: isActive ? "0 8px 30px rgba(17,17,17,0.08)" : "none",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                    <div>
                      <div style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: isMobile ? 23 : 28, color: "#111", marginBottom: 4, lineHeight: 1.05 }}>
                        {option.title}
                      </div>
                      <div style={{ color: "#4a4a4a", fontSize: isMobile ? 13 : 14, lineHeight: 1.5 }}>{option.summary}</div>
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

          <div style={{ background: "linear-gradient(180deg, #faf8f4 0%, #f5f2ec 100%)", border: "1px solid #e8e4dc", borderRadius: 16, padding: isMobile ? 16 : 22, order: isMobile ? 1 : 2 }}>
            <div style={{ fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: "#888", marginBottom: 10 }}>
              Recommended experience
            </div>
            <h2 style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: isMobile ? 28 : 34, lineHeight: 1.05, color: "#111", margin: "0 0 10px" }}>
              {active.title}
            </h2>
            <p style={{ color: "#4a4a4a", fontSize: isMobile ? 13 : 14, lineHeight: 1.65, marginBottom: 14 }}>
              {isMobile ? active.summary : active.detail}
            </p>

            <div style={{ display: "grid", gap: 8, marginBottom: 16 }}>
              {active.highlights.slice(0, isMobile ? 2 : 3).map((item) => (
                <div key={item} style={{ display: "flex", alignItems: "center", gap: 10, color: "#111", fontSize: isMobile ? 13 : 14 }}>
                  <span style={{ color: "#c9a84c", fontSize: 16 }}>✦</span>
                  <span>{item}</span>
                </div>
              ))}
            </div>

            <Link
              to={active.href}
              onClick={() => handleChoose(active.id)}
              className="lx-btn lx-btn-primary"
              style={{ display: "inline-flex", textDecoration: "none", padding: "14px 18px", fontSize: 12, width: isMobile ? "100%" : "auto" }}
            >
              {active.cta}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
