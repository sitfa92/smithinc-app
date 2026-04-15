import React from "react";
import { Link, useLocation } from "react-router-dom";
import { supabase } from "../supabase";
import { useAuth } from "../auth";

const C = {
  ink: "#111111",
  slate: "#4a4a4a",
  dust: "#888888",
  smoke: "#e8e4dc",
  ivory: "#faf8f4",
  white: "#ffffff",
  gold: "#c9a96e",
};

// Groups — each item only shows if the user canAccess its key
const GROUPS = [
  {
    key: "talent",
    label: "Talent",
    items: [
      { key: "models",        label: "Models",      to: "/models" },
      { key: "model-pipeline",label: "Pipeline",    to: "/model-pipeline" },
      { key: "submissions",   label: "Submissions", to: "/submissions" },
    ],
  },
  {
    key: "business",
    label: "Business",
    items: [
      { key: "bookings", label: "Bookings", to: "/bookings" },
      { key: "clients",  label: "Clients",  to: "/clients" },
    ],
  },
  {
    key: "settings",
    label: "Settings",
    items: [
      { key: "integrations", label: "Integrations", to: "/integrations" },
      { key: "workflows",    label: "Workflows",    to: "/workflows" },
      { key: "team",         label: "Team",         to: "/team" },
    ],
  },
];

