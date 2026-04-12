import React from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  Link,
} from "react-router-dom";
import { supabase } from "./supabase";
import { uploadImage } from "./imageUpload";
import { sendModelSubmissionEmail, sendModelStatusUpdateEmail, sendBookingConfirmationEmail, sendBookingConfirmedEmail } from "./emailService";
import { calculateMetrics, MetricCard } from "./analyticsUtils";

/* AUTH */
const useAuth = () => {
  const [user, setUser] = React.useState(
    JSON.parse(localStorage.getItem("user"))
  );

  const login = (email, password) => {
    if (email === "admin@smithinc.com" && password === "password123") {
      const userData = { email };
      localStorage.setItem("user", JSON.stringify(userData));
      setUser(userData);
      return true;
    }
    return false;
  };

  const logout = () => {
    localStorage.removeItem("user");
    setUser(null);
  };

  return { user, login, logout };
};

/* NAV */
const Nav = () => {
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

  return (
    <nav style={navStyle}>
      <div style={{ fontWeight: "bold", fontSize: 18, whiteSpace: "nowrap" }}>
        SmithInc
      </div>

      {/* Desktop Navigation */}
      <div style={desktopNavStyle}>
        <Link to="/" style={linkStyle}>
          Dashboard
        </Link>
        <Link to="/model-signup" style={linkStyle}>
          Model Signup
        </Link>
        <Link to="/submissions" style={linkStyle}>
          Submissions
        </Link>
        <Link to="/bookings" style={linkStyle}>
          Bookings
        </Link>
        <Link to="/analytics" style={linkStyle}>
          Analytics
        </Link>
        <Link to="/login" style={linkStyle}>
          Login
        </Link>
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
        <Link 
          to="/" 
          style={linkStyle} 
          onClick={() => setMobileMenuOpen(false)}
        >
          Dashboard
        </Link>
        <Link 
          to="/model-signup" 
          style={linkStyle} 
          onClick={() => setMobileMenuOpen(false)}
        >
          Model Signup
        </Link>
        <Link 
          to="/submissions" 
          style={linkStyle} 
          onClick={() => setMobileMenuOpen(false)}
        >
          Submissions
        </Link>
        <Link 
          to="/bookings" 
          style={linkStyle} 
          onClick={() => setMobileMenuOpen(false)}
        >
          Bookings
        </Link>
        <Link 
          to="/analytics" 
          style={linkStyle} 
          onClick={() => setMobileMenuOpen(false)}
        >
          Analytics
        </Link>
        <Link 
          to="/login" 
          style={linkStyle} 
          onClick={() => setMobileMenuOpen(false)}
        >
          Login
        </Link>
      </div>
    </nav>
  );
};

/* LOGIN */
const Login = () => {
  const { login } = useAuth();
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");

  const handleSubmit = (e) => {
    e.preventDefault();
    if (login(email, password)) {
      window.location.href = "/";
    } else {
      alert("Invalid login");
    }
  };

  return (
    <div style={{ padding: "20px", maxWidth: "400px", margin: "50px auto" }}>
      <h1 style={{ textAlign: "center", marginBottom: 30 }}>Admin Login</h1>
      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: 20 }}>
          <input 
            placeholder="Email" 
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
          style={{
            width: "100%",
            padding: "12px",
            backgroundColor: "#333",
            color: "white",
            border: "none",
            borderRadius: "4px",
            fontSize: "16px",
            fontWeight: "bold",
            cursor: "pointer",
          }}
        >
          Login
        </button>
      </form>
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

      // Insert model with image URL and pending status
      const { data, error: supabaseError } = await supabase
        .from("models")
        .insert([
          {
            name: form.name.trim(),
            email: form.email.trim(),
            instagram: form.instagram.trim(),
            image_url: imageUrl,
            status: "pending",
            submitted_at: new Date().toISOString(),
          },
        ])
        .select();

      if (supabaseError) throw supabaseError;

      // Send confirmation emails (async, don't block UI)
      sendModelSubmissionEmail({
        name: form.name.trim(),
        email: form.email.trim(),
        instagram: form.instagram.trim(),
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
      const { error: supabaseError } = await supabase
        .from("models")
        .update({ status: newStatus })
        .eq("id", modelId);

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

/* DASHBOARD */
const Dashboard = () => {
  const { logout } = useAuth();

  return (
    <div style={{ padding: 40 }}>
      <h1>Dashboard</h1>
      <button onClick={logout}>Logout</button>
    </div>
  );
};

/* PROTECTED */
const ProtectedApp = () => {
  const { user } = useAuth();

  if (!user) return <Navigate to="/login" />;

  return (
    <>
      <Nav />
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/submissions" element={<Submissions />} />
        <Route path="/bookings" element={<AdminBookings />} />
        <Route path="/analytics" element={<Analytics />} />
      </Routes>
    </>
  );
};

/* APP */
function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/model-signup" element={<ModelSignup />} />
        <Route path="/book" element={<PublicBooking />} />
        <Route path="/*" element={<ProtectedApp />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
