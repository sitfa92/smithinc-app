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
const Nav = () => (
  <nav style={{ padding: 20 }}>
    <Link to="/">Dashboard</Link> |{" "}
    <Link to="/model-signup">Model Signup</Link> |{" "}
    <Link to="/submissions">Submissions</Link> |{" "}
    <Link to="/bookings">Bookings</Link> |{" "}
    <Link to="/login">Login</Link>
  </nav>
);

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
    <div style={{ padding: 40 }}>
      <h1>Admin Login</h1>
      <form onSubmit={handleSubmit}>
        <input placeholder="Email" onChange={(e) => setEmail(e.target.value)} />
        <br /><br />
        <input type="password" placeholder="Password" onChange={(e) => setPassword(e.target.value)} />
        <br /><br />
        <button>Login</button>
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
    <div style={{ padding: 40, maxWidth: 600, margin: "0 auto" }}>
      <h1>Model Signup</h1>
      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: 15 }}>
          <label style={{ display: "block", marginBottom: 5, fontWeight: "bold" }}>
            Full Name *
          </label>
          <input 
            value={form.name} 
            placeholder="Your full name" 
            onChange={(e) => setForm({...form, name: e.target.value})}
            disabled={loading}
            style={{ width: "100%", padding: 10, boxSizing: "border-box" }}
          />
        </div>

        <div style={{ marginBottom: 15 }}>
          <label style={{ display: "block", marginBottom: 5, fontWeight: "bold" }}>
            Email *
          </label>
          <input 
            value={form.email} 
            placeholder="your@email.com" 
            type="email"
            onChange={(e) => setForm({...form, email: e.target.value})}
            disabled={loading}
            style={{ width: "100%", padding: 10, boxSizing: "border-box" }}
          />
        </div>

        <div style={{ marginBottom: 15 }}>
          <label style={{ display: "block", marginBottom: 5, fontWeight: "bold" }}>
            Instagram
          </label>
          <input 
            value={form.instagram} 
            placeholder="@yourprofile" 
            onChange={(e) => setForm({...form, instagram: e.target.value})}
            disabled={loading}
            style={{ width: "100%", padding: 10, boxSizing: "border-box" }}
          />
        </div>

        <div style={{ marginBottom: 15 }}>
          <label style={{ display: "block", marginBottom: 5, fontWeight: "bold" }}>
            Profile Image * (JPG, PNG, GIF, WebP - Max 5MB)
          </label>
          <input 
            type="file"
            accept="image/*"
            onChange={handleImageChange}
            disabled={loading}
            style={{ width: "100%", padding: 10 }}
          />
          {imagePreview && (
            <div style={{ marginTop: 15, textAlign: "center" }}>
              <img 
                src={imagePreview} 
                alt="Preview" 
                style={{ maxWidth: "100%", maxHeight: 300, borderRadius: 8 }}
              />
            </div>
          )}
        </div>

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
            cursor: loading ? "not-allowed" : "pointer",
          }}
        >
          {loading ? "Uploading..." : "Submit Application"}
        </button>
      </form>

      {error && (
        <div style={{ color: "#d32f2f", marginTop: 20, padding: 10, backgroundColor: "#ffebee", borderRadius: 4 }}>
          {error}
        </div>
      )}
      {success && (
        <div style={{ color: "#388e3c", marginTop: 20, padding: 10, backgroundColor: "#e8f5e9", borderRadius: 4 }}>
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
    <div style={{ padding: 40, maxWidth: 1200, margin: "0 auto" }}>
      <h1>Model Applications</h1>
      
      {loading && <p>Loading applications...</p>}
      {error && <div style={{ color: "#d32f2f", marginBottom: 20, padding: 10, backgroundColor: "#ffebee", borderRadius: 4 }}>Error: {error}</div>}
      
      {!loading && submissions.length === 0 && (
        <p style={{ color: "#999", fontSize: 16 }}>No submissions yet.</p>
      )}

      {!loading && submissions.map((model) => (
        <div
          key={model.id}
          style={{
            display: "flex",
            gap: 20,
            padding: 20,
            marginBottom: 20,
            border: "1px solid #e0e0e0",
            borderRadius: 8,
            backgroundColor: "#fafafa",
          }}
        >
          {/* Image */}
          <div style={{ flex: "0 0 150px" }}>
            {model.image_url ? (
              <img
                src={model.image_url}
                alt={model.name}
                style={{
                  width: "100%",
                  height: 200,
                  objectFit: "cover",
                  borderRadius: 8,
                }}
              />
            ) : (
              <div
                style={{
                  width: "100%",
                  height: 200,
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
          <div style={{ flex: 1 }}>
            <div style={{ marginBottom: 10 }}>
              <h3 style={{ margin: "0 0 5px 0" }}>{model.name}</h3>
              <p style={{ margin: "5px 0", color: "#666" }}>
                <strong>Email:</strong> {model.email}
              </p>
              {model.instagram && (
                <p style={{ margin: "5px 0", color: "#666" }}>
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
              <div style={{ display: "flex", gap: 10 }}>
                <button
                  onClick={() => updateModelStatus(model.id, "approved")}
                  disabled={actionLoading[model.id]}
                  style={{
                    padding: "8px 16px",
                    backgroundColor: "#4caf50",
                    color: "white",
                    border: "none",
                    borderRadius: 4,
                    cursor: actionLoading[model.id] ? "not-allowed" : "pointer",
                    opacity: actionLoading[model.id] ? 0.6 : 1,
                  }}
                >
                  {actionLoading[model.id] ? "..." : "✓ Approve"}
                </button>
                <button
                  onClick={() => updateModelStatus(model.id, "rejected")}
                  disabled={actionLoading[model.id]}
                  style={{
                    padding: "8px 16px",
                    backgroundColor: "#f44336",
                    color: "white",
                    border: "none",
                    borderRadius: 4,
                    cursor: actionLoading[model.id] ? "not-allowed" : "pointer",
                    opacity: actionLoading[model.id] ? 0.6 : 1,
                  }}
                >
                  {actionLoading[model.id] ? "..." : "✕ Reject"}
                </button>
              </div>
            )}
          </div>
        </div>
      ))}
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
    <div style={{ padding: 40, maxWidth: 600, margin: "0 auto" }}>
      <h1>Book Our Services</h1>
      <p style={{ color: "#666", marginBottom: 30 }}>
        Interested in booking talent or services? Let's connect.
      </p>

      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: 15 }}>
          <label style={{ display: "block", marginBottom: 5, fontWeight: "bold" }}>
            Full Name *
          </label>
          <input
            value={form.name}
            placeholder="Your full name"
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            disabled={loading}
            style={{ width: "100%", padding: 10, boxSizing: "border-box" }}
          />
        </div>

        <div style={{ marginBottom: 15 }}>
          <label style={{ display: "block", marginBottom: 5, fontWeight: "bold" }}>
            Email *
          </label>
          <input
            value={form.email}
            placeholder="your@email.com"
            type="email"
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            disabled={loading}
            style={{ width: "100%", padding: 10, boxSizing: "border-box" }}
          />
        </div>

        <div style={{ marginBottom: 15 }}>
          <label style={{ display: "block", marginBottom: 5, fontWeight: "bold" }}>
            Company / Brand *
          </label>
          <input
            value={form.company}
            placeholder="Your company name"
            onChange={(e) => setForm({ ...form, company: e.target.value })}
            disabled={loading}
            style={{ width: "100%", padding: 10, boxSizing: "border-box" }}
          />
        </div>

        <div style={{ marginBottom: 15 }}>
          <label style={{ display: "block", marginBottom: 5, fontWeight: "bold" }}>
            Service Type *
          </label>
          <select
            value={form.service_type}
            onChange={(e) => setForm({ ...form, service_type: e.target.value })}
            disabled={loading}
            style={{ width: "100%", padding: 10, boxSizing: "border-box" }}
          >
            <option value="Model Booking">Model Booking</option>
            <option value="Creative Direction">Creative Direction</option>
            <option value="Photoshoot">Photoshoot</option>
            <option value="Consultation">Consultation</option>
          </select>
        </div>

        <div style={{ marginBottom: 15 }}>
          <label style={{ display: "block", marginBottom: 5, fontWeight: "bold" }}>
            Preferred Date
          </label>
          <input
            value={form.preferred_date}
            type="date"
            onChange={(e) => setForm({ ...form, preferred_date: e.target.value })}
            disabled={loading}
            style={{ width: "100%", padding: 10, boxSizing: "border-box" }}
          />
        </div>

        <div style={{ marginBottom: 15 }}>
          <label style={{ display: "block", marginBottom: 5, fontWeight: "bold" }}>
            Message / Notes
          </label>
          <textarea
            value={form.message}
            placeholder="Tell us more about your project..."
            onChange={(e) => setForm({ ...form, message: e.target.value })}
            disabled={loading}
            style={{
              width: "100%",
              padding: 10,
              boxSizing: "border-box",
              minHeight: 120,
              fontFamily: "inherit",
            }}
          />
        </div>

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
            padding: 10,
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
            padding: 10,
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
    <div style={{ padding: 40, maxWidth: 1200, margin: "0 auto" }}>
      <h1>Booking Requests</h1>

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
        bookings.map((booking) => (
          <div
            key={booking.id}
            style={{
              padding: 20,
              marginBottom: 20,
              border: "1px solid #e0e0e0",
              borderRadius: 8,
              backgroundColor: "#fafafa",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
              <div style={{ flex: 1 }}>
                <h3 style={{ margin: "0 0 10px 0" }}>{booking.name}</h3>
                <p style={{ margin: "5px 0", color: "#666" }}>
                  <strong>Company:</strong> {booking.company}
                </p>
                <p style={{ margin: "5px 0", color: "#666" }}>
                  <strong>Email:</strong> {booking.email}
                </p>
                <p style={{ margin: "5px 0", color: "#666" }}>
                  <strong>Service:</strong> {booking.service_type}
                </p>
                {booking.preferred_date && (
                  <p style={{ margin: "5px 0", color: "#666" }}>
                    <strong>Preferred Date:</strong>{" "}
                    {new Date(booking.preferred_date).toLocaleDateString()}
                  </p>
                )}
                {booking.message && (
                  <p style={{ margin: "10px 0 0 0", padding: 10, backgroundColor: "#fff", borderRadius: 4, color: "#555" }}>
                    <strong>Message:</strong> {booking.message}
                  </p>
                )}
                <p style={{ margin: "10px 0 0 0", color: "#999", fontSize: "0.9em" }}>
                  Received: {new Date(booking.created_at).toLocaleString()}
                </p>
              </div>

              <div style={{ marginLeft: 20, textAlign: "right" }}>
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
                    marginBottom: 15,
                  }}
                >
                  {booking.status}
                </span>

                {booking.status === "pending" && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    <button
                      onClick={() => updateBookingStatus(booking.id, "confirmed")}
                      disabled={actionLoading[booking.id]}
                      style={{
                        padding: "8px 12px",
                        backgroundColor: "#4caf50",
                        color: "white",
                        border: "none",
                        borderRadius: 4,
                        cursor: actionLoading[booking.id] ? "not-allowed" : "pointer",
                        opacity: actionLoading[booking.id] ? 0.6 : 1,
                        fontSize: "0.9em",
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
                      padding: "8px 12px",
                      backgroundColor: "#2196f3",
                      color: "white",
                      border: "none",
                      borderRadius: 4,
                      cursor: actionLoading[booking.id] ? "not-allowed" : "pointer",
                      opacity: actionLoading[booking.id] ? 0.6 : 1,
                      fontSize: "0.9em",
                    }}
                  >
                    {actionLoading[booking.id] ? "..." : "✓ Completed"}
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
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
