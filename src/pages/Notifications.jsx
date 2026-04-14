import React from "react";
import { supabase } from "../supabase";
import { useAuth } from "../auth";

export default function Notifications() {
  const { user, role } = useAuth();
  const [alerts, setAlerts] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [filter, setFilter] = React.useState("all"); // all | unread | read
  const [markingAll, setMarkingAll] = React.useState(false);
  const [updatingId, setUpdatingId] = React.useState("");

  const C = {
    ink:"#111111", slate:"#4a4a4a", dust:"#888888", smoke:"#e8e4dc",
    ivory:"#faf8f4", white:"#ffffff", gold:"#c9a84c",
    ok:"#1a6636", okBg:"#edf7ee",
    warn:"#92560a", warnBg:"#fef8ec",
    err:"#9b1c1c", errBg:"#fef2f2",
    info:"#1e3a5f", infoBg:"#eff6ff",
  };

  const fetchAlerts = React.useCallback(async () => {
    if (!user?.email) return;
    try {
      const { data, error } = await supabase
        .from("alerts")
        .select("id, title, message, audience_role, audience_email, source_type, level, status, created_at, read_at")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      const email = (user.email || "").toLowerCase();
      const visible = (data || []).filter(item => {
        if (role === "admin") return true;
        return (item.audience_email || "").toLowerCase() === email || item.audience_role === role;
      });
      setAlerts(visible);
    } catch (_err) {
      setAlerts([]);
    } finally {
      setLoading(false);
    }
  }, [user?.email, role]);

  React.useEffect(() => {
    setLoading(true);
    fetchAlerts();
    const ch = supabase
      .channel(`notifications-${(user?.email || "").toLowerCase()}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "alerts" }, fetchAlerts)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [fetchAlerts, user?.email]);

  const markRead = async (id) => {
    setUpdatingId(id);
    try {
      const { error } = await supabase
        .from("alerts")
        .update({ status: "read", read_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
      setAlerts(prev => prev.map(a => a.id === id ? { ...a, status: "read", read_at: new Date().toISOString() } : a));
    } finally {
      setUpdatingId("");
    }
  };

  const markAllRead = async () => {
    const unread = alerts.filter(a => a.status !== "read");
    if (!unread.length) return;
    setMarkingAll(true);
    try {
      const ids = unread.map(a => a.id);
      const { error } = await supabase
        .from("alerts")
        .update({ status: "read", read_at: new Date().toISOString() })
        .in("id", ids);
      if (error) throw error;
      setAlerts(prev => prev.map(a => ids.includes(a.id) ? { ...a, status: "read", read_at: new Date().toISOString() } : a));
    } finally {
      setMarkingAll(false);
    }
  };

  const lvlPalette = {
    info:    [C.infoBg, C.info],
    success: [C.okBg,   C.ok],
    warning: [C.warnBg, C.warn],
    error:   [C.errBg,  C.err],
  };

  const filtered = alerts.filter(a => {
    if (filter === "unread") return a.status !== "read";
    if (filter === "read")   return a.status === "read";
    return true;
  });

  const unreadCount = alerts.filter(a => a.status !== "read").length;

  const tabBtn = (key, label, count) => (
    <button
      key={key}
      onClick={() => setFilter(key)}
      style={{
        padding: "8px 16px", border: "none", borderRadius: 8, cursor: "pointer",
        fontSize: 12, fontWeight: 600, letterSpacing: "0.07em", textTransform: "uppercase",
        fontFamily: "'Inter',sans-serif",
        background: filter === key ? C.ink : "transparent",
        color: filter === key ? C.white : C.dust,
        transition: "all 0.18s ease",
      }}
    >
      {label}{count > 0 && ` (${count})`}
    </button>
  );

  return (
    <div style={{ padding: "32px 24px", maxWidth: 820, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap", marginBottom: 8 }}>
        <div>
          <h1 style={{ fontFamily: "'Cormorant Garamond',Georgia,serif", fontSize: "clamp(26px,4vw,38px)", fontWeight: 500, color: C.ink, letterSpacing: "-0.02em", margin: 0 }}>
            Notifications
          </h1>
          <p style={{ color: C.dust, fontSize: 13, marginTop: 4 }}>
            {unreadCount > 0 ? `${unreadCount} unread` : "All caught up"}
          </p>
        </div>
        {unreadCount > 0 && (
          <button
            onClick={markAllRead}
            disabled={markingAll}
            style={{
              padding: "10px 18px", background: C.ink, color: C.white, border: "none",
              borderRadius: 8, fontSize: 12, fontWeight: 600, letterSpacing: "0.07em",
              textTransform: "uppercase", cursor: markingAll ? "not-allowed" : "pointer",
              fontFamily: "'Inter',sans-serif", opacity: markingAll ? 0.6 : 1,
            }}
          >
            {markingAll ? "Marking…" : "Mark All Read"}
          </button>
        )}
      </div>

      {/* Filter tabs */}
      <div style={{ display: "flex", gap: 4, marginBottom: 24, background: C.ivory, padding: 4, borderRadius: 10, width: "fit-content" }}>
        {tabBtn("all", "All", alerts.length)}
        {tabBtn("unread", "Unread", unreadCount)}
        {tabBtn("read", "Read", alerts.length - unreadCount)}
      </div>

      {loading && <p style={{ color: C.dust }}>Loading notifications…</p>}
      {!loading && filtered.length === 0 && (
        <div style={{ textAlign: "center", padding: "60px 24px" }}>
          <p style={{ fontFamily: "'Cormorant Garamond',Georgia,serif", fontSize: 24, color: C.ink, marginBottom: 8 }}>
            {filter === "unread" ? "No unread notifications" : "No notifications yet"}
          </p>
          <p style={{ color: C.dust, fontSize: 13 }}>
            {filter === "unread" ? "You're all caught up." : "Notifications will appear here when there is activity."}
          </p>
        </div>
      )}

      {!loading && filtered.map(item => {
        const [bg, fg] = lvlPalette[item.level] || [C.ivory, C.slate];
        const isRead = item.status === "read";
        return (
          <div
            key={item.id}
            style={{
              background: isRead ? C.ivory : C.white,
              border: `1px solid ${isRead ? C.smoke : "rgba(17,17,17,0.12)"}`,
              borderRadius: 12,
              padding: "16px 18px",
              marginBottom: 10,
              boxShadow: isRead ? "none" : "0 1px 4px rgba(17,17,17,0.05)",
              transition: "all 0.2s ease",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
                  {!isRead && (
                    <span style={{ width: 7, height: 7, borderRadius: "50%", background: C.err, flexShrink: 0, display: "inline-block" }} />
                  )}
                  <p style={{ margin: 0, fontWeight: 600, fontSize: 14, color: C.ink }}>{item.title}</p>
                  <span style={{ padding: "2px 8px", borderRadius: 99, background: bg, color: fg, fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>
                    {item.level || "info"}
                  </span>
                </div>
                {item.message && (
                  <p style={{ margin: "4px 0 6px", color: C.slate, fontSize: 13, lineHeight: 1.6 }}>{item.message}</p>
                )}
                <p style={{ margin: 0, color: C.dust, fontSize: 11 }}>
                  {new Date(item.created_at).toLocaleString()}
                  {item.audience_role && <span style={{ marginLeft: 8, textTransform: "uppercase", letterSpacing: "0.06em" }}>· {item.audience_role}</span>}
                  {isRead && item.read_at && <span style={{ marginLeft: 8 }}>· Read {new Date(item.read_at).toLocaleTimeString()}</span>}
                </p>
              </div>
              {!isRead && (
                <button
                  onClick={() => markRead(item.id)}
                  disabled={updatingId === item.id}
                  style={{
                    padding: "7px 13px", background: "transparent", color: C.slate,
                    border: `1px solid ${C.smoke}`, borderRadius: 7, fontSize: 11, fontWeight: 600,
                    letterSpacing: "0.06em", textTransform: "uppercase", cursor: updatingId === item.id ? "not-allowed" : "pointer",
                    fontFamily: "'Inter',sans-serif", flexShrink: 0, opacity: updatingId === item.id ? 0.5 : 1,
                    transition: "all 0.18s ease",
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = C.ivory; e.currentTarget.style.borderColor = C.ink; e.currentTarget.style.color = C.ink; }}
                  onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.borderColor = C.smoke; e.currentTarget.style.color = C.slate; }}
                >
                  {updatingId === item.id ? "…" : "Mark Read"}
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
