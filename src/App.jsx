import React from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  Link,
  useNavigate,
} from "react-router-dom";
import { supabase } from "./supabase";
import { uploadImage } from "./imageUpload";
import { sendModelSubmissionEmail, sendModelStatusUpdateEmail, sendBookingConfirmationEmail, sendBookingConfirmedEmail } from "./emailService";
import { calculateMetrics, MetricCard } from "./analyticsUtils";

const DEFAULT_ROLE_BY_EMAIL = {
  "sitfa92@gmail.com": "admin",
  "marthajohn223355@gmail.com": "va",
  "chizzyboi72@gmail.com": "agent",
};

const sendZapierEvent = async (eventType, payload) => {
  try {
    await fetch("/api/zapier/forward", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ eventType, payload }),
    });
  } catch (_err) {
    // Intentionally ignored to keep core user flows uninterrupted.
  }
};

const BACKEND_BASE_URL = (import.meta.env.VITE_BACKEND_URL || "").trim();

const PIPELINE_STAGES = [
  "submitted",
  "reviewing",
  "development",
  "digitals_pending",
  "ready_to_pitch",
  "pitched",
  "in_talks",
  "signed",
  "rejected",
];

const PIPELINE_STAGE_LABELS = {
  submitted: "Submitted",
  reviewing: "Reviewing",
  development: "Development",
  digitals_pending: "Digitals Pending",
  ready_to_pitch: "Ready to Pitch",
  pitched: "Pitched",
  in_talks: "In Talks",
  signed: "Signed",
  rejected: "Rejected",
};

const PRIORITY_LEVELS = ["low", "medium", "high"];
const PRIORITY_RANK = { high: 3, medium: 2, low: 1 };

const normalizePipelineStage = (value) =>
  PIPELINE_STAGES.includes(value) ? value : "submitted";

const normalizePriorityLevel = (value) =>
  PRIORITY_LEVELS.includes(value) ? value : "medium";

const isMissingColumnError = (err) =>
  err?.code === "42703" ||
  err?.message?.toLowerCase().includes("column") ||
  err?.message?.toLowerCase().includes("does not exist");

const buildFallbackTasksFromBookings = (bookings) =>
  (bookings || [])
    .filter((b) => ["pending", "confirmed"].includes(b.status))
    .slice(0, 6)
    .map((b) => ({
      _id: `fallback-${b.id}`,
      role: "MJ",
      task: `${b.status === "pending" ? "Review" : "Complete"} booking for ${b.name}`,
      status: b.status === "pending" ? "pending" : "in_progress",
    }));

const sendBackendWebhook = async (type, data) => {
  if (!BACKEND_BASE_URL) return;

  try {
    await fetch(`${BACKEND_BASE_URL}/webhook/zapier`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, data }),
    });
  } catch (_err) {
    // Keep frontend flows unaffected if backend is down or not reachable.
  }
};

// Allowlist is always derived from the defaults — keeps stale closures safe.
const STATIC_ALLOWED_EMAILS = new Set(Object.keys(DEFAULT_ROLE_BY_EMAIL));
const isStaticallyAllowed = (email) =>
  STATIC_ALLOWED_EMAILS.has((email || "").trim().toLowerCase());

/* AUTH */
const AuthContext = React.createContext(null);

const useProvideAuth = () => {
  const [user, setUser] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [roleByEmail, setRoleByEmail] = React.useState(DEFAULT_ROLE_BY_EMAIL);

  React.useEffect(() => {
    let mounted = true;

    const loadRoles = async () => {
      try {
        const { data, error } = await supabase
          .from("users")
          .select("email, role, is_active");

        if (error) throw error;

        const mapped = {};
        (data || []).forEach((row) => {
          const email = (row.email || "").trim().toLowerCase();
          if (email && row.is_active !== false) {
            mapped[email] = row.role || "user";
          }
        });

        if (mounted && Object.keys(mapped).length > 0) {
          // Defaults ALWAYS win — DB cannot override hardcoded admin/va/agent.
          setRoleByEmail({ ...mapped, ...DEFAULT_ROLE_BY_EMAIL });
        }
      } catch (_err) {
        // Fall back to default hardcoded roles when users table is not ready.
        if (mounted) {
          setRoleByEmail(DEFAULT_ROLE_BY_EMAIL);
        }
      }
    };

    loadRoles();

    const initSession = async () => {
      const { data, error } = await supabase.auth.getSession();
      if (!mounted) return;

      if (error) {
        console.error("Session fetch error:", error);
      }

      const sessionUser = data?.session?.user ?? null;
      if (sessionUser?.email && !isStaticallyAllowed(sessionUser.email)) {
        await supabase.auth.signOut();
        setUser(null);
      } else {
        setUser(sessionUser);
      }
      setLoading(false);
    };

    initSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      const sessionUser = session?.user ?? null;
      if (sessionUser?.email && !isStaticallyAllowed(sessionUser.email)) {
        supabase.auth.signOut();
        setUser(null);
      } else {
        setUser(sessionUser);
      }
      setLoading(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const login = async (email, password) => {
    if (!isStaticallyAllowed(email)) {
      throw new Error("This account is not authorized for this platform.");
    }

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      throw error;
    }
    return true;
  };

  const logout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      throw error;
    }
  };

  const role = user?.email ? roleByEmail[user.email.toLowerCase()] || "user" : "user";
  const isAdmin = role === "admin";

  return { user, login, logout, loading, role, isAdmin, roleByEmail };
};

const AuthProvider = ({ children }) => {
  const auth = useProvideAuth();
  return <AuthContext.Provider value={auth}>{children}</AuthContext.Provider>;
};

const useAuth = () => {
  const context = React.useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
};

/* NAV */
const Nav = () => {
  const { user, logout, role } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);
  const [isMobile, setIsMobile] = React.useState(window.innerWidth <= 768);

  React.useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
      if (window.innerWidth > 768) {
        setMobileMenuOpen(false);
      }
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const navStyle = {
    padding: "15px 20px",
    backgroundColor: "#fff",
    borderBottom: "1px solid #e0e0e0",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    position: "relative",
  };

  const desktopNavStyle = {
    display: isMobile ? "none" : "flex",
    gap: "20px",
    flexWrap: "wrap",
  };

  const linkStyle = {
    textDecoration: "none",
    color: "#333",
    fontWeight: 500,
    fontSize: 14,
    padding: "8px 12px",
    borderRadius: 4,
    transition: "background-color 0.2s",
    cursor: "pointer",
    display: "block",
  };

  const userEmailStyle = {
    color: "#666",
    fontSize: 13,
    marginRight: 8,
    whiteSpace: "nowrap",
  };

  const mobileMenuStyle = {
    display: mobileMenuOpen ? "flex" : "none",
    flexDirection: "column",
    position: "absolute",
    top: "55px",
    left: 0,
    right: 0,
    backgroundColor: "#fff",
    borderBottom: "1px solid #e0e0e0",
    padding: "10px",
    gap: "8px",
    zIndex: 1000,
    boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
  };

  const mobileMenuButtonStyle = {
    backgroundColor: "transparent",
    border: "none",
    fontSize: 24,
    cursor: "pointer",
    padding: "5px 10px",
    display: isMobile ? "block" : "none",
    color: "#333",
  };

  const canAccess = (section) => {
    if (role === "admin") return true;
    if (role === "va") {
      return ["dashboard", "models", "model-pipeline", "bookings", "clients", "integrations"].includes(section);
    }
    if (role === "agent") {
      return ["dashboard", "models", "model-pipeline", "submissions", "analytics"].includes(section);
    }
    if (role === "user") {
      return ["dashboard", "models"].includes(section);
    }
    return false;
  };

  return (
    <nav style={navStyle}>
      <div style={{ fontWeight: "bold", fontSize: 18, whiteSpace: "nowrap" }}>
        MEET SERENITY
      </div>

      {/* Desktop Navigation */}
      <div style={desktopNavStyle}>
        {user?.email && <span style={userEmailStyle}>{user.email} ({role})</span>}
        {canAccess("dashboard") && (
          <Link to="/" style={linkStyle}>
            Dashboard
          </Link>
        )}
        {canAccess("models") && (
          <Link to="/models" style={linkStyle}>
            Models
          </Link>
        )}
        {canAccess("model-pipeline") && (
          <Link to="/model-pipeline" style={linkStyle}>
            Pipeline
          </Link>
        )}
        {canAccess("submissions") && (
          <Link to="/submissions" style={linkStyle}>
            Submissions
          </Link>
        )}
        {canAccess("bookings") && (
          <Link to="/bookings" style={linkStyle}>
            Bookings
          </Link>
        )}
        {canAccess("clients") && (
          <Link to="/clients" style={linkStyle}>
            Clients
          </Link>
        )}
        {canAccess("analytics") && (
          <Link to="/analytics" style={linkStyle}>
            Analytics
          </Link>
        )}
        {canAccess("integrations") && (
          <Link to="/integrations" style={linkStyle}>
            Integrations
          </Link>
        )}
        {canAccess("team") && (
          <Link to="/team" style={linkStyle}>
            Team
          </Link>
        )}
        <button
          onClick={async () => {
            try {
              await logout();
              window.location.href = "/login";
            } catch (err) {
              alert(err.message || "Failed to logout");
            }
          }}
          style={{ ...linkStyle, border: "none", background: "transparent" }}
        >
          Logout
        </button>
      </div>

      {/* Mobile Menu Button */}
      <button
        onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        style={mobileMenuButtonStyle}
        aria-label="Toggle menu"
      >
        ☰
      </button>

      {/* Mobile Navigation */}
      <div style={mobileMenuStyle}>
        {user?.email && <span style={userEmailStyle}>{user.email} ({role})</span>}
        {canAccess("dashboard") && (
          <Link 
            to="/" 
            style={linkStyle} 
            onClick={() => setMobileMenuOpen(false)}
          >
            Dashboard
          </Link>
        )}
        {canAccess("models") && (
          <Link 
            to="/models" 
            style={linkStyle} 
            onClick={() => setMobileMenuOpen(false)}
          >
            Models
          </Link>
        )}
        {canAccess("model-pipeline") && (
          <Link
            to="/model-pipeline"
            style={linkStyle}
            onClick={() => setMobileMenuOpen(false)}
          >
            Pipeline
          </Link>
        )}
        {canAccess("submissions") && (
          <Link 
            to="/submissions" 
            style={linkStyle} 
            onClick={() => setMobileMenuOpen(false)}
          >
            Submissions
          </Link>
        )}
        {canAccess("bookings") && (
          <Link 
            to="/bookings" 
            style={linkStyle} 
            onClick={() => setMobileMenuOpen(false)}
          >
            Bookings
          </Link>
        )}
        {canAccess("clients") && (
          <Link 
            to="/clients" 
            style={linkStyle} 
            onClick={() => setMobileMenuOpen(false)}
          >
            Clients
          </Link>
        )}
        {canAccess("analytics") && (
          <Link 
            to="/analytics" 
            style={linkStyle} 
            onClick={() => setMobileMenuOpen(false)}
          >
            Analytics
          </Link>
        )}
        {canAccess("integrations") && (
          <Link 
            to="/integrations" 
            style={linkStyle} 
            onClick={() => setMobileMenuOpen(false)}
          >
            Integrations
          </Link>
        )}
        {canAccess("team") && (
          <Link 
            to="/team" 
            style={linkStyle} 
            onClick={() => setMobileMenuOpen(false)}
          >
            Team
          </Link>
        )}
        <button
          onClick={async () => {
            try {
              await logout();
              setMobileMenuOpen(false);
              window.location.href = "/login";
            } catch (err) {
              alert(err.message || "Failed to logout");
            }
          }}
          style={{ ...linkStyle, border: "none", background: "transparent", textAlign: "left" }}
        >
          Logout
        </button>
      </div>
    </nav>
  );
};

