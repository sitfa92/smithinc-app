import React from "react";
import { Link } from "react-router-dom";
import "../App.css";
import VoiceCallButton from "../components/VoiceCallButton";

const sections = [
  {
    id: "for",
    eyebrow: "Who it is for",
    title: "For people who want structure, not guesswork.",
    cards: [
      {
        title: "Tired of guessing",
        text: "For models who have tried random shoots, scattered advice, and inconsistent posting without a clear plan.",
      },
      {
        title: "Need real direction",
        text: "For talent who need positioning, presentation, and industry readiness instead of vague motivation.",
      },
      {
        title: "Ready to commit",
        text: "For serious applicants willing to follow structure, complete assignments, and build toward real market readiness.",
      },
    ],
  },
  {
    id: "different",
    eyebrow: "Why S.I.T.F.A.",
    title: "What makes this container different.",
    points: [
      {
        title: "Not a modeling agency",
        text: "SmithInc. The Fashion Agency is a fashion consulting and model development business focused on readiness, strategy, and structured growth.",
      },
      {
        title: "Built for transformation",
        text: "This structure replaces a fixed 12-week format with a month-to-month path that supports different timelines.",
      },
      {
        title: "Selective by design",
        text: "Every application is screened for seriousness, timing, and coachability. Fit matters more than volume.",
      },
    ],
  },
  {
    id: "tiers",
    eyebrow: "Membership tiers",
    title: "Three levels of support.",
    pricingGroups: [
      {
        currency: "NGN",
        symbol: "₦",
        label: "Nigeria — Naira",
        tiers: [
          { label: "Starter", price: "₦20,610", text: "Affordable entry support for confidence, structure, and steady early progress." },
          { label: "Growth", price: "₦41,247", text: "Balanced coaching depth for sharper positioning, stronger assets, and better accountability." },
          { label: "Elite", price: "₦61,870.50", text: "Premium support for committed talent who want the highest-touch development experience." },
        ],
      },
      {
        currency: "XOF",
        symbol: "CFA",
        label: "Ivory Coast — West African CFA franc",
        tiers: [
          { label: "Starter", price: "CFA 30,000", text: "Affordable entry support for confidence, structure, and steady early progress." },
          { label: "Growth", price: "CFA 45,000", text: "Balanced coaching depth for sharper positioning, stronger assets, and better accountability." },
          { label: "Elite", price: "CFA 75,000", text: "Premium support for committed talent who want the highest-touch development experience." },
        ],
      },
      {
        currency: "USD",
        symbol: "$",
        label: "United States — Dollar",
        tiers: [
          { label: "Starter", price: "$50", text: "Affordable entry support for confidence, structure, and steady early progress." },
          { label: "Growth", price: "$75", text: "Balanced coaching depth for sharper positioning, stronger assets, and better accountability." },
          { label: "Elite", price: "$125", text: "Premium support for committed talent who want the highest-touch development experience." },
        ],
      },
      {
        currency: "GBP",
        symbol: "£",
        label: "United Kingdom — Pound",
        tiers: [
          { label: "Starter", price: "£22.06", text: "Affordable entry support for confidence, structure, and steady early progress." },
          { label: "Growth", price: "£44.12", text: "Balanced coaching depth for sharper positioning, stronger assets, and better accountability." },
          { label: "Elite", price: "£62.51", text: "Premium support for committed talent who want the highest-touch development experience." },
        ],
      },
      {
        currency: "KES",
        symbol: "KSh",
        label: "Nairobi, Kenya — Kenyan shilling",
        tiers: [
          { label: "Starter", price: "KSh 6,500", text: "Affordable entry support for confidence, structure, and steady early progress." },
          { label: "Growth", price: "KSh 9,500", text: "Balanced coaching depth for sharper positioning, stronger assets, and better accountability." },
          { label: "Elite", price: "KSh 16,000", text: "Premium support for committed talent who want the highest-touch development experience." },
        ],
      },
      {
        currency: "UGX",
        symbol: "USh",
        label: "Uganda — Shilling",
        tiers: [
          { label: "Starter", price: "USh 56,414.80", text: "Affordable entry support for confidence, structure, and steady early progress." },
          { label: "Growth", price: "USh 112,829.61", text: "Balanced coaching depth for sharper positioning, stronger assets, and better accountability." },
          { label: "Elite", price: "USh 169,244.42", text: "Premium support for committed talent who want the highest-touch development experience." },
        ],
      },
    ],
  },
  {
    id: "value",
    eyebrow: "What members get",
    title: "Support that moves people forward.",
    cards: [
      {
        title: "Development roadmap",
        text: "A structured path for presentation, branding, readiness, and consistent progress reviews.",
      },
      {
        title: "Coaching support",
        text: "Tier-based coaching touchpoints, reviews, and accountability to keep development moving.",
      },
      {
        title: "Longer runway",
        text: "Members can build at a 0-3 month or 3-6 month pace instead of one short sprint.",
      },
    ],
  },
  {
    id: "flexibility",
    eyebrow: "Flexibility and referrals",
    title: "Designed to be easier to join and easier to share.",
    points: [
      {
        title: "Flexible cancellation",
        text: "Members can cancel with notice before the next billing date, lowering friction and keeping entry accessible.",
      },
      {
        title: "Accepted referral credits",
        text: "When a referred model is accepted and completes payment, the referring member receives a tier-based credit toward a future invoice.",
      },
    ],
  },
];

