import React from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth";

export default function Login() {
  const { login, user } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");

  React.useEffect(() => {
    if (user) navigate("/", { replace: true });
  }, [user, navigate]);

  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const prefilledEmail = params.get("email") || "";
    if (prefilledEmail) {
      setEmail(prefilledEmail.trim().toLowerCase());
    }
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      await login(email.trim(), password);
    } catch (err) {
      setError(err.message || "Invalid login");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: "40px 20px", maxWidth: 400, margin: "0 auto" }}>
      <h1>Login</h1>
      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: 15 }}>
          <input
            type="email"
            value={email}
            placeholder="Email"
            onChange={(e) => setEmail(e.target.value)}
            disabled={loading}
            required
            style={{ width: "100%", padding: 12, boxSizing: "border-box", fontSize: 16, border: "1px solid #ccc", borderRadius: 4 }}
          />
        </div>
        <div style={{ marginBottom: 20 }}>
          <input
            type="password"
            value={password}
            placeholder="Password"
            onChange={(e) => setPassword(e.target.value)}
            disabled={loading}
            required
            style={{ width: "100%", padding: 12, boxSizing: "border-box", fontSize: 16, border: "1px solid #ccc", borderRadius: 4 }}
          />
        </div>
        {error && (
          <div style={{ color: "#d32f2f", marginBottom: 15, padding: 10, backgroundColor: "#ffebee", borderRadius: 4 }}>
            {error}
          </div>
        )}
        <button
          disabled={loading}
          style={{
            width: "100%",
            padding: 12,
            backgroundColor: loading ? "#ccc" : "#333",
            color: "white",
            border: "none",
            borderRadius: 4,
            fontSize: 16,
            fontWeight: "bold",
            cursor: loading ? "not-allowed" : "pointer",
          }}
        >
          {loading ? "Logging in..." : "Login"}
        </button>
      </form>
    </div>
  );
}
