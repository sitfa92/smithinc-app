import React from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  Link,
} from "react-router-dom";

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

  const handleSubmit = (e) => {
    e.preventDefault();

    const data = JSON.parse(localStorage.getItem("models")) || [];
    data.push(form);
    localStorage.setItem("models", JSON.stringify(data));

    alert("Model submitted!");
    setForm({ name: "", email: "", instagram: "" });
  };

  return (
    <div style={{ padding: 40 }}>
      <h1>Model Signup</h1>
      <form onSubmit={handleSubmit}>
        <input value={form.name} placeholder="Name" onChange={(e) => setForm({...form, name: e.target.value})} />
        <br /><br />
        <input value={form.email} placeholder="Email" onChange={(e) => setForm({...form, email: e.target.value})} />
        <br /><br />
        <input value={form.instagram} placeholder="Instagram" onChange={(e) => setForm({...form, instagram: e.target.value})} />
        <br /><br />
        <button>Submit</button>
      </form>
    </div>
  );
};

/* SUBMISSIONS */
const Submissions = () => {
  const data = JSON.parse(localStorage.getItem("models")) || [];

  return (
    <div style={{ padding: 40 }}>
      <h1>Submissions</h1>
      {data.map((m, i) => (
        <div key={i}>
          {m.name} — {m.email} — {m.instagram}
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