function getIntent() {
  const params = new URLSearchParams(window.location.search);
  return params.get("intent") || window.localStorage.getItem("ms-intent") || "become-model";
}

function getDefaultTierCurrency() {
  const localeList = [
    ...(Array.isArray(navigator.languages) ? navigator.languages : []),
    String(navigator.language || "").trim(),
  ].filter(Boolean);

  const extractRegion = (locale) => {
    const value = String(locale || "").trim();
    if (!value) return "";
    try {
      if (typeof Intl !== "undefined" && typeof Intl.Locale === "function") {
        return String(new Intl.Locale(value).region || "").toUpperCase();
      }
    } catch {
      // Ignore invalid locale values and continue with manual parsing.
    }
    const parts = value.replace("_", "-").split("-");
    const maybeRegion = parts.find((part) => /^[A-Za-z]{2}$/.test(part));
    return String(maybeRegion || "").toUpperCase();
  };

  const regionHints = new Set(localeList.map(extractRegion).filter(Boolean));

  const inSet = (...codes) => codes.some((code) => regionHints.has(code));

  if (inSet("NG")) return "NGN";
  if (inSet("CI", "SN", "BJ", "BF", "ML", "NE", "TG", "GW")) return "XOF";
  if (inSet("KE")) return "KES";
  if (inSet("UG", "TZ", "RW", "BI", "SS", "ET")) return "UGX";
  if (inSet("GB", "IE")) return "GBP";
  if (inSet("US", "CA", "MX", "BR", "AR", "CL", "CO", "PE")) return "USD";

  const timeZone = String(Intl.DateTimeFormat().resolvedOptions().timeZone || "").toLowerCase();
  if (timeZone.includes("africa/abidjan")) {
    return "XOF";
  }
  if (timeZone.includes("africa/lagos") || timeZone.includes("africa/accra")) {
    return "NGN";
  }
  if (timeZone.includes("africa/nairobi")) {
    return "KES";
  }
  if (timeZone.includes("africa/kampala") || timeZone.includes("africa/kigali") || timeZone.includes("africa/dar_es_salaam")) {
    return "UGX";
  }
  if (timeZone.includes("europe/london") || timeZone.includes("europe/dublin")) {
    return "GBP";
  }
  if (timeZone.startsWith("america/")) {
    return "USD";
  }
  if (timeZone.startsWith("africa/")) {
    return "NGN";
  }

  return "USD";
}

