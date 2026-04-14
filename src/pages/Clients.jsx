import React from "react";
import { supabase } from "../supabase";
import { isMissingColumnError, sendZapierEvent, createInAppAlerts, sendInternalTeamEmailAlert, sendBackendWebhook } from "../utils";

export default function Clients() {
  const [clients, setClients] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [tableReady, setTableReady] = React.useState(true);
  const [error, setError] = React.useState("");
  const [saveError, setSaveError] = React.useState("");
  const [form, setForm] = React.useState({
    name: "",
    email: "",
    service_type: "General",
    client_value: "",
    status: "lead",
    contract_signed: false,
    invoice_paid: false,
  });

  const SETUP_SQL = `-- Run this in your Supabase SQL Editor:
create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text,
  project text,
  honeybook_id text default '',
  service_type text default 'general',
  client_value numeric default 0,
  status text default 'lead',
  invoice_status text default 'pending',
  contract_signed boolean default false,
  invoice_paid boolean default false,
  source text default 'manual',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.clients add column if not exists email text;
alter table public.clients add column if not exists project text;
alter table public.clients add column if not exists honeybook_id text default '';
alter table public.clients add column if not exists service_type text default 'general';
alter table public.clients add column if not exists client_value numeric default 0;
alter table public.clients add column if not exists invoice_status text default 'pending';
alter table public.clients add column if not exists contract_signed boolean default false;
alter table public.clients add column if not exists invoice_paid boolean default false;
alter table public.clients add column if not exists source text default 'manual';
alter table public.clients add column if not exists updated_at timestamptz default now();

alter table public.clients disable row level security;

alter table public.bookings add column if not exists zoom_link text;
alter table public.bookings disable row level security;`;

  const isTableMissingError = (err) =>
    err?.code === "42P01" ||
    err?.code === "42501" ||
    err?.message?.toLowerCase().includes("does not exist") ||
    err?.message?.toLowerCase().includes("relation") ||
    err?.message?.toLowerCase().includes("permission") ||
    err?.message?.toLowerCase().includes("policy") ||
    err?.message?.toLowerCase().includes("rls");

  const isDuplicateClientError = (err) =>
    err?.code === "23505" ||
    err?.message?.toLowerCase().includes("duplicate") ||
    err?.message?.toLowerCase().includes("unique");

  const normalizeClient = (client) => {
    const invoiceStatus = client.invoice_status || (client.invoice_paid ? "paid" : "pending");
    return {
      ...client,
      email: client.email || "",
      service_type: client.service_type || client.project || "General",
      client_value: client.client_value ?? 0,
      invoice_status: invoiceStatus,
      project: client.project || client.service_type || "",
      source: client.source || "manual",
    };
  };

  const fetchClients = async () => {
    try {
      setError("");
      const { data, error } = await supabase
        .from("clients")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setTableReady(true);
      setClients((data || []).map(normalizeClient));
    } catch (err) {
      if (isTableMissingError(err)) {
        setTableReady(false);
      } else {
        setError(err.message || "Failed to load clients");
      }
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    fetchClients();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const saveClient = async (e) => {
    e.preventDefault();
    setSaveError("");
    try {
      const clientPayload = {
        name: form.name.trim(),
        email: form.email.trim().toLowerCase(),
        project: form.service_type.trim(),
        service_type: form.service_type.trim(),
        client_value: Number(form.client_value || 0),
        status: form.status,
        invoice_status: form.invoice_paid ? "paid" : form.contract_signed ? "sent" : "pending",
        contract_signed: form.contract_signed,
        invoice_paid: form.invoice_paid,
        source: "manual",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      let { error } = await supabase.from("clients").insert([clientPayload]);
      if (error && isMissingColumnError(error)) {
        const fallbackPayload = {
          name: form.name.trim(),
          project: form.service_type.trim(),
          status: form.status,
          invoice_status: form.invoice_paid ? "paid" : form.contract_signed ? "sent" : "pending",
          created_at: new Date().toISOString(),
        };
        const fallback = await supabase.from("clients").insert([fallbackPayload]);
        error = fallback.error;
      }
      if (error) throw error;

      sendZapierEvent("client.created", {
        name: form.name.trim(),
        email: form.email.trim().toLowerCase(),
        service_type: form.service_type.trim(),
        client_value: Number(form.client_value || 0),
        status: form.status,
        invoice_paid: form.invoice_paid,
        contract_signed: form.contract_signed,
      });

      createInAppAlerts([
        {
          title: "Client record added",
          message: `${form.name.trim()} was added to client management.`,
          audience_role: "admin",
          source_type: "client",
          source_id: form.email.trim().toLowerCase() || form.name.trim(),
          level: form.status === "lead" ? "info" : "success",
        },
      ]);

      sendInternalTeamEmailAlert({
        subject: `Client added: ${form.name.trim()}`,
        message: `${form.name.trim()} was added to client management.\nEmail: ${form.email.trim() || "N/A"}\nStatus: ${form.status}`,
        roles: ["admin"],
        submissionEmail: form.email.trim(),
      });

      sendBackendWebhook("new_client", {
        name: form.name.trim(),
        email: form.email.trim().toLowerCase(),
        stage: form.status,
      });

      setForm({ name: "", email: "", service_type: "General", client_value: "", status: "lead", contract_signed: false, invoice_paid: false });
      fetchClients();
    } catch (err) {
      if (isDuplicateClientError(err)) {
        setSaveError("A client with that email already exists.");
      } else {
        setSaveError(err.message || "Failed to save client");
      }
    }
  };

  const statusColor = { lead: "#ff9800", active: "#4caf50", completed: "#2196f3", inactive: "#9e9e9e", churned: "#d32f2f" };
  const invoiceColor = { pending: "#ff9800", sent: "#2196f3", paid: "#4caf50" };

  return (
    <div style={{ padding: 20, maxWidth: 1000, margin: "0 auto" }}>
      <h1>Client Management</h1>

      {!tableReady && (
        <div style={{ background: "#fff3e0", border: "1px solid #ff9800", borderRadius: 8, padding: 16, marginBottom: 20 }}>
          <strong style={{ color: "#e65100" }}>Database setup required</strong>
          <p style={{ margin: "8px 0", color: "#555" }}>The clients table doesn't exist yet. Copy and run this SQL in your
            {" "}<a href="https://supabase.com/dashboard/project/jjmmakbnjzzxbuflucck/sql" target="_blank" rel="noreferrer">Supabase SQL Editor</a>:
          </p>
          <pre style={{ background: "#f5f5f5", padding: 12, borderRadius: 6, fontSize: 12, overflowX: "auto", whiteSpace: "pre-wrap" }}>{SETUP_SQL}</pre>
          <button onClick={() => { navigator.clipboard.writeText(SETUP_SQL); }}
            style={{ marginTop: 8, padding: "8px 14px", background: "#333", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer" }}>
            Copy SQL
          </button>
        </div>
      )}

      {tableReady && (
        <form onSubmit={saveClient} style={{ display: "grid", gap: 10, marginBottom: 24 }}>
          <input value={form.name} placeholder="Client name" onChange={(e) => setForm({ ...form, name: e.target.value })} required
            style={{ padding: 10, border: "1px solid #ccc", borderRadius: 4 }} />
          <input value={form.email} placeholder="Client email" type="email" onChange={(e) => setForm({ ...form, email: e.target.value })}
            style={{ padding: 10, border: "1px solid #ccc", borderRadius: 4 }} />
          <input value={form.service_type} placeholder="Service / project" onChange={(e) => setForm({ ...form, service_type: e.target.value })} required
            style={{ padding: 10, border: "1px solid #ccc", borderRadius: 4 }} />
          <input value={form.client_value} placeholder="Client value (optional)" type="number" min="0" step="0.01"
            onChange={(e) => setForm({ ...form, client_value: e.target.value })}
            style={{ padding: 10, border: "1px solid #ccc", borderRadius: 4 }} />
          <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}
            style={{ padding: 10, border: "1px solid #ccc", borderRadius: 4 }}>
            <option value="lead">Lead</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="churned">Churned</option>
            <option value="completed">Completed</option>
          </select>
          <label style={{ color: "#666" }}>
            <input type="checkbox" checked={form.contract_signed} onChange={(e) => setForm({ ...form, contract_signed: e.target.checked })} style={{ marginRight: 8 }} />
            Contract signed
          </label>
          <label style={{ color: "#666" }}>
            <input type="checkbox" checked={form.invoice_paid} onChange={(e) => setForm({ ...form, invoice_paid: e.target.checked })} style={{ marginRight: 8 }} />
            Invoice paid
          </label>
          {saveError && <p style={{ color: "#d32f2f", margin: 0 }}>{saveError}</p>}
          <button style={{ padding: 12, background: "#333", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer" }}>Save Client</button>
        </form>
      )}

      {loading && <p>Loading clients...</p>}
      {error && <p style={{ color: "#d32f2f" }}>{error}</p>}

      {!loading && tableReady && clients.length === 0 && (
        <p style={{ color: "#999" }}>No clients yet. Add one above.</p>
      )}

      {!loading && clients.map((client) => (
        <div key={client.id} style={{ border: "1px solid #e0e0e0", borderRadius: 8, padding: 16, marginBottom: 10 }}>
          <strong style={{ fontSize: 16 }}>{client.name}</strong>
          <p style={{ margin: "6px 0", color: "#666" }}>{client.service_type || client.project || "General"}</p>
          {client.email && <p style={{ margin: "6px 0", color: "#666" }}>{client.email}</p>}
          {Number(client.client_value || 0) > 0 && (
            <p style={{ margin: "6px 0", color: "#666" }}>Value: ${Number(client.client_value).toLocaleString()}</p>
          )}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
            <span style={{ padding: "4px 10px", borderRadius: 20, background: statusColor[client.status] || "#999", color: "#fff", fontSize: 12, fontWeight: 600 }}>
              {client.status}
            </span>
            <span style={{ padding: "4px 10px", borderRadius: 20, background: invoiceColor[client.invoice_status] || "#999", color: "#fff", fontSize: 12, fontWeight: 600 }}>
              {client.invoice_status}
            </span>
            {client.contract_signed && (
              <span style={{ padding: "4px 10px", borderRadius: 20, background: "#6a1b9a", color: "#fff", fontSize: 12, fontWeight: 600 }}>
                Contract Signed
              </span>
            )}
            {client.source && (
              <span style={{ padding: "4px 10px", borderRadius: 20, background: "#455a64", color: "#fff", fontSize: 12, fontWeight: 600 }}>
                {client.source}
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