/* LOGIN */
const Login = () => {
  const { login, user } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");

  // Already logged in — bounce to dashboard without a full reload.
  React.useEffect(() => {
    if (user) navigate("/", { replace: true });
  }, [user]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      await login(email.trim(), password);
      // onAuthStateChange will update user → the effect above navigates.
    } catch (err) {
      setError(err.message || "Invalid login");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: "20px", maxWidth: "400px", margin: "50px auto" }}>
      <h1 style={{ textAlign: "center", marginBottom: 30 }}>Admin Login</h1>
      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: 20 }}>
          <input 
            placeholder="Email" 
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{
              width: "100%",
              padding: "12px",
              fontSize: "16px",
              border: "1px solid #ccc",
              borderRadius: "4px",
              boxSizing: "border-box",
            }}
          />
        </div>

        <div style={{ marginBottom: 20 }}>
          <input 
            type="password" 
            placeholder="Password" 
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{
              width: "100%",
              padding: "12px",
              fontSize: "16px",
              border: "1px solid #ccc",
              borderRadius: "4px",
              boxSizing: "border-box",
            }}
          />
        </div>

        <button
          disabled={loading}
          style={{
            width: "100%",
            padding: "12px",
            backgroundColor: loading ? "#999" : "#333",
            color: "white",
            border: "none",
            borderRadius: "4px",
            fontSize: "16px",
            fontWeight: "bold",
            cursor: loading ? "not-allowed" : "pointer",
          }}
        >
          {loading ? "Signing in..." : "Login"}
        </button>
      </form>

      {error && (
        <div
          style={{
            marginTop: 16,
            color: "#b00020",
            backgroundColor: "#ffe8ec",
            borderRadius: 4,
            padding: 12,
            fontSize: 14,
          }}
        >
          {error}
        </div>
      )}
    </div>
  );
};

/* MODEL SIGNUP */
const ModelSignup = () => {
  const [form, setForm] = React.useState({
    name: "",
    email: "",
    instagram: "",
  });
  const [image, setImage] = React.useState(null);
  const [imagePreview, setImagePreview] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");
  const [success, setSuccess] = React.useState(false);

  const handleImageChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setImage(file);
      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      // Validate required fields
      if (!form.name.trim() || !form.email.trim()) {
        throw new Error("Name and email are required");
      }

      if (!image) {
        throw new Error("Please upload a profile image");
      }

      // Upload image first
      let imageUrl = "";
      try {
        imageUrl = await uploadImage(image);
      } catch (uploadErr) {
        throw new Error(`Image upload failed: ${uploadErr.message}`);
      }

      const baseSubmission = {
        name: form.name.trim(),
        email: form.email.trim(),
        instagram: form.instagram.trim(),
        image_url: imageUrl,
        status: "pending",
        submitted_at: new Date().toISOString(),
      };

      const pipelineSubmission = {
        ...baseSubmission,
        pipeline_stage: "submitted",
        priority_level: "medium",
        scouting_notes: "",
        internal_notes: "",
        agency_name: "",
        last_updated: new Date().toISOString(),
      };

      // Insert model with image URL and pending status
      let { error: supabaseError } = await supabase
        .from("models")
        .insert([pipelineSubmission]);

      if (supabaseError && isMissingColumnError(supabaseError)) {
        const retry = await supabase.from("models").insert([baseSubmission]);
        supabaseError = retry.error;
      }

      if (supabaseError) throw supabaseError;

      // Send confirmation emails (async, don't block UI)
      sendModelSubmissionEmail({
        name: form.name.trim(),
        email: form.email.trim(),
        instagram: form.instagram.trim(),
      });

      sendBackendWebhook("model_signup", {
        name: form.name.trim(),
        instagram: form.instagram.trim(),
        height: "",
        status: "pending",
      });

      setSuccess(true);
      setForm({ name: "", email: "", instagram: "" });
      setImage(null);
      setImagePreview("");
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err.message || "Failed to submit. Please try again.");
      console.error("Submission error:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: "20px", maxWidth: "600px", margin: "0 auto", boxSizing: "border-box" }}>
      <h1 style={{ fontSize: "clamp(24px, 5vw, 32px)" }}>Model Signup</h1>
      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: 20 }}>
          <label style={{ display: "block", marginBottom: 8, fontWeight: "bold" }}>
            Full Name *
          </label>
          <input 
            value={form.name} 
            placeholder="Your full name" 
            onChange={(e) => setForm({...form, name: e.target.value})}
            disabled={loading}
            style={{
              width: "100%",
              padding: "12px",
              boxSizing: "border-box",
              fontSize: "16px",
              border: "1px solid #ccc",
              borderRadius: "4px",
            }}
          />
        </div>

        <div style={{ marginBottom: 20 }}>
          <label style={{ display: "block", marginBottom: 8, fontWeight: "bold" }}>
            Email *
          </label>
          <input 
            value={form.email} 
            placeholder="your@email.com" 
            type="email"
            onChange={(e) => setForm({...form, email: e.target.value})}
            disabled={loading}
            style={{
              width: "100%",
              padding: "12px",
              boxSizing: "border-box",
              fontSize: "16px",
              border: "1px solid #ccc",
              borderRadius: "4px",
            }}
          />
        </div>

        <div style={{ marginBottom: 20 }}>
          <label style={{ display: "block", marginBottom: 8, fontWeight: "bold" }}>
            Instagram
          </label>
          <input 
            value={form.instagram} 
            placeholder="@yourprofile" 
            onChange={(e) => setForm({...form, instagram: e.target.value})}
            disabled={loading}
            style={{
              width: "100%",
              padding: "12px",
              boxSizing: "border-box",
              fontSize: "16px",
              border: "1px solid #ccc",
              borderRadius: "4px",
            }}
          />
        </div>

        <div style={{ marginBottom: 20 }}>
          <label style={{ display: "block", marginBottom: 8, fontWeight: "bold" }}>
            Profile Image * (JPG, PNG, GIF, WebP - Max 5MB)
          </label>
          <input 
            type="file"
            accept="image/*"
            onChange={handleImageChange}
            disabled={loading}
            style={{
              width: "100%",
              padding: "12px",
              boxSizing: "border-box",
              fontSize: "16px",
              border: "1px solid #ccc",
              borderRadius: "4px",
            }}
          />
          {imagePreview && (
            <div style={{ marginTop: 15, textAlign: "center" }}>
              <img 
                src={imagePreview} 
                alt="Preview" 
                style={{
                  maxWidth: "100%",
                  maxHeight: "300px",
                  borderRadius: 8,
                }}
              />
            </div>
          )}
        </div>

        <button 
          disabled={loading}
          style={{
            width: "100%",
            padding: "12px",
            backgroundColor: loading ? "#ccc" : "#333",
            color: "white",
            border: "none",
            borderRadius: 4,
            fontSize: 16,
            fontWeight: "bold",
            cursor: loading ? "not-allowed" : "pointer",
          }}
        >
          {loading ? "Uploading..." : "Submit Application"}
        </button>
      </form>

      {error && (
        <div style={{
          color: "#d32f2f",
          marginTop: 20,
          padding: 15,
          backgroundColor: "#ffebee",
          borderRadius: 4,
        }}>
          {error}
        </div>
      )}
      {success && (
        <div style={{
          color: "#388e3c",
          marginTop: 20,
          padding: 15,
          backgroundColor: "#e8f5e9",
          borderRadius: 4,
        }}>
          ✓ Application submitted successfully! We'll review it soon.
        </div>
      )}
    </div>
  );
};

