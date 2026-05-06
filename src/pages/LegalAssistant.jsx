import React from "react";

const C = {
  ink: "#111111",
  slate: "#4a4a4a",
  dust: "#7d7d7d",
  line: "#e7e3d9",
  ivory: "#f8f5ef",
  white: "#ffffff",
  gold: "#b9965b",
  warnBg: "#fff7e8",
};

export default function LegalAssistant() {
  const [input, setInput] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");
  const [messages, setMessages] = React.useState([
    {
      role: "assistant",
      content:
        "Welcome to Legal Affairs AI Assistant. I can help with legal intake preparation, risk issue triage, and next-step guidance. I am not a lawyer and this is not legal advice.",
    },
  ]);

  async function onSend(e) {
    e?.preventDefault();
    const text = String(input || "").trim();
    if (!text || loading) return;

    const nextMessages = [...messages, { role: "user", content: text }];
    setMessages(nextMessages);
    setInput("");
    setError("");
    setLoading(true);

    try {
      const resp = await fetch("/api/legal-assistant/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          history: nextMessages.slice(-8),
        }),
      });

      const json = await resp.json().catch(() => ({}));
      if (!resp.ok || !json?.ok) {
        throw new Error(json?.error || "Failed to get a response");
      }

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: String(json.answer || "No response generated."),
        },
      ]);
    } catch (err) {
      setError(err?.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(180deg, #f8f5ef 0%, #ffffff 65%)", padding: "32px 16px 56px" }}>
      <div style={{ maxWidth: 920, margin: "0 auto" }}>
        <div style={{ marginBottom: 16, fontSize: 12, letterSpacing: "0.12em", textTransform: "uppercase", color: C.dust, fontWeight: 700 }}>
          SmithInc Legal Operations
        </div>
        <h1 style={{ margin: 0, fontFamily: "'Cormorant Garamond', serif", fontSize: "clamp(30px, 5vw, 46px)", color: C.ink, lineHeight: 1.1 }}>
          Legal Attorney Affairs AI Bot
        </h1>
        <p style={{ marginTop: 10, marginBottom: 18, color: C.slate, fontSize: 15, maxWidth: 760, lineHeight: 1.6 }}>
          Use this assistant to prepare legal issue summaries, identify missing facts, and organize attorney follow-up.
          It provides general legal information only and does not replace licensed counsel.
        </p>

        <div style={{ background: C.warnBg, border: `1px solid ${C.line}`, borderRadius: 12, padding: "12px 14px", color: C.slate, fontSize: 13, marginBottom: 18 }}>
          Not legal advice. For active court deadlines, criminal exposure, or emergency legal risk, contact a licensed attorney immediately.
        </div>

        <div style={{ border: `1px solid ${C.line}`, borderRadius: 16, background: C.white, overflow: "hidden", boxShadow: "0 10px 30px rgba(17,17,17,0.06)" }}>
          <div style={{ maxHeight: 460, overflowY: "auto", padding: 16, background: C.ivory }}>
            {messages.map((msg, idx) => {
              const isAssistant = msg.role === "assistant";
              return (
                <div key={`${msg.role}-${idx}`} style={{ display: "flex", justifyContent: isAssistant ? "flex-start" : "flex-end", marginBottom: 10 }}>
                  <div
                    style={{
                      maxWidth: "88%",
                      whiteSpace: "pre-wrap",
                      borderRadius: 12,
                      padding: "10px 12px",
                      fontSize: 14,
                      lineHeight: 1.5,
                      border: `1px solid ${isAssistant ? C.line : "#1f1f1f"}`,
                      background: isAssistant ? "#ffffff" : "#1f1f1f",
                      color: isAssistant ? C.ink : "#ffffff",
                    }}
                  >
                    {msg.content}
                  </div>
                </div>
              );
            })}
            {loading && <div style={{ color: C.dust, fontSize: 13 }}>Thinking...</div>}
          </div>

          <form onSubmit={onSend} style={{ borderTop: `1px solid ${C.line}`, padding: 14, background: C.white }}>
            <label htmlFor="legal-input" style={{ display: "block", marginBottom: 8, color: C.dust, fontSize: 12, letterSpacing: "0.08em", textTransform: "uppercase", fontWeight: 700 }}>
              Message
            </label>
            <textarea
              id="legal-input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              rows={4}
              placeholder="Describe your legal issue, jurisdiction, and timeline..."
              style={{ width: "100%", resize: "vertical", borderRadius: 10, border: `1px solid ${C.line}`, padding: 12, fontSize: 14, outline: "none", fontFamily: "inherit" }}
            />
            <div style={{ marginTop: 10, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
              <div style={{ color: C.dust, fontSize: 12 }}>
                Tip: include country/state, case type, and deadlines for better triage.
              </div>
              <button
                type="submit"
                disabled={loading || !String(input || "").trim()}
                style={{
                  border: "none",
                  borderRadius: 999,
                  background: loading ? "#bfbfbf" : C.gold,
                  color: "#111",
                  padding: "10px 18px",
                  fontSize: 12,
                  fontWeight: 700,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  cursor: loading ? "not-allowed" : "pointer",
                }}
              >
                {loading ? "Sending..." : "Send"}
              </button>
            </div>
            {error && <div style={{ marginTop: 10, color: "#b42318", fontSize: 13 }}>Error: {error}</div>}
          </form>
        </div>
      </div>
    </div>
  );
}