export default function Nav() {
  const { user, logout, role } = useAuth();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);
  const [mobileExpanded, setMobileExpanded] = React.useState({});
  const [isMobile, setIsMobile] = React.useState(window.innerWidth <= 900);
  const [openMenu, setOpenMenu] = React.useState(null);
  const [unreadAlertCount, setUnreadAlertCount] = React.useState(0);
  const closeTimer = React.useRef(null);

  React.useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 900);
      if (window.innerWidth > 900) setMobileMenuOpen(false);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  React.useEffect(() => {
    let mounted = true;
    const fetchUnreadAlerts = async () => {
      if (!user?.email) { if (mounted) setUnreadAlertCount(0); return; }
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
      } catch (_err) { if (mounted) setUnreadAlertCount(0); }
    };
    fetchUnreadAlerts();
    const ch = supabase
      .channel(`nav-alerts-${(user?.email || "guest").toLowerCase()}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "alerts" }, fetchUnreadAlerts)
      .subscribe();
    return () => { mounted = false; supabase.removeChannel(ch); };
  }, [user?.email, role]);

  const canAccess = (section) => {
    if (role === "admin") return true;
    if (role === "va")    return ["dashboard","models","model-pipeline","bookings","clients","integrations","workflows"].includes(section);
    if (role === "agent") return ["dashboard","models","model-pipeline","submissions","analytics"].includes(section);
    if (role === "user")  return ["dashboard","models"].includes(section);
    return false;
  };

  const openDrop = (key) => {
    clearTimeout(closeTimer.current);
    setOpenMenu(key);
  };
  const closeDrop = () => {
    closeTimer.current = setTimeout(() => setOpenMenu(null), 120);
  };

  // ── Styles ──────────────────────────────────────────────────
  const navLinkBase = {
    textDecoration: "none",
    color: C.slate,
    fontFamily: "'Inter', sans-serif",
    fontSize: 13,
    fontWeight: 500,
    letterSpacing: "0.06em",
    textTransform: "uppercase",
    padding: "6px 4px",
    background: "transparent",
    border: "none",
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    gap: 4,
    position: "relative",
    whiteSpace: "nowrap",
    transition: "color 0.15s",
  };

  const activeBorderStyle = {
    content: '""',
    position: "absolute",
    bottom: -2,
    left: 0,
    right: 0,
    height: 1,
    background: C.gold,
  };

  const dropPanel = {
    position: "absolute",
    top: "calc(100% + 10px)",
    left: "50%",
    transform: "translateX(-50%)",
    minWidth: 180,
    background: C.white,
    border: `1px solid ${C.smoke}`,
    borderRadius: 10,
    boxShadow: "0 8px 32px rgba(17,17,17,0.10), 0 2px 8px rgba(17,17,17,0.06)",
    padding: "6px 0",
    zIndex: 2000,
  };

  const dropItem = (active) => ({
    display: "block",
    padding: "10px 20px",
    textDecoration: "none",
    fontFamily: "'Inter', sans-serif",
    fontSize: 13,
    fontWeight: active ? 600 : 400,
    letterSpacing: "0.05em",
    color: active ? C.ink : C.slate,
    background: active ? C.ivory : "transparent",
    borderLeft: active ? `2px solid ${C.gold}` : "2px solid transparent",
    transition: "background 0.12s, color 0.12s",
    cursor: "pointer",
    whiteSpace: "nowrap",
  });

  const mobileGroupLabel = {
    fontFamily: "'Inter', sans-serif",
    fontSize: 11,
    fontWeight: 600,
    letterSpacing: "0.1em",
    textTransform: "uppercase",
    color: C.dust,
    padding: "10px 12px 4px",
    borderTop: `1px solid ${C.smoke}`,
    marginTop: 4,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    cursor: "pointer",
    userSelect: "none",
  };

  const mobileLinkStyle = {
    display: "block",
    textDecoration: "none",
    color: C.slate,
    fontFamily: "'Inter', sans-serif",
    fontSize: 13,
    fontWeight: 500,
    padding: "9px 12px 9px 22px",
    background: "transparent",
    border: "none",
    cursor: "pointer",
    textAlign: "left",
    width: "100%",
    letterSpacing: "0.04em",
  };

  // ── Chevron SVG ───────────────────────────────────────────
  const Chevron = ({ open }) => (
    <svg width="10" height="6" viewBox="0 0 10 6" fill="none"
      style={{ transition: "transform 0.2s", transform: open ? "rotate(180deg)" : "rotate(0deg)", flexShrink: 0 }}>
      <path d="M1 1l4 4 4-4" stroke={C.dust} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );

  // ── Bell ──────────────────────────────────────────────────
  const BellLink = ({ onClick: handleClick }) => (
    <Link to="/notifications" onClick={handleClick}
      style={{ ...navLinkBase, padding: "6px 4px" }}
      aria-label={`Alerts${unreadAlertCount ? ` (${unreadAlertCount} unread)` : ""}`}>
      <span style={{ fontSize: 15, position: "relative" }}>
        🔔
        {unreadAlertCount > 0 && (
          <span style={{
            position: "absolute", top: -4, right: -6,
            minWidth: 16, height: 16, padding: "0 4px",
            borderRadius: 999, background: "#c0392b", color: C.white,
            fontSize: 10, lineHeight: "16px", textAlign: "center", fontWeight: 700,
          }}>
            {unreadAlertCount > 99 ? "99+" : unreadAlertCount}
          </span>
        )}
      </span>
    </Link>
  );

  // ── Desktop dropdown group ────────────────────────────────
  const DropGroup = ({ group }) => {
    const visibleItems = group.items.filter(i => canAccess(i.key));
    if (visibleItems.length === 0) return null;
    const isOpen = openMenu === group.key;
    const anyActive = visibleItems.some(i => location.pathname === i.to);

    return (
      <div style={{ position: "relative" }}
        onMouseEnter={() => openDrop(group.key)}
        onMouseLeave={closeDrop}>
        <button style={{
          ...navLinkBase,
          color: anyActive ? C.ink : C.slate,
        }}>
          {group.label}
          <Chevron open={isOpen} />
          {anyActive && (
            <span style={{ ...activeBorderStyle, position: "absolute", bottom: -3 }} />
          )}
        </button>
        {isOpen && (
          <div style={dropPanel}
            onMouseEnter={() => openDrop(group.key)}
            onMouseLeave={closeDrop}>
            {visibleItems.map(item => {
              const active = location.pathname === item.to;
              return (
                <Link key={item.key} to={item.to}
                  onClick={() => setOpenMenu(null)}
                  style={dropItem(active)}
                  onMouseEnter={e => { if (!active) e.currentTarget.style.background = C.ivory; }}
                  onMouseLeave={e => { if (!active) e.currentTarget.style.background = "transparent"; }}>
                  {item.label}
                </Link>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  return (
    <nav style={{
      padding: "0 28px",
      backgroundColor: C.white,
      borderBottom: `1px solid ${C.smoke}`,
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      height: 58,
      position: "sticky",
      top: 0,
      zIndex: 1500,
      boxShadow: "0 1px 0 rgba(17,17,17,0.04)",
    }}>
      {/* Brand */}
      <Link
        to={user ? "/dashboard" : "/login"}
        style={{
          fontFamily: "'Cormorant Garamond', Georgia, serif",
          fontWeight: 600,
          fontSize: 17,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          color: C.ink,
          textDecoration: "none",
          whiteSpace: "nowrap",
          flexShrink: 0,
        }}
        onClick={() => setMobileMenuOpen(false)}>
        Meet Serenity
      </Link>

      {/* Desktop Nav */}
      {!isMobile && (
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          {/* Standalone: Dashboard */}
          {canAccess("dashboard") && (
            <Link to="/dashboard" style={{
              ...navLinkBase,
              color: location.pathname === "/dashboard" ? C.ink : C.slate,
            }}>
              Dashboard
              {location.pathname === "/dashboard" && <span style={{ ...activeBorderStyle, position: "absolute", bottom: -3 }} />}
            </Link>
          )}

          {/* Dropdown groups */}
          {GROUPS.map(g => <DropGroup key={g.key} group={g} />)}

          {/* Standalone: Analytics */}
          {canAccess("analytics") && (
            <Link to="/analytics" style={{
              ...navLinkBase,
              color: location.pathname === "/analytics" ? C.ink : C.slate,
            }}>
              Analytics
              {location.pathname === "/analytics" && <span style={{ ...activeBorderStyle, position: "absolute", bottom: -3 }} />}
            </Link>
          )}

          {/* Divider */}
          <div style={{ width: 1, height: 20, background: C.smoke }} />

          {/* Bell */}
          {user?.email && <BellLink onClick={() => {}} />}

          {/* User pill */}
          {user?.email && (
            <span style={{
              fontFamily: "'Inter', sans-serif",
              fontSize: 11,
              color: C.dust,
              letterSpacing: "0.03em",
              whiteSpace: "nowrap",
            }}>
              {user.email.split("@")[0]} <span style={{ color: C.smoke.replace("dc","bb"), textTransform: "uppercase", fontSize: 10 }}>({role})</span>
            </span>
          )}

          {/* Logout */}
          <button
            onClick={async () => { try { await logout(); window.location.href = "/login"; } catch (err) { alert(err.message); } }}
            style={{
              ...navLinkBase,
              color: C.dust,
              fontSize: 12,
              border: `1px solid ${C.smoke}`,
              borderRadius: 6,
              padding: "5px 12px",
              textTransform: "uppercase",
              letterSpacing: "0.07em",
            }}>
            Logout
          </button>
        </div>
      )}

      {/* Mobile: bell + hamburger */}
      {isMobile && (
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {user?.email && <BellLink onClick={() => {}} />}
          <button
            onClick={() => setMobileMenuOpen(o => !o)}
            style={{ background: "transparent", border: "none", cursor: "pointer", padding: "4px 6px", color: C.ink, fontSize: 20, lineHeight: 1 }}
            aria-label="Toggle menu">
            {mobileMenuOpen ? "✕" : "☰"}
          </button>
        </div>
      )}

      {/* Mobile drawer */}
      {isMobile && mobileMenuOpen && (
        <div style={{
          position: "absolute",
          top: 58,
          left: 0,
          right: 0,
          background: C.white,
          borderBottom: `1px solid ${C.smoke}`,
          boxShadow: "0 8px 24px rgba(17,17,17,0.08)",
          zIndex: 1400,
          paddingBottom: 12,
        }}>
          {/* Standalone: Dashboard */}
          {canAccess("dashboard") && (
            <Link to="/dashboard" onClick={() => setMobileMenuOpen(false)} style={{ ...mobileLinkStyle, paddingLeft: 16 }}>Dashboard</Link>
          )}

          {/* Groups */}
          {GROUPS.map(g => {
            const visibleItems = g.items.filter(i => canAccess(i.key));
            if (visibleItems.length === 0) return null;
            const expanded = !!mobileExpanded[g.key];
            return (
              <div key={g.key}>
                <div style={mobileGroupLabel} onClick={() => setMobileExpanded(p => ({ ...p, [g.key]: !p[g.key] }))}>
                  {g.label}
                  <Chevron open={expanded} />
                </div>
                {expanded && visibleItems.map(item => (
                  <Link key={item.key} to={item.to}
                    onClick={() => setMobileMenuOpen(false)}
                    style={mobileLinkStyle}>
                    {item.label}
                  </Link>
                ))}
              </div>
            );
          })}

          {/* Analytics */}
          {canAccess("analytics") && (
            <Link to="/analytics" onClick={() => setMobileMenuOpen(false)} style={{ ...mobileLinkStyle, paddingLeft: 16 }}>Analytics</Link>
          )}

          {/* Divider + meta */}
          <div style={{ borderTop: `1px solid ${C.smoke}`, margin: "8px 0" }} />
          {user?.email && (
            <span style={{ display: "block", fontFamily: "'Inter',sans-serif", fontSize: 11, color: C.dust, padding: "4px 16px" }}>
              {user.email} ({role})
            </span>
          )}
          <button
            onClick={async () => { try { await logout(); setMobileMenuOpen(false); window.location.href = "/login"; } catch (err) { alert(err.message); } }}
            style={{ ...mobileLinkStyle, paddingLeft: 16, color: C.dust }}>
            Logout
          </button>
        </div>
      )}
    </nav>
  );
}