/* SUBMISSIONS */
const Submissions = () => {
  const [submissions, setSubmissions] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const [actionLoading, setActionLoading] = React.useState({});

  React.useEffect(() => {
    fetchSubmissions();
  }, []);

  const fetchSubmissions = async () => {
    try {
      setError("");
      const { data, error: supabaseError } = await supabase
        .from("models")
        .select("*")
        .order("submitted_at", { ascending: false });

      if (supabaseError) throw supabaseError;
      setSubmissions(data || []);
    } catch (err) {
      setError(err.message || "Failed to load submissions");
      console.error("Fetch error:", err);
    } finally {
      setLoading(false);
    }
  };

  const updateModelStatus = async (modelId, newStatus) => {
    const model = submissions.find((m) => m.id === modelId);
    if (!model) return;

    setActionLoading((prev) => ({ ...prev, [modelId]: true }));
    try {
      const nextUpdate = { status: newStatus, last_updated: new Date().toISOString() };
      let { error: supabaseError } = await supabase
        .from("models")
        .update(nextUpdate)
        .eq("id", modelId);

      if (supabaseError && isMissingColumnError(supabaseError)) {
        const retry = await supabase
          .from("models")
          .update({ status: newStatus })
          .eq("id", modelId);
        supabaseError = retry.error;
      }

      if (supabaseError) throw supabaseError;

      // Send status update email (async, don't block UI)
      sendModelStatusUpdateEmail(model, newStatus);

      // Update local state
      setSubmissions((prev) =>
        prev.map((m) => (m.id === modelId ? { ...m, status: newStatus } : m))
      );
    } catch (err) {
      console.error("Update error:", err);
      alert(`Failed to update status: ${err.message}`);
    } finally {
      setActionLoading((prev) => ({ ...prev, [modelId]: false }));
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "approved":
        return "#4caf50"; // Green
      case "rejected":
        return "#f44336"; // Red
      case "pending":
      default:
        return "#ff9800"; // Orange
    }
  };

  return (
    <div style={{ padding: "20px", maxWidth: "1200px", margin: "0 auto", boxSizing: "border-box" }}>
      <h1 style={{ fontSize: "clamp(24px, 5vw, 32px)" }}>Model Applications</h1>
      
      {loading && <p>Loading applications...</p>}
      {error && <div style={{ color: "#d32f2f", marginBottom: 20, padding: 10, backgroundColor: "#ffebee", borderRadius: 4 }}>Error: {error}</div>}
      
      {!loading && submissions.length === 0 && (
        <p style={{ color: "#999", fontSize: 16 }}>No submissions yet.</p>
      )}

      {!loading && submissions.map((model) => {
        const isMobile = window.innerWidth <= 768;
        return (
          <div
            key={model.id}
            style={{
              display: "flex",
              flexDirection: isMobile ? "column" : "row",
              gap: isMobile ? "15px" : "20px",
              padding: "20px",
              marginBottom: "20px",
              border: "1px solid #e0e0e0",
              borderRadius: 8,
              backgroundColor: "#fafafa",
              boxSizing: "border-box",
            }}
          >
            {/* Image */}
            <div style={{ 
              flex: isMobile ? "1 1 100%" : "0 0 150px",
              minWidth: 0,
            }}>
              {model.image_url ? (
                <img
                  src={model.image_url}
                  alt={model.name}
                  style={{
                    width: "100%",
                    height: isMobile ? "250px" : "200px",
                    objectFit: "cover",
                    borderRadius: 8,
                  }}
                />
              ) : (
                <div
                  style={{
                    width: "100%",
                    height: isMobile ? "250px" : "200px",
                    backgroundColor: "#e0e0e0",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    borderRadius: 8,
                    color: "#999",
                  }}
                >
                  No Image
                </div>
              )}
            </div>

            {/* Info */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ marginBottom: 10 }}>
                <h3 style={{ margin: "0 0 5px 0", fontSize: "clamp(18px, 4vw, 20px)" }}>{model.name}</h3>
                <p style={{ margin: "5px 0", color: "#666", wordBreak: "break-word" }}>
                  <strong>Email:</strong> {model.email}
                </p>
                {model.instagram && (
                  <p style={{ margin: "5px 0", color: "#666", wordBreak: "break-word" }}>
                    <strong>Instagram:</strong> @{model.instagram}
                  </p>
                )}
                <p style={{ margin: "5px 0", color: "#999", fontSize: "0.9em" }}>
                  Submitted: {new Date(model.submitted_at).toLocaleString()}
                </p>
              </div>

              {/* Status Badge */}
              <div style={{ marginBottom: 15 }}>
                <span
                  style={{
                    display: "inline-block",
                    padding: "6px 12px",
                    backgroundColor: getStatusColor(model.status),
                    color: "white",
                    borderRadius: 20,
                    fontSize: "0.85em",
                    fontWeight: "bold",
                    textTransform: "uppercase",
                  }}
                >
                  {model.status}
                </span>
              </div>

              {/* Actions */}
              {model.status === "pending" && (
                <div style={{ 
                  display: "flex", 
                  gap: 10,
                  flexDirection: isMobile ? "column" : "row",
                }}>
                  <button
                    onClick={() => updateModelStatus(model.id, "approved")}
                    disabled={actionLoading[model.id]}
                    style={{
                      flex: isMobile ? "1 1 100%" : "auto",
                      padding: isMobile ? "10px 16px" : "8px 16px",
                      backgroundColor: "#4caf50",
                      color: "white",
                      border: "none",
                      borderRadius: 4,
                      cursor: actionLoading[model.id] ? "not-allowed" : "pointer",
                      opacity: actionLoading[model.id] ? 0.6 : 1,
                      fontSize: "14px",
                      fontWeight: 500,
                    }}
                  >
                    {actionLoading[model.id] ? "..." : "✓ Approve"}
                  </button>
                  <button
                    onClick={() => updateModelStatus(model.id, "rejected")}
                    disabled={actionLoading[model.id]}
                    style={{
                      flex: isMobile ? "1 1 100%" : "auto",
                      padding: isMobile ? "10px 16px" : "8px 16px",
                      backgroundColor: "#f44336",
                      color: "white",
                      border: "none",
                      borderRadius: 4,
                      cursor: actionLoading[model.id] ? "not-allowed" : "pointer",
                      opacity: actionLoading[model.id] ? 0.6 : 1,
                      fontSize: "14px",
                      fontWeight: 5,
                    }}
                  >
                    {actionLoading[model.id] ? "..." : "✕ Reject"}
                  </button>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

/* PUBLIC BOOKING */
const PublicBooking = () => {
  const [form, setForm] = React.useState({
    name: "",
    email: "",
    company: "",
    service_type: "Model Booking",
    preferred_date: "",
    message: "",
  });
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");
  const [success, setSuccess] = React.useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      // Validate required fields
      if (!form.name.trim() || !form.email.trim() || !form.company.trim()) {
        throw new Error("Name, email, and company are required");
      }

      // Insert booking
      const { error: supabaseError } = await supabase
        .from("bookings")
        .insert([
          {
            name: form.name.trim(),
            email: form.email.trim(),
            company: form.company.trim(),
            service_type: form.service_type,
            preferred_date: form.preferred_date,
            message: form.message.trim(),
            status: "pending",
            created_at: new Date().toISOString(),
          },
        ]);

      if (supabaseError) throw supabaseError;

      // Send confirmation emails (async, don't block UI)
      sendBookingConfirmationEmail({
        name: form.name.trim(),
        email: form.email.trim(),
        company: form.company.trim(),
        service_type: form.service_type,
        preferred_date: form.preferred_date,
      });

      sendZapierEvent("booking.created", {
        name: form.name.trim(),
        email: form.email.trim(),
        company: form.company.trim(),
        service_type: form.service_type,
        preferred_date: form.preferred_date,
        message: form.message.trim(),
      });

      sendBackendWebhook("booking", {
        client: form.company.trim(),
        name: form.name.trim(),
        email: form.email.trim(),
        service_type: form.service_type,
        preferred_date: form.preferred_date,
      });

      setSuccess(true);
      setForm({
        name: "",
        email: "",
        company: "",
        service_type: "Model Booking",
        preferred_date: "",
        message: "",
      });
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err.message || "Failed to submit booking. Please try again.");
      console.error("Booking error:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: "20px", maxWidth: "600px", margin: "0 auto", boxSizing: "border-box" }}>
      <h1 style={{ fontSize: "clamp(24px, 5vw, 32px)" }}>Book Our Services</h1>
      <p style={{ color: "#666", marginBottom: 30 }}>
        Interested in booking talent or services? Let's connect.
      </p>

      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: 20 }}>
          <label style={{ display: "block", marginBottom: 8, fontWeight: "bold" }}>
            Full Name *
          </label>
          <input
            value={form.name}
            placeholder="Your full name"
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            disabled={loading}
            style={{
              width: "100%",
              padding: "12px",
              boxSizing: "border-box",
              fontSize: "16px",
              border: "1px solid #ccc",
              borderRadius: "4px",
            }}
          />
        </div>

        <div style={{ marginBottom: 20 }}>
          <label style={{ display: "block", marginBottom: 8, fontWeight: "bold" }}>
            Email *
          </label>
          <input
            value={form.email}
            placeholder="your@email.com"
            type="email"
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            disabled={loading}
            style={{
              width: "100%",
              padding: "12px",
              boxSizing: "border-box",
              fontSize: "16px",
              border: "1px solid #ccc",
              borderRadius: "4px",
            }}
          />
        </div>

        <div style={{ marginBottom: 20 }}>
          <label style={{ display: "block", marginBottom: 8, fontWeight: "bold" }}>
            Company / Brand *
          </label>
          <input
            value={form.company}
            placeholder="Your company name"
            onChange={(e) => setForm({ ...form, company: e.target.value })}
            disabled={loading}
            style={{
              width: "100%",
              padding: "12px",
              boxSizing: "border-box",
              fontSize: "16px",
              border: "1px solid #ccc",
              borderRadius: "4px",
            }}
          />
        </div>

        <div style={{ marginBottom: 20 }}>
          <label style={{ display: "block", marginBottom: 8, fontWeight: "bold" }}>
            Service Type *
          </label>
          <select
            value={form.service_type}
            onChange={(e) => setForm({ ...form, service_type: e.target.value })}
            disabled={loading}
            style={{
              width: "100%",
              padding: "12px",
              boxSizing: "border-box",
              fontSize: "16px",
              border: "1px solid #ccc",
              borderRadius: "4px",
            }}
          >
            <option value="Model Booking">Model Booking</option>
            <option value="Creative Direction">Creative Direction</option>
            <option value="Photoshoot">Photoshoot</option>
            <option value="Consultation">Consultation</option>
          </select>
        </div>

        <div style={{ marginBottom: 20 }}>
          <label style={{ display: "block", marginBottom: 8, fontWeight: "bold" }}>
            Preferred Date
          </label>
          <input
            value={form.preferred_date}
            type="date"
            onChange={(e) => setForm({ ...form, preferred_date: e.target.value })}
            disabled={loading}
            style={{
              width: "100%",
              padding: "12px",
              boxSizing: "border-box",
              fontSize: "16px",
              border: "1px solid #ccc",
              borderRadius: "4px",
            }}
          />
        </div>

        <div style={{ marginBottom: 20 }}>
          <label style={{ display: "block", marginBottom: 8, fontWeight: "bold" }}>
            Message / Notes
          </label>
          <textarea
            value={form.message}
            placeholder="Tell us more about your project..."
            onChange={(e) => setForm({ ...form, message: e.target.value })}
            disabled={loading}
            style={{
              width: "100%",
              padding: "12px",
              boxSizing: "border-box",
              minHeight: 120,
              fontFamily: "inherit",
              fontSize: "16px",
              border: "1px solid #ccc",
              borderRadius: "4px",
            }}
          />
        </div>

        <button
          disabled={loading}
          style={{
            width: "100%",
            padding: "12px",
            backgroundColor: loading ? "#ccc" : "#333",
            color: "white",
            border: "none",
            borderRadius: 4,
            fontSize: 16,
            fontWeight: "bold",
            cursor: loading ? "not-allowed" : "pointer",
          }}
        >
          {loading ? "Sending..." : "Send Booking Request"}
        </button>
      </form>

      {error && (
        <div
          style={{
            color: "#d32f2f",
            marginTop: 20,
            padding: 15,
            backgroundColor: "#ffebee",
            borderRadius: 4,
          }}
        >
          {error}
        </div>
      )}
      {success && (
        <div
          style={{
            color: "#388e3c",
            marginTop: 20,
            padding: 15,
            backgroundColor: "#e8f5e9",
            borderRadius: 4,
          }}
        >
          ✓ Booking request submitted! We'll get back to you shortly.
        </div>
      )}
    </div>
  );
};

/* ADMIN BOOKINGS */
const AdminBookings = () => {
  const [bookings, setBookings] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const [actionLoading, setActionLoading] = React.useState({});
  const [zoomDrafts, setZoomDrafts] = React.useState({});

  React.useEffect(() => {
    fetchBookings();
  }, []);

  const fetchBookings = async () => {
    try {
      setError("");
      const { data, error: supabaseError } = await supabase
        .from("bookings")
        .select("*")
        .order("created_at", { ascending: false });

      if (supabaseError) throw supabaseError;
      setBookings(data || []);
    } catch (err) {
      setError(err.message || "Failed to load bookings");
      console.error("Fetch error:", err);
    } finally {
      setLoading(false);
    }
  };

  const updateBookingStatus = async (bookingId, newStatus) => {
    const booking = bookings.find((b) => b.id === bookingId);
    if (!booking) return;

    setActionLoading((prev) => ({ ...prev, [bookingId]: true }));
    try {
      const { error: supabaseError } = await supabase
        .from("bookings")
        .update({ status: newStatus })
        .eq("id", bookingId);

      if (supabaseError) throw supabaseError;

      // Send confirmation email if status is confirmed
      if (newStatus === "confirmed") {
        sendBookingConfirmedEmail(booking);
        sendZapierEvent("booking.confirmed", {
          id: booking.id,
          name: booking.name,
          email: booking.email,
          company: booking.company,
          service_type: booking.service_type,
          preferred_date: booking.preferred_date,
          status: newStatus,
          zoom_link: booking.zoom_link || null,
        });
      }

      // Update local state
      setBookings((prev) =>
        prev.map((b) => (b.id === bookingId ? { ...b, status: newStatus } : b))
      );
    } catch (err) {
      console.error("Update error:", err);
      alert(`Failed to update booking: ${err.message}`);
    } finally {
      setActionLoading((prev) => ({ ...prev, [bookingId]: false }));
    }
  };

  const saveZoomLink = async (bookingId) => {
    const zoomLink = (zoomDrafts[bookingId] || "").trim();
    if (!zoomLink) return;

    try {
      const { error: supabaseError } = await supabase
        .from("bookings")
        .update({ zoom_link: zoomLink })
        .eq("id", bookingId);

      if (supabaseError) throw supabaseError;

      setBookings((prev) =>
        prev.map((b) => (b.id === bookingId ? { ...b, zoom_link: zoomLink } : b))
      );
      setZoomDrafts((prev) => ({ ...prev, [bookingId]: "" }));
    } catch (err) {
      alert(err.message || "Failed to save Zoom link. Ensure bookings table has zoom_link column.");
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "confirmed":
        return "#4caf50"; // Green
      case "completed":
        return "#2196f3"; // Blue
      case "pending":
      default:
        return "#ff9800"; // Orange
    }
  };

  return (
    <div style={{ padding: "20px", maxWidth: "1200px", margin: "0 auto", boxSizing: "border-box" }}>
      <h1 style={{ fontSize: "clamp(24px, 5vw, 32px)" }}>Booking Requests</h1>

      {loading && <p>Loading bookings...</p>}
      {error && (
        <div
          style={{
            color: "#d32f2f",
            marginBottom: 20,
            padding: 10,
            backgroundColor: "#ffebee",
            borderRadius: 4,
          }}
        >
          Error: {error}
        </div>
      )}

      {!loading && bookings.length === 0 && (
        <p style={{ color: "#999", fontSize: 16 }}>No booking requests yet.</p>
      )}

      {!loading &&
        bookings.map((booking) => {
          const isMobile = window.innerWidth <= 768;
          return (
            <div
              key={booking.id}
              style={{
                padding: 20,
                marginBottom: 20,
                border: "1px solid #e0e0e0",
                borderRadius: 8,
                backgroundColor: "#fafafa",
                boxSizing: "border-box",
              }}
            >
              <div style={{ 
                display: "flex", 
                flexDirection: isMobile ? "column" : "row",
                justifyContent: "space-between", 
                alignItems: isMobile ? "flex-start" : "flex-start",
                gap: isMobile ? "15px" : "20px",
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <h3 style={{ margin: "0 0 10px 0", fontSize: "clamp(16px, 4vw, 18px)" }}>{booking.name}</h3>
                  <p style={{ margin: "5px 0", color: "#666", wordBreak: "break-word" }}>
                    <strong>Company:</strong> {booking.company}
                  </p>
                  <p style={{ margin: "5px 0", color: "#666", wordBreak: "break-word" }}>
                    <strong>Email:</strong> {booking.email}
                  </p>
                  <p style={{ margin: "5px 0", color: "#666", wordBreak: "break-word" }}>
                    <strong>Service:</strong> {booking.service_type}
                  </p>
                  {booking.preferred_date && (
                    <p style={{ margin: "5px 0", color: "#666" }}>
                      <strong>Preferred Date:</strong>{" "}
                      {new Date(booking.preferred_date).toLocaleDateString()}
                    </p>
                  )}
                  {booking.message && (
                    <p style={{ margin: "10px 0 0 0", padding: 10, backgroundColor: "#fff", borderRadius: 4, color: "#555", wordBreak: "break-word" }}>
                      <strong>Message:</strong> {booking.message}
                    </p>
                  )}
                  {booking.zoom_link && (
                    <p style={{ margin: "10px 0 0 0", color: "#666", wordBreak: "break-word" }}>
                      <strong>Zoom:</strong>{" "}
                      <a href={booking.zoom_link} target="_blank" rel="noreferrer">{booking.zoom_link}</a>
                    </p>
                  )}
                  <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <input
                      placeholder="Attach Zoom meeting link"
                      value={zoomDrafts[booking.id] || ""}
                      onChange={(e) =>
                        setZoomDrafts((prev) => ({ ...prev, [booking.id]: e.target.value }))
                      }
                      style={{ flex: "1 1 260px", padding: 8, border: "1px solid #ccc", borderRadius: 4 }}
                    />
                    <button
                      onClick={() => saveZoomLink(booking.id)}
                      style={{ padding: "8px 12px", border: "none", backgroundColor: "#333", color: "white", borderRadius: 4 }}
                    >
                      Save Zoom Link
                    </button>
                  </div>
                  <p style={{ margin: "10px 0 0 0", color: "#999", fontSize: "0.9em" }}>
                    Received: {new Date(booking.created_at).toLocaleString()}
                  </p>
                </div>

                <div style={{ 
                  marginLeft: isMobile ? 0 : 20, 
                  textAlign: isMobile ? "left" : "right",
                  width: isMobile ? "100%" : "auto",
                }}>
                  <span
                    style={{
                      display: "inline-block",
                      padding: "6px 12px",
                      backgroundColor: getStatusColor(booking.status),
                      color: "white",
                      borderRadius: 20,
                      fontSize: "0.85em",
                      fontWeight: "bold",
                      textTransform: "uppercase",
                      marginBottom: isMobile ? 10 : 15,
                    }}
                  >
                    {booking.status}
                  </span>

                  {booking.status === "pending" && (
                    <div style={{ 
                      display: "flex", 
                      flexDirection: isMobile ? "row" : "column", 
                      gap: isMobile ? 8 : 8,
                    }}>
                      <button
                        onClick={() => updateBookingStatus(booking.id, "confirmed")}
                        disabled={actionLoading[booking.id]}
                        style={{
                          flex: isMobile ? "1 1 100%" : "auto",
                          padding: isMobile ? "10px 16px" : "8px 12px",
                          backgroundColor: "#4caf50",
                          color: "white",
                          border: "none",
                          borderRadius: 4,
                          cursor: actionLoading[booking.id] ? "not-allowed" : "pointer",
                          opacity: actionLoading[booking.id] ? 0.6 : 1,
                          fontSize: "0.9em",
                          fontWeight: 500,
                        }}
                      >
                        {actionLoading[booking.id] ? "..." : "✓ Confirm"}
                      </button>
                    </div>
                  )}
                  {booking.status === "confirmed" && (
                    <button
                      onClick={() => updateBookingStatus(booking.id, "completed")}
                      disabled={actionLoading[booking.id]}
                      style={{
                        width: isMobile ? "100%" : "auto",
                        padding: isMobile ? "10px 16px" : "8px 12px",
                        backgroundColor: "#2196f3",
                        color: "white",
                        border: "none",
                        borderRadius: 4,
                        cursor: actionLoading[booking.id] ? "not-allowed" : "pointer",
                        opacity: actionLoading[booking.id] ? 0.6 : 1,
                        fontSize: "0.9em",
                        fontWeight: 5,
                      }}
                    >
                      {actionLoading[booking.id] ? "..." : "✓ Completed"}
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
    </div>
  );
};

/* ANALYTICS */
const Analytics = () => {
  const [models, setModels] = React.useState([]);
  const [bookings, setBookings] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");

  React.useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setError("");
      const [modelsResult, bookingsResult] = await Promise.all([
        supabase.from("models").select("*"),
        supabase.from("bookings").select("*"),
      ]);

      if (modelsResult.error) throw modelsResult.error;
      if (bookingsResult.error) throw bookingsResult.error;

      setModels(modelsResult.data || []);
      setBookings(bookingsResult.data || []);
    } catch (err) {
      setError(err.message || "Failed to load analytics");
      console.error("Analytics error:", err);
    } finally {
      setLoading(false);
    }
  };

  const metrics = calculateMetrics(models, bookings);

  const metricsGridStyle = {
    display: "flex",
    flexWrap: "wrap",
    gap: "15px",
    justifyContent: "center",
  };

  return (
    <div
      style={{
        padding: "20px",
        maxWidth: "1200px",
        margin: "0 auto",
        boxSizing: "border-box",
      }}
    >
      <h1 style={{ margin: "0 0 30px 0", textAlign: "center", fontSize: "clamp(24px, 5vw, 32px)" }}>Analytics</h1>

      {loading && <p style={{ textAlign: "center" }}>Loading analytics...</p>}
      {error && (
        <div
          style={{
            color: "#d32f2f",
            marginBottom: 20,
            padding: 15,
            backgroundColor: "#ffebee",
            borderRadius: 4,
            textAlign: "center",
          }}
        >
          Error: {error}
        </div>
      )}

      {!loading && (
        <>
          {/* Model Metrics */}
          <div style={{ marginBottom: 40 }}>
            <h2 style={{ fontSize: "clamp(18px, 4vw, 20px)", marginBottom: 20, color: "#333" }}>
              Model Pipeline
            </h2>
            <div style={metricsGridStyle}>
              <MetricCard label="Total Submissions" value={metrics.totalModels} color="#333" />
              <MetricCard label="Pending Review" value={metrics.pendingModels} color="#ff9800" />
              <MetricCard label="Approved" value={metrics.approvedModels} color="#4caf50" />
              <MetricCard label="Rejected" value={metrics.rejectedModels} color="#f44336" />
            </div>
          </div>

          {/* Booking Metrics */}
          <div style={{ marginBottom: 40 }}>
            <h2 style={{ fontSize: "clamp(18px, 4vw, 20px)", marginBottom: 20, color: "#333" }}>
              Booking Activity
            </h2>
            <div style={metricsGridStyle}>
              <MetricCard label="Total Bookings" value={metrics.totalBookings} color="#333" />
              <MetricCard label="Pending" value={metrics.pendingBookings} color="#ff9800" />
              <MetricCard label="Confirmed" value={metrics.confirmedBookings} color="#4caf50" />
              <MetricCard label="Completed" value={metrics.completedBookings} color="#2196f3" />
            </div>
          </div>

          {/* This Week */}
          <div style={{ marginBottom: 20 }}>
            <h2 style={{ fontSize: "clamp(18px, 4vw, 20px)", marginBottom: 20, color: "#333" }}>
              This Week
            </h2>
            <div style={metricsGridStyle}>
              <MetricCard
                label="Model Submissions"
                value={metrics.modelsThisWeek}
                color="#667bc6"
              />
              <MetricCard
                label="New Bookings"
                value={metrics.bookingsThisWeek}
                color="#667bc6"
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
};

/* MODELS */
const Models = () => {
  const { role } = useAuth();
  const [models, setModels] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const [saveLoading, setSaveLoading] = React.useState(false);
  const [saveError, setSaveError] = React.useState("");
  const [form, setForm] = React.useState({
    name: "",
    email: "",
    instagram: "",
    height: "",
    status: "pending",
  });

  const canAddModels = ["admin", "agent", "user"].includes(role);

  const fetchModels = async () => {
    try {
      setError("");
      const { data, error } = await supabase
        .from("models")
        .select("*")
        .order("submitted_at", { ascending: false });
      if (error) throw error;
      setModels(data || []);
    } catch (err) {
      setError(err.message || "Failed to load models");
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    fetchModels();
  }, []);

  const saveModel = async (e) => {
    e.preventDefault();
    if (!canAddModels) return;

    setSaveLoading(true);
    setSaveError("");
    try {
      const basePayload = {
        name: form.name.trim(),
        email: form.email.trim(),
        instagram: form.instagram.trim(),
        height: form.height.trim(),
        status: form.status,
        submitted_at: new Date().toISOString(),
      };

      const payload = {
        ...basePayload,
        pipeline_stage: "submitted",
        priority_level: "medium",
        scouting_notes: "",
        internal_notes: "",
        agency_name: "",
        last_updated: new Date().toISOString(),
      };

      if (!payload.name || !payload.email) {
        throw new Error("Name and email are required");
      }

      let { error } = await supabase.from("models").insert([payload]);
      if (error && isMissingColumnError(error)) {
        const retry = await supabase.from("models").insert([basePayload]);
        error = retry.error;
      }
      if (error) throw error;

      sendZapierEvent("model.created", {
        name: payload.name,
        email: payload.email,
        instagram: payload.instagram,
        status: payload.status,
      });

      sendBackendWebhook("model_signup", {
        name: payload.name,
        instagram: payload.instagram,
        height: payload.height,
        status: payload.status,
      });

      setForm({ name: "", email: "", instagram: "", height: "", status: "pending" });
      fetchModels();
    } catch (err) {
      setSaveError(err.message || "Failed to add model");
    } finally {
      setSaveLoading(false);
    }
  };

  const approved = models.filter((m) => m.status === "approved").length;
  const pending = models.filter((m) => m.status === "pending").length;

  return (
    <div style={{ padding: 20, maxWidth: 1200, margin: "0 auto" }}>
      <h1>Talent Tracking</h1>

      {canAddModels && (
        <form onSubmit={saveModel} style={{ display: "grid", gap: 10, marginBottom: 20 }}>
          <input
            value={form.name}
            placeholder="Model name"
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
            style={{ padding: 10, border: "1px solid #ccc", borderRadius: 4 }}
          />
          <input
            value={form.email}
            placeholder="Model email"
            type="email"
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            required
            style={{ padding: 10, border: "1px solid #ccc", borderRadius: 4 }}
          />
          <input
            value={form.instagram}
            placeholder="Instagram"
            onChange={(e) => setForm({ ...form, instagram: e.target.value })}
            style={{ padding: 10, border: "1px solid #ccc", borderRadius: 4 }}
          />
          <input
            value={form.height}
            placeholder="Height (optional)"
            onChange={(e) => setForm({ ...form, height: e.target.value })}
            style={{ padding: 10, border: "1px solid #ccc", borderRadius: 4 }}
          />
          <select
            value={form.status}
            onChange={(e) => setForm({ ...form, status: e.target.value })}
            style={{ padding: 10, border: "1px solid #ccc", borderRadius: 4 }}
          >
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
          {saveError && <p style={{ color: "#d32f2f", margin: 0 }}>{saveError}</p>}
          <button
            disabled={saveLoading}
            style={{
              padding: 10,
              border: "none",
              borderRadius: 4,
              background: saveLoading ? "#999" : "#333",
              color: "#fff",
              cursor: saveLoading ? "not-allowed" : "pointer",
            }}
          >
            {saveLoading ? "Saving..." : "Add Model Manually"}
          </button>
        </form>
      )}

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 18 }}>
        <MetricCard label="Total Models" value={models.length} color="#333" />
        <MetricCard label="Approved Talent" value={approved} color="#4caf50" />
        <MetricCard label="Pending Review" value={pending} color="#ff9800" />
      </div>
      {loading && <p>Loading models...</p>}
      {error && <p style={{ color: "#d32f2f" }}>{error}</p>}
      {!loading && models.map((model) => (
        <div key={model.id} style={{ border: "1px solid #e0e0e0", borderRadius: 8, padding: 14, marginBottom: 10 }}>
          <strong>{model.name}</strong>
          <p style={{ margin: "6px 0", color: "#666" }}>{model.email}</p>
          <p style={{ margin: "6px 0", color: "#666" }}>{model.instagram || "No Instagram"}</p>
          <p style={{ margin: 0, color: "#666" }}>Status: {model.status}</p>
        </div>
      ))}
    </div>
  );
};

/* MODEL PIPELINE */
const ModelPipeline = () => {
  const { role } = useAuth();
  const [models, setModels] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const [actionLoading, setActionLoading] = React.useState({});
  const [pipelineSchemaReady, setPipelineSchemaReady] = React.useState(true);
  const [filters, setFilters] = React.useState({
    stage: "all",
    priority: "all",
    status: "all",
    sortBy: "recent",
  });

  const canEditPipeline = role === "admin" || role === "agent";
  const visibleStages = ["submitted", "reviewing", "development", "ready_to_pitch", "in_talks", "signed"];

  const PIPELINE_SETUP_SQL = `alter table public.models
  add column if not exists pipeline_stage text default 'submitted',
  add column if not exists agency_name text,
  add column if not exists scouting_notes text,
  add column if not exists internal_notes text,
  add column if not exists priority_level text default 'medium',
  add column if not exists last_updated timestamptz default now();

update public.models
set
  pipeline_stage = coalesce(pipeline_stage, 'submitted'),
  priority_level = coalesce(priority_level, 'medium'),
  last_updated = coalesce(last_updated, now());

alter table public.models disable row level security;`;

  const normalizeModel = (row) => ({
    ...row,
    pipeline_stage: normalizePipelineStage(row.pipeline_stage),
    priority_level: normalizePriorityLevel(row.priority_level),
    scouting_notes: row.scouting_notes || "",
    internal_notes: row.internal_notes || "",
    agency_name: row.agency_name || "",
    last_updated: row.last_updated || row.updated_at || row.submitted_at || row.created_at,
  });

  const fetchModels = async () => {
    try {
      setError("");
      const selectFields = "id, name, email, instagram, image_url, status, submitted_at, created_at, pipeline_stage, agency_name, scouting_notes, internal_notes, priority_level, last_updated";
      const { data, error: fetchError } = await supabase
        .from("models")
        .select(selectFields)
        .order("last_updated", { ascending: false });

      if (fetchError) {
        if (isMissingColumnError(fetchError)) {
          setPipelineSchemaReady(false);
          const fallback = await supabase
            .from("models")
            .select("*")
            .order("submitted_at", { ascending: false });
          if (fallback.error) throw fallback.error;
          setModels((fallback.data || []).map(normalizeModel));
          return;
        }
        throw fetchError;
      }

      setPipelineSchemaReady(true);
      setModels((data || []).map(normalizeModel));
    } catch (err) {
      setError(err.message || "Failed to load model pipeline");
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    fetchModels();
  }, []);

  const updateModelPipeline = async (modelId, updates) => {
    if (!canEditPipeline || !pipelineSchemaReady) return;

    setActionLoading((prev) => ({ ...prev, [modelId]: true }));
    try {
      const resp = await fetch("/api/models/update-pipeline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          modelId,
          updates: { ...updates, last_updated: new Date().toISOString() },
        }),
      });

      const json = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        throw new Error(json.error || "Pipeline update failed");
      }

      setModels((prev) =>
        prev.map((model) =>
          model.id === modelId
            ? normalizeModel({ ...model, ...updates, last_updated: new Date().toISOString() })
            : model
        )
      );
    } catch (err) {
      setError(err.message || "Failed to update model");
    } finally {
      setActionLoading((prev) => ({ ...prev, [modelId]: false }));
    }
  };

  const filteredModels = models
    .filter((model) => (filters.stage === "all" ? true : model.pipeline_stage === filters.stage))
    .filter((model) => (filters.priority === "all" ? true : model.priority_level === filters.priority))
    .filter((model) => (filters.status === "all" ? true : model.status === filters.status))
    .sort((a, b) => {
      if (filters.sortBy === "priority") {
        return (PRIORITY_RANK[b.priority_level] || 0) - (PRIORITY_RANK[a.priority_level] || 0);
      }
      const aTime = new Date(a.last_updated || 0).getTime();
      const bTime = new Date(b.last_updated || 0).getTime();
      return bTime - aTime;
    });

  const grouped = visibleStages.reduce((acc, stage) => {
    acc[stage] = filteredModels.filter((model) => model.pipeline_stage === stage);
    return acc;
  }, {});

  return (
    <div style={{ padding: 20, maxWidth: 1300, margin: "0 auto" }}>
      <h1>Model Pipeline</h1>
      <p style={{ color: "#666", marginTop: 0 }}>
        Structured tracking from first submission to agency signing.
      </p>

      {!pipelineSchemaReady && (
        <div style={{ background: "#fff3e0", border: "1px solid #ff9800", borderRadius: 8, padding: 16, marginBottom: 18 }}>
          <strong style={{ color: "#e65100" }}>Pipeline fields need one-time database setup</strong>
          <p style={{ margin: "8px 0", color: "#555" }}>
            Run this SQL in the{" "}
            <a href="https://supabase.com/dashboard/project/jjmmakbnjzzxbuflucck/sql" target="_blank" rel="noreferrer">
              Supabase SQL Editor
            </a>
            .
          </p>
          <pre style={{ background: "#f5f5f5", padding: 12, borderRadius: 6, fontSize: 12, overflowX: "auto", whiteSpace: "pre-wrap" }}>{PIPELINE_SETUP_SQL}</pre>
          <button
            onClick={() => navigator.clipboard.writeText(PIPELINE_SETUP_SQL)}
            style={{ marginTop: 8, padding: "8px 14px", background: "#333", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer" }}
          >
            Copy SQL
          </button>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10, marginBottom: 16 }}>
        <select value={filters.stage} onChange={(e) => setFilters((prev) => ({ ...prev, stage: e.target.value }))} style={{ padding: 10, border: "1px solid #ccc", borderRadius: 4 }}>
          <option value="all">All Stages</option>
          {PIPELINE_STAGES.map((stage) => (
            <option key={stage} value={stage}>{PIPELINE_STAGE_LABELS[stage]}</option>
          ))}
        </select>
        <select value={filters.priority} onChange={(e) => setFilters((prev) => ({ ...prev, priority: e.target.value }))} style={{ padding: 10, border: "1px solid #ccc", borderRadius: 4 }}>
          <option value="all">All Priority</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
        <select value={filters.status} onChange={(e) => setFilters((prev) => ({ ...prev, status: e.target.value }))} style={{ padding: 10, border: "1px solid #ccc", borderRadius: 4 }}>
          <option value="all">All Status</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
        </select>
        <select value={filters.sortBy} onChange={(e) => setFilters((prev) => ({ ...prev, sortBy: e.target.value }))} style={{ padding: 10, border: "1px solid #ccc", borderRadius: 4 }}>
          <option value="recent">Most Recently Updated</option>
          <option value="priority">Priority Level</option>
        </select>
      </div>

      {loading && <p>Loading pipeline...</p>}
      {error && <p style={{ color: "#d32f2f" }}>{error}</p>}

      {!loading && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 14 }}>
          {visibleStages.map((stage) => (
            <div key={stage} style={{ border: "1px solid #e0e0e0", borderRadius: 10, padding: 12, background: "#fafafa" }}>
              <h3 style={{ marginTop: 0 }}>{PIPELINE_STAGE_LABELS[stage]} ({grouped[stage]?.length || 0})</h3>

              {(grouped[stage] || []).map((model) => {
                const notesPreview = model.scouting_notes || model.internal_notes || "No notes yet";
                const isBusy = !!actionLoading[model.id];

                return (
                  <div key={model.id} style={{ border: "1px solid #ececec", borderRadius: 8, padding: 10, marginBottom: 10, background: "#fff" }}>
                    <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                      {model.image_url ? (
                        <img src={model.image_url} alt={model.name} style={{ width: 54, height: 54, borderRadius: 8, objectFit: "cover", flexShrink: 0 }} />
                      ) : (
                        <div style={{ width: 54, height: 54, borderRadius: 8, background: "#efefef", flexShrink: 0 }} />
                      )}
                      <div style={{ minWidth: 0 }}>
                        <p style={{ margin: 0, fontWeight: 700 }}>{model.name}</p>
                        <p style={{ margin: "4px 0 0", color: "#666", fontSize: 13 }}>Status: {model.status || "pending"}</p>
                      </div>
                    </div>

                    <p style={{ margin: "8px 0", color: "#666", fontSize: 13 }}>Priority: <strong>{model.priority_level}</strong></p>
                    <p style={{ margin: "8px 0", color: "#555", fontSize: 13 }}>
                      {String(notesPreview).slice(0, 120)}
                      {String(notesPreview).length > 120 ? "..." : ""}
                    </p>

                    {canEditPipeline && pipelineSchemaReady && (
                      <div style={{ display: "grid", gap: 8 }}>
                        <select
                          value={model.pipeline_stage}
                          onChange={(e) => updateModelPipeline(model.id, { pipeline_stage: e.target.value })}
                          disabled={isBusy}
                          style={{ padding: 8, border: "1px solid #ccc", borderRadius: 4 }}
                        >
                          {PIPELINE_STAGES.map((item) => (
                            <option key={item} value={item}>{PIPELINE_STAGE_LABELS[item]}</option>
                          ))}
                        </select>

                        <select
                          value={model.priority_level}
                          onChange={(e) => updateModelPipeline(model.id, { priority_level: e.target.value })}
                          disabled={isBusy}
                          style={{ padding: 8, border: "1px solid #ccc", borderRadius: 4 }}
                        >
                          <option value="high">High Priority</option>
                          <option value="medium">Medium Priority</option>
                          <option value="low">Low Priority</option>
                        </select>

                        <textarea
                          value={model.scouting_notes || ""}
                          placeholder="Scouting notes"
                          onChange={(e) => setModels((prev) => prev.map((m) => (m.id === model.id ? { ...m, scouting_notes: e.target.value } : m)))}
                          onBlur={() => updateModelPipeline(model.id, { scouting_notes: model.scouting_notes || "" })}
                          disabled={isBusy}
                          style={{ minHeight: 70, padding: 8, border: "1px solid #ccc", borderRadius: 4, resize: "vertical" }}
                        />

                        <textarea
                          value={model.internal_notes || ""}
                          placeholder="Internal notes"
                          onChange={(e) => setModels((prev) => prev.map((m) => (m.id === model.id ? { ...m, internal_notes: e.target.value } : m)))}
                          onBlur={() => updateModelPipeline(model.id, { internal_notes: model.internal_notes || "" })}
                          disabled={isBusy}
                          style={{ minHeight: 70, padding: 8, border: "1px solid #ccc", borderRadius: 4, resize: "vertical" }}
                        />

                        <input
                          value={model.agency_name || ""}
                          placeholder="Agency name (for signed talent)"
                          onChange={(e) => setModels((prev) => prev.map((m) => (m.id === model.id ? { ...m, agency_name: e.target.value } : m)))}
                          onBlur={() => updateModelPipeline(model.id, { agency_name: model.agency_name || "" })}
                          disabled={isBusy}
                          style={{ padding: 8, border: "1px solid #ccc", borderRadius: 4 }}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

/* CLIENTS */
const Clients = () => {
  const [clients, setClients] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [tableReady, setTableReady] = React.useState(true);
  const [error, setError] = React.useState("");
  const [saveError, setSaveError] = React.useState("");
  const [form, setForm] = React.useState({
    name: "",
    project: "",
    status: "lead",
    invoice_status: "pending",
  });

  const SETUP_SQL = `-- Run this in your Supabase SQL Editor:
create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  project text,
  status text default 'lead',
  invoice_status text default 'pending',
  created_at timestamptz default now()
);

-- Disable RLS so the app can read/write (internal admin tool):
alter table public.clients disable row level security;

-- Also add zoom_link to bookings if missing:
alter table public.bookings add column if not exists zoom_link text;
alter table public.bookings disable row level security;`;

  const isTableMissingError = (err) =>
    err?.code === "42P01" ||
    err?.code === "42501" ||
    err?.message?.toLowerCase().includes("does not exist") ||
    err?.message?.toLowerCase().includes("relation") ||
    err?.message?.toLowerCase().includes("permission") ||
    err?.message?.toLowerCase().includes("policy") ||
    err?.message?.toLowerCase().includes("rls");

  const fetchClients = async () => {
    try {
      setError("");
      const { data, error } = await supabase
        .from("clients")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setTableReady(true);
      setClients(data || []);
    } catch (err) {
      if (isTableMissingError(err)) {
        setTableReady(false);
      } else {
        setError(err.message || "Failed to load clients");
      }
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    fetchClients();
  }, []);

  const saveClient = async (e) => {
    e.preventDefault();
    setSaveError("");
    try {
      const { error } = await supabase.from("clients").insert([{
        name: form.name.trim(),
        project: form.project.trim(),
        status: form.status,
        invoice_status: form.invoice_status,
        created_at: new Date().toISOString(),
      }]);
      if (error) throw error;

      sendZapierEvent("client.created", {
        name: form.name.trim(),
        project: form.project.trim(),
        status: form.status,
        invoice_status: form.invoice_status,
      });

      sendBackendWebhook("new_client", {
        name: form.name.trim(),
        email: "",
        stage: form.status,
      });

      setForm({ name: "", project: "", status: "lead", invoice_status: "pending" });
      fetchClients();
    } catch (err) {
      setSaveError(err.message || "Failed to save client");
    }
  };

  const statusColor = { lead: "#ff9800", active: "#4caf50", completed: "#2196f3" };
  const invoiceColor = { pending: "#ff9800", sent: "#2196f3", paid: "#4caf50" };

  return (
    <div style={{ padding: 20, maxWidth: 1000, margin: "0 auto" }}>
      <h1>Client Management</h1>

      {/* Setup banner */}
      {!tableReady && (
        <div style={{ background: "#fff3e0", border: "1px solid #ff9800", borderRadius: 8, padding: 16, marginBottom: 20 }}>
          <strong style={{ color: "#e65100" }}>Database setup required</strong>
          <p style={{ margin: "8px 0", color: "#555" }}>The clients table doesn't exist yet. Copy and run this SQL in your
            {" "}<a href="https://supabase.com/dashboard/project/jjmmakbnjzzxbuflucck/sql" target="_blank" rel="noreferrer">Supabase SQL Editor</a>:
          </p>
          <pre style={{ background: "#f5f5f5", padding: 12, borderRadius: 6, fontSize: 12, overflowX: "auto", whiteSpace: "pre-wrap" }}>{SETUP_SQL}</pre>
          <button
            onClick={() => { navigator.clipboard.writeText(SETUP_SQL); }}
            style={{ marginTop: 8, padding: "8px 14px", background: "#333", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer" }}
          >Copy SQL</button>
        </div>
      )}

      {/* Add client form — only shown when table exists */}
      {tableReady && (
        <form onSubmit={saveClient} style={{ display: "grid", gap: 10, marginBottom: 24 }}>
          <input value={form.name} placeholder="Client name" onChange={(e) => setForm({ ...form, name: e.target.value })} required
            style={{ padding: 10, border: "1px solid #ccc", borderRadius: 4 }} />
          <input value={form.project} placeholder="Project" onChange={(e) => setForm({ ...form, project: e.target.value })} required
            style={{ padding: 10, border: "1px solid #ccc", borderRadius: 4 }} />
          <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}
            style={{ padding: 10, border: "1px solid #ccc", borderRadius: 4 }}>
            <option value="lead">Lead</option>
            <option value="active">Active</option>
            <option value="completed">Completed</option>
          </select>
          <select value={form.invoice_status} onChange={(e) => setForm({ ...form, invoice_status: e.target.value })}
            style={{ padding: 10, border: "1px solid #ccc", borderRadius: 4 }}>
            <option value="pending">Invoice Pending</option>
            <option value="sent">Invoice Sent</option>
            <option value="paid">Paid</option>
          </select>
          {saveError && <p style={{ color: "#d32f2f", margin: 0 }}>{saveError}</p>}
          <button style={{ padding: 12, background: "#333", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer" }}>Save Client</button>
        </form>
      )}

      {loading && <p>Loading clients...</p>}
      {error && <p style={{ color: "#d32f2f" }}>{error}</p>}

      {!loading && tableReady && clients.length === 0 && (
        <p style={{ color: "#999" }}>No clients yet. Add one above.</p>
      )}

      {!loading && clients.map((client) => (
        <div key={client.id} style={{ border: "1px solid #e0e0e0", borderRadius: 8, padding: 16, marginBottom: 10 }}>
          <strong style={{ fontSize: 16 }}>{client.name}</strong>
          <p style={{ margin: "6px 0", color: "#666" }}>{client.project}</p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
            <span style={{ padding: "4px 10px", borderRadius: 20, background: statusColor[client.status] || "#999", color: "#fff", fontSize: 12, fontWeight: 600 }}>
              {client.status}
            </span>
            <span style={{ padding: "4px 10px", borderRadius: 20, background: invoiceColor[client.invoice_status] || "#999", color: "#fff", fontSize: 12, fontWeight: 600 }}>
              {client.invoice_status}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
};

/* INTEGRATIONS */
const Integrations = () => {
  const [bookings, setBookings] = React.useState([]);
  const [zapierStatus, setZapierStatus] = React.useState({ loading: true, configured: false, events: [] });
  const [zapierTestState, setZapierTestState] = React.useState({ loading: false, message: "" });
  const [backendStatus, setBackendStatus] = React.useState({ loading: !!BACKEND_BASE_URL, connected: false });
  const [opsTasks, setOpsTasks] = React.useState([]);
  const [opsTasksSource, setOpsTasksSource] = React.useState("fallback");
  const gmailMessages = [
    { id: 1, from: "client@brand.com", subject: "Campaign availability", time: "2h ago" },
    { id: 2, from: "team@meetserenity.com", subject: "Weekly operations sync", time: "5h ago" },
    { id: 3, from: "photo@studio.com", subject: "Shoot schedule confirmation", time: "1d ago" },
  ];

  React.useEffect(() => {
    const fetchBookings = async () => {
      const { data } = await supabase.from("bookings").select("*").order("created_at", { ascending: false });
      const list = data || [];
      setBookings(list);
      return list;
    };

    const fetchOpsTasks = async (fallbackBookings) => {
      if (!BACKEND_BASE_URL) {
        setOpsTasks(buildFallbackTasksFromBookings(fallbackBookings));
        setOpsTasksSource("supabase");
        return;
      }

      try {
        const resp = await fetch(`${BACKEND_BASE_URL}/public/tasks`);
        if (!resp.ok) throw new Error("backend tasks unavailable");
        const json = await resp.json();
        setOpsTasks(Array.isArray(json) ? json : []);
        setOpsTasksSource("backend");
      } catch (_err) {
        setOpsTasks(buildFallbackTasksFromBookings(fallbackBookings));
        setOpsTasksSource("supabase");
      }
    };

    const fetchZapierStatus = async () => {
      try {
        const resp = await fetch("/api/zapier/status");
        const json = await resp.json();
        setZapierStatus({ loading: false, ...json });
      } catch (_err) {
        setZapierStatus({ loading: false, configured: false, events: [] });
      }
    };

    const fetchBackendHealth = async () => {
      if (!BACKEND_BASE_URL) {
        setBackendStatus({ loading: false, connected: false, message: "Not configured" });
        return;
      }

      try {
        const resp = await fetch(`${BACKEND_BASE_URL}/health`);
        const json = await resp.json();
        setBackendStatus({
          loading: false,
          connected: !!json?.ok,
          message: json?.ok ? "Connected" : "Unavailable",
        });
      } catch (_err) {
        setBackendStatus({ loading: false, connected: false, message: "Unavailable" });
      }
    };

    const init = async () => {
      const loadedBookings = await fetchBookings();
      await fetchZapierStatus();
      await fetchBackendHealth();
      await fetchOpsTasks(loadedBookings);
    };

    init();
  }, []);

  const sendZapierTest = async () => {
    setZapierTestState({ loading: true, message: "Sending test event..." });
    try {
      const resp = await fetch("/api/zapier/forward", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventType: "zapier.test",
          payload: { source: "integrations-page", timestamp: new Date().toISOString() },
        }),
      });

      const json = await resp.json();
      if (!resp.ok || !json.ok) {
        throw new Error(json.error || "Zapier test failed");
      }

      setZapierTestState({ loading: false, message: "Test event sent to Zapier." });
    } catch (err) {
      setZapierTestState({ loading: false, message: err.message || "Zapier test failed" });
    }
  };

  const upcoming = bookings.filter((b) => b.preferred_date).slice(0, 5);
  const zoomMeetings = bookings.filter((b) => b.zoom_link).slice(0, 5);
  const calendlyUrl = "https://calendly.com/meetserenity";
  const embedModelSignup = `${window.location.origin}/model-signup`;
  const embedBooking = `${window.location.origin}/book`;

  return (
    <div style={{ padding: 20, maxWidth: 1100, margin: "0 auto" }}>
      <h1>Integrations Hub</h1>

      <div style={{ border: "1px solid #e0e0e0", borderRadius: 8, padding: 14, marginBottom: 16 }}>
        <h2>Calendly</h2>
        <p style={{ color: "#666" }}>Scheduling link: <a href={calendlyUrl} target="_blank" rel="noreferrer">{calendlyUrl}</a></p>
        <p style={{ marginBottom: 6 }}><strong>Upcoming Appointments</strong></p>
        {upcoming.length === 0 && <p style={{ color: "#666" }}>No upcoming appointments yet.</p>}
        {upcoming.map((booking) => (
          <p key={booking.id} style={{ margin: "4px 0", color: "#666" }}>
            {booking.name} - {booking.preferred_date} ({booking.status})
          </p>
        ))}
      </div>

      <div style={{ border: "1px solid #e0e0e0", borderRadius: 8, padding: 14, marginBottom: 16 }}>
        <h2>Gmail (API-ready mock)</h2>
        {gmailMessages.map((msg) => (
          <p key={msg.id} style={{ margin: "6px 0", color: "#666" }}>
            <strong>{msg.from}</strong> - {msg.subject} <span style={{ color: "#999" }}>({msg.time})</span>
          </p>
        ))}
      </div>

      <div style={{ border: "1px solid #e0e0e0", borderRadius: 8, padding: 14, marginBottom: 16 }}>
        <h2>Zoom Meetings</h2>
        {zoomMeetings.length === 0 && <p style={{ color: "#666" }}>No Zoom links attached yet.</p>}
        {zoomMeetings.map((meeting) => (
          <p key={meeting.id} style={{ margin: "6px 0", color: "#666" }}>
            {meeting.name}: <a href={meeting.zoom_link} target="_blank" rel="noreferrer">Join Meeting</a>
          </p>
        ))}
      </div>

      <div style={{ border: "1px solid #e0e0e0", borderRadius: 8, padding: 14, marginBottom: 16 }}>
        <h2>Zapier Automations</h2>
        {zapierStatus.loading && <p style={{ color: "#666" }}>Checking Zapier configuration...</p>}

        {!zapierStatus.loading && !zapierStatus.configured && (
          <div style={{ background: "#f8f9fb", borderRadius: 6, padding: 12, marginBottom: 10 }}>
            <p style={{ margin: "0 0 6px 0", color: "#333", fontWeight: 600 }}>Connection status: Not configured</p>
            <p style={{ margin: 0, color: "#666" }}>
              Add ZAPIER_WEBHOOK_URL in Vercel to activate app automations.
            </p>
          </div>
        )}

        {!zapierStatus.loading && zapierStatus.configured && (
          <>
            <p style={{ color: "#2e7d32", marginBottom: 8 }}>Connected</p>
            <p style={{ color: "#666", marginBottom: 10 }}>
              Active events: {(zapierStatus.events || []).join(", ")}
            </p>
            <button
              onClick={sendZapierTest}
              disabled={zapierTestState.loading}
              style={{ padding: "8px 12px", border: "none", backgroundColor: "#333", color: "white", borderRadius: 4, cursor: zapierTestState.loading ? "not-allowed" : "pointer", opacity: zapierTestState.loading ? 0.6 : 1 }}
            >
              {zapierTestState.loading ? "Sending..." : "Send Test Event"}
            </button>
            {zapierTestState.message && (
              <p style={{ color: "#666", marginTop: 10 }}>{zapierTestState.message}</p>
            )}
          </>
        )}
      </div>

      <div style={{ border: "1px solid #e0e0e0", borderRadius: 8, padding: 14 }}>
        <h2>Operations Tasks</h2>
        <p style={{ color: "#666", marginBottom: 8 }}>
          Source: {opsTasksSource === "backend" ? "Backend API" : "Supabase fallback"}
        </p>
        {opsTasks.length === 0 && <p style={{ color: "#666" }}>No tasks available yet.</p>}
        {opsTasks.map((task, idx) => (
          <p key={task._id || task.id || idx} style={{ margin: "6px 0", color: "#666" }}>
            [{task.role || "OPS"}] {task.task} ({task.status || "pending"})
          </p>
        ))}
      </div>

      <div style={{ border: "1px solid #e0e0e0", borderRadius: 8, padding: 14, marginTop: 16 }}>
        <h2>Website Integration</h2>
        <p style={{ color: "#666" }}>Embed-ready public pages:</p>
        <p style={{ color: "#666" }}>Model Signup: {embedModelSignup}</p>
        <p style={{ color: "#666" }}>Booking Form: {embedBooking}</p>
        <p style={{ color: "#666", marginTop: 8 }}>
          Backend status: {backendStatus.loading ? "Checking..." : backendStatus.message || "Not configured"}
        </p>
      </div>
    </div>
  );
};

/* DASHBOARD */
const Dashboard = () => {
  const { user, logout, role } = useAuth();
  const [models, setModels] = React.useState([]);
  const [bookings, setBookings] = React.useState([]);
  const [clients, setClients] = React.useState([]);

  React.useEffect(() => {
    const fetchOverview = async () => {
      const [modelsRes, bookingsRes, clientsRes] = await Promise.all([
        supabase.from("models").select("*").order("submitted_at", { ascending: false }),
        supabase.from("bookings").select("*").order("created_at", { ascending: false }),
        supabase.from("clients").select("*").order("created_at", { ascending: false }),
      ]);
      setModels(modelsRes.data || []);
      setBookings(bookingsRes.data || []);
      setClients(clientsRes.data || []);
    };

    fetchOverview();
  }, []);

  const recentModels = models.slice(0, 5);
  const upcomingBookings = bookings.filter((b) => b.preferred_date).slice(0, 5);
  const nextPendingModel = models.find((m) => m.status === "pending");
  const nextPendingBooking = bookings.find((b) => b.status === "pending");

  return (
    <div style={{ padding: 20, maxWidth: 1200, margin: "0 auto" }}>
      <h1>Central Operations Dashboard</h1>
      <p style={{ color: "#666", marginTop: 8 }}>Signed in as: {user?.email || "Unknown user"}</p>
      <p style={{ color: "#666", marginTop: 4 }}>Role: {role}</p>

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 20 }}>
        <MetricCard label="Models" value={models.length} color="#333" />
        <MetricCard label="Bookings" value={bookings.length} color="#4caf50" />
        <MetricCard label="Clients" value={clients.length} color="#2196f3" />
      </div>

      <div style={{ marginTop: 24, border: "1px solid #e0e0e0", borderRadius: 8, padding: 14 }}>
        <h2>Quick Actions</h2>
        {(role === "admin" || role === "agent") && nextPendingModel && (
          <button
            onClick={async () => {
              await supabase.from("models").update({ status: "approved" }).eq("id", nextPendingModel.id);
              window.location.reload();
            }}
            style={{ marginRight: 8, padding: "10px 14px" }}
          >
            Approve {nextPendingModel.name}
          </button>
        )}
        {(role === "admin" || role === "va") && nextPendingBooking && (
          <button
            onClick={async () => {
              await supabase.from("bookings").update({ status: "confirmed" }).eq("id", nextPendingBooking.id);
              window.location.reload();
            }}
            style={{ padding: "10px 14px" }}
          >
            Confirm Booking ({nextPendingBooking.name})
          </button>
        )}
      </div>

      <div style={{ marginTop: 20, display: "grid", gap: 14 }}>
        <div style={{ border: "1px solid #e0e0e0", borderRadius: 8, padding: 14 }}>
          <h3>Upcoming Bookings</h3>
          {upcomingBookings.length === 0 && <p style={{ color: "#666" }}>No upcoming bookings yet.</p>}
          {upcomingBookings.map((booking) => (
            <p key={booking.id} style={{ margin: "6px 0", color: "#666" }}>
              {booking.name} - {booking.preferred_date} ({booking.status})
            </p>
          ))}
        </div>

        <div style={{ border: "1px solid #e0e0e0", borderRadius: 8, padding: 14 }}>
          <h3>Recent Model Submissions</h3>
          {recentModels.length === 0 && <p style={{ color: "#666" }}>No submissions yet.</p>}
          {recentModels.map((model) => (
            <p key={model.id} style={{ margin: "6px 0", color: "#666" }}>
              {model.name} - {model.status}
            </p>
          ))}
        </div>
      </div>

      <button
        onClick={async () => {
          try {
            await logout();
            window.location.href = "/login";
          } catch (err) {
            alert(err.message || "Failed to logout");
          }
        }}
        style={{ marginTop: 20 }}
      >
        Logout
      </button>
    </div>
  );
};

/* TEAM (ADMIN) */
const Team = () => {
  const [members, setMembers] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [tableReady, setTableReady] = React.useState(true);
  const [error, setError] = React.useState("");
  const [form, setForm] = React.useState({ email: "", role: "user", is_active: true });

  const SETUP_SQL = `-- Run this in your Supabase SQL Editor:
create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  role text not null default 'user',
  is_active boolean not null default true,
  created_at timestamptz default now()
);

-- Disable RLS so the app can read/write (internal admin tool):
alter table public.users disable row level security;

-- Seed your three team members:
insert into public.users (email, role, is_active) values
  ('sitfa92@gmail.com', 'admin', true),
  ('marthajohn223355@gmail.com', 'va', true),
  ('chizzyboi72@gmail.com', 'agent', true)
on conflict (email) do nothing;`;

  const isTableMissingError = (err) =>
    err?.code === "42P01" ||
    err?.code === "42501" ||
    err?.message?.toLowerCase().includes("does not exist") ||
    err?.message?.toLowerCase().includes("relation") ||
    err?.message?.toLowerCase().includes("permission") ||
    err?.message?.toLowerCase().includes("policy") ||
    err?.message?.toLowerCase().includes("rls");

  // Fallback members derived from static defaults when table is missing.
  const DEFAULT_MEMBERS = Object.entries(DEFAULT_ROLE_BY_EMAIL).map(([email, role]) => ({
    id: email,
    email,
    role,
    is_active: true,
    created_at: null,
  }));

  const fetchMembers = async () => {
    try {
      setError("");
      const { data, error } = await supabase
        .from("users")
        .select("id, email, role, is_active, created_at")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setTableReady(true);
      setMembers(data || []);
    } catch (err) {
      if (isTableMissingError(err)) {
        setTableReady(false);
        setMembers(DEFAULT_MEMBERS);
      } else {
        setError(err.message || "Failed to load team");
      }
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    fetchMembers();
  }, []);

  const addMember = async (e) => {
    e.preventDefault();
    try {
      const { error } = await supabase.from("users").insert([{
        email: form.email.trim().toLowerCase(),
        role: form.role,
        is_active: form.is_active,
        created_at: new Date().toISOString(),
      }]);
      if (error) throw error;
      setForm({ email: "", role: "user", is_active: true });
      fetchMembers();
    } catch (err) {
      setError(err.message || "Failed to add team member");
    }
  };

  const updateRole = async (memberId, role) => {
    try {
      const { error } = await supabase.from("users").update({ role }).eq("id", memberId);
      if (error) throw error;
      fetchMembers();
    } catch (err) {
      setError(err.message || "Failed to update role");
    }
  };

  const toggleActive = async (memberId, isActive) => {
    try {
      const { error } = await supabase.from("users").update({ is_active: !isActive }).eq("id", memberId);
      if (error) throw error;
      fetchMembers();
    } catch (err) {
      setError(err.message || "Failed to update status");
    }
  };

  const roleLabel = { admin: "Admin", va: "Virtual Assistant", agent: "Agent", user: "User" };

  return (
    <div style={{ padding: 20, maxWidth: 1000, margin: "0 auto" }}>
      <h1>Team Management</h1>
      <p style={{ color: "#666" }}>Manage allowed users and assign role access.</p>

      {/* Setup banner */}
      {!tableReady && (
        <div style={{ background: "#fff3e0", border: "1px solid #ff9800", borderRadius: 8, padding: 16, marginBottom: 20 }}>
          <strong style={{ color: "#e65100" }}>Database setup required</strong>
          <p style={{ margin: "8px 0", color: "#555" }}>The users table doesn't exist yet. Copy and run this SQL in your
            {" "}<a href="https://supabase.com/dashboard/project/jjmmakbnjzzxbuflucck/sql" target="_blank" rel="noreferrer">Supabase SQL Editor</a>.
            Until then, your team is shown from the built-in defaults (read-only).
          </p>
          <pre style={{ background: "#f5f5f5", padding: 12, borderRadius: 6, fontSize: 12, overflowX: "auto", whiteSpace: "pre-wrap" }}>{SETUP_SQL}</pre>
          <button
            onClick={() => { navigator.clipboard.writeText(SETUP_SQL); }}
            style={{ marginTop: 8, padding: "8px 14px", background: "#333", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer" }}
          >Copy SQL</button>
        </div>
      )}

      {/* Add member form — only when table exists */}
      {tableReady && (
        <form onSubmit={addMember} style={{ display: "grid", gap: 10, marginTop: 14, marginBottom: 20 }}>
          <input value={form.email} placeholder="team@meetserenity.com" type="email"
            onChange={(e) => setForm({ ...form, email: e.target.value })} required
            style={{ padding: 10, border: "1px solid #ccc", borderRadius: 4 }} />
          <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}
            style={{ padding: 10, border: "1px solid #ccc", borderRadius: 4 }}>
            <option value="admin">Admin</option>
            <option value="va">Virtual Assistant</option>
            <option value="agent">Agent</option>
            <option value="user">User</option>
          </select>
          <label style={{ color: "#666" }}>
            <input type="checkbox" checked={form.is_active}
              onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
              style={{ marginRight: 8 }} />
            Active account
          </label>
          <button style={{ width: 160, padding: 10, background: "#333", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer" }}>
            Add Team Member
          </button>
        </form>
      )}

      {loading && <p>Loading team...</p>}
      {error && <p style={{ color: "#d32f2f" }}>{error}</p>}

      {!loading && members.map((member) => (
        <div key={member.id} style={{ border: "1px solid #e0e0e0", borderRadius: 8, padding: 12, marginBottom: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <p style={{ margin: 0, fontWeight: 600, flex: 1 }}>{member.email}</p>
            <span style={{
              padding: "3px 10px", borderRadius: 20, fontSize: 12, fontWeight: 600,
              background: member.is_active ? "#e8f5e9" : "#ffebee",
              color: member.is_active ? "#388e3c" : "#c62828",
            }}>{member.is_active ? "Active" : "Inactive"}</span>
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
            {tableReady ? (
              <>
                <select value={member.role || "user"} onChange={(e) => updateRole(member.id, e.target.value)}
                  style={{ padding: 8, border: "1px solid #ccc", borderRadius: 4 }}>
                  <option value="admin">Admin</option>
                  <option value="va">Virtual Assistant</option>
                  <option value="agent">Agent</option>
                  <option value="user">User</option>
                </select>
                <button onClick={() => toggleActive(member.id, !!member.is_active)}
                  style={{ padding: "8px 10px", border: "none", borderRadius: 4, cursor: "pointer",
                    background: member.is_active ? "#f44336" : "#4caf50", color: "white" }}>
                  {member.is_active ? "Deactivate" : "Activate"}
                </button>
              </>
            ) : (
              <span style={{ color: "#999", fontSize: 13 }}>Role: {roleLabel[member.role] || member.role} (read-only until table is created)</span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};

/* PROTECTED */
const canAccessRoute = (role, routeKey) => {
  if (role === "admin") return true;
  if (role === "va") {
    return ["dashboard", "models", "model-pipeline", "bookings", "clients", "integrations"].includes(routeKey);
  }
  if (role === "agent") {
    return ["dashboard", "models", "model-pipeline", "submissions", "analytics"].includes(routeKey);
  }
  if (role === "user") {
    return ["dashboard", "models"].includes(routeKey);
  }
  return false;
};

const RoleRoute = ({ routeKey, children }) => {
  const { role, loading } = useAuth();
  // Don't redirect while auth is still resolving — wait for real role.
  if (loading) {
    return (
      <div style={{ padding: 40, textAlign: "center" }}>
        <p>Loading...</p>
      </div>
    );
  }
  if (!canAccessRoute(role, routeKey)) {
    return <Navigate to="/" replace />;
  }
  return children;
};

const ProtectedApp = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div style={{ padding: 40, textAlign: "center" }}>
        <p>Loading session...</p>
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  return (
    <>
      <Nav />
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route
          path="/models"
          element={
            <RoleRoute routeKey="models">
              <Models />
            </RoleRoute>
          }
        />
        <Route
          path="/model-pipeline"
          element={
            <RoleRoute routeKey="model-pipeline">
              <ModelPipeline />
            </RoleRoute>
          }
        />
        <Route
          path="/submissions"
          element={
            <RoleRoute routeKey="submissions">
              <Submissions />
            </RoleRoute>
          }
        />
        <Route
          path="/bookings"
          element={
            <RoleRoute routeKey="bookings">
              <AdminBookings />
            </RoleRoute>
          }
        />
        <Route
          path="/clients"
          element={
            <RoleRoute routeKey="clients">
              <Clients />
            </RoleRoute>
          }
        />
        <Route
          path="/analytics"
          element={
            <RoleRoute routeKey="analytics">
              <Analytics />
            </RoleRoute>
          }
        />
        <Route
          path="/integrations"
          element={
            <RoleRoute routeKey="integrations">
              <Integrations />
            </RoleRoute>
          }
        />
        <Route
          path="/team"
          element={
            <RoleRoute routeKey="team">
              <Team />
            </RoleRoute>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
};

/* APP */
function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/model-signup" element={<ModelSignup />} />
          <Route path="/book" element={<PublicBooking />} />
          <Route path="/*" element={<ProtectedApp />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
