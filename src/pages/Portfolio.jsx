import React from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "../supabase";

export default function Portfolio() {
  const { id } = useParams();
  const [model, setModel] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [notFound, setNotFound] = React.useState(false);

  const C = {
    ink: "#111111", slate: "#4a4a4a", dust: "#888888",
    smoke: "#e8e4dc", ivory: "#faf8f4", canvas: "#f5f2ec",
    white: "#ffffff", gold: "#c9a84c",
    ok: "#1a6636", okBg: "#edf7ee",
    warn: "#92560a", warnBg: "#fef8ec",
    err: "#9b1c1c", errBg: "#fef2f2",
  };

  React.useEffect(() => {
    if (!id) { setNotFound(true); setLoading(false); return; }

    const cacheKey = `portfolio-${id}`;
    try {
      const raw = window.sessionStorage.getItem(cacheKey);
      if (raw) {
        const cached = JSON.parse(raw);
        if (cached?.data && Date.now() - cached.ts < 300000) {
          setModel(cached.data);
          setLoading(false);
          return;
        }
      }
    } catch {
      // ignore cache issues
    }

    const load = async () => {
      try {
        const { data, error } = await supabase
          .from("models")
          .select("id, name, email, instagram, height, status, image_url, submitted_at, created_at")
          .eq("id", id)
          .single();
        if (error || !data) { setNotFound(true); }
        else {
          setModel(data);
          try {
            window.sessionStorage.setItem(cacheKey, JSON.stringify({ ts: Date.now(), data }));
          } catch {
            // ignore cache issues
          }
        }
      } catch (_) {
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id]);

  const statusBadge = (st) => {
    const m = {
      approved: [C.okBg, C.ok],
      pending:  [C.warnBg, C.warn],
      rejected: [C.errBg, C.err],
    };
    const [bg, clr] = m[st] || [C.ivory, C.dust];
    return (
      <span style={{
        display: "inline-flex", alignItems: "center",
        padding: "4px 12px", borderRadius: 99,
        fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase",
        background: bg, color: clr,
      }}>
        {st || "pending"}
      </span>
    );
  };

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: C.canvas }}>
        <p style={{ color: C.dust, fontFamily: "'Inter',sans-serif" }}>Loading…</p>
      </div>
    );
  }

  if (notFound || !model) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: C.canvas, padding: 24, textAlign: "center" }}>
        <p style={{ fontFamily: "'Cormorant Garamond',Georgia,serif", fontSize: 40, fontWeight: 400, color: C.ink, marginBottom: 8 }}>Profile not found</p>
        <p style={{ color: C.dust, fontSize: 14, marginBottom: 28 }}>This talent profile does not exist or has been removed.</p>
        <Link to="/book" style={{ padding: "12px 24px", background: C.ink, color: C.white, borderRadius: 8, fontSize: 12, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", fontFamily: "'Inter',sans-serif", textDecoration: "none" }}>
          Book a Consultation
        </Link>
      </div>
    );
  }

  const instagramHandle = model.instagram ? model.instagram.replace(/^@/, "") : null;

  return (
    <div style={{ minHeight: "100vh", background: C.canvas, padding: "0 0 60px" }}>
      {/* Header bar */}
      <div style={{ background: "rgba(255,255,255,0.9)", backdropFilter: "blur(16px)", borderBottom: `1px solid ${C.smoke}`, padding: "18px 28px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <Link to="/" style={{ fontFamily: "'Cormorant Garamond',Georgia,serif", fontSize: 17, fontWeight: 500, letterSpacing: "0.18em", textTransform: "uppercase", color: C.ink, textDecoration: "none" }}>
          Meet Serenity
        </Link>
        <Link to="/book" style={{ padding: "10px 20px", background: C.ink, color: C.white, borderRadius: 8, fontSize: 11, fontWeight: 600, letterSpacing: "0.09em", textTransform: "uppercase", fontFamily: "'Inter',sans-serif", textDecoration: "none" }}>
          Book This Talent
        </Link>
      </div>

      <div style={{ maxWidth: 760, margin: "0 auto", padding: "48px 24px 0" }}>
        <div style={{ display: "flex", gap: 36, alignItems: "flex-start", flexWrap: "wrap" }}>
          {/* Photo */}
          <div style={{ flexShrink: 0 }}>
            {model.image_url ? (
              <img
                src={model.image_url}
                alt={model.name}
                loading="lazy"
                decoding="async"
                style={{ width: 220, height: 280, objectFit: "cover", borderRadius: 16, border: `1px solid ${C.smoke}`, boxShadow: "0 8px 36px rgba(17,17,17,0.12)", display: "block" }}
                onError={(e) => { e.target.style.display = "none"; }}
              />
            ) : (
              <div style={{ width: 220, height: 280, borderRadius: 16, background: C.smoke, border: `1px solid ${C.smoke}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <span style={{ fontFamily: "'Cormorant Garamond',Georgia,serif", fontSize: 64, color: C.dust, opacity: 0.4 }}>✦</span>
              </div>
            )}
          </div>

          {/* Details */}
          <div style={{ flex: 1, minWidth: 220 }}>
            <h1 style={{ fontFamily: "'Cormorant Garamond',Georgia,serif", fontSize: "clamp(32px,5vw,52px)", fontWeight: 500, color: C.ink, letterSpacing: "-0.03em", margin: "0 0 8px", lineHeight: 1.1 }}>
              {model.name}
            </h1>

            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 20 }}>
              {statusBadge(model.status)}
              {model.height && (
                <span style={{ fontSize: 13, color: C.dust }}>Height: {model.height}</span>
              )}
            </div>

            {instagramHandle && (
              <a
                href={`https://instagram.com/${instagramHandle}`}
                target="_blank"
                rel="noreferrer"
                style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, color: C.slate, textDecoration: "none", marginBottom: 20, padding: "8px 14px", background: C.white, border: `1px solid ${C.smoke}`, borderRadius: 8, transition: "all 0.2s ease" }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = C.ink; e.currentTarget.style.color = C.ink; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = C.smoke; e.currentTarget.style.color = C.slate; }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/>
                </svg>
                @{instagramHandle}
              </a>
            )}

            <hr style={{ border: "none", borderTop: `1px solid ${C.smoke}`, margin: "20px 0" }} />

            <p style={{ fontSize: 13, color: C.dust, lineHeight: 1.7, marginBottom: 28 }}>
              Represented by <strong style={{ color: C.ink }}>Meet Serenity</strong>.<br />
              For bookings, collaborations, and rate inquiries, please use the link below.
            </p>

            <Link
              to="/book"
              style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "14px 28px", background: C.ink, color: C.white, borderRadius: 10, fontSize: 12, fontWeight: 600, letterSpacing: "0.09em", textTransform: "uppercase", fontFamily: "'Inter',sans-serif", textDecoration: "none", boxShadow: "0 4px 20px rgba(17,17,17,0.18)", transition: "all 0.2s ease" }}
              onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-1px)"; e.currentTarget.style.boxShadow = "0 8px 28px rgba(17,17,17,0.24)"; }}
              onMouseLeave={e => { e.currentTarget.style.transform = ""; e.currentTarget.style.boxShadow = "0 4px 20px rgba(17,17,17,0.18)"; }}
            >
              ✦ Book a Consultation
            </Link>
          </div>
        </div>

        {/* Footer */}
        <div style={{ marginTop: 60, textAlign: "center", borderTop: `1px solid ${C.smoke}`, paddingTop: 28 }}>
          <p style={{ fontSize: 11, color: C.dust, letterSpacing: "0.1em", textTransform: "uppercase" }}>
            © {new Date().getFullYear()} Meet Serenity · All rights reserved
          </p>
        </div>
      </div>
    </div>
  );
}
