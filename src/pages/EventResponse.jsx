import React from "react";
import "../App.css";

const COLORS = {
  ink: "#111111",
  slate: "#4a4a4a",
  dust: "#888888",
  smoke: "#e8e4dc",
  ivory: "#faf8f4",
  white: "#ffffff",
  ok: "#1a6636",
  okBg: "#edf7ee",
  warn: "#92560a",
  warnBg: "#fef8ec",
  err: "#9b1c1c",
  errBg: "#fef2f2",
};

const buttonStyle = (active, tone = "dark") => {
  const palette = {
    dark: [COLORS.ink, COLORS.white, COLORS.ink],
    success: [COLORS.okBg, COLORS.ok, "rgba(26,102,54,0.2)"],
    warn: [COLORS.warnBg, COLORS.warn, "rgba(146,86,10,0.2)"],
    danger: [COLORS.errBg, COLORS.err, "rgba(155,28,28,0.2)"],
  }[tone];

  return {
    padding: "10px 14px",
    borderRadius: 8,
    border: `1px solid ${active ? palette[2] : COLORS.smoke}`,
    background: active ? palette[0] : COLORS.white,
    color: active ? palette[1] : COLORS.slate,
    fontSize: 12,
    fontWeight: 600,
    letterSpacing: "0.06em",
    textTransform: "uppercase",
    cursor: "pointer",
    fontFamily: "'Inter',sans-serif",
  };
};

