import React from "react";

const VAPI_PUBLIC_KEY =
  import.meta.env.VITE_VAPI_PUBLIC_KEY || "5bce534b-e6b2-479c-b6bb-02f2b94298e3";
const VAPI_ASSISTANT_ID =
  import.meta.env.VITE_VAPI_ASSISTANT_ID || "806e0bca-a295-4eee-8a20-1e99639808a8";

const STATUS = { idle: "idle", connecting: "connecting", active: "active", error: "error" };

// ── Singleton module loader ────────────────────────────────
// Starts loading the Vapi SDK immediately when this file is first imported,
// so it's ready (or has already failed cleanly) before the user ever clicks.
let _vapiCtorPromise = null;
function getVapiCtorPromise() {
  if (!_vapiCtorPromise) {
    _vapiCtorPromise = import("@vapi-ai/web").then((mod) => {
      let Ctor = mod?.default ?? mod;
      if (typeof Ctor !== "function") Ctor = Ctor?.default;
      if (typeof Ctor !== "function") throw new Error("Voice SDK could not be loaded. Please refresh and try again.");
      return Ctor;
    }).catch((err) => {
      // Reset so a retry can try again
      _vapiCtorPromise = null;
      throw err;
    });
  }
  return _vapiCtorPromise;
}

// Kick off the load now, in the background, so it's ready on first click
getVapiCtorPromise().catch(() => { /* suppress noise — will surface on click */ });

// ── Error message extractor ───────────────────────────────
function extractErrMsg(err) {
  if (!err) return null;
  if (typeof err === "string") return err;
  if (err.message) return err.message;
  if (err.error?.message) return err.error.message;
  if (err.errorMsg) return err.errorMsg;
  if (err.error && typeof err.error === "string") return err.error;
  try { return JSON.stringify(err); } catch { return "Unknown error"; }
}

// ── Mic permission check ──────────────────────────────────
async function requestMicPermission() {
  if (!navigator?.mediaDevices?.getUserMedia) {
    throw new Error("Microphone access is not supported in this browser. Try Chrome or Safari.");
  }
  let stream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch (err) {
    if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
      throw new Error("Microphone permission denied. Please allow microphone access in your browser settings, then try again.");
    }
    if (err.name === "NotFoundError") {
      throw new Error("No microphone found. Please connect a microphone and try again.");
    }
    throw new Error(err.message || "Could not access microphone. Please check your browser settings.");
  }
  // Release immediately — Vapi will open its own stream
  try { stream.getTracks().forEach((t) => t.stop()); } catch { /* ignore */ }
}

