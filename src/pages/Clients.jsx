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

  const C = { ink:"#111111", slate:"#4a4a4a", dust:"#888888", smoke:"#e8e4dc", ivory:"#faf8f4", white:"#ffffff", warn:"#92560a", warnBg:"#fef8ec", ok:"#1a6636", okBg:"#edf7ee", err:"#9b1c1c", errBg:"#fef2f2", info:"#1e3a5f", infoBg:"#eff6ff", purple:"#6a1b9a", purpleBg:"rgba(106,27,154,0.10)" };
  const inp = { padding:"11px 13px", fontSize:13, color:C.ink, background:C.white, border:`1px solid ${C.smoke}`, borderRadius:8, outline:"none", fontFamily:"'Inter',sans-serif", width:"100%", boxSizing:"border-box" };
  const statusBadge = (st) => { const m={lead:[C.warnBg,C.warn],active:[C.okBg,C.ok],completed:[C.infoBg,C.info],inactive:[C.ivory,C.dust],churned:[C.errBg,C.err]}; const [bg,clr]=m[st]||[C.ivory,C.slate]; return {display:"inline-flex",alignItems:"center",padding:"3px 10px",borderRadius:99,fontSize:11,fontWeight:600,letterSpacing:"0.06em",textTransform:"uppercase",background:bg,color:clr}; };
  const invoiceBadge = (st) => { const m={pending:[C.warnBg,C.warn],sent:[C.infoBg,C.info],paid:[C.okBg,C.ok]}; const [bg,clr]=m[st]||[C.ivory,C.slate]; return {display:"inline-flex",alignItems:"center",padding:"3px 10px",borderRadius:99,fontSize:11,fontWeight:600,letterSpacing:"0.06em",textTransform:"uppercase",background:bg,color:clr}; };

  return (
    <div style={{ padding:"32px 24px", maxWidth:1000, margin:"0 auto" }}>
      <h1 style={{ fontFamily:"'Cormorant Garamond',Georgia,serif", fontSize:"clamp(26px,4vw,38px)", fontWeight:500, color:C.ink, letterSpacing:"-0.02em", margin:"0 0 4px" }}>Client Management</h1>
      <p style={{ color:C.dust, fontSize:13, marginBottom:24 }}>Track your client roster, contracts, and invoices.</p>

      {!tableReady && (
        <div style={{ background:C.warnBg, border:`1px solid rgba(146,86,10,0.2)`, borderRadius:12, padding:"18px 22px", marginBottom:24 }}>
          <p style={{ margin:"0 0 6px", fontWeight:600, color:C.warn, fontSize:14 }}>Database setup required</p>
          <p style={{ margin:"0 0 10px", color:C.slate, fontSize:13 }}>
            The clients table doesn't exist yet. Copy and run this SQL in your{" "}
            <a href="https://supabase.com/dashboard/project/jjmmakbnjzzxbuflucck/sql" target="_blank" rel="noreferrer" style={{ color:C.ink }}>Supabase SQL Editor</a>:
          </p>
          <pre style={{ background:C.ivory, border:`1px solid ${C.smoke}`, padding:"12px 14px", borderRadius:8, fontSize:11, overflowX:"auto", whiteSpace:"pre-wrap", color:C.slate }}>{SETUP_SQL}</pre>
          <button onClick={()=>navigator.clipboard.writeText(SETUP_SQL)} style={{ marginTop:10, padding:"9px 16px", background:C.ink, color:C.white, border:"none", borderRadius:8, fontSize:12, fontWeight:600, letterSpacing:"0.07em", textTransform:"uppercase", cursor:"pointer", fontFamily:"'Inter',sans-serif" }}>Copy SQL</button>
        </div>
      )}

      {tableReady && (
        <div style={{ background:C.white, border:`1px solid ${C.smoke}`, borderRadius:12, padding:"22px 22px", marginBottom:24, boxShadow:"0 1px 4px rgba(17,17,17,0.04)" }}>
          <p style={{ fontFamily:"'Cormorant Garamond',Georgia,serif", fontSize:18, fontWeight:500, color:C.ink, margin:"0 0 14px" }}>Add Client</p>
          <form onSubmit={saveClient} style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
            <input value={form.name} placeholder="Client name" onChange={(e)=>setForm({...form,name:e.target.value})} required style={inp} />
            <input value={form.email} placeholder="Client email" type="email" onChange={(e)=>setForm({...form,email:e.target.value})} style={inp} />
            <input value={form.service_type} placeholder="Service / project" onChange={(e)=>setForm({...form,service_type:e.target.value})} required style={inp} />
            <input value={form.client_value} placeholder="Client value (optional)" type="number" min="0" step="0.01" onChange={(e)=>setForm({...form,client_value:e.target.value})} style={inp} />
            <select value={form.status} onChange={(e)=>setForm({...form,status:e.target.value})} style={{ ...inp, appearance:"none", cursor:"pointer" }}>
              <option value="lead">Lead</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="churned">Churned</option>
              <option value="completed">Completed</option>
            </select>
            <div style={{ display:"flex", flexDirection:"column", gap:8, justifyContent:"center" }}>
              <label style={{ display:"flex", alignItems:"center", gap:8, fontSize:13, color:C.slate, cursor:"pointer" }}>
                <input type="checkbox" checked={form.contract_signed} onChange={(e)=>setForm({...form,contract_signed:e.target.checked})} /> Contract signed
              </label>
              <label style={{ display:"flex", alignItems:"center", gap:8, fontSize:13, color:C.slate, cursor:"pointer" }}>
                <input type="checkbox" checked={form.invoice_paid} onChange={(e)=>setForm({...form,invoice_paid:e.target.checked})} /> Invoice paid
              </label>
            </div>
            {saveError && <p style={{ color:C.err, margin:0, gridColumn:"1/-1", fontSize:13 }}>{saveError}</p>}
            <button style={{ gridColumn:"1/-1", padding:"12px 20px", background:C.ink, color:C.white, border:"none", borderRadius:8, fontSize:12, fontWeight:600, letterSpacing:"0.08em", textTransform:"uppercase", cursor:"pointer", fontFamily:"'Inter',sans-serif" }}>Save Client</button>
          </form>
        </div>
      )}

      {loading && <p style={{ color:C.dust }}>Loading clients…</p>}
      {error && <p style={{ color:C.err, fontSize:13 }}>{error}</p>}
      {!loading && tableReady && clients.length === 0 && <p style={{ color:C.dust }}>No clients yet. Add one above.</p>}

      {!loading && clients.map(client => (
        <div key={client.id} style={{ border:`1px solid ${C.smoke}`, borderRadius:12, padding:"16px 18px", marginBottom:12, background:C.white, boxShadow:"0 1px 4px rgba(17,17,17,0.04)" }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:12, flexWrap:"wrap" }}>
            <div>
              <p style={{ margin:"0 0 3px", fontSize:15, fontWeight:600, color:C.ink }}>{client.name}</p>
              <p style={{ margin:"0 0 2px", fontSize:13, color:C.dust }}>{client.service_type || client.project || "General"}</p>
              {client.email && <p style={{ margin:"0 0 2px", fontSize:13, color:C.dust }}>{client.email}</p>}
              {Number(client.client_value || 0) > 0 && <p style={{ margin:"0 0 2px", fontSize:13, color:C.slate }}>Value: ${Number(client.client_value).toLocaleString()}</p>}
            </div>
            <div style={{ display:"flex", gap:6, flexWrap:"wrap", alignItems:"center" }}>
              <span style={statusBadge(client.status)}>{client.status}</span>
              <span style={invoiceBadge(client.invoice_status)}>{client.invoice_status}</span>
              {client.contract_signed && <span style={{ ...statusBadge("active"), background:C.purpleBg, color:C.purple }}>Contract ✓</span>}
              {client.source && <span style={{ padding:"3px 10px", borderRadius:99, background:C.ivory, color:C.dust, fontSize:11, fontWeight:600, letterSpacing:"0.06em", textTransform:"uppercase" }}>{client.source}</span>}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
