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

  return (
    <div style={{ padding: 20, maxWidth: 1200, margin: "0 auto" }}>
      <h1>Central Operations Dashboard</h1>
      <p style={{ color: "#666", marginTop: 8 }}>Signed in as: {user?.email || "Unknown user"}</p>
      <p style={{ color: "#666", marginTop: 4 }}>Role: {role}</p>
      {!!currentDataSyncState.syncedAt && (
        <p style={{ color: "#2e7d32", marginTop: 4, fontSize: 13 }}>
          Last current-data sync: {new Date(currentDataSyncState.syncedAt).toLocaleString()}
        </p>
      )}
      {loading && <p style={{ color: "#666" }}>Loading dashboard data...</p>}
      {error && <p style={{ color: "#d32f2f" }}>{error}</p>}

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 20 }}>
        <MetricCard label="Models" value={models.length} color="#333" />
        <MetricCard label="Bookings" value={bookings.length} color="#4caf50" />
        <MetricCard label="Clients" value={clients.length} color="#2196f3" />
        <MetricCard label="Tasks Pending" value={taskSummary.pending} color="#ff9800" />
        <MetricCard label="Tasks Done" value={taskSummary.done} color="#4caf50" />
        <MetricCard label="Unread Alerts" value={unreadAlerts} color="#ef6c00" />
      </div>

      {(!tasksTableReady || !eventsTableReady || !alertsTableReady) && (
        <div style={{ background: "#fff3e0", border: "1px solid #ff9800", borderRadius: 8, padding: 16, marginTop: 18 }}>
          <strong style={{ color: "#e65100" }}>Dashboard setup required</strong>
          <p style={{ margin: "8px 0", color: "#555" }}>
            Task tracking, alerts, and custom calendar events need one-time table setup. Run this SQL in the{" "}
            <a href="https://supabase.com/dashboard/project/jjmmakbnjzzxbuflucck/sql" target="_blank" rel="noreferrer">Supabase SQL Editor</a>.
          </p>
          <pre style={{ background: "#f5f5f5", padding: 12, borderRadius: 6, fontSize: 12, overflowX: "auto", whiteSpace: "pre-wrap" }}>{DASHBOARD_SETUP_SQL}</pre>
          <button
            onClick={() => navigator.clipboard.writeText(DASHBOARD_SETUP_SQL)}
            style={{ marginTop: 8, padding: "8px 14px", background: "#333", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer" }}
          >
            Copy SQL
          </button>
        </div>
      )}

      <div style={{ marginTop: 24, border: "1px solid #e0e0e0", borderRadius: 8, padding: 14 }}>
        <h2>Quick Actions</h2>
        {role === "admin" && (
          <div style={{ marginBottom: 12 }}>
            <button
              onClick={runCurrentDataSync}
              disabled={currentDataSyncState.loading}
              style={{ marginRight: 8, padding: "10px 14px" }}
            >
              {currentDataSyncState.loading ? "Syncing Current Data..." : "Run Current Data Sync"}
            </button>
            {currentDataSyncState.message && (
              <div style={{ marginTop: 8 }}>
                <p style={{ color: currentDataSyncState.error ? "#d32f2f" : "#666", margin: 0 }}>
                  {currentDataSyncState.message}
                </p>
                {!!currentDataSyncState.syncedAt && (
                  <p style={{ color: "#666", margin: "6px 0 0", fontSize: 13 }}>
                    Last sync: {new Date(currentDataSyncState.syncedAt).toLocaleString()}
                  </p>
                )}
              </div>
            )}
          </div>
        )}
        {(role === "admin" || role === "agent") && nextPendingModel && (
          <button
            onClick={async () => {
              const { error } = await supabase.from("models").update({ status: "approved" }).eq("id", nextPendingModel.id);
              if (!error) setModels((prev) => prev.map((m) => m.id === nextPendingModel.id ? { ...m, status: "approved" } : m));
            }}
            style={{ marginRight: 8, padding: "10px 14px" }}
          >
            Approve {nextPendingModel.name}
          </button>
        )}
        {(role === "admin" || role === "va") && nextPendingBooking && (
          <button
            onClick={async () => {
              const { error } = await supabase.from("bookings").update({ status: "confirmed" }).eq("id", nextPendingBooking.id);
              if (!error) setBookings((prev) => prev.map((b) => b.id === nextPendingBooking.id ? { ...b, status: "confirmed" } : b));
            }}
            style={{ padding: "10px 14px" }}
          >
            Confirm Booking ({nextPendingBooking.name})
          </button>
        )}
      </div>

      <div style={{ marginTop: 20, display: "grid", gap: 14 }}>
        <div style={{ border: "1px solid #e0e0e0", borderRadius: 8, padding: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
            <h3 style={{ margin: 0 }}>Alerts</h3>
            <span style={{ color: "#666", fontSize: 13 }}>{unreadAlerts} unread</span>
          </div>
          <p style={{ color: "#666", marginTop: 8 }}>
            Internal alerts for admins and team members. Submission emails continue through the existing email flows.
          </p>
          {!alertsTableReady && <p style={{ color: "#666" }}>Run the dashboard setup SQL above to enable alerts.</p>}
          {alertsTableReady && alertsForViewer.length === 0 && <p style={{ color: "#666" }}>No alerts yet.</p>}
          {alertsForViewer.slice(0, 10).map((item) => (
            <div key={item.id} style={{ border: "1px solid #eee", borderRadius: 6, padding: 10, marginBottom: 8, background: item.status === "read" ? "#fafafa" : "#fff" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <p style={{ margin: 0, fontWeight: 600 }}>{item.title}</p>
                <span style={{ padding: "3px 10px", borderRadius: 12, background: alertLevelColor[item.level] || "#455a64", color: "#fff", fontSize: 12 }}>
                  {item.level || "info"}
                </span>
              </div>
              <p style={{ margin: "6px 0", color: "#666" }}>{item.message || "No details provided."}</p>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <p style={{ margin: 0, color: "#999", fontSize: 12 }}>{new Date(item.created_at).toLocaleString()}</p>
                {item.status !== "read" && (
                  <button
                    onClick={() => markAlertRead(item.id)}
                    disabled={updatingAlertId === item.id}
                    style={{ padding: "6px 10px", border: "none", background: "#333", color: "#fff", borderRadius: 4, cursor: updatingAlertId === item.id ? "not-allowed" : "pointer", opacity: updatingAlertId === item.id ? 0.7 : 1 }}
                  >
                    {updatingAlertId === item.id ? "Updating..." : "Mark Read"}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        <div style={{ border: "1px solid #e0e0e0", borderRadius: 8, padding: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
            <h3 style={{ margin: 0 }}>Role-Based Intake Tasks</h3>
            <button
              onClick={syncIncomingTasks}
              disabled={!tasksTableReady || syncingTasks}
              style={{ padding: "8px 12px", border: "none", background: "#333", color: "#fff", borderRadius: 4, cursor: syncingTasks ? "not-allowed" : "pointer", opacity: syncingTasks ? 0.7 : 1 }}
            >
              {syncingTasks ? "Syncing..." : "Sync Incoming Data to Tasks"}
            </button>
          </div>
          <p style={{ color: "#666", marginTop: 8 }}>
            New pending models create Agent tasks, pending bookings create VA tasks, and client leads create Admin tasks.
          </p>
          {taskListForViewer.length === 0 && <p style={{ color: "#666" }}>No tasks assigned yet.</p>}
          {taskListForViewer.slice(0, 12).map((task) => {
            const assigned = (task.assigned_email || "unassigned").toLowerCase();
            const canEditTask = canManageAllTasks || assigned === userEmail;
            return (
              <div key={task.id} style={{ border: "1px solid #eee", borderRadius: 6, padding: 10, marginBottom: 8 }}>
                <p style={{ margin: 0, fontWeight: 600 }}>{task.title}</p>
                <p style={{ margin: "4px 0", color: "#666", fontSize: 13 }}>
                  Role: {task.role} | Assigned: {task.assigned_email || "Unassigned"}
                </p>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <span style={{ padding: "3px 10px", borderRadius: 12, background: taskStatusColor[task.status] || "#999", color: "#fff", fontSize: 12 }}>
                    {task.status || "pending"}
                  </span>
                  <select
                    value={task.status || "pending"}
                    onChange={(e) => updateTaskStatus(task.id, e.target.value)}
                    disabled={!canEditTask || !tasksTableReady}
                    style={{ padding: 6, border: "1px solid #ccc", borderRadius: 4 }}
                  >
                    <option value="pending">Pending</option>
                    <option value="in_progress">In Progress</option>
                    <option value="done">Done</option>
                  </select>
                </div>
              </div>
            );
          })}
        </div>

        <div style={{ border: "1px solid #e0e0e0", borderRadius: 8, padding: 14 }}>
          <h3 style={{ marginTop: 0 }}>Team Task Completion</h3>
          {userProgress.length === 0 && <p style={{ color: "#666" }}>No team members available.</p>}
          {userProgress.map((row) => (
            <div key={row.email} style={{ marginBottom: 10 }}>
              <p style={{ margin: "0 0 4px 0", fontWeight: 600 }}>
                {row.email} ({row.role || "user"}) - {row.completed}/{row.total} complete
              </p>
              <div style={{ height: 8, background: "#eee", borderRadius: 999, overflow: "hidden" }}>
                <div style={{ width: `${row.pct}%`, height: "100%", background: row.pct >= 70 ? "#4caf50" : "#ff9800" }} />
              </div>
            </div>
          ))}
        </div>

        <div style={{ border: "1px solid #e0e0e0", borderRadius: 8, padding: 14 }}>
          <h3 style={{ marginTop: 0 }}>Calendar &amp; Events</h3>
          {eventsTableReady && (
            <form onSubmit={addCalendarEvent} style={{ display: "grid", gap: 8, marginBottom: 12 }}>
              <input
                placeholder="Event title"
                value={eventForm.title}
                onChange={(e) => setEventForm((prev) => ({ ...prev, title: e.target.value }))}
                style={{ padding: 8, border: "1px solid #ccc", borderRadius: 4 }}
              />
              <input
                type="datetime-local"
                value={eventForm.event_at}
                onChange={(e) => setEventForm((prev) => ({ ...prev, event_at: e.target.value }))}
                style={{ padding: 8, border: "1px solid #ccc", borderRadius: 4 }}
              />
              <select
                value={eventForm.event_type}
                onChange={(e) => setEventForm((prev) => ({ ...prev, event_type: e.target.value }))}
                style={{ padding: 8, border: "1px solid #ccc", borderRadius: 4 }}
              >
                <option value="internal">Internal</option>
                <option value="shoot">Shoot</option>
                <option value="meeting">Meeting</option>
                <option value="deadline">Deadline</option>
              </select>
              <input
                placeholder="Notes (optional)"
                value={eventForm.notes}
                onChange={(e) => setEventForm((prev) => ({ ...prev, notes: e.target.value }))}
                style={{ padding: 8, border: "1px solid #ccc", borderRadius: 4 }}
              />
              <button
                type="submit"
                disabled={savingEvent}
                style={{ width: 160, padding: "8px 10px", border: "none", background: "#333", color: "#fff", borderRadius: 4, cursor: savingEvent ? "not-allowed" : "pointer", opacity: savingEvent ? 0.7 : 1 }}
              >
                {savingEvent ? "Saving..." : "Add Event"}
              </button>
            </form>
          )}
          {mergedCalendar.length === 0 && <p style={{ color: "#666" }}>No upcoming events yet.</p>}
          {mergedCalendar.map((event) => (
            <p key={event.id} style={{ margin: "6px 0", color: "#666" }}>
              <strong>{new Date(event.event_at).toLocaleString()}</strong> - {event.title}
              {event.event_type ? ` (${event.event_type})` : ""}
            </p>
          ))}
        </div>

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
}
