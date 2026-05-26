import React from "react";
import { Link } from "react-router-dom";
import "../App.css";
import SeoTopicCluster from "../components/SeoTopicCluster";
import VoiceBotChatWidget from "../components/VoiceBotChatWidget";

let voiceCallButtonPromise;

function loadVoiceCallButton() {
  if (!voiceCallButtonPromise) {
    voiceCallButtonPromise = import("../components/VoiceCallButton");
  }
  return voiceCallButtonPromise;
}

function HomepageVoiceCallButton({ label, metadata, compact = false }) {
  const [LoadedButton, setLoadedButton] = React.useState(null);
  const [isLoading, setIsLoading] = React.useState(false);

  const hydrateButton = React.useCallback(() => {
    if (LoadedButton || isLoading) return;

    setIsLoading(true);
    loadVoiceCallButton()
      .then((mod) => {
        setLoadedButton(() => mod.default);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [LoadedButton, isLoading]);

  if (LoadedButton) {
    return <LoadedButton label={label} metadata={metadata} compact={compact} />;
  }

  return (
    <button
      type="button"
      onClick={hydrateButton}
      onMouseEnter={hydrateButton}
      onFocus={hydrateButton}
      onTouchStart={hydrateButton}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 10,
        padding: compact ? "9px 14px" : "14px 28px",
        background: "#c9a84c",
        color: "#ffffff",
        border: "none",
        borderRadius: 10,
        fontSize: compact ? 11 : 12,
        fontWeight: 700,
        letterSpacing: compact ? "0.07em" : "0.1em",
        textTransform: "uppercase",
        fontFamily: "'Inter',sans-serif",
        cursor: isLoading ? "wait" : "pointer",
        boxShadow: "0 4px 20px rgba(201,168,76,0.35)",
        opacity: isLoading ? 0.78 : 1,
      }}
    >
      {isLoading ? "Loading call" : label}
    </button>
  );
}

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
      {
        currency: "INR",
        symbol: "₹",
        label: "Mumbai, India — Indian rupee",
        tiers: [
          { label: "Starter", price: "₹3,900", text: "Affordable entry support for confidence, structure, and steady early progress." },
          { label: "Growth", price: "₹7,200", text: "Balanced coaching depth for sharper positioning, stronger assets, and better accountability." },
          { label: "Elite", price: "₹11,500", text: "Premium support for committed talent who want the highest-touch development experience." },
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
  if (inSet("IN")) return "INR";
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
  if (timeZone.includes("asia/kolkata") || timeZone.includes("asia/calcutta")) {
    return "INR";
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
  const [calendlyLinks, setCalendlyLinks] = React.useState([]);
  const [voiceBotStatus, setVoiceBotStatus] = React.useState("checking");
  const callLine = (import.meta.env.VITE_PUBLIC_CALL_LINE || "").trim();
  const callLineHref = callLine ? `tel:${callLine.replace(/\s+/g, "")}` : "";
  const ownerPhone = (import.meta.env.VITE_OWNER_DAVID_PHONE || callLine || "779-238-8250").trim();

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

  React.useEffect(() => {
    const isCalendlyUrl = (value) => /^https?:\/\/(www\.)?calendly\.com\//i.test(String(value || "").trim());

    const loadCalendlyLinks = async () => {
      try {
        const resp = await fetch("/api/calendly/links");
        const json = await resp.json();
        if (!resp.ok) throw new Error("Calendly unavailable");
        const links = Array.isArray(json?.links) ? json.links : [];
        const cleaned = links.filter((item) => isCalendlyUrl(item?.url));
        if (cleaned.length) {
          setCalendlyLinks(cleaned);
          return;
        }
      } catch (_err) {
        // Fall through to frontend env fallback.
      }

      const fallback = [
        import.meta.env.VITE_CALENDLY_US_LINK,
        import.meta.env.VITE_CALENDLY_INTL_LINK,
        import.meta.env.VITE_CALENDLY_GENERAL_LINK,
      ]
        .map((url) => String(url || "").trim())
        .filter((url) => isCalendlyUrl(url));

      const mapped = fallback.map((url, idx) => ({
        label: idx === 0 ? "US" : idx === 1 ? "International" : "General",
        url,
      }));

      setCalendlyLinks(mapped);
    };

    loadCalendlyLinks();
  }, []);

  const applyPath = `/model-signup?intent=${encodeURIComponent(intent)}`;
  const partnerPath = "/partner-submit";
  const brandAmbassadorPath = "/brand-ambassador-submit";
  const primaryCta = intent === "get-signed" ? "Apply for representation" : "Apply for the program";
  const publicLinks = [
    { to: "/book", label: "Book a Consultation" },
    { to: "/model-signup", label: "Model Application" },
    { to: "/partner-submit", label: "Partner Submission" },
    { to: "/brand-ambassador-submit", label: "Ambassador Submission" },
    { to: "/contact-team", label: "Contact Team" },
    { to: "/leave-review", label: "Leave a Review" },
    { to: "/insights", label: "Insights Hub" },
  ];

  return (
    <div className="lx-auth-screen" style={{ alignItems: "flex-start", paddingTop: isMobile ? 14 : 38, paddingBottom: isMobile ? 20 : 48 }}>
      <VoiceBotChatWidget onStatusChange={setVoiceBotStatus} />
      <div className="lx-auth-panel wide" style={{ maxWidth: 1040, width: "min(1040px, 100%)", padding: isMobile ? "20px 14px" : "44px 44px" }}>
        <header style={{ marginBottom: isMobile ? 18 : 28 }}>
          <div style={{ display: "flex", alignItems: isMobile ? "stretch" : "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: isMobile ? 14 : 18 }}>
            <div className="lx-auth-brand" style={{ marginBottom: 0, paddingBottom: 0, borderBottom: "none", textAlign: "left" }}>
              Meet Serenity
            </div>
            <Link
              to="/team-login"
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

          <div style={{ maxWidth: 680, margin: "0 auto", textAlign: "center" }}>
            <div style={{ fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: "#767676", marginBottom: 10 }}>
              S.I.T.F.A. model development membership
            </div>
            <h1 className="lx-auth-title" style={{ marginBottom: 14, fontSize: isMobile ? 34 : 52, lineHeight: 1.02 }}>
              Choose your lane. Grow at your pace.
            </h1>
            <p className="lx-auth-sub" style={{ maxWidth: 620, marginBottom: 20, textAlign: "center", marginLeft: "auto", marginRight: "auto", fontSize: isMobile ? 14 : 15, lineHeight: 1.75 }}>
              Meet Serenity is SmithInc's fashion consulting and model development platform: one system for model portfolios, brand booking coordination, and pipeline tracking, plus Starter, Growth, and Elite program tiers with coaching, positioning support, and accountability.
            </p>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center" }}>
              <Link to={applyPath} className="lx-btn lx-btn-primary" style={{ textDecoration: "none" }}>
                {primaryCta}
              </Link>
              <a href="#tiers" className="lx-btn lx-btn-outline" style={{ textDecoration: "none" }}>
                See tiers
              </a>
            </div>
          </div>
        </header>

        <section
          className="lx-card"
          style={{
            marginBottom: isMobile ? 16 : 24,
            padding: isMobile ? "14px" : "20px 22px",
            borderColor: "#e6e0d2",
            boxShadow: "0 10px 28px rgba(22, 17, 11, 0.05)",
          }}
        >
          <div style={{ fontSize: 11, letterSpacing: "0.11em", textTransform: "uppercase", color: "#5a4a2f", fontWeight: 700, marginBottom: 8 }}>
            Need help now?
          </div>
          <p style={{ margin: "0 0 12px", color: "#4a4a4a", fontSize: 14, lineHeight: 1.7, maxWidth: 680 }}>
            Call Serenity now from your browser, or dial the line directly.
          </p>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "10px 14px",
              borderRadius: 999,
              background: "rgba(255,255,255,0.72)",
              border: "1px solid rgba(179, 149, 105, 0.28)",
              color: "#5a534b",
              fontSize: 13,
              lineHeight: 1.5,
              boxShadow: "0 10px 24px rgba(28, 24, 19, 0.06)",
              marginBottom: 12,
            }}
          >
            <span style={{ fontSize: 16, lineHeight: 1 }}>AI</span>
            <span>
              {voiceBotStatus === "unavailable"
                ? "Voice assistant is temporarily unavailable. Use Call Serenity or Contact Team below."
                : voiceBotStatus === "ready"
                  ? "Use the voice assistant in the lower-right corner for instant guidance."
                  : "Voice assistant is loading. You can still call or contact the team below right now."}
            </span>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-start" }}>
            <HomepageVoiceCallButton
              label="Call Serenity"
              metadata={{ page: "homepage", intent, owner_contact_phone: ownerPhone, escalation_option: "call_david" }}
              compact={isMobile}
            />
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
          {calendlyLinks.length > 0 && (
            <div style={{ borderTop: "1px solid #efe9dc", paddingTop: 12, marginTop: 12 }}>
              <p style={{ margin: "0 0 8px", color: "#4a4a4a", fontSize: 12, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase" }}>
                Schedule instantly
              </p>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {calendlyLinks.map((item, idx) => (
                  <a
                    key={`${item.url}-${idx}`}
                    href={item.url}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      textDecoration: "none",
                      padding: isMobile ? "8px 11px" : "9px 13px",
                      borderRadius: 9,
                      border: "1px solid #111",
                      color: "#111",
                      fontSize: 12,
                      fontWeight: 600,
                      letterSpacing: "0.05em",
                      textTransform: "uppercase",
                      background: "#fff",
                    }}
                  >
                    {item.label || `Link ${idx + 1}`}
                  </a>
                ))}
              </div>
            </div>
          )}
        </section>

        {sections.map((section) => (
          <section key={section.id} id={section.id} className="lx-card" style={{ marginBottom: isMobile ? 16 : 22, padding: isMobile ? "16px 14px" : "26px 28px" }}>
            <div style={{ fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: "#767676", marginBottom: 10 }}>
              {section.eyebrow}
            </div>
            <h2 style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: isMobile ? 33 : 42, lineHeight: 1.04, color: "#111", margin: "0 0 16px", maxWidth: 760 }}>
              {section.title}
            </h2>

            {section.cards && (
              <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(3, minmax(0, 1fr))", gap: 14 }}>
                {section.cards.map((card) => (
                  <article key={card.title} style={{ background: "#fff", border: "1px solid #ece8df", borderRadius: 12, padding: isMobile ? 14 : 18, boxShadow: "0 5px 14px rgba(18, 12, 4, 0.03)" }}>
                    <h3 style={{ margin: "0 0 8px", color: "#111", fontSize: 17, fontWeight: 700 }}>{card.title}</h3>
                    <p style={{ margin: 0, color: "#4a4a4a", fontSize: 14, lineHeight: 1.72 }}>{card.text}</p>
                  </article>
                ))}
              </div>
            )}

            {section.points && (
              <div style={{ display: "grid", gap: 12 }}>
                {section.points.map((point) => (
                  <article key={point.title} style={{ border: "1px solid #ece8df", borderRadius: 12, padding: isMobile ? 14 : 18, background: "#fff", boxShadow: "0 5px 14px rgba(18, 12, 4, 0.03)" }}>
                    <h3 style={{ margin: "0 0 8px", color: "#111", fontSize: 17, fontWeight: 700 }}>{point.title}</h3>
                    <p style={{ margin: 0, color: "#4a4a4a", fontSize: 14, lineHeight: 1.72, maxWidth: 840 }}>{point.text}</p>
                  </article>
                ))}
              </div>
            )}

            {section.pricingGroups && (
              <div style={{ display: "grid", gap: 16 }}>
                <div style={{ display: "grid", gap: 7, maxWidth: 390 }}>
                  <label htmlFor="tier-currency" style={{ fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: "#767676", fontWeight: 700 }}>
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
                      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
                        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "#767676", background: "#faf8f4", border: "1px solid #e8e4dc", borderRadius: 99, padding: "3px 11px" }}>{activeGroup.currency}</span>
                        <span style={{ fontSize: 13, color: "#767676" }}>{activeGroup.label}</span>
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(3, minmax(0, 1fr))", gap: 14 }}>
                        {activeGroup.tiers.map((tier) => (
                          <article key={tier.label} style={{ border: "1px solid #ece8df", borderRadius: 12, padding: isMobile ? 16 : 20, background: "#fff", boxShadow: "0 5px 14px rgba(18, 12, 4, 0.03)" }}>
                            <div style={{ fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", color: "#767676", marginBottom: 7 }}>{tier.label}</div>
                            <div style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 46, lineHeight: 1, color: "#111", marginBottom: 10 }}>{tier.price}</div>
                            <p style={{ margin: 0, color: "#4a4a4a", fontSize: 14, lineHeight: 1.72 }}>{tier.text}</p>
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

        <section className="lx-card" style={{ marginBottom: isMobile ? 16 : 22, padding: isMobile ? "16px 14px" : "24px 28px" }}>
          <div style={{ fontSize: 11, letterSpacing: "0.11em", textTransform: "uppercase", color: "#111", fontWeight: 700, marginBottom: 8 }}>
            Agency Submission Portals
          </div>
          <p style={{ margin: "0 0 14px", color: "#4a4a4a", fontSize: 14, lineHeight: 1.7, maxWidth: 760 }}>
            Applying to an agency partner? Use the dedicated portal below. These flows are separate from SmithInc owner/admin intake.
          </p>
          <div style={{ display: "grid", gap: 12, gridTemplateColumns: isMobile ? "1fr" : "repeat(3, minmax(0, 1fr))" }}>
            <div style={{ border: "1px solid #ece8df", borderRadius: 12, padding: isMobile ? 12 : 16, background: "#fff" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 9 }}>
                <img
                  src="/model-hunter-logo.svg"
                  alt="Model Hunter logo"
                  style={{ width: 30, height: 30, objectFit: "contain", borderRadius: 6, border: "1px solid #e8e4dc", background: "#fff" }}
                />
                <div style={{ fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", color: "#111", fontWeight: 700 }}>
                  Model Hunter
                </div>
              </div>
              <p style={{ margin: "0 0 12px", color: "#4a4a4a", fontSize: 13, lineHeight: 1.65 }}>
                Public submissions for Model Hunter talent intake.
              </p>
              <Link
                to="/model-hunter-submit"
                className="lx-btn lx-btn-outline"
                style={{ textDecoration: "none", borderColor: "#111", color: "#111", width: "100%", justifyContent: "center" }}
              >
                Submit to Model Hunter
              </Link>
            </div>

            <div style={{ border: "1px solid #ece8df", borderRadius: 12, padding: isMobile ? 12 : 16, background: "#fff" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 9 }}>
                <img
                  src="/ml-events-logo.svg"
                  alt="ML Events logo"
                  style={{ width: 30, height: 30, objectFit: "contain", borderRadius: 6, border: "1px solid #e8e4dc", background: "#fff" }}
                />
                <div style={{ fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", color: "#5a4a2f", fontWeight: 700 }}>
                  ML Events
                </div>
              </div>
              <p style={{ margin: "0 0 12px", color: "#4a4a4a", fontSize: 13, lineHeight: 1.65 }}>
                Public submissions for ML Events talent intake.
              </p>
              <Link
                to="/ml-events-submit"
                className="lx-btn lx-btn-outline"
                style={{ textDecoration: "none", borderColor: "#c9a84c", color: "#5a4a2f", width: "100%", justifyContent: "center" }}
              >
                Submit to ML Events
              </Link>
            </div>

            <div style={{ border: "1px solid #ece8df", borderRadius: 12, padding: isMobile ? 12 : 16, background: "#fff" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 9 }}>
                <img
                  src="/ivory-models-logo.svg"
                  alt="Ivory Models logo"
                  style={{ width: 30, height: 30, objectFit: "contain", borderRadius: 6, border: "1px solid #e8e4dc", background: "#fff" }}
                />
                <div style={{ fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", color: "#5a4a2f", fontWeight: 700 }}>
                  Ivory Models
                </div>
              </div>
              <p style={{ margin: "0 0 12px", color: "#4a4a4a", fontSize: 13, lineHeight: 1.65 }}>
                Public submissions for Ivory Models Talent Agency intake.
              </p>
              <Link
                to="/ivory-models-submit"
                className="lx-btn lx-btn-outline"
                style={{ textDecoration: "none", borderColor: "#c9a84c", color: "#5a4a2f", width: "100%", justifyContent: "center" }}
              >
                Submit to Ivory Models
              </Link>
            </div>
          </div>
        </section>

        <section className="lx-card" style={{ marginBottom: isMobile ? 16 : 22, padding: isMobile ? "16px 14px" : "24px 28px" }}>
          <div style={{ fontSize: 11, letterSpacing: "0.11em", textTransform: "uppercase", color: "#5a4a2f", fontWeight: 700, marginBottom: 8 }}>
            For brands, partners, and ambassadors
          </div>
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(2, minmax(0,1fr))", gap: 12 }}>
            <div style={{ background: "#fff", border: "1px solid #eadcc0", borderRadius: 12, padding: "14px 14px" }}>
              <p style={{ margin: "0 0 10px", color: "#2a2112", fontSize: isMobile ? 14 : 15, lineHeight: 1.65 }}>
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
            <div style={{ background: "#fff", border: "1px solid #eadcc0", borderRadius: 12, padding: "14px 14px" }}>
              <p style={{ margin: "0 0 10px", color: "#2a2112", fontSize: isMobile ? 14 : 15, lineHeight: 1.65 }}>
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
        </section>

        <section className="lx-card" style={{ marginBottom: isMobile ? 16 : 22, padding: isMobile ? "16px 14px" : "24px 28px" }}>
          <p style={{ margin: "0 0 10px", fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#767676" }}>
            Explore public pages
          </p>
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(2, minmax(0,1fr))", gap: 8, marginBottom: 16 }}>
            {publicLinks.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                style={{ textDecoration: "none", padding: "10px 12px", borderRadius: 9, border: "1px solid #e8e4dc", color: "#111", fontSize: 13, lineHeight: 1.4, background: "#fff" }}
              >
                {item.label}
              </Link>
            ))}
          </div>
          <SeoTopicCluster title="Deep-dive growth guides" />
        </section>

        <section className="lx-card" style={{ marginBottom: 0, padding: isMobile ? "16px 14px" : "24px 28px" }}>
          <div style={{ fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: "#767676", marginBottom: 8 }}>
            Before you apply
          </div>
          <h2 style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: isMobile ? 34 : 42, lineHeight: 1.05, color: "#111", margin: "0 0 12px", maxWidth: 760 }}>
            Apply if you are serious about becoming more prepared and more polished.
          </h2>
          <p style={{ color: "#4a4a4a", fontSize: 15, lineHeight: 1.75, margin: "0 0 16px", maxWidth: 720 }}>
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