export default function ModelDevelopment() {
  const [intent] = React.useState(getIntent);
  const [isMobile, setIsMobile] = React.useState(() => window.innerWidth <= 768);
  const [tierCurrency, setTierCurrency] = React.useState(getDefaultTierCurrency);
  const callLine = (import.meta.env.VITE_PUBLIC_CALL_LINE || "").trim();
  const callLineHref = callLine ? `tel:${callLine.replace(/\s+/g, "")}` : "";

  React.useEffect(() => {
    try {
      window.localStorage.setItem("ms-intent", intent);
    } catch {
      // ignore storage issues
    }
  }, [intent]);

  React.useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const applyPath = `/model-signup?intent=${encodeURIComponent(intent)}`;
  const partnerPath = "/partner-submit";
  const brandAmbassadorPath = "/brand-ambassador-submit";
  const primaryCta = intent === "get-signed" ? "Apply for representation" : "Apply for the program";

  return (
    <div className="lx-auth-screen" style={{ alignItems: "flex-start", paddingTop: isMobile ? 12 : 32, paddingBottom: isMobile ? 16 : 36 }}>
      <div className="lx-auth-panel wide" style={{ maxWidth: 1120, width: "min(1120px, 100%)", padding: isMobile ? "18px 14px" : "36px 30px" }}>
        <div style={{ marginBottom: isMobile ? 14 : 18 }}>
          <div style={{ display: "flex", alignItems: isMobile ? "stretch" : "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: isMobile ? 10 : 16 }}>
            <div className="lx-auth-brand" style={{ marginBottom: 0, paddingBottom: 0 }}>
              Meet Serenity
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
          <div style={{ fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: "#888", marginBottom: 8 }}>
            S.I.T.F.A. model development membership
          </div>
          <h1 className="lx-auth-title" style={{ marginBottom: 8, fontSize: isMobile ? 32 : 46, lineHeight: 1 }}>
            Choose your lane. Grow at your pace.
          </h1>
          <p className="lx-auth-sub" style={{ maxWidth: 760, marginBottom: 16, textAlign: "center", marginLeft: "auto", marginRight: "auto" }}>
            A structured, selective model development membership designed for talent who want clear direction, stronger presentation, and a longer runway for growth.
          </p>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Link to={applyPath} className="lx-btn lx-btn-primary" style={{ textDecoration: "none" }}>
              {primaryCta}
            </Link>
            <a href="#tiers" className="lx-btn lx-btn-outline" style={{ textDecoration: "none" }}>
              See tiers
            </a>
          </div>

          <div
            style={{
              marginTop: 14,
              border: "1px solid #e8e4dc",
              background: "#fff",
              borderRadius: 12,
              padding: isMobile ? "12px" : "14px 16px",
              display: "grid",
              gap: 10,
            }}
          >
            <div style={{ fontSize: 11, letterSpacing: "0.11em", textTransform: "uppercase", color: "#5a4a2f", fontWeight: 700 }}>
              Need help now?
            </div>
            <p style={{ margin: 0, color: "#4a4a4a", fontSize: 13, lineHeight: 1.6 }}>
              Call Serenity now from your browser, or dial the line directly.
            </p>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-start" }}>
              <VoiceCallButton label="Call Serenity" metadata={{ page: "homepage", intent }} compact={isMobile} />
              <a
                href="/contact-team"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  padding: isMobile ? "9px 14px" : "14px 22px",
                  background: "transparent",
                  color: "#111111",
                  border: "1.5px solid #c9a84c",
                  borderRadius: 10,
                  fontSize: isMobile ? 11 : 12,
                  fontWeight: 700,
                  letterSpacing: isMobile ? "0.07em" : "0.1em",
                  textTransform: "uppercase",
                  fontFamily: "'Inter',sans-serif",
                  textDecoration: "none",
                  transition: "all 0.2s ease",
                  cursor: "pointer",
                }}
                onMouseEnter={e => { e.currentTarget.style.background = "#fdf7ec"; e.currentTarget.style.transform = "translateY(-1px)"; }}
                onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.transform = ""; }}
              >
                Contact Team
              </a>
              {callLineHref && (
                <a
                  href={callLineHref}
                  className="lx-btn lx-btn-outline"
                  style={{ textDecoration: "none" }}
                >
                  Call line {callLine}
                </a>
              )}
            </div>
          </div>

          <div
            style={{
              marginTop: 12,
              border: "1px solid #d9cfbc",
              background: "linear-gradient(135deg, #fff9ec 0%, #f8f1e3 100%)",
              borderRadius: 12,
              padding: isMobile ? "12px 12px" : "14px 16px",
              display: "grid",
              gap: 12,
            }}
          >
            <div style={{ fontSize: 11, letterSpacing: "0.11em", textTransform: "uppercase", color: "#5a4a2f", fontWeight: 700 }}>
              For brands, partners, and ambassadors
            </div>
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(2, minmax(0,1fr))", gap: 10 }}>
              <div style={{ background: "rgba(255,255,255,0.55)", border: "1px solid #eadcc0", borderRadius: 10, padding: "10px 11px" }}>
                <p style={{ margin: "0 0 8px", color: "#2a2112", fontSize: isMobile ? 13 : 14, lineHeight: 1.55 }}>
                  Looking to hire talent or source models for a campaign? Submit your request and our team will review your casting brief.
                </p>
                <Link
                  to={partnerPath}
                  className="lx-btn"
                  style={{
                    textDecoration: "none",
                    background: "#111",
                    color: "#fff",
                    border: "1px solid #111",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    minHeight: 40,
                  }}
                >
                  Partner with us
                </Link>
              </div>
              <div style={{ background: "rgba(255,255,255,0.55)", border: "1px solid #eadcc0", borderRadius: 10, padding: "10px 11px" }}>
                <p style={{ margin: "0 0 8px", color: "#2a2112", fontSize: isMobile ? 13 : 14, lineHeight: 1.55 }}>
                  Ready to represent your community and collaborate with campaigns? Submit as a brand ambassador.
                </p>
                <Link
                  to={brandAmbassadorPath}
                  className="lx-btn"
                  style={{
                    textDecoration: "none",
                    background: "#111",
                    color: "#fff",
                    border: "1px solid #111",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    minHeight: 40,
                  }}
                >
                  Apply as brand ambassador
                </Link>
              </div>
            </div>
          </div>
        </div>

        {sections.map((section) => (
          <section key={section.id} id={section.id} className="lx-card" style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: "#888", marginBottom: 8 }}>
              {section.eyebrow}
            </div>
            <h2 style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: isMobile ? 30 : 38, lineHeight: 1.05, color: "#111", margin: "0 0 14px" }}>
              {section.title}
            </h2>

            {section.cards && (
              <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(3, minmax(0, 1fr))", gap: 12 }}>
                {section.cards.map((card) => (
                  <article key={card.title} style={{ background: "linear-gradient(180deg, #faf8f4 0%, #f5f2ec 100%)", border: "1px solid #e8e4dc", borderRadius: 14, padding: isMobile ? 14 : 16 }}>
                    <h3 style={{ margin: "0 0 6px", color: "#111", fontSize: 16, fontWeight: 700 }}>{card.title}</h3>
                    <p style={{ margin: 0, color: "#4a4a4a", fontSize: 14, lineHeight: 1.6 }}>{card.text}</p>
                  </article>
                ))}
              </div>
            )}

            {section.points && (
              <div style={{ display: "grid", gap: 10 }}>
                {section.points.map((point) => (
                  <article key={point.title} style={{ border: "1px solid #e8e4dc", borderRadius: 12, padding: isMobile ? 14 : 16, background: "#fff" }}>
                    <h3 style={{ margin: "0 0 6px", color: "#111", fontSize: 16, fontWeight: 700 }}>{point.title}</h3>
                    <p style={{ margin: 0, color: "#4a4a4a", fontSize: 14, lineHeight: 1.6 }}>{point.text}</p>
                  </article>
                ))}
              </div>
            )}

            {section.pricingGroups && (
              <div style={{ display: "grid", gap: 14 }}>
                <div style={{ display: "grid", gap: 7, maxWidth: 360 }}>
                  <label htmlFor="tier-currency" style={{ fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: "#888", fontWeight: 700 }}>
                    Select your currency
                  </label>
                  <select
                    id="tier-currency"
                    value={tierCurrency}
                    onChange={(e) => setTierCurrency(e.target.value)}
                    style={{
                      border: "1px solid #e8e4dc",
                      background: "#fff",
                      color: "#111",
                      borderRadius: 10,
                      padding: "10px 12px",
                      fontSize: 13,
                      fontWeight: 600,
                      fontFamily: "'Inter',sans-serif",
                      outline: "none",
                    }}
                  >
                    {section.pricingGroups.map((group) => (
                      <option key={group.currency} value={group.currency}>
                        {group.label}
                      </option>
                    ))}
                  </select>
                </div>

                {(() => {
                  const activeGroup = section.pricingGroups.find((group) => group.currency === tierCurrency) || section.pricingGroups[0];
                  return (
                    <div key={activeGroup.currency}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "#888", background: "#faf8f4", border: "1px solid #e8e4dc", borderRadius: 99, padding: "3px 11px" }}>{activeGroup.currency}</span>
                        <span style={{ fontSize: 13, color: "#888" }}>{activeGroup.label}</span>
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(3, minmax(0, 1fr))", gap: 12 }}>
                        {activeGroup.tiers.map((tier) => (
                          <article key={tier.label} style={{ border: "1px solid #e8e4dc", borderRadius: 14, padding: isMobile ? 16 : 18, background: "#fff" }}>
                            <div style={{ fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", color: "#888", marginBottom: 6 }}>{tier.label}</div>
                            <div style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 46, lineHeight: 1, color: "#111", marginBottom: 8 }}>{tier.price}</div>
                            <p style={{ margin: 0, color: "#4a4a4a", fontSize: 14, lineHeight: 1.6 }}>{tier.text}</p>
                          </article>
                        ))}
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}
          </section>
        ))}

        <section className="lx-card" style={{ marginBottom: 0 }}>
          <div style={{ fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: "#888", marginBottom: 8 }}>
            Before you apply
          </div>
          <h2 style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: isMobile ? 30 : 38, lineHeight: 1.05, color: "#111", margin: "0 0 10px" }}>
            Apply if you are serious about becoming more prepared and more polished.
          </h2>
          <p style={{ color: "#4a4a4a", fontSize: 14, lineHeight: 1.7, margin: "0 0 14px" }}>
            We review applications for fit, commitment, and readiness. If this structure matches where you are right now, continue to the submission form.
          </p>
          <Link to={applyPath} className="lx-btn lx-btn-primary" style={{ textDecoration: "none" }}>
            Continue to submission
          </Link>
        </section>
      </div>
    </div>
  );
}
