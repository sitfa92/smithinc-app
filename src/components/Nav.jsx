import React from "react";
import { Link } from "react-router-dom";
import { supabase } from "../supabase";
import { useAuth } from "../auth";

export default function Nav() {
  const { user, logout, role } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);
  const [isMobile, setIsMobile] = React.useState(window.innerWidth <= 768);
  const [unreadAlertCount, setUnreadAlertCount] = React.useState(0);

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

  React.useEffect(() => {
    let mounted = true;

    const fetchUnreadAlerts = async () => {
      if (!user?.email) {
        if (mounted) setUnreadAlertCount(0);
        return;
      }

      try {
        const { data, error } = await supabase
          .from("alerts")
          .select("id, audience_role, audience_email, status")
          .neq("status", "read")
          .order("created_at", { ascending: false })
          .limit(100);

        if (error) throw error;

        const email = (user.email || "").toLowerCase();
        const visible = (data || []).filter((item) => {
          if (role === "admin") return true;
          return (item.audience_email || "").toLowerCase() === email || item.audience_role === role;
        });

        if (mounted) setUnreadAlertCount(visible.length);
      } catch (_err) {
        if (mounted) setUnreadAlertCount(0);
      }
    };

    fetchUnreadAlerts();

    const alertsChannel = supabase
      .channel(`nav-alerts-${(user?.email || "guest").toLowerCase()}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "alerts" }, () => {
        fetchUnreadAlerts();
      })
      .subscribe();

    return () => {
      mounted = false;
      supabase.removeChannel(alertsChannel);
    };
  }, [user?.email, role]);

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
      return ["dashboard", "models", "model-pipeline", "bookings", "clients", "integrations", "workflows"].includes(section);
    }
    if (role === "agent") {
      return ["dashboard", "models", "model-pipeline", "submissions", "analytics"].includes(section);
    }
    if (role === "user") {
      return ["dashboard", "models"].includes(section);
    }
    return false;
  };

  const bellLink = (
    <Link
      to="/notifications"
      style={{ ...linkStyle, position: "relative", paddingRight: 16 }}
      onClick={() => setMobileMenuOpen(false)}
      aria-label={`Alerts${unreadAlertCount ? ` (${unreadAlertCount} unread)` : ""}`}
    >
      <span style={{ fontSize: 16 }}>🔔</span>
      {unreadAlertCount > 0 && (
        <span
          style={{
            position: "absolute",
            top: 2,
            right: 2,
            minWidth: 18,
            height: 18,
            padding: "0 5px",
            borderRadius: 999,
            background: "#d32f2f",
            color: "#fff",
            fontSize: 11,
            lineHeight: "18px",
            textAlign: "center",
            fontWeight: 700,
          }}
        >
          {unreadAlertCount > 99 ? "99+" : unreadAlertCount}
        </span>
      )}
    </Link>
  );

  return (
    <nav style={navStyle}>
      <Link
        to={user ? "/" : "/login"}
        style={{ fontWeight: "bold", fontSize: 18, whiteSpace: "nowrap", color: "#333", textDecoration: "none" }}
        onClick={() => setMobileMenuOpen(false)}
      >
        MEET SERENITY
      </Link>

      {/* Desktop Navigation */}
      <div style={desktopNavStyle}>
        {user?.email && <span style={userEmailStyle}>{user.email} ({role})</span>}
        {canAccess("dashboard") && <Link to="/" style={linkStyle}>Dashboard</Link>}
        {canAccess("models") && <Link to="/models" style={linkStyle}>Models</Link>}
        {canAccess("model-pipeline") && <Link to="/model-pipeline" style={linkStyle}>Pipeline</Link>}
        {canAccess("submissions") && <Link to="/submissions" style={linkStyle}>Submissions</Link>}
        {canAccess("bookings") && <Link to="/bookings" style={linkStyle}>Bookings</Link>}
        {canAccess("clients") && <Link to="/clients" style={linkStyle}>Clients</Link>}
        {canAccess("analytics") && <Link to="/analytics" style={linkStyle}>Analytics</Link>}
        {canAccess("integrations") && <Link to="/integrations" style={linkStyle}>Integrations</Link>}
        {canAccess("workflows") && <Link to="/workflows" style={linkStyle}>Workflows</Link>}
        {canAccess("team") && <Link to="/team" style={linkStyle}>Team</Link>}
        {user?.email && bellLink}
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
        {canAccess("dashboard") && <Link to="/" style={linkStyle} onClick={() => setMobileMenuOpen(false)}>Dashboard</Link>}
        {canAccess("models") && <Link to="/models" style={linkStyle} onClick={() => setMobileMenuOpen(false)}>Models</Link>}
        {canAccess("model-pipeline") && <Link to="/model-pipeline" style={linkStyle} onClick={() => setMobileMenuOpen(false)}>Pipeline</Link>}
        {canAccess("submissions") && <Link to="/submissions" style={linkStyle} onClick={() => setMobileMenuOpen(false)}>Submissions</Link>}
        {canAccess("bookings") && <Link to="/bookings" style={linkStyle} onClick={() => setMobileMenuOpen(false)}>Bookings</Link>}
        {canAccess("clients") && <Link to="/clients" style={linkStyle} onClick={() => setMobileMenuOpen(false)}>Clients</Link>}
        {canAccess("analytics") && <Link to="/analytics" style={linkStyle} onClick={() => setMobileMenuOpen(false)}>Analytics</Link>}
        {canAccess("integrations") && <Link to="/integrations" style={linkStyle} onClick={() => setMobileMenuOpen(false)}>Integrations</Link>}
        {canAccess("workflows") && <Link to="/workflows" style={linkStyle} onClick={() => setMobileMenuOpen(false)}>Workflows</Link>}
        {canAccess("team") && <Link to="/team" style={linkStyle} onClick={() => setMobileMenuOpen(false)}>Team</Link>}
        {user?.email && bellLink}
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
}
