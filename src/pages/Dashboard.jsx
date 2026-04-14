import React from "react";
import { supabase } from "../supabase";
import { useAuth } from "../auth";
import { DEFAULT_ROLE_BY_EMAIL, runAuthenticatedCurrentDataSync } from "../utils";
import { MetricCard } from "../analyticsUtils";

export default function Dashboard() {
  const { user, logout, role, roleByEmail } = useAuth();
  const [models, setModels] = React.useState([]);
  const [bookings, setBookings] = React.useState([]);
  const [clients, setClients] = React.useState([]);
  const [members, setMembers] = React.useState([]);
  const [opsTasks, setOpsTasks] = React.useState([]);
  const [alerts, setAlerts] = React.useState([]);
  const [calendarEvents, setCalendarEvents] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const [tasksTableReady, setTasksTableReady] = React.useState(true);
  const [alertsTableReady, setAlertsTableReady] = React.useState(true);
  const [eventsTableReady, setEventsTableReady] = React.useState(true);
  const [syncingTasks, setSyncingTasks] = React.useState(false);
  const [currentDataSyncState, setCurrentDataSyncState] = React.useState({ loading: false, message: "", error: false, syncedAt: "" });
  const [savingEvent, setSavingEvent] = React.useState(false);
  const [updatingAlertId, setUpdatingAlertId] = React.useState("");
  const [eventForm, setEventForm] = React.useState({
    title: "",
    event_at: "",
    event_type: "internal",
    notes: "",
  });

  const DASHBOARD_SETUP_SQL = `-- Run this in your Supabase SQL Editor:
create table if not exists public.ops_tasks (
  id uuid primary key default gen_random_uuid(),
  task_key text unique not null,
  title text not null,
  description text default '',
  role text not null default 'admin',
  assigned_email text,
  source_type text default 'manual',
  source_id text default '',
  status text not null default 'pending',
  due_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.calendar_events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  event_at timestamptz not null,
  event_type text not null default 'internal',
  notes text default '',
  created_by text,
  created_at timestamptz default now()
);

create table if not exists public.alerts (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  message text default '',
  audience_role text,
  audience_email text,
  source_type text default 'system',
  source_id text default '',
  level text not null default 'info',
  status text not null default 'unread',
  created_at timestamptz default now(),
  read_at timestamptz
);

create index if not exists idx_ops_tasks_assigned_email on public.ops_tasks(assigned_email);
create index if not exists idx_ops_tasks_status on public.ops_tasks(status);
create index if not exists idx_calendar_events_event_at on public.calendar_events(event_at);
create index if not exists idx_alerts_audience_role on public.alerts(audience_role);
create index if not exists idx_alerts_audience_email on public.alerts(audience_email);
create index if not exists idx_alerts_status on public.alerts(status);
create index if not exists idx_alerts_created_at on public.alerts(created_at desc);

alter table public.ops_tasks disable row level security;
alter table public.calendar_events disable row level security;
alter table public.alerts disable row level security;`;

  const isTableMissingError = (err) =>
    err?.code === "42P01" ||
    err?.code === "42501" ||
    err?.message?.toLowerCase().includes("does not exist") ||
    err?.message?.toLowerCase().includes("relation") ||
    err?.message?.toLowerCase().includes("permission") ||
    err?.message?.toLowerCase().includes("policy") ||
    err?.message?.toLowerCase().includes("rls");

  const fallbackMembers = React.useMemo(
    () =>
      Object.entries(DEFAULT_ROLE_BY_EMAIL).map(([email, roleName]) => ({
        id: email,
        email,
        role: roleName,
        is_active: true,
      })),
    []
  );

  const activeMembers = (members.length ? members : fallbackMembers).filter(
    (m) => m.is_active !== false
  );

  const assigneeByRole = React.useMemo(() => {
    const fromMembers = {};
    ["admin", "va", "agent"].forEach((r) => {
      const matched = activeMembers.find((m) => (m.role || "") === r);
      fromMembers[r] = matched?.email || "";
    });

    const fromRoleByEmail = {};
    Object.entries(roleByEmail || {}).forEach(([email, roleName]) => {
      if (!["admin", "va", "agent"].includes(roleName)) return;
      if (!fromRoleByEmail[roleName]) fromRoleByEmail[roleName] = email;
    });

    return {
      admin: fromMembers.admin || fromRoleByEmail.admin || "",
      va: fromMembers.va || fromRoleByEmail.va || "",
      agent: fromMembers.agent || fromRoleByEmail.agent || "",
    };
  }, [activeMembers, roleByEmail]);

  const buildIntakeTasks = React.useCallback(() => {
    const tasks = [];

    models
      .filter((m) => (m.status || "pending") === "pending")
      .forEach((model) => {
        tasks.push({
          task_key: `model-review-${model.id}`,
          title: `Review model submission: ${model.name || "Unnamed"}`,
          description: "New model submission requires review and decision.",
          role: "agent",
          assigned_email: assigneeByRole.agent || null,
          source_type: "model",
          source_id: String(model.id),
          status: "pending",
          due_at: model.submitted_at || model.created_at || new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
      });

    bookings
      .filter((b) => (b.status || "pending") === "pending")
      .forEach((booking) => {
        tasks.push({
          task_key: `booking-confirm-${booking.id}`,
          title: `Confirm booking request: ${booking.name || "Unknown"}`,
          description: "New booking request requires follow-up and confirmation.",
          role: "va",
          assigned_email: assigneeByRole.va || null,
          source_type: "booking",
          source_id: String(booking.id),
          status: "pending",
          due_at: booking.preferred_date || booking.created_at || new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
      });

    clients
      .filter((c) => (c.status || "").toLowerCase() === "lead")
      .forEach((client) => {
        tasks.push({
          task_key: `client-onboard-${client.id}`,
          title: `Qualify new client lead: ${client.name || "Unnamed"}`,
          description: "New lead in client list needs onboarding decision.",
          role: "admin",
          assigned_email: assigneeByRole.admin || null,
          source_type: "client",
          source_id: String(client.id),
          status: "pending",
          due_at: client.created_at || new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
      });

    return tasks;
  }, [models, bookings, clients, assigneeByRole]);

  const fetchMembers = React.useCallback(async () => {
    try {
      const { data, error: membersError } = await supabase
        .from("users")
        .select("id, email, role, is_active")
        .order("created_at", { ascending: false });

      if (membersError) throw membersError;
      setMembers(data || []);
    } catch (_err) {
      setMembers(fallbackMembers);
    }
  }, [fallbackMembers]);

  const fetchOpsAndEvents = React.useCallback(async () => {
    try {
      const tasksResp = await supabase
        .from("ops_tasks")
        .select("id, task_key, title, description, role, assigned_email, source_type, source_id, status, due_at, created_at, updated_at")
        .order("created_at", { ascending: false })
        .limit(200);

      if (tasksResp.error) throw tasksResp.error;
      setTasksTableReady(true);
      setOpsTasks(tasksResp.data || []);
    } catch (err) {
      if (isTableMissingError(err)) {
        setTasksTableReady(false);
        setOpsTasks([]);
      }
    }

    try {
      const eventsResp = await supabase
        .from("calendar_events")
        .select("id, title, event_at, event_type, notes, created_by, created_at")
        .order("event_at", { ascending: true })
        .limit(100);

      if (eventsResp.error) throw eventsResp.error;
      setEventsTableReady(true);
      setCalendarEvents(eventsResp.data || []);
    } catch (err) {
      if (isTableMissingError(err)) {
        setEventsTableReady(false);
        setCalendarEvents([]);
      }
    }

    try {
      const alertsResp = await supabase
        .from("alerts")
        .select("id, title, message, audience_role, audience_email, source_type, source_id, level, status, created_at, read_at")
        .order("created_at", { ascending: false })
        .limit(100);

      if (alertsResp.error) throw alertsResp.error;
      setAlertsTableReady(true);
      setAlerts(alertsResp.data || []);
    } catch (err) {
      if (isTableMissingError(err)) {
        setAlertsTableReady(false);
        setAlerts([]);
      }
    }
  }, []);

  const fetchOverview = React.useCallback(async () => {
    try {
      setError("");
      setLoading(true);

      const [modelsRes, bookingsRes, clientsRes] = await Promise.all([
        supabase.from("models").select("*").order("submitted_at", { ascending: false }),
        supabase.from("bookings").select("*").order("created_at", { ascending: false }),
        supabase.from("clients").select("*").order("created_at", { ascending: false }),
      ]);

      if (modelsRes.error) throw modelsRes.error;
      if (bookingsRes.error) throw bookingsRes.error;
      if (clientsRes.error) throw clientsRes.error;

      setModels(modelsRes.data || []);
      setBookings(bookingsRes.data || []);
      setClients(clientsRes.data || []);
    } catch (err) {
      setError(err.message || "Failed to load dashboard overview");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    const init = async () => {
      await Promise.all([fetchOverview(), fetchMembers()]);
      await fetchOpsAndEvents();
    };
    init();
  }, [fetchOverview, fetchMembers, fetchOpsAndEvents]);

  const syncIncomingTasks = React.useCallback(async () => {
    if (!tasksTableReady) return;

    setSyncingTasks(true);
    try {
      const generated = buildIntakeTasks();
      if (generated.length > 0) {
        const { error: upsertError } = await supabase
          .from("ops_tasks")
          .upsert(generated, { onConflict: "task_key" });

        if (upsertError) throw upsertError;
      }

      await fetchOpsAndEvents();
    } catch (err) {
      alert(err.message || "Failed to sync intake tasks");
    } finally {
      setSyncingTasks(false);
    }
  }, [tasksTableReady, buildIntakeTasks, fetchOpsAndEvents]);

  React.useEffect(() => {
    if (!tasksTableReady) return;
    if (models.length === 0 && bookings.length === 0 && clients.length === 0) return;
    if (opsTasks.length > 0) return;
    syncIncomingTasks();
  }, [tasksTableReady]); // eslint-disable-line react-hooks/exhaustive-deps

  const updateTaskStatus = async (taskId, status) => {
    try {
      const { error: updateError } = await supabase
        .from("ops_tasks")
        .update({ status, updated_at: new Date().toISOString() })
        .eq("id", taskId);
      if (updateError) throw updateError;
      setOpsTasks((prev) =>
        prev.map((task) => (task.id === taskId ? { ...task, status, updated_at: new Date().toISOString() } : task))
      );
    } catch (err) {
      alert(err.message || "Failed to update task status");
    }
  };

  const addCalendarEvent = async (e) => {
    e.preventDefault();
    if (!eventsTableReady) return;

    if (!eventForm.title.trim() || !eventForm.event_at) {
      alert("Title and date/time are required");
      return;
    }

    setSavingEvent(true);
    try {
      const payload = {
        title: eventForm.title.trim(),
        event_at: new Date(eventForm.event_at).toISOString(),
        event_type: eventForm.event_type,
        notes: eventForm.notes.trim(),
        created_by: (user?.email || "").toLowerCase(),
      };
      const { error: insertError } = await supabase.from("calendar_events").insert([payload]);
      if (insertError) throw insertError;

      setEventForm({ title: "", event_at: "", event_type: "internal", notes: "" });
      await fetchOpsAndEvents();
    } catch (err) {
      alert(err.message || "Failed to save calendar event");
    } finally {
      setSavingEvent(false);
    }
  };

  const runCurrentDataSync = async () => {
    setCurrentDataSyncState({ loading: true, message: "Syncing current app data...", error: false });

    try {
      const json = await runAuthenticatedCurrentDataSync();
      await fetchOverview();
      await fetchOpsAndEvents();

      setCurrentDataSyncState({
        loading: false,
        error: false,
        syncedAt: json.synced_at || "",
        message: `Sync complete. Models: ${json.models_count}, bookings: ${json.bookings_count}, clients: ${json.clients_count}, leads: ${json.leads_count}, enrollments: ${json.enrollments_count}, tasks synced: ${json.tasks_synced}.`,
      });
    } catch (err) {
      setCurrentDataSyncState({
        loading: false,
        error: true,
        syncedAt: "",
        message: err.message || "Sync failed",
      });
    }
  };

  const userEmail = (user?.email || "").toLowerCase();
  const canManageAllTasks = role === "admin";
  const alertsForViewer = alerts.filter((item) => {
    if (canManageAllTasks) return true;
    const audienceEmail = (item.audience_email || "").toLowerCase();
    return audienceEmail === userEmail || item.audience_role === role;
  });
  const unreadAlerts = alertsForViewer.filter((item) => item.status !== "read").length;

  const taskListForViewer = opsTasks.filter((task) => {
    if (canManageAllTasks) return true;
    const assigned = (task.assigned_email || "").toLowerCase();
    return assigned === userEmail || task.role === role;
  });

  const taskStatusColor = { pending: "#ff9800", in_progress: "#2196f3", done: "#4caf50" };
  const alertLevelColor = { info: "#455a64", success: "#2e7d32", warning: "#ef6c00", error: "#c62828" };

  const taskSummary = {
    pending: opsTasks.filter((t) => t.status === "pending").length,
    done: opsTasks.filter((t) => t.status === "done").length,
  };

  const markAlertRead = async (alertId) => {
    if (!alertsTableReady) return;

    setUpdatingAlertId(alertId);
    try {
      const { error: updateError } = await supabase
        .from("alerts")
        .update({ status: "read", read_at: new Date().toISOString() })
        .eq("id", alertId);
      if (updateError) throw updateError;

      setAlerts((prev) =>
        prev.map((item) =>
          item.id === alertId ? { ...item, status: "read", read_at: new Date().toISOString() } : item
        )
      );
    } catch (err) {
      alert(err.message || "Failed to mark alert as read");
    } finally {
      setUpdatingAlertId("");
    }
  };

  const userProgress = activeMembers.map((member) => {
    const email = (member.email || "").toLowerCase();
    const assigned = opsTasks.filter((task) => (task.assigned_email || "").toLowerCase() === email);
    const completed = assigned.filter((task) => task.status === "done").length;
    const pct = assigned.length ? Math.round((completed / assigned.length) * 100) : 0;
    return { email: member.email, role: member.role, completed, total: assigned.length, pct };
  });

  const recentModels = models.slice(0, 5);
  const upcomingBookings = bookings.filter((b) => b.preferred_date).slice(0, 5);
  const nextPendingModel = models.find((m) => m.status === "pending");
  const nextPendingBooking = bookings.find((b) => b.status === "pending");

  const bookingCalendarEvents = bookings
    .filter((b) => b.preferred_date)
    .map((b) => ({
      id: `booking-${b.id}`,
      title: `Booking: ${b.name}`,
      event_at: b.preferred_date,
      event_type: "booking",
      notes: b.service_type || "",
    }));

  const mergedCalendar = [...calendarEvents, ...bookingCalendarEvents]
    .sort((a, b) => new Date(a.event_at).getTime() - new Date(b.event_at).getTime())
    .slice(0, 20);

  // luxury style helpers (inline, no import needed)
  const C = { ink:"#111111", slate:"#4a4a4a", dust:"#888888", smoke:"#e8e4dc", ivory:"#faf8f4", canvas:"#f5f2ec", white:"#ffffff", gold:"#c9a84c", err:"#9b1c1c", errBg:"#fef2f2", warn:"#92560a", warnBg:"#fef8ec", info:"#1e3a5f", infoBg:"#eff6ff", ok:"#1a6636", okBg:"#edf7ee" };
  const card = { background:C.white, border:`1px solid ${C.smoke}`, borderRadius:12, padding:24, marginBottom:20, boxShadow:"0 1px 4px rgba(17,17,17,0.05)" };
  const cardH = { fontFamily:"'Cormorant Garamond',Georgia,serif", fontSize:20, fontWeight:500, color:C.ink, marginBottom:12, marginTop:0 };
  const inp2 = { padding:"11px 13px", fontSize:13, color:C.ink, background:C.white, border:`1px solid ${C.smoke}`, borderRadius:8, outline:"none", fontFamily:"'Inter',sans-serif", width:"100%", boxSizing:"border-box" };
  const btn = (bg=C.ink,clr=C.white,extra={}) => ({ padding:"10px 18px", background:bg, color:clr, border:"none", borderRadius:8, fontSize:12, fontWeight:600, letterSpacing:"0.07em", textTransform:"uppercase", cursor:"pointer", fontFamily:"'Inter',sans-serif", ...extra });

  return (
    <div style={{ padding:"32px 24px", maxWidth:1200, margin:"0 auto" }}>
      {/* Header */}
      <div style={{ marginBottom:28 }}>
        <h1 style={{ fontFamily:"'Cormorant Garamond',Georgia,serif", fontSize:"clamp(26px,4vw,38px)", fontWeight:500, color:C.ink, letterSpacing:"-0.02em", margin:0 }}>
          Central Operations
        </h1>
        <p style={{ color:C.dust, marginTop:6, fontSize:13 }}>
          {user?.email || "Unknown user"} · <span style={{ textTransform:"uppercase", letterSpacing:"0.06em", fontSize:11 }}>{role}</span>
          {!!currentDataSyncState.syncedAt && (
            <span style={{ marginLeft:12, color:"#1a6636" }}>✓ synced {new Date(currentDataSyncState.syncedAt).toLocaleTimeString()}</span>
          )}
        </p>
      </div>
      {loading && <p style={{ color:C.dust }}>Loading dashboard…</p>}
      {error && <p style={{ color:C.err }}>{error}</p>}
      {!!currentDataSyncState.syncedAt && (
        <p style={{ color: "#2e7d32", marginTop: 4, fontSize: 13 }}>
          Last current-data sync: {new Date(currentDataSyncState.syncedAt).toLocaleString()}
        </p>
      )}
      {/* Metric Grid */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))", gap:14, marginBottom:28 }}>
        {[
          { label:"Models",        value:models.length },
          { label:"Bookings",      value:bookings.length },
          { label:"Clients",       value:clients.length },
          { label:"Tasks Pending", value:taskSummary.pending },
          { label:"Tasks Done",    value:taskSummary.done },
          { label:"Unread Alerts", value:unreadAlerts },
        ].map(m => (
          <div key={m.label} style={{ background:C.white, border:`1px solid ${C.smoke}`, borderRadius:12, padding:20, boxShadow:"0 1px 4px rgba(17,17,17,0.04)" }}>
            <p style={{ margin:"0 0 6px", fontSize:11, fontWeight:600, letterSpacing:"0.1em", textTransform:"uppercase", color:C.dust }}>{m.label}</p>
            <p style={{ margin:0, fontFamily:"'Cormorant Garamond',Georgia,serif", fontSize:34, fontWeight:500, color:C.ink, lineHeight:1 }}>{m.value}</p>
          </div>
        ))}
      </div>

      {/* Setup Banner */}
      {(!tasksTableReady || !eventsTableReady || !alertsTableReady) && (
        <div style={{ background:C.warnBg, border:`1px solid rgba(146,86,10,0.2)`, borderRadius:12, padding:"18px 22px", marginBottom:24 }}>
          <p style={{ margin:"0 0 6px", fontWeight:600, color:C.warn, fontSize:14 }}>Dashboard setup required</p>
          <p style={{ margin:"0 0 10px", color:C.slate, fontSize:13 }}>
            Task tracking, alerts, and custom calendar events need one-time table setup. Run this SQL in the{" "}
            <a href="https://supabase.com/dashboard/project/jjmmakbnjzzxbuflucck/sql" target="_blank" rel="noreferrer" style={{ color:C.ink, textDecoration:"underline" }}>Supabase SQL Editor</a>.
          </p>
          <pre style={{ background:C.ivory, border:`1px solid ${C.smoke}`, padding:"12px 14px", borderRadius:8, fontSize:11, overflowX:"auto", whiteSpace:"pre-wrap", color:C.slate, maxHeight:200, overflow:"auto" }}>{DASHBOARD_SETUP_SQL}</pre>
          <button onClick={()=>navigator.clipboard.writeText(DASHBOARD_SETUP_SQL)} style={btn(C.ink,C.white,{marginTop:10})}>Copy SQL</button>
        </div>
      )}

      {/* Quick Actions */}
      <div style={{ ...card, marginBottom:24 }}>
        <h2 style={cardH}>Quick Actions</h2>
        <div style={{ display:"flex", gap:10, flexWrap:"wrap", alignItems:"flex-start" }}>
          {role === "admin" && (
            <div>
              <button onClick={runCurrentDataSync} disabled={currentDataSyncState.loading} style={btn(C.ink,C.white,{opacity:currentDataSyncState.loading?0.55:1,cursor:currentDataSyncState.loading?"not-allowed":"pointer"})}>
                {currentDataSyncState.loading ? "Syncing…" : "Run Current Data Sync"}
              </button>
              {currentDataSyncState.message && (
                <p style={{ marginTop:8, color:currentDataSyncState.error?C.err:C.dust, fontSize:13, lineHeight:1.5, margin:"8px 0 0" }}>{currentDataSyncState.message}</p>
              )}
            </div>
          )}
          {(role === "admin" || role === "agent") && nextPendingModel && (
            <button
              onClick={async () => { const { error } = await supabase.from("models").update({ status:"approved" }).eq("id", nextPendingModel.id); if (!error) setModels(prev=>prev.map(m=>m.id===nextPendingModel.id?{...m,status:"approved"}:m)); }}
              style={btn(C.okBg,C.ok)}
            >Approve {nextPendingModel.name}</button>
          )}
          {(role === "admin" || role === "va") && nextPendingBooking && (
            <button
              onClick={async () => { const { error } = await supabase.from("bookings").update({ status:"confirmed" }).eq("id", nextPendingBooking.id); if (!error) setBookings(prev=>prev.map(b=>b.id===nextPendingBooking.id?{...b,status:"confirmed"}:b)); }}
              style={btn(C.infoBg,C.info)}
            >Confirm Booking: {nextPendingBooking.name}</button>
          )}
        </div>
      </div>

      {/* Content Grid */}
      <div style={{ display:"grid", gap:20 }}>

        {/* Alerts */}
        <div style={card}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", flexWrap:"wrap", gap:8, marginBottom:12 }}>
            <h3 style={cardH}>Alerts</h3>
            <span style={{ color:C.dust, fontSize:12, letterSpacing:"0.06em", textTransform:"uppercase" }}>{unreadAlerts} unread</span>
          </div>
          <p style={{ color:C.dust, fontSize:13, marginBottom:12, lineHeight:1.6 }}>Internal alerts for admins and team members.</p>
          {!alertsTableReady && <p style={{ color:C.dust, fontSize:13 }}>Run the dashboard setup SQL above to enable alerts.</p>}
          {alertsTableReady && alertsForViewer.length === 0 && <p style={{ color:C.dust, fontSize:13 }}>No alerts yet.</p>}
          {alertsForViewer.slice(0,10).map(item => {
            const lvlColor = { info:[C.infoBg,C.info], success:[C.okBg,C.ok], warning:[C.warnBg,C.warn], error:[C.errBg,C.err] }[item.level] || [C.ivory,C.slate];
            return (
              <div key={item.id} style={{ border:`1px solid ${C.smoke}`, borderRadius:10, padding:"12px 14px", marginBottom:10, background:item.status==="read"?C.ivory:C.white }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", gap:8, flexWrap:"wrap", marginBottom:4 }}>
                  <p style={{ margin:0, fontWeight:600, fontSize:14, color:C.ink }}>{item.title}</p>
                  <span style={{ padding:"3px 10px", borderRadius:99, background:lvlColor[0], color:lvlColor[1], fontSize:11, fontWeight:600, letterSpacing:"0.06em", textTransform:"uppercase" }}>{item.level||"info"}</span>
                </div>
                <p style={{ margin:"4px 0 8px", color:C.slate, fontSize:13, lineHeight:1.6 }}>{item.message||"No details provided."}</p>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", gap:8, flexWrap:"wrap" }}>
                  <p style={{ margin:0, color:C.dust, fontSize:11 }}>{new Date(item.created_at).toLocaleString()}</p>
                  {item.status !== "read" && (
                    <button onClick={()=>markAlertRead(item.id)} disabled={updatingAlertId===item.id} style={btn(C.ink,C.white,{padding:"6px 12px",fontSize:11,opacity:updatingAlertId===item.id?0.55:1,cursor:updatingAlertId===item.id?"not-allowed":"pointer"})}>
                      {updatingAlertId===item.id?"…":"Mark Read"}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Tasks */}
        <div style={card}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", flexWrap:"wrap", gap:8, marginBottom:12 }}>
            <h3 style={cardH}>Role-Based Intake Tasks</h3>
            <button onClick={syncIncomingTasks} disabled={!tasksTableReady||syncingTasks} style={btn(C.ink,C.white,{opacity:(!tasksTableReady||syncingTasks)?0.55:1,cursor:(!tasksTableReady||syncingTasks)?"not-allowed":"pointer",padding:"8px 14px"})}>
              {syncingTasks ? "Syncing…" : "Sync Tasks"}
            </button>
          </div>
          <p style={{ color:C.dust, fontSize:13, marginBottom:12, lineHeight:1.6 }}>Pending models → Agent. Pending bookings → VA. Client leads → Admin.</p>
          {taskListForViewer.length === 0 && <p style={{ color:C.dust, fontSize:13 }}>No tasks assigned yet.</p>}
          {taskListForViewer.slice(0,12).map(task => {
            const assigned = (task.assigned_email||"unassigned").toLowerCase();
            const canEditTask = canManageAllTasks || assigned === userEmail;
            const sColor = { pending:[C.warnBg,C.warn], in_progress:[C.infoBg,C.info], done:[C.okBg,C.ok] }[task.status] || [C.ivory,C.slate];
            return (
              <div key={task.id} style={{ border:`1px solid ${C.smoke}`, borderRadius:10, padding:"12px 14px", marginBottom:10 }}>
                <p style={{ margin:"0 0 4px", fontWeight:600, fontSize:14, color:C.ink }}>{task.title}</p>
                <p style={{ margin:"0 0 8px", color:C.dust, fontSize:12 }}>Role: {task.role} · Assigned: {task.assigned_email||"Unassigned"}</p>
                <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap" }}>
                  <span style={{ padding:"3px 10px", borderRadius:99, background:sColor[0], color:sColor[1], fontSize:11, fontWeight:600, letterSpacing:"0.06em", textTransform:"uppercase" }}>{task.status||"pending"}</span>
                  <select value={task.status||"pending"} onChange={(e)=>updateTaskStatus(task.id,e.target.value)} disabled={!canEditTask||!tasksTableReady}
                    style={{ padding:"6px 10px", border:`1px solid ${C.smoke}`, borderRadius:6, fontSize:12, color:C.slate, background:C.white, outline:"none", cursor:canEditTask?"pointer":"not-allowed" }}>
                    <option value="pending">Pending</option>
                    <option value="in_progress">In Progress</option>
                    <option value="done">Done</option>
                  </select>
                </div>
              </div>
            );
          })}
        </div>

        {/* Team Progress */}
        <div style={card}>
          <h3 style={cardH}>Team Task Completion</h3>
          {userProgress.length === 0 && <p style={{ color:C.dust, fontSize:13 }}>No team members available.</p>}
          {userProgress.map(row => (
            <div key={row.email} style={{ marginBottom:14 }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:5 }}>
                <p style={{ margin:0, fontSize:13, fontWeight:600, color:C.ink }}>{row.email} <span style={{ color:C.dust, fontSize:11, fontWeight:400 }}>({row.role||"user"})</span></p>
                <span style={{ color:C.dust, fontSize:12 }}>{row.completed}/{row.total}</span>
              </div>
              <div style={{ height:6, background:C.smoke, borderRadius:99, overflow:"hidden" }}>
                <div style={{ width:`${row.pct}%`, height:"100%", borderRadius:99, background:row.pct>=70?"#1a6636":"#c9a84c", transition:"width 0.4s ease" }} />
              </div>
            </div>
          ))}
        </div>

        {/* Calendar */}
        <div style={card}>
          <h3 style={cardH}>Calendar & Events</h3>
          {eventsTableReady && (
            <form onSubmit={addCalendarEvent} style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:16 }}>
              <input placeholder="Event title" value={eventForm.title} onChange={(e)=>setEventForm(p=>({...p,title:e.target.value}))} style={{...inp2,gridColumn:"1/-1"}} />
              <input type="datetime-local" value={eventForm.event_at} onChange={(e)=>setEventForm(p=>({...p,event_at:e.target.value}))} style={inp2} />
              <select value={eventForm.event_type} onChange={(e)=>setEventForm(p=>({...p,event_type:e.target.value}))} style={{ ...inp2, appearance:"none" }}>
                <option value="internal">Internal</option>
                <option value="shoot">Shoot</option>
                <option value="meeting">Meeting</option>
                <option value="deadline">Deadline</option>
              </select>
              <input placeholder="Notes (optional)" value={eventForm.notes} onChange={(e)=>setEventForm(p=>({...p,notes:e.target.value}))} style={{...inp2,gridColumn:"1/-1"}} />
              <button type="submit" disabled={savingEvent} style={btn(C.ink,C.white,{gridColumn:"1/-1",opacity:savingEvent?0.55:1,cursor:savingEvent?"not-allowed":"pointer"})}>
                {savingEvent ? "Saving…" : "Add Event"}
              </button>
            </form>
          )}
          {mergedCalendar.length === 0 && <p style={{ color:C.dust, fontSize:13 }}>No upcoming events yet.</p>}
          {mergedCalendar.map(ev => (
            <div key={ev.id} style={{ display:"flex", gap:12, alignItems:"baseline", marginBottom:8, paddingBottom:8, borderBottom:`1px solid ${C.smoke}` }}>
              <span style={{ fontSize:12, color:C.dust, whiteSpace:"nowrap" }}>{new Date(ev.event_at).toLocaleString()}</span>
              <span style={{ fontSize:13, color:C.ink }}>{ev.title}{ev.event_type?` · ${ev.event_type}`:""}</span>
            </div>
          ))}
        </div>

        {/* Two-col bottom */}
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(280px,1fr))", gap:20 }}>
          <div style={card}>
            <h3 style={cardH}>Upcoming Bookings</h3>
            {upcomingBookings.length === 0 && <p style={{ color:C.dust, fontSize:13 }}>No upcoming bookings yet.</p>}
            {upcomingBookings.map(b => (
              <div key={b.id} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"8px 0", borderBottom:`1px solid ${C.smoke}`, gap:8 }}>
                <span style={{ fontSize:13, color:C.ink }}>{b.name}</span>
                <span style={{ fontSize:12, color:C.dust }}>{b.preferred_date}</span>
                <span style={{ fontSize:11, fontWeight:600, letterSpacing:"0.06em", textTransform:"uppercase", color:b.status==="confirmed"?"#1a6636":C.warn }}>{b.status}</span>
              </div>
            ))}
          </div>
          <div style={card}>
            <h3 style={cardH}>Recent Submissions</h3>
            {recentModels.length === 0 && <p style={{ color:C.dust, fontSize:13 }}>No submissions yet.</p>}
            {recentModels.map(m => (
              <div key={m.id} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"8px 0", borderBottom:`1px solid ${C.smoke}`, gap:8 }}>
                <span style={{ fontSize:13, color:C.ink }}>{m.name}</span>
                <span style={{ fontSize:11, fontWeight:600, letterSpacing:"0.06em", textTransform:"uppercase", color:m.status==="approved"?"#1a6636":m.status==="rejected"?C.err:C.warn }}>{m.status}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <button
        onClick={async () => { try { await logout(); window.location.href = "/login"; } catch(err) { alert(err.message||"Failed to logout"); } }}
        style={{ ...btn(C.ivory,C.slate), marginTop:28, border:`1px solid ${C.smoke}` }}
      >
        Sign out
      </button>
    </div>
  );
}
