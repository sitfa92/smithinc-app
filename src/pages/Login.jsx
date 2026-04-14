import React from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth";
import "../App.css";

export default function Login() {
  const { login, user } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");
  const [attempts, setAttempts] = React.useState(0);
  const [cooldownUntil, setCooldownUntil] = React.useState(0);
  const [cooldownSecs, setCooldownSecs] = React.useState(0);

  React.useEffect(() => {
    if (user) navigate("/", { replace: true });
  }, [user, navigate]);

  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const pre = params.get("email") || "";
    if (pre) setEmail(pre.trim().toLowerCase());
  }, []);

  React.useEffect(() => {
    if (cooldownUntil <= Date.now()) return;
    const tick = () => {
      const remaining = Math.ceil((cooldownUntil - Date.now()) / 1000);
      if (remaining <= 0) { setCooldownSecs(0); setAttempts(0); }
      else setCooldownSecs(remaining);
    };
    tick();
    const id = setInterval(tick, 500);
    return () => clearInterval(id);
  }, [cooldownUntil]);

  const isInCooldown = cooldownUntil > Date.now() && cooldownSecs > 0;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isInCooldown) return;
    setLoading(true);
    setError("");
    try {
      await login(email.trim(), password);
    } catch (err) {
      const next = attempts + 1;
      setAttempts(next);
      if (next >= 5) {
        const until = Date.now() + 30_000;
        setCooldownUntil(until);
        setError("Too many failed attempts. Please wait 30 seconds.");
      } else {
        setError(err.message || "Invalid credentials. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  const inp = {
    width:"100%", padding:"13px 16px", fontSize:14, color:"#111",
    background:"#fff", border:"1px solid #e8e4dc", borderRadius:8,
    outline:"none", fontFamily:"'Inter',sans-serif", boxSizing:"border-box",
    transition:"border-color 0.2s",
  };

  return (
    <div className="lx-auth-screen">
      <div className="lx-auth-panel">
        <div className="lx-auth-brand">Meet Serenity</div>

        <h1 className="lx-auth-title">Welcome back</h1>
        <p className="lx-auth-sub">Sign in to your account</p>

        <form onSubmit={handleSubmit}>
          <div className="lx-field">
            <label className="lx-label">Email</label>
            <input
              type="email" value={email} placeholder="you@example.com"
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading} required
              style={inp}
              onFocus={(e) => { e.target.style.borderColor="#111"; e.target.style.boxShadow="0 0 0 3px rgba(17,17,17,0.05)"; }}
              onBlur={(e)  => { e.target.style.borderColor="#e8e4dc"; e.target.style.boxShadow="none"; }}
            />
          </div>
          <div className="lx-field">
            <label className="lx-label">Password</label>
            <input
              type="password" value={password} placeholder="••••••••"
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading} required
              style={inp}
              onFocus={(e) => { e.target.style.borderColor="#111"; e.target.style.boxShadow="0 0 0 3px rgba(17,17,17,0.05)"; }}
              onBlur={(e)  => { e.target.style.borderColor="#e8e4dc"; e.target.style.boxShadow="none"; }}
            />
          </div>

          {isInCooldown && (
            <div style={{ background:"#fef2f2", border:"1px solid rgba(155,28,28,0.2)", borderRadius:8, padding:"10px 14px", marginBottom:16, color:"#9b1c1c", fontSize:13 }}>
              Too many failed attempts. Try again in <strong>{cooldownSecs}s</strong>.
            </div>
          )}
          {!isInCooldown && error && (
            <div style={{ background:"#fef2f2", border:"1px solid rgba(155,28,28,0.2)", borderRadius:8, padding:"10px 14px", marginBottom:16, color:"#9b1c1c", fontSize:13 }}>
              {error}{attempts > 1 && attempts < 5 && <span style={{ opacity:0.7 }}> ({5 - attempts} attempt{5 - attempts !== 1 ? "s" : ""} remaining)</span>}
            </div>
          )}

          <button
            disabled={loading || isInCooldown}
            className={`lx-btn lx-btn-primary lx-btn-full${(loading || isInCooldown) ? " lx-btn-disabled" : ""}`}
            style={{ marginTop: 8, padding: "14px 22px", fontSize: 12 }}
          >
            {isInCooldown ? `Wait ${cooldownSecs}s…` : loading ? "Signing in…" : "Sign In"}
          </button>
        </form>

        <p style={{ textAlign:"center", color:"#bbb", fontSize:12, marginTop:28, letterSpacing:"0.06em", textTransform:"uppercase" }}>
          Team access only
        </p>
      </div>
    </div>
  );
}