export default function EventResponse() {
  const params = React.useMemo(() => new URLSearchParams(window.location.search), []);
  const modelName = params.get("name") || "there";
  const modelEmail = params.get("email") || "";
  const eventTitle = params.get("eventTitle") || "Casting call";
  const eventType = params.get("eventType") || "casting";
  const eventAt = params.get("eventAt") || "";
  const actionAlias = { confirm: "available", reschedule: "maybe", cancel: "unavailable" };
  const rawAction = params.get("action") || "available";
  const defaultAction = ["available", "maybe", "unavailable"].includes(rawAction)
    ? rawAction
    : actionAlias[rawAction] || "available";

  const [action, setAction] = React.useState(defaultAction);
  const [message, setMessage] = React.useState("");
  const [requestedTime, setRequestedTime] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [instagram, setInstagram] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [submitted, setSubmitted] = React.useState(false);
  const [error, setError] = React.useState("");

  const prettyDate = React.useMemo(() => {
    if (!eventAt) return "To be announced";
    const dt = new Date(eventAt);
    return Number.isNaN(dt.getTime()) ? eventAt : dt.toLocaleString();
  }, [eventAt]);

  const submitResponse = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");

    try {
      const res = await fetch("/api/events/respond", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          modelName,
          modelEmail,
          eventTitle,
          eventType,
          eventAt,
          action,
          requestedTime: requestedTime ? new Date(requestedTime).toISOString() : "",
          phone,
          instagram,
          message,
        }),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.ok) throw new Error(json.error || "Failed to send response");
      setSubmitted(true);
    } catch (err) {
      setError(err.message || "Failed to submit response.");
    } finally {
      setSaving(false);
    }
  };

  const successText = {
    available: "Your casting availability has been submitted.",
    maybe: "Your tentative availability has been submitted.",
    unavailable: "Your unavailability has been submitted.",
  }[action] || "Your response has been sent.";

  return (
    <div className="lx-auth-screen" style={{ alignItems: "flex-start", paddingTop: 24, paddingBottom: 24 }}>
      <div className="lx-auth-panel xwide" style={{ maxWidth: 760, padding: "32px 24px" }}>
        <div className="lx-auth-brand" style={{ marginBottom: 18, paddingBottom: 14 }}>Meet Serenity</div>
        <h1 className="lx-auth-title" style={{ marginBottom: 8 }}>Casting Call Submission</h1>
        <p className="lx-auth-sub" style={{ marginBottom: 20 }}>
          {modelName}, submit your standard casting call response so the team can review availability quickly.
        </p>

        <div style={{ background: "linear-gradient(180deg, #faf8f4 0%, #f5f2ec 100%)", border: "1px solid #e8e4dc", borderRadius: 14, padding: 18, marginBottom: 18 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#888", marginBottom: 10 }}>Event details</div>
          <div style={{ display: "grid", gap: 6, color: COLORS.slate, fontSize: 14 }}>
            <div><strong style={{ color: COLORS.ink }}>Casting call:</strong> {eventTitle}</div>
            <div><strong style={{ color: COLORS.ink }}>Category:</strong> {eventType}</div>
            <div><strong style={{ color: COLORS.ink }}>Date & time:</strong> {prettyDate}</div>
            {modelEmail ? <div><strong style={{ color: COLORS.ink }}>Email:</strong> {modelEmail}</div> : null}
          </div>
        </div>

        {submitted ? (
          <div style={{ background: COLORS.okBg, border: "1px solid rgba(26,102,54,0.2)", borderRadius: 12, padding: "16px 18px", color: COLORS.ok, fontSize: 14 }}>
            {successText}
          </div>
        ) : (
          <form onSubmit={submitResponse} style={{ display: "grid", gap: 12 }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: COLORS.dust, marginBottom: 8 }}>
                Your response
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button type="button" onClick={() => setAction("available")} style={buttonStyle(action === "available", "success")}>Available</button>
                <button type="button" onClick={() => setAction("maybe")} style={buttonStyle(action === "maybe", "warn")}>Maybe</button>
                <button type="button" onClick={() => setAction("unavailable")} style={buttonStyle(action === "unavailable", "danger")}>Unavailable</button>
              </div>
            </div>

            {action === "maybe" && (
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: COLORS.dust, marginBottom: 6 }}>
                  Preferred / alternate time
                </div>
                <input
                  type="datetime-local"
                  value={requestedTime}
                  onChange={(e) => setRequestedTime(e.target.value)}
                  style={{ width: "100%", padding: "12px 14px", borderRadius: 8, border: `1px solid ${COLORS.smoke}`, fontSize: 14, boxSizing: "border-box" }}
                />
              </div>
            )}

            <div style={{ display: "grid", gap: 8, gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))" }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: COLORS.dust, marginBottom: 6 }}>
                  Phone (optional)
                </div>
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="e.g. +1 555 555 5555"
                  style={{ width: "100%", padding: "12px 14px", borderRadius: 8, border: `1px solid ${COLORS.smoke}`, fontSize: 14, boxSizing: "border-box" }}
                />
              </div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: COLORS.dust, marginBottom: 6 }}>
                  Instagram (optional)
                </div>
                <input
                  value={instagram}
                  onChange={(e) => setInstagram(e.target.value)}
                  placeholder="@yourhandle"
                  style={{ width: "100%", padding: "12px 14px", borderRadius: 8, border: `1px solid ${COLORS.smoke}`, fontSize: 14, boxSizing: "border-box" }}
                />
              </div>
            </div>

            <div>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: COLORS.dust, marginBottom: 6 }}>
                Message
              </div>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Add any notes, links, or wardrobe details for the team"
                rows={4}
                style={{ width: "100%", padding: "12px 14px", borderRadius: 8, border: `1px solid ${COLORS.smoke}`, fontSize: 14, boxSizing: "border-box", resize: "vertical" }}
              />
            </div>

            {error ? (
              <div style={{ background: COLORS.errBg, border: "1px solid rgba(155,28,28,0.2)", borderRadius: 10, padding: "10px 14px", color: COLORS.err, fontSize: 13 }}>
                {error}
              </div>
            ) : null}

            <button
              type="submit"
              disabled={saving}
              className="lx-btn lx-btn-primary lx-btn-full"
            >
              {saving ? "Sending…" : "Submit Casting Response"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
