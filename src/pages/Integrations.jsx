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

  const C = { ink:"#111111", slate:"#4a4a4a", dust:"#888888", smoke:"#e8e4dc", ivory:"#faf8f4", white:"#ffffff", warn:"#92560a", warnBg:"#fef8ec", ok:"#1a6636", okBg:"#edf7ee", err:"#9b1c1c", errBg:"#fef2f2", info:"#1e3a5f", infoBg:"#eff6ff", gold:"#c9a84c" };
  const sec = (extra={}) => ({ background:C.white, border:`1px solid ${C.smoke}`, borderRadius:12, padding:"20px 22px", marginBottom:16, boxShadow:"0 1px 4px rgba(17,17,17,0.04)", ...extra });
  const secTitle = { fontFamily:"'Cormorant Garamond',Georgia,serif", fontSize:20, fontWeight:500, color:C.ink, margin:"0 0 4px" };
  const chip = (label, bg, fg) => <span style={{ padding:"3px 10px", background:bg, color:fg, borderRadius:99, fontSize:11, fontWeight:600, letterSpacing:"0.06em", textTransform:"uppercase" }}>{label}</span>;
  const btn = (label, onClick, disabled, loading) => (
    <button onClick={onClick} disabled={disabled} style={{ padding:"9px 16px", background:disabled ? C.smoke : C.ink, color:disabled ? C.dust : C.white, border:"none", borderRadius:8, fontSize:12, fontWeight:600, letterSpacing:"0.07em", textTransform:"uppercase", cursor:disabled ? "not-allowed" : "pointer", fontFamily:"'Inter',sans-serif", opacity:loading ? 0.7 : 1 }}>{label}</button>
  );

  return (
    <div style={{ padding:"32px 24px", maxWidth:1100, margin:"0 auto" }}>
      <h1 style={{ fontFamily:"'Cormorant Garamond',Georgia,serif", fontSize:"clamp(26px,4vw,38px)", fontWeight:500, color:C.ink, letterSpacing:"-0.02em", margin:"0 0 4px" }}>Integrations</h1>
      <p style={{ color:C.dust, fontSize:13, marginBottom:28 }}>Connect your external tools and services.</p>

      {/* Calendly */}
      <div style={sec()}>
        <p style={secTitle}>Calendly</p>
        <p style={{ color:C.dust, fontSize:13, margin:"0 0 10px" }}>Scheduling link: <a href={calendlyUrl} target="_blank" rel="noreferrer" style={{ color:C.ink }}>{calendlyUrl}</a></p>
        <p style={{ fontWeight:600, color:C.slate, fontSize:13, margin:"0 0 8px" }}>Upcoming Appointments</p>
        {upcoming.length === 0 && <p style={{ color:C.dust, fontSize:13 }}>No upcoming appointments yet.</p>}
        {upcoming.map(booking => (
          <p key={booking.id} style={{ margin:"4px 0", color:C.dust, fontSize:13 }}>{booking.name} — {booking.preferred_date} <span style={{ color:C.slate }}>({booking.status})</span></p>
        ))}
      </div>

      {/* Zoom */}
      <div style={sec()}>
        <p style={secTitle}>Zoom Meetings</p>
        {zoomMeetings.length === 0 && <p style={{ color:C.dust, fontSize:13, margin:0 }}>No Zoom links attached yet.</p>}
        {zoomMeetings.map(meeting => (
          <p key={meeting.id} style={{ margin:"6px 0", color:C.dust, fontSize:13 }}>{meeting.name}: <a href={meeting.zoom_link} target="_blank" rel="noreferrer" style={{ color:C.ink }}>Join Meeting</a></p>
        ))}
      </div>

      {/* Zapier */}
      <div style={sec()}>
        <p style={secTitle}>Zapier Automations</p>
        {zapierStatus.loading && <p style={{ color:C.dust, fontSize:13 }}>Checking Zapier configuration…</p>}
        {!zapierStatus.loading && !zapierStatus.configured && (
          <div style={{ background:C.ivory, borderRadius:8, padding:"12px 14px", marginBottom:8 }}>
            <p style={{ margin:"0 0 4px", fontWeight:600, color:C.slate, fontSize:13 }}>Connection status: Not configured</p>
            <p style={{ margin:0, color:C.dust, fontSize:13 }}>Add ZAPIER_WEBHOOK_URL in Vercel to activate app automations.</p>
          </div>
        )}
        {!zapierStatus.loading && zapierStatus.configured && (
          <div>
            <p style={{ color:C.ok, fontSize:13, margin:"0 0 6px", fontWeight:600 }}>Connected</p>
            <p style={{ color:C.dust, fontSize:13, margin:"0 0 10px" }}>Active events: {(zapierStatus.events || []).join(", ")}</p>
            {btn(zapierTestState.loading ? "Sending…" : "Send Test Event", sendZapierTest, zapierTestState.loading, zapierTestState.loading)}
            {zapierTestState.message && <p style={{ color:C.dust, marginTop:10, fontSize:13 }}>{zapierTestState.message}</p>}
          </div>
        )}
      </div>

      {/* Current Data Sync */}
      {canRunCurrentDataSync && (
        <div style={sec()}>
          <p style={secTitle}>Current Data Sync</p>
          <p style={{ color:C.dust, fontSize:13, margin:"0 0 12px" }}>Rebuild app state from the records already stored in Supabase. This does not pull historical records directly from external platforms.</p>
          {btn(currentDataSyncState.loading ? "Syncing…" : "Run Current Data Sync", runCurrentDataSync, currentDataSyncState.loading, currentDataSyncState.loading)}
          {currentDataSyncState.message && (
            <div style={{ marginTop:10 }}>
              <p style={{ color:currentDataSyncState.error ? C.err : C.dust, margin:0, fontSize:13 }}>{currentDataSyncState.message}</p>
              {!!currentDataSyncState.syncedAt && <p style={{ color:C.dust, margin:"6px 0 0", fontSize:12 }}>Last sync: {new Date(currentDataSyncState.syncedAt).toLocaleString()}</p>}
            </div>
          )}
        </div>
      )}

      {/* Ops Tasks */}
      <div style={sec()}>
        <p style={secTitle}>Operations Tasks</p>
        <p style={{ color:C.dust, fontSize:12, margin:"0 0 10px" }}>Source: {opsTasksSource === "backend" ? "Backend API" : "Supabase fallback"}</p>
        {opsTasks.length === 0 && <p style={{ color:C.dust, fontSize:13 }}>No tasks available yet.</p>}
        {opsTasks.map((task, idx) => (
          <p key={task._id || task.id || idx} style={{ margin:"5px 0", color:C.dust, fontSize:13 }}>
            <span style={{ fontSize:11, fontWeight:600, letterSpacing:"0.08em", textTransform:"uppercase", color:C.slate, marginRight:8 }}>[{task.role || "OPS"}]</span>{task.task} <span style={{ color:C.dust }}>({task.status || "pending"})</span>
          </p>
        ))}
      </div>

      {/* Website Integration */}
      <div style={sec()}>
        <p style={secTitle}>Website Integration</p>
        <p style={{ color:C.dust, fontSize:13, margin:"0 0 8px" }}>Embed-ready public pages:</p>
        <p style={{ color:C.slate, fontSize:13, margin:"0 0 4px" }}>Model Signup: <span style={{ color:C.ink }}>{embedModelSignup}</span></p>
        <p style={{ color:C.slate, fontSize:13, margin:"0 0 4px" }}>Booking Form: <span style={{ color:C.ink }}>{embedBooking}</span></p>
        <p style={{ color:C.dust, fontSize:13, marginTop:10 }}>Backend status: {backendStatus.loading ? "Checking…" : backendStatus.message || "Not configured"}</p>
      </div>

      {/* ManyChat */}
      <div style={{ ...sec(), border:`1px solid rgba(123,47,247,0.3)` }}>
        <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:10 }}>
          <p style={secTitle}>ManyChat</p>
          {chip("Lead Capture", "rgba(123,47,247,0.12)", "#6d28d9")}
        </div>
        <p style={{ color:C.dust, fontSize:13, margin:"0 0 12px" }}>Incoming leads from Instagram DM flows and the website chat widget are automatically inserted into the model pipeline or bookings table.</p>
        <div style={{ background:"rgba(123,47,247,0.06)", borderRadius:8, padding:"12px 14px", marginBottom:12 }}>
          <p style={{ margin:"0 0 5px", fontWeight:600, color:C.slate, fontSize:13 }}>Webhook endpoint</p>
          <code style={{ display:"block", wordBreak:"break-all", color:"#5b21b6", fontSize:12 }}>{window.location.origin}/api/manychat/webhook</code>
        </div>
        <p style={{ margin:"0 0 6px", color:C.slate, fontWeight:600, fontSize:13 }}>Required env vars</p>
        <ul style={{ margin:"0 0 12px", paddingLeft:18, color:C.dust, fontSize:13, lineHeight:1.8 }}>
          <li><code>MANYCHAT_WEBHOOK_SECRET</code> — paste into ManyChat Request header <code>x-manychat-secret</code></li>
          <li><code>VITE_MANYCHAT_PAGE_ID</code> — your ManyChat Page ID for the chat widget</li>
          <li><code>SUPABASE_SERVICE_ROLE_KEY</code> — service-role key (already required by pipeline endpoint)</li>
        </ul>
        <p style={{ margin:"0 0 6px", color:C.slate, fontWeight:600, fontSize:13 }}>Expected POST body from ManyChat</p>
        <pre style={{ background:C.ivory, border:`1px solid ${C.smoke}`, padding:"12px 14px", borderRadius:8, fontSize:11, overflowX:"auto", margin:"0 0 12px", color:C.slate }}>{`{\n  "secret": "<MANYCHAT_WEBHOOK_SECRET>",\n  "name": "{{first_name}} {{last_name}}",\n  "email": "{{email}}",\n  "instagram": "{{instagram}}",\n  "interest": "model"   // or "client"\n}`}</pre>
        <p style={{ margin:"0 0 10px", color:C.dust, fontSize:13 }}>Leads captured via ManyChat appear with a purple <strong>ManyChat</strong> badge in Submissions and Model Pipeline.</p>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
          <div style={{ background:"rgba(123,47,247,0.06)", borderRadius:8, padding:"12px 14px" }}>
            <p style={{ margin:"0 0 4px", fontWeight:600, fontSize:13, color:C.slate }}>Webhook secret</p>
            {manyChatStatus.loading
              ? <p style={{ margin:0, color:C.dust, fontSize:13 }}>Checking…</p>
              : <p style={{ margin:0, fontSize:13, fontWeight:600, color:manyChatStatus.configured ? C.ok : C.err }}>{manyChatStatus.configured ? "✓ Configured" : "✗ Not set — add MANYCHAT_WEBHOOK_SECRET"}</p>}
          </div>
          <div style={{ background:"rgba(123,47,247,0.06)", borderRadius:8, padding:"12px 14px" }}>
            <p style={{ margin:"0 0 4px", fontWeight:600, fontSize:13, color:C.slate }}>Chat widget</p>
            {manyChatStatus.loading
              ? <p style={{ margin:0, color:C.dust, fontSize:13 }}>Checking…</p>
              : <p style={{ margin:0, fontSize:13, fontWeight:600, color:manyChatStatus.widgetConfigured ? C.ok : C.err }}>{manyChatStatus.widgetConfigured ? "✓ Configured" : "✗ Not set — add VITE_MANYCHAT_PAGE_ID"}</p>}
          </div>
        </div>
      </div>

      {/* HoneyBook */}
      <div style={{ ...sec(), border:`1px solid rgba(231,111,81,0.4)` }}>
        <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:10 }}>
          <p style={secTitle}>HoneyBook</p>
          {chip("CRM Sync", "rgba(231,111,81,0.12)", "#c0392b")}
        </div>
        <p style={{ color:C.dust, fontSize:13, margin:"0 0 12px" }}>Connect HoneyBook via Zapier to automatically sync contacts, projects, invoices, contracts, and payments into your Clients table.</p>
        <div style={{ background:"rgba(231,111,81,0.06)", borderRadius:8, padding:"12px 14px", marginBottom:12 }}>
          <p style={{ margin:"0 0 5px", fontWeight:600, color:C.slate, fontSize:13 }}>Webhook endpoint (paste into Zapier → Webhooks POST)</p>
          <code style={{ display:"block", wordBreak:"break-all", color:"#c0392b", fontSize:12 }}>{window.location.origin}/api/honeybook/sync</code>
        </div>
        <p style={{ margin:"0 0 6px", color:C.slate, fontWeight:600, fontSize:13 }}>Setup steps (one Zap per trigger)</p>
        <ol style={{ margin:"0 0 12px", paddingLeft:18, color:C.dust, fontSize:13, lineHeight:1.8 }}>
          <li>In Zapier: Trigger = <strong>HoneyBook</strong> (choose an event below)</li>
          <li>Action = <strong>Webhooks by Zapier → POST</strong></li>
          <li>URL = the endpoint above</li>
          <li>Payload type = <strong>JSON</strong></li>
          <li>Add Data: map HoneyBook fields to the body keys listed below</li>
          <li>Add Header: <code>x-honeybook-secret</code> = your <code>HONEYBOOK_WEBHOOK_SECRET</code> value</li>
        </ol>
        <p style={{ margin:"0 0 8px", color:C.slate, fontWeight:600, fontSize:13 }}>Supported HoneyBook triggers</p>
        <div style={{ overflowX:"auto", marginBottom:12 }}>
          <table style={{ width:"100%", borderCollapse:"collapse", fontSize:12 }}>
            <thead>
              <tr style={{ background:"rgba(231,111,81,0.06)" }}>
                <th style={{ textAlign:"left", padding:"7px 10px", borderBottom:`1px solid rgba(231,111,81,0.3)`, color:C.slate }}>HoneyBook trigger</th>
                <th style={{ textAlign:"left", padding:"7px 10px", borderBottom:`1px solid rgba(231,111,81,0.3)`, color:C.slate }}>event_type value</th>
                <th style={{ textAlign:"left", padding:"7px 10px", borderBottom:`1px solid rgba(231,111,81,0.3)`, color:C.slate }}>What it does</th>
              </tr>
            </thead>
            <tbody>
              {[
                ["New Contact","honeybook.contact.created","Creates client record with status = lead"],
                ["New Project","honeybook.project.created","Creates client (active) + booking if date present"],
                ["Project Stage Changed","honeybook.project.stage_changed","Updates client status (lead / active / completed)"],
                ["Invoice Sent","honeybook.invoice.sent","Sets invoice_status = sent"],
                ["Invoice Paid","honeybook.invoice.paid","Sets invoice_status = paid, updates client value"],
                ["Contract Signed","honeybook.contract.signed","Sets contract_signed = true"],
                ["Payment Received","honeybook.payment.received","Updates client value with payment amount"],
              ].map(([trigger,type,effect]) => (
                <tr key={type} style={{ borderBottom:`1px solid ${C.smoke}` }}>
                  <td style={{ padding:"7px 10px", color:C.ink }}>{trigger}</td>
                  <td style={{ padding:"7px 10px" }}><code style={{ fontSize:11 }}>{type}</code></td>
                  <td style={{ padding:"7px 10px", color:C.dust }}>{effect}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p style={{ margin:"0 0 6px", color:C.slate, fontWeight:600, fontSize:13 }}>Required JSON body fields</p>
        <pre style={{ background:C.ivory, border:`1px solid ${C.smoke}`, padding:"12px 14px", borderRadius:8, fontSize:11, overflowX:"auto", margin:"0 0 12px", color:C.slate }}>{`{\n  "event_type": "honeybook.project.created",\n  "name": "{{contact_name}}",\n  "email": "{{contact_email}}",\n  "company_name": "{{company}}",\n  "project_name": "{{project_name}}",\n  "project_value": "{{project_value}}",\n  "pipeline_stage": "{{stage}}",\n  "honeybook_id": "{{project_id}}",\n  "preferred_date": "{{event_date}}"\n}`}</pre>
        <p style={{ margin:"0 0 4px", color:C.slate, fontWeight:600, fontSize:13 }}>Required env vars</p>
        <ul style={{ margin:0, paddingLeft:18, color:C.dust, fontSize:13, lineHeight:1.8 }}>
          <li><code>HONEYBOOK_WEBHOOK_SECRET</code> — any string you choose; paste it into the Zapier header</li>
          <li><code>SUPABASE_SERVICE_ROLE_KEY</code> — already required by other endpoints</li>
        </ul>
      </div>
    </div>
  );
}
