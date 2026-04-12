import React from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  Link,
} from "react-router-dom";
import { supabase } from "./supabase";

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
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");
  const [success, setSuccess] = React.useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      // Validate required fields
      if (!form.name.trim() || !form.email.trim()) {
        throw new Error("Name and email are required");
      }

      const { data, error: supabaseError } = await supabase
        .from("models")
        .insert([
          {
            name: form.name.trim(),
            email: form.email.trim(),
            instagram: form.instagram.trim(),
            submitted_at: new Date().toISOString(),
          },
        ])
        .select();

      if (supabaseError) throw supabaseError;

      setSuccess(true);
      setForm({ name: "", email: "", instagram: "" });
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err.message || "Failed to submit. Please try again.");
      console.error("Submission error:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: 40 }}>
      <h1>Model Signup</h1>
      <form onSubmit={handleSubmit}>
        <input 
          value={form.name} 
          placeholder="Name" 
          onChange={(e) => setForm({...form, name: e.target.value})}
          disabled={loading}
        />
        <br /><br />
        <input 
          value={form.email} 
          placeholder="Email" 
          type="email"
          onChange={(e) => setForm({...form, email: e.target.value})}
          disabled={loading}
        />
        <br /><br />
        <input 
          value={form.instagram} 
          placeholder="Instagram (@username)" 
          onChange={(e) => setForm({...form, instagram: e.target.value})}
          disabled={loading}
        />
        <br /><br />
        <button disabled={loading}>{loading ? "Submitting..." : "Submit"}</button>
      </form>
      {error && <div style={{ color: "red", marginTop: 10 }}>{error}</div>}
      {success && <div style={{ color: "green", marginTop: 10 }}>✓ Submitted successfully!</div>}
    </div>
  );
};

/* SUBMISSIONS */
const Submissions = () => {
  const [submissions, setSubmissions] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");

  React.useEffect(() => {
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

    fetchSubmissions();
  }, []);

  return (
    <div style={{ padding: 40 }}>
      <h1>Submissions</h1>
      {loading && <p>Loading...</p>}
      {error && <div style={{ color: "red", marginBottom: 10 }}>Error: {error}</div>}
      {!loading && submissions.length === 0 && <p>No submissions yet.</p>}
      {!loading && submissions.map((m) => (
        <div key={m.id} style={{ padding: 10, borderBottom: "1px solid #ccc", marginBottom: 10 }}>
          <strong>{m.name}</strong> — {m.email}
          {m.instagram && <> — @{m.instagram}</>}
          <div style={{ fontSize: "0.85em", color: "#666", marginTop: 5 }}>
            {new Date(m.submitted_at).toLocaleString()}
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
        <Route path="/*" element={<ProtectedApp />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
