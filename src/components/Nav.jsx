import React from "react";
import { Link, useLocation } from "react-router-dom";
import { supabase } from "../supabase";
import { useAuth } from "../auth";
import VoiceCallButton from "./VoiceCallButton";

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
    key: "dashboard-group",
    label: "Dashboard",
    items: [
      { key: "dashboard",      label: "Overview",      to: "/dashboard" },
      { key: "notifications",  label: "Alerts",        to: "/notifications" },
    ],
  },
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
      { key: "bookings",            label: "Bookings",    to: "/bookings" },
      { key: "partners",            label: "Partners",    to: "/partners" },
      { key: "partner-pipeline",    label: "Pipeline",    to: "/partner-pipeline" },
      { key: "partner-submissions", label: "Submissions", to: "/partner-submissions" },
    ],
  },
  {
    key: "brand-ambassador",
    label: "Brand Ambassador",
    items: [
      { key: "brand-ambassadors",           label: "Contacts",    to: "/brand-ambassadors" },
      { key: "brand-ambassador-pipeline",   label: "Pipeline",    to: "/brand-ambassador-pipeline" },
      { key: "brand-ambassador-submissions",label: "Submissions", to: "/brand-ambassador-submissions" },
    ],
  },
  {
    key: "settings",
    label: "Settings",
    items: [
      { key: "integrations", label: "Integrations", to: "/integrations" },
      { key: "workflows",    label: "Workflows",    to: "/workflows" },
      { key: "team",         label: "Team",         to: "/team" },
      { key: "team-docs",    label: "Team Docs",    to: "/team-docs" },
      { key: "contact-team", label: "Contact Team", to: "/contact-team" },
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
  const [recentUnreadAlerts, setRecentUnreadAlerts] = React.useState([]);
  const closeTimer = React.useRef(null);
  const navRef = React.useRef(null);

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
          .select("id, title, created_at, audience_role, audience_email, status")
          .neq("status", "read")
          .order("created_at", { ascending: false })
          .limit(100);
        if (error) throw error;
        const email = (user.email || "").toLowerCase();
        const visible = (data || []).filter((item) => {
          if (role === "admin") return true;
          return (item.audience_email || "").toLowerCase() === email || item.audience_role === role;
        });
        if (mounted) {
          setUnreadAlertCount(visible.length);
          setRecentUnreadAlerts(visible.slice(0, 5));
        }
      } catch (_err) {
        if (mounted) {
          setUnreadAlertCount(0);
          setRecentUnreadAlerts([]);
        }
      }
    };
    fetchUnreadAlerts();
    const ch = supabase
      .channel(`nav-alerts-${(user?.email || "guest").toLowerCase()}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "alerts" }, fetchUnreadAlerts)
      .subscribe();
    return () => { mounted = false; supabase.removeChannel(ch); };
  }, [user?.email, role]);

  React.useEffect(() => {
    const handleClickOutside = (event) => {
      if (navRef.current && !navRef.current.contains(event.target)) {
        setOpenMenu(null);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      clearTimeout(closeTimer.current);
    };
  }, []);

  const canAccess = (section) => {
    if (role === "admin") return true;
    if (role === "va")    return ["dashboard","dashboard-group","notifications","models","model-pipeline","bookings","partners","partner-pipeline","partner-submissions","brand-ambassadors","brand-ambassador-pipeline","brand-ambassador-submissions","integrations","workflows"].includes(section);
    if (role === "agent") return ["dashboard","dashboard-group","notifications","models","model-pipeline","submissions","analytics"].includes(section);
    if (role === "user")  return ["dashboard","dashboard-group","notifications","models"].includes(section);
    return false;
  };

  const openDrop = (key) => {
    clearTimeout(closeTimer.current);
    setOpenMenu(key);
  };
  const toggleDrop = (key) => {
    clearTimeout(closeTimer.current);
    setOpenMenu((prev) => (prev === key ? null : key));
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
  const AlertsMenu = () => {
    const isOpen = openMenu === "alerts-menu";
    return (
      <div
        style={{ position: "relative" }}
        onMouseEnter={() => openDrop("alerts-menu")}
        onMouseLeave={closeDrop}
      >
        <button
          type="button"
          onClick={() => toggleDrop("alerts-menu")}
          aria-expanded={isOpen}
          aria-haspopup="menu"
          aria-label={`Alerts${unreadAlertCount ? ` (${unreadAlertCount} unread)` : ""}`}
          style={{ ...navLinkBase, padding: "6px 4px" }}
        >
          <span style={{ fontSize: 15, position: "relative" }}>
            🔔
            {unreadAlertCount > 0 && (
              <span
                style={{
                  position: "absolute",
                  top: -4,
                  right: -6,
                  minWidth: 16,
                  height: 16,
                  padding: "0 4px",
                  borderRadius: 999,
                  background: "#c0392b",
                  color: C.white,
                  fontSize: 10,
                  lineHeight: "16px",
                  textAlign: "center",
                  fontWeight: 700,
                }}
              >
                {unreadAlertCount > 99 ? "99+" : unreadAlertCount}
              </span>
            )}
          </span>
        </button>

        {isOpen && (
          <div
            style={{
              ...dropPanel,
              left: "auto",
              right: -8,
              transform: "none",
              minWidth: 280,
              maxWidth: 320,
              padding: "8px 0",
            }}
            onMouseEnter={() => openDrop("alerts-menu")}
            onMouseLeave={closeDrop}
          >
            <div
              style={{
                padding: "8px 14px 10px",
                borderBottom: `1px solid ${C.smoke}`,
                fontFamily: "'Inter', sans-serif",
              }}
            >
              <div style={{ fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", color: C.dust }}>
                Alerts
              </div>
              <div style={{ fontSize: 12, color: C.slate, marginTop: 2 }}>
                {unreadAlertCount > 0 ? `${unreadAlertCount} unread` : "All caught up"}
              </div>
            </div>

            {recentUnreadAlerts.length === 0 ? (
              <div style={{ padding: "12px 14px", fontSize: 12, color: C.dust, fontFamily: "'Inter', sans-serif" }}>
                No unread alerts right now.
              </div>
            ) : (
              recentUnreadAlerts.map((item) => (
                <Link
                  key={item.id}
                  to="/notifications"
                  onClick={() => setOpenMenu(null)}
                  style={{
                    display: "block",
                    padding: "10px 14px",
                    textDecoration: "none",
                    borderBottom: `1px solid ${C.smoke}`,
                    fontFamily: "'Inter', sans-serif",
                    background: "transparent",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = C.ivory;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "transparent";
                  }}
                >
                  <div style={{ color: C.ink, fontSize: 12, fontWeight: 600, lineHeight: 1.35 }}>
                    {item.title || "Alert"}
                  </div>
                  <div style={{ color: C.dust, fontSize: 11, marginTop: 3 }}>
                    {new Date(item.created_at).toLocaleString()}
                  </div>
                </Link>
              ))
            )}

            <Link
              to="/notifications"
              onClick={() => setOpenMenu(null)}
              style={{
                display: "block",
                textAlign: "center",
                textDecoration: "none",
                padding: "10px 12px 8px",
                fontFamily: "'Inter', sans-serif",
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: C.ink,
              }}
            >
              View All Alerts
            </Link>

            <div style={{ borderTop: `1px solid ${C.smoke}`, padding: "10px 12px 8px" }}>
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  color: C.dust,
                  marginBottom: 8,
                  fontFamily: "'Inter', sans-serif",
                }}
              >
                Quick Test
              </div>
              <VoiceCallButton
                label="Test Voice Call"
                compact
                metadata={{ page: "nav_alerts_dropdown", role: role || "unknown", email: user?.email || "" }}
              />
            </div>
          </div>
        )}
      </div>
    );
  };

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
        <button
          type="button"
          onClick={() => toggleDrop(group.key)}
          aria-expanded={isOpen}
          aria-haspopup="menu"
          style={{
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
    <nav ref={navRef} style={{
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
          {/* Dropdown groups (Dashboard group is first) */}
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

          {/* Alerts dropdown */}
          {user?.email && <AlertsMenu />}

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
          {user?.email && <AlertsMenu />}
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
          {/* Groups (Dashboard group is first, contains Overview + Alerts) */}
          {GROUPS.map(g => {
            const visibleItems = g.items.filter(i => canAccess(i.key));
            if (visibleItems.length === 0) return null;
            const expanded = !!mobileExpanded[g.key];
            return (
              <div key={g.key}>
                <button
                  type="button"
                  style={{ ...mobileGroupLabel, background: "transparent", border: "none", width: "100%" }}
                  onClick={() => setMobileExpanded(p => ({ ...p, [g.key]: !p[g.key] }))}>
                  {g.label}
                  <Chevron open={expanded} />
                </button>
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