// metadata: arbitrary object merged into the VAPI call metadata
// label: button text override (default "Talk to Serenity")
// compact: smaller UI variant for tight spaces like dropdown menus
export default function VoiceCallButton({ modelName, metadata = {}, label = "Talk to Serenity", compact = false }) {
  const [status, setStatus] = React.useState(STATUS.idle);
  const [errorMsg, setErrorMsg] = React.useState("");
  const [isMuted, setIsMuted] = React.useState(false);
  const vapiRef = React.useRef(null);

  // Clean up VAPI instance on unmount
  React.useEffect(() => {
    return () => {
      if (vapiRef.current) {
        try { vapiRef.current.stop(); } catch { /* ignore */ }
        vapiRef.current = null;
      }
    };
  }, []);

  const startCall = React.useCallback(async () => {
    setStatus(STATUS.connecting);
    setErrorMsg("");

    try {
      // 1. Check mic permission first
      await requestMicPermission();

      // 2. Get the preloaded Vapi constructor (already loading since page load)
      const VapiCtor = await getVapiCtorPromise();

      // 3. Create instance and set up listeners BEFORE starting the call
      const vapi = new VapiCtor(VAPI_PUBLIC_KEY);
      vapiRef.current = vapi;

      vapi.on("call-start", () => setStatus(STATUS.active));
      vapi.on("call-end", () => {
        setStatus(STATUS.idle);
        setIsMuted(false);
        vapiRef.current = null;
      });
      vapi.on("error", (err) => {
        console.error("VAPI error event:", err);
        const msg = extractErrMsg(err) || "Call failed. Please try again.";
        setStatus(STATUS.error);
        setErrorMsg(msg);
        setIsMuted(false);
        try { vapi.stop(); } catch { /* ignore */ }
        vapiRef.current = null;
      });

      // 4. Start the call
      await vapi.start(VAPI_ASSISTANT_ID, {
        metadata: {
          ...(modelName ? { model_name: modelName } : {}),
          ...metadata,
        },
      });
    } catch (err) {
      console.error("VAPI startCall error:", err);
      setStatus(STATUS.error);
      setErrorMsg(extractErrMsg(err) || "Could not start call. Please check your microphone and try again.");
      vapiRef.current = null;
    }
  }, [modelName, metadata]);

  const stopCall = React.useCallback(() => {
    if (vapiRef.current) {
      try { vapiRef.current.stop(); } catch { /* ignore */ }
    }
    setStatus(STATUS.idle);
    setIsMuted(false);
    vapiRef.current = null;
  }, []);

  const toggleMute = React.useCallback(() => {
    if (!vapiRef.current) return;
    const next = !isMuted;
    try {
      vapiRef.current.setMuted(next);
      setIsMuted(next);
    } catch { /* ignore */ }
  }, [isMuted]);

  const C = {
    ink: "#111111", white: "#ffffff", gold: "#c9a84c",
    ok: "#1a6636", err: "#9b1c1c", smoke: "#e8e4dc", dust: "#888888",
  };

  if (status === STATUS.idle || status === STATUS.error) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: compact ? 6 : 8 }}>
        <button
          onClick={startCall}
          style={{
            display: "inline-flex", alignItems: "center", gap: 10,
            padding: compact ? "9px 14px" : "14px 28px",
            background: C.gold, color: C.white,
            border: "none", borderRadius: 10,
            fontSize: compact ? 11 : 12, fontWeight: 700, letterSpacing: compact ? "0.07em" : "0.1em", textTransform: "uppercase",
            fontFamily: "'Inter',sans-serif", cursor: "pointer",
            boxShadow: "0 4px 20px rgba(201,168,76,0.35)",
            transition: "all 0.2s ease",
          }}
          onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-1px)"; e.currentTarget.style.boxShadow = "0 8px 28px rgba(201,168,76,0.45)"; }}
          onMouseLeave={e => { e.currentTarget.style.transform = ""; e.currentTarget.style.boxShadow = "0 4px 20px rgba(201,168,76,0.35)"; }}
        >
          <MicIcon />
          {label}
        </button>
        {status === STATUS.error && errorMsg && (
          <p style={{ fontSize: 12, color: C.err, margin: 0, maxWidth: 280 }}>{errorMsg}</p>
        )}
        {!compact && (
          <p style={{ fontSize: 11, color: C.dust, margin: 0, letterSpacing: "0.04em" }}>
            Free AI voice consultation · No call charges
          </p>
        )}
      </div>
    );
  }

  if (status === STATUS.connecting) {
    return (
      <div style={{ display: "inline-flex", alignItems: "center", gap: 12, padding: compact ? "9px 14px" : "14px 28px", background: C.smoke, borderRadius: 10 }}>
        <PulsingDot color={C.gold} />
        <span style={{ fontSize: compact ? 11 : 12, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", fontFamily: "'Inter',sans-serif", color: C.ink }}>
          Connecting…
        </span>
      </div>
    );
  }

  // STATUS.active
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "inline-flex", alignItems: "center", gap: 10, padding: compact ? "8px 12px" : "10px 18px", background: "#edf7ee", border: "1px solid #b2dfc0", borderRadius: 10 }}>
        <PulsingDot color={C.ok} />
        <span style={{ fontSize: compact ? 11 : 12, fontWeight: 600, color: C.ok, letterSpacing: "0.08em", textTransform: "uppercase", fontFamily: "'Inter',sans-serif" }}>
          Call in Progress
        </span>
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <button
          onClick={toggleMute}
          title={isMuted ? "Unmute" : "Mute"}
          style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            padding: compact ? "8px 12px" : "10px 18px",
            background: isMuted ? "#fef8ec" : C.white,
            border: `1px solid ${isMuted ? "#f0c070" : C.smoke}`,
            borderRadius: 8, fontSize: compact ? 11 : 12, fontWeight: 600,
            color: isMuted ? "#92560a" : C.ink,
            fontFamily: "'Inter',sans-serif", cursor: "pointer",
          }}
        >
          {isMuted ? <MicOffIcon /> : <MicIcon />}
          {isMuted ? "Unmute" : "Mute"}
        </button>
        <button
          onClick={stopCall}
          style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            padding: compact ? "8px 12px" : "10px 18px",
            background: C.err, color: C.white,
            border: "none", borderRadius: 8,
            fontSize: compact ? 11 : 12, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase",
            fontFamily: "'Inter',sans-serif", cursor: "pointer",
          }}
        >
          <PhoneOffIcon />
          End Call
        </button>
      </div>
    </div>
  );
}

function PulsingDot({ color }) {
  const [big, setBig] = React.useState(false);
  React.useEffect(() => {
    const t = setInterval(() => setBig(p => !p), 600);
    return () => clearInterval(t);
  }, []);
  return (
    <span style={{
      display: "inline-block",
      width: big ? 10 : 8, height: big ? 10 : 8,
      borderRadius: "50%", background: color,
      transition: "width 0.3s ease, height 0.3s ease",
      flexShrink: 0,
    }} />
  );
}

function MicIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="2" width="6" height="12" rx="3" />
      <path d="M5 10a7 7 0 0 0 14 0" />
      <line x1="12" y1="19" x2="12" y2="22" />
      <line x1="8" y1="22" x2="16" y2="22" />
    </svg>
  );
}

function MicOffIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="1" y1="1" x2="23" y2="23" />
      <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6" />
      <path d="M17 16.95A7 7 0 0 1 5 10v-1m14 0v1a7 7 0 0 1-.11 1.23" />
      <line x1="12" y1="19" x2="12" y2="22" />
      <line x1="8" y1="22" x2="16" y2="22" />
    </svg>
  );
}

function PhoneOffIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.68 13.31a16 16 0 0 0 3.41 2.6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7 2 2 0 0 1 1.72 2v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07" />
      <path d="M14.5 2.5a19.79 19.79 0 0 0-8.63 3.07A19.87 19.87 0 0 0 2.21 14.1a2 2 0 0 0 1.72 2.18 12.84 12.84 0 0 0 2.81-.7 2 2 0 0 1 2.11.45l1.27 1.27" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}
