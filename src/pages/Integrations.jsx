import React from "react";
import { supabase } from "../supabase";
import { useAuth } from "../auth";
import { BACKEND_BASE_URL, buildFallbackTasksFromBookings, runAuthenticatedCurrentDataSync } from "../utils";

export default function Integrations() {
  const { role } = useAuth();
  const [bookings, setBookings] = React.useState([]);
  const [zapierStatus, setZapierStatus] = React.useState({ loading: true, configured: false, events: [] });
  const [zapierTestState, setZapierTestState] = React.useState({ loading: false, message: "" });
  const [backendStatus, setBackendStatus] = React.useState({ loading: !!BACKEND_BASE_URL, connected: false });
  const [opsTasks, setOpsTasks] = React.useState([]);
  const [opsTasksSource, setOpsTasksSource] = React.useState("fallback");
  const [manyChatStatus, setManyChatStatus] = React.useState({ loading: true, configured: false, widgetConfigured: false });
  const [currentDataSyncState, setCurrentDataSyncState] = React.useState({ loading: false, message: "", error: false, syncedAt: "" });

  React.useEffect(() => {
    const fetchBookings = async () => {
      const { data } = await supabase.from("bookings").select("*").order("created_at", { ascending: false });
      const list = data || [];
      setBookings(list);
      return list;
    };

    const fetchOpsTasks = async (fallbackBookings) => {
      if (!BACKEND_BASE_URL) {
        setOpsTasks(buildFallbackTasksFromBookings(fallbackBookings));
        setOpsTasksSource("supabase");
        return;
      }

      try {
        const resp = await fetch(`${BACKEND_BASE_URL}/public/tasks`);
        if (!resp.ok) throw new Error("backend tasks unavailable");
        const json = await resp.json();
        setOpsTasks(Array.isArray(json) ? json : []);
        setOpsTasksSource("backend");
      } catch (_err) {
        setOpsTasks(buildFallbackTasksFromBookings(fallbackBookings));
        setOpsTasksSource("supabase");
      }
    };

    const fetchZapierStatus = async () => {
      try {
        const resp = await fetch("/api/zapier/status");
        const json = await resp.json();
        setZapierStatus({ loading: false, ...json });
      } catch (_err) {
        setZapierStatus({ loading: false, configured: false, events: [] });
      }
    };

    const fetchBackendHealth = async () => {
      if (!BACKEND_BASE_URL) {
        setBackendStatus({ loading: false, connected: false, message: "Not configured" });
        return;
      }

      try {
        const resp = await fetch(`${BACKEND_BASE_URL}/health`);
        const json = await resp.json();
        setBackendStatus({ loading: false, connected: !!json?.ok, message: json?.ok ? "Connected" : "Unavailable" });
      } catch (_err) {
        setBackendStatus({ loading: false, connected: false, message: "Unavailable" });
      }
    };

    const init = async () => {
      const [loadedBookings] = await Promise.all([
        fetchBookings(),
        fetchZapierStatus(),
        fetchBackendHealth(),
      ]);
      await fetchOpsTasks(loadedBookings);

      try {
        const resp = await fetch("/api/manychat/status");
        const json = await resp.json();
        setManyChatStatus({ loading: false, ...json });
      } catch (_err) {
        setManyChatStatus({ loading: false, configured: false, widgetConfigured: false });
      }
    };

    init();
  }, []);

  const sendZapierTest = async () => {
    setZapierTestState({ loading: true, message: "Sending test event..." });
    try {
      const resp = await fetch("/api/zapier/forward", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventType: "zapier.test",
          payload: { source: "integrations-page", timestamp: new Date().toISOString() },
        }),
      });

      const json = await resp.json();
      if (!resp.ok || !json.ok) {
        throw new Error(json.error || "Zapier test failed");
      }

      setZapierTestState({ loading: false, message: "Test event sent to Zapier." });
    } catch (err) {
      setZapierTestState({ loading: false, message: err.message || "Zapier test failed" });
    }
  };

  const runCurrentDataSync = async () => {
    setCurrentDataSyncState({ loading: true, message: "Syncing current app data...", error: false });

    try {
      const json = await runAuthenticatedCurrentDataSync();

      setCurrentDataSyncState({
        loading: false,
        error: false,
        syncedAt: json.synced_at || "",
        message: `Sync complete. Models: ${json.models_count}, bookings: ${json.bookings_count}, clients: ${json.clients_count}, leads: ${json.leads_count}, enrollments: ${json.enrollments_count}, tasks synced: ${json.tasks_synced}.`,
      });
    } catch (err) {
      setCurrentDataSyncState({ loading: false, error: true, syncedAt: "", message: err.message || "Sync failed" });
    }
  };

  const upcoming = bookings.filter((b) => b.preferred_date).slice(0, 5);
  const zoomMeetings = bookings.filter((b) => b.zoom_link).slice(0, 5);
  const calendlyUrl = "https://calendly.com/meetserenity";
  const embedModelSignup = `${window.location.origin}/model-signup`;
  const embedBooking = `${window.location.origin}/book`;
  const canRunCurrentDataSync = role === "admin";

  return (
    <div style={{ padding: 20, maxWidth: 1100, margin: "0 auto" }}>
      <h1>Integrations Hub</h1>

      <div style={{ border: "1px solid #e0e0e0", borderRadius: 8, padding: 14, marginBottom: 16 }}>
        <h2>Calendly</h2>
        <p style={{ color: "#666" }}>Scheduling link: <a href={calendlyUrl} target="_blank" rel="noreferrer">{calendlyUrl}</a></p>
        <p style={{ marginBottom: 6 }}><strong>Upcoming Appointments</strong></p>
        {upcoming.length === 0 && <p style={{ color: "#666" }}>No upcoming appointments yet.</p>}
        {upcoming.map((booking) => (
          <p key={booking.id} style={{ margin: "4px 0", color: "#666" }}>
            {booking.name} - {booking.preferred_date} ({booking.status})
          </p>
        ))}
      </div>

      <div style={{ border: "1px solid #e0e0e0", borderRadius: 8, padding: 14, marginBottom: 16 }}>
        <h2>Zoom Meetings</h2>
        {zoomMeetings.length === 0 && <p style={{ color: "#666" }}>No Zoom links attached yet.</p>}
        {zoomMeetings.map((meeting) => (
          <p key={meeting.id} style={{ margin: "6px 0", color: "#666" }}>
            {meeting.name}: <a href={meeting.zoom_link} target="_blank" rel="noreferrer">Join Meeting</a>
          </p>
        ))}
      </div>

      <div style={{ border: "1px solid #e0e0e0", borderRadius: 8, padding: 14, marginBottom: 16 }}>
        <h2>Zapier Automations</h2>
        {zapierStatus.loading && <p style={{ color: "#666" }}>Checking Zapier configuration...</p>}

        {!zapierStatus.loading && !zapierStatus.configured && (
          <div style={{ background: "#f8f9fb", borderRadius: 6, padding: 12, marginBottom: 10 }}>
            <p style={{ margin: "0 0 6px 0", color: "#333", fontWeight: 600 }}>Connection status: Not configured</p>
            <p style={{ margin: 0, color: "#666" }}>Add ZAPIER_WEBHOOK_URL in Vercel to activate app automations.</p>
          </div>
        )}

        {!zapierStatus.loading && zapierStatus.configured && (
          <>
            <p style={{ color: "#2e7d32", marginBottom: 8 }}>Connected</p>
            <p style={{ color: "#666", marginBottom: 10 }}>Active events: {(zapierStatus.events || []).join(", ")}</p>
            <button
              onClick={sendZapierTest}
              disabled={zapierTestState.loading}
              style={{ padding: "8px 12px", border: "none", backgroundColor: "#333", color: "white", borderRadius: 4, cursor: zapierTestState.loading ? "not-allowed" : "pointer", opacity: zapierTestState.loading ? 0.6 : 1 }}
            >
              {zapierTestState.loading ? "Sending..." : "Send Test Event"}
            </button>
            {zapierTestState.message && <p style={{ color: "#666", marginTop: 10 }}>{zapierTestState.message}</p>}
          </>
        )}
      </div>

      {canRunCurrentDataSync && (
        <div style={{ border: "1px solid #e0e0e0", borderRadius: 8, padding: 14, marginBottom: 16 }}>
          <h2>Current Data Sync</h2>
          <p style={{ color: "#666", marginBottom: 10 }}>
            Rebuild app state from the records already stored in Supabase. This does not pull historical records directly from external platforms.
          </p>
          <button
            onClick={runCurrentDataSync}
            disabled={currentDataSyncState.loading}
            style={{ padding: "8px 12px", border: "none", backgroundColor: "#333", color: "white", borderRadius: 4, cursor: currentDataSyncState.loading ? "not-allowed" : "pointer", opacity: currentDataSyncState.loading ? 0.6 : 1 }}
          >
            {currentDataSyncState.loading ? "Syncing..." : "Run Current Data Sync"}
          </button>
          {currentDataSyncState.message && (
            <div style={{ marginTop: 10 }}>
              <p style={{ color: currentDataSyncState.error ? "#b71c1c" : "#666", margin: 0 }}>
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

      <div style={{ border: "1px solid #e0e0e0", borderRadius: 8, padding: 14 }}>
        <h2>Operations Tasks</h2>
        <p style={{ color: "#666", marginBottom: 8 }}>Source: {opsTasksSource === "backend" ? "Backend API" : "Supabase fallback"}</p>
        {opsTasks.length === 0 && <p style={{ color: "#666" }}>No tasks available yet.</p>}
        {opsTasks.map((task, idx) => (
          <p key={task._id || task.id || idx} style={{ margin: "6px 0", color: "#666" }}>
            [{task.role || "OPS"}] {task.task} ({task.status || "pending"})
          </p>
        ))}
      </div>

      <div style={{ border: "1px solid #e0e0e0", borderRadius: 8, padding: 14, marginTop: 16 }}>
        <h2>Website Integration</h2>
        <p style={{ color: "#666" }}>Embed-ready public pages:</p>
        <p style={{ color: "#666" }}>Model Signup: {embedModelSignup}</p>
        <p style={{ color: "#666" }}>Booking Form: {embedBooking}</p>
        <p style={{ color: "#666", marginTop: 8 }}>
          Backend status: {backendStatus.loading ? "Checking..." : backendStatus.message || "Not configured"}
        </p>
      </div>

      <div style={{ border: "1px solid #7b2ff7", borderRadius: 8, padding: 14, marginTop: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
          <h2 style={{ margin: 0 }}>ManyChat</h2>
          <span style={{ padding: "3px 10px", backgroundColor: "#7b2ff7", color: "#fff", borderRadius: 20, fontSize: 12, fontWeight: "bold" }}>Lead Capture</span>
        </div>
        <p style={{ color: "#666", marginBottom: 8 }}>
          Incoming leads from Instagram DM flows and the website chat widget are automatically inserted into the model pipeline or bookings table.
        </p>
        <div style={{ background: "#f8f4ff", borderRadius: 6, padding: 12, marginBottom: 10 }}>
          <p style={{ margin: "0 0 6px 0", fontWeight: 600, color: "#333" }}>Webhook endpoint</p>
          <code style={{ display: "block", wordBreak: "break-all", color: "#5b21b6", fontSize: 13 }}>
            {window.location.origin}/api/manychat/webhook
          </code>
        </div>
        <p style={{ margin: "0 0 4px 0", color: "#444", fontWeight: 600 }}>Required env vars</p>
        <ul style={{ margin: "0 0 10px 0", paddingLeft: 18, color: "#666", fontSize: 13 }}>
          <li><code>MANYCHAT_WEBHOOK_SECRET</code> — paste into ManyChat Request header <code>x-manychat-secret</code></li>
          <li><code>VITE_MANYCHAT_PAGE_ID</code> — your ManyChat Page ID for the chat widget</li>
          <li><code>SUPABASE_SERVICE_ROLE_KEY</code> — service-role key (already required by pipeline endpoint)</li>
        </ul>
        <p style={{ margin: "0 0 4px 0", color: "#444", fontWeight: 600 }}>Expected POST body from ManyChat</p>
        <pre style={{ background: "#f5f5f5", padding: 10, borderRadius: 6, fontSize: 12, overflowX: "auto", margin: 0 }}>{`{
  "secret": "<MANYCHAT_WEBHOOK_SECRET>",
  "name": "{{first_name}} {{last_name}}",
  "email": "{{email}}",
  "instagram": "{{instagram}}",
  "interest": "model"   // or "client"
}`}</pre>
        <p style={{ margin: "12px 0 0", color: "#666", fontSize: 13 }}>
          Leads captured via ManyChat appear with a purple <strong>ManyChat</strong> badge in Submissions and Model Pipeline.
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 14 }}>
          <div style={{ background: "#f8f4ff", borderRadius: 6, padding: 10 }}>
            <p style={{ margin: "0 0 4px 0", fontWeight: 600, fontSize: 13, color: "#333" }}>Webhook secret</p>
            {manyChatStatus.loading
              ? <p style={{ margin: 0, color: "#999", fontSize: 13 }}>Checking...</p>
              : <p style={{ margin: 0, fontSize: 13, color: manyChatStatus.configured ? "#2e7d32" : "#b71c1c", fontWeight: 600 }}>
                  {manyChatStatus.configured ? "✓ Configured" : "✗ Not set — add MANYCHAT_WEBHOOK_SECRET"}
                </p>
            }
          </div>
          <div style={{ background: "#f8f4ff", borderRadius: 6, padding: 10 }}>
            <p style={{ margin: "0 0 4px 0", fontWeight: 600, fontSize: 13, color: "#333" }}>Chat widget</p>
            {manyChatStatus.loading
              ? <p style={{ margin: 0, color: "#999", fontSize: 13 }}>Checking...</p>
              : <p style={{ margin: 0, fontSize: 13, color: manyChatStatus.widgetConfigured ? "#2e7d32" : "#b71c1c", fontWeight: 600 }}>
                  {manyChatStatus.widgetConfigured ? "✓ Configured" : "✗ Not set — add VITE_MANYCHAT_PAGE_ID"}
                </p>
            }
          </div>
        </div>
      </div>

      {/* HoneyBook */}
      <div style={{ border: "1px solid #f4a261", borderRadius: 8, padding: 14, marginTop: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
          <h2 style={{ margin: 0 }}>HoneyBook</h2>
          <span style={{ padding: "3px 10px", backgroundColor: "#e76f51", color: "#fff", borderRadius: 20, fontSize: 12, fontWeight: "bold" }}>CRM Sync</span>
        </div>
        <p style={{ color: "#666", marginBottom: 8 }}>
          Connect HoneyBook via Zapier to automatically sync contacts, projects, invoices, contracts, and payments into your Clients table.
        </p>

        <div style={{ background: "#fff8f4", borderRadius: 6, padding: 12, marginBottom: 12 }}>
          <p style={{ margin: "0 0 6px 0", fontWeight: 600, color: "#333" }}>Webhook endpoint (paste into Zapier → Webhooks POST)</p>
          <code style={{ display: "block", wordBreak: "break-all", color: "#c0392b", fontSize: 13 }}>
            {window.location.origin}/api/honeybook/sync
          </code>
        </div>

        <p style={{ margin: "0 0 6px 0", color: "#444", fontWeight: 600 }}>Setup steps (one Zap per trigger)</p>
        <ol style={{ margin: "0 0 12px 0", paddingLeft: 18, color: "#555", fontSize: 13, lineHeight: 1.7 }}>
          <li>In Zapier: Trigger = <strong>HoneyBook</strong> (choose an event below)</li>
          <li>Action = <strong>Webhooks by Zapier → POST</strong></li>
          <li>URL = the endpoint above</li>
          <li>Payload type = <strong>JSON</strong></li>
          <li>Add Data: map HoneyBook fields to the body keys listed below</li>
          <li>Add Header: <code>x-honeybook-secret</code> = your <code>HONEYBOOK_WEBHOOK_SECRET</code> value</li>
        </ol>

        <p style={{ margin: "0 0 6px 0", color: "#444", fontWeight: 600 }}>Supported HoneyBook triggers → event_type value to send</p>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, marginBottom: 12 }}>
            <thead>
              <tr style={{ background: "#fef3e9" }}>
                <th style={{ textAlign: "left", padding: "6px 10px", borderBottom: "1px solid #f4a261" }}>HoneyBook trigger</th>
                <th style={{ textAlign: "left", padding: "6px 10px", borderBottom: "1px solid #f4a261" }}>event_type value</th>
                <th style={{ textAlign: "left", padding: "6px 10px", borderBottom: "1px solid #f4a261" }}>What it does in the app</th>
              </tr>
            </thead>
            <tbody>
              {[
                ["New Contact", "honeybook.contact.created", "Creates client record with status = lead"],
                ["New Project", "honeybook.project.created", "Creates client (active) + booking if date present"],
                ["Project Stage Changed", "honeybook.project.stage_changed", "Updates client status (lead / active / completed)"],
                ["Invoice Sent", "honeybook.invoice.sent", "Sets invoice_status = sent"],
                ["Invoice Paid", "honeybook.invoice.paid", "Sets invoice_status = paid, updates client value"],
                ["Contract Signed", "honeybook.contract.signed", "Sets contract_signed = true"],
                ["Payment Received", "honeybook.payment.received", "Updates client value with payment amount"],
              ].map(([trigger, type, effect]) => (
                <tr key={type} style={{ borderBottom: "1px solid #f9e8da" }}>
                  <td style={{ padding: "6px 10px", color: "#333" }}>{trigger}</td>
                  <td style={{ padding: "6px 10px" }}><code style={{ fontSize: 12 }}>{type}</code></td>
                  <td style={{ padding: "6px 10px", color: "#555" }}>{effect}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p style={{ margin: "0 0 6px 0", color: "#444", fontWeight: 600 }}>Required JSON body fields (map from HoneyBook in Zapier)</p>
        <pre style={{ background: "#f5f5f5", padding: 10, borderRadius: 6, fontSize: 12, overflowX: "auto", margin: "0 0 12px 0" }}>{`{
  "event_type": "honeybook.project.created",
  "name": "{{contact_name}}",
  "email": "{{contact_email}}",
  "company_name": "{{company}}",
  "project_name": "{{project_name}}",
  "project_value": "{{project_value}}",
  "pipeline_stage": "{{stage}}",
  "honeybook_id": "{{project_id}}",
  "preferred_date": "{{event_date}}"
}`}</pre>

        <p style={{ margin: "0 0 4px 0", color: "#444", fontWeight: 600 }}>Required env vars</p>
        <ul style={{ margin: 0, paddingLeft: 18, color: "#666", fontSize: 13 }}>
          <li><code>HONEYBOOK_WEBHOOK_SECRET</code> — any string you choose; paste it into the Zapier header</li>
          <li><code>SUPABASE_SERVICE_ROLE_KEY</code> — already required by other endpoints</li>
        </ul>
      </div>
    </div>
  );
}
