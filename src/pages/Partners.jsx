import React from "react";
import { supabase } from "../supabase";
import { isMissingColumnError, sendZapierEvent, createInAppAlerts, sendInternalTeamEmailAlert, sendBackendWebhook } from "../utils";

export default function Partners() {
  const isBrandAmbassadorView = React.useMemo(() => {
    if (typeof window === "undefined") return false;
    return window.location.pathname.startsWith("/brand-ambassadors");
  }, []);
  const [clients, setClients] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [tableReady, setTableReady] = React.useState(true);
  const [usingFallbackData, setUsingFallbackData] = React.useState(false);
  const [error, setError] = React.useState("");
  const [saveError, setSaveError] = React.useState("");
  const [uploadingId, setUploadingId] = React.useState("");
  const [moveToModelsLoading, setMoveToModelsLoading] = React.useState({});
  const [movedToModels, setMovedToModels] = React.useState({});
  const avatarInputRef = React.useRef({});

  const isAmbassadorClient = React.useCallback((item) => {
    const source = String(item?.source || "").toLowerCase();
    const serviceType = String(item?.service_type || "").toLowerCase();
    const project = String(item?.project || "").toLowerCase();
    const notes = String(item?.internal_notes || item?.notes || "").toLowerCase();
    return (
      source === "brand_ambassador" ||
      serviceType.includes("brand ambassador") ||
      project.includes("brand ambassador") ||
      notes.includes("moved from model")
    );
  }, []);

  const moveBackToModels = async (client) => {
    if (!isBrandAmbassadorView || !client?.id) return;
    if (!window.confirm(`Move ${client.name || "this brand ambassador"} back to Models?`)) return;

    setMoveToModelsLoading((prev) => ({ ...prev, [client.id]: true }));
    setError("");
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const resp = await fetch("/api/clients/move-to-models", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token || ""}`,
        },
        body: JSON.stringify({ clientId: client.id }),
      });

      const json = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        throw new Error(json.error || "Failed to move brand ambassador back to models");
      }

      setMovedToModels((prev) => ({ ...prev, [client.id]: true }));
      setClients((prev) => prev.filter((item) => item.id !== client.id));
    } catch (err) {
      setError(err.message || "Failed to move brand ambassador back to models");
    } finally {
      setMoveToModelsLoading((prev) => ({ ...prev, [client.id]: false }));
    }
  };

  const uploadAvatar = async (clientId, file) => {
    if (!file || !clientId || String(clientId).startsWith("booking-")) return;
    setUploadingId(String(clientId));
    try {
      const ext = file.name.split(".").pop();
      const path = `avatars/clients/${clientId}/avatar.${ext}`;
      const buckets = [(import.meta.env.VITE_SUPABASE_STORAGE_BUCKET || "").trim(), "model-images", "models", "images"].filter(Boolean);
      let publicUrl = "";
      for (const bucket of buckets) {
        const { error: upErr } = await supabase.storage.from(bucket).upload(path, file, { upsert: true, contentType: file.type });
        if (upErr) continue;
        const { data: pubData } = supabase.storage.from(bucket).getPublicUrl(path);
        publicUrl = pubData?.publicUrl || "";
        break;
      }
      if (!publicUrl) throw new Error("Upload failed — no bucket accepted the file");
      const { error: updateErr } = await supabase.from("clients").update({ avatar_url: publicUrl }).eq("id", clientId);
      if (updateErr) throw updateErr;
      setClients(prev => prev.map(c => c.id === clientId ? { ...c, avatar_url: publicUrl } : c));
    } catch (err) {
      alert(err.message || "Failed to upload photo");
    } finally {
      setUploadingId("");
    }
  };
  const [form, setForm] = React.useState({
    name: "",
    email: "",
    company: "",
    service_type: "General",
    client_value: "",
    status: "lead",
    contract_signed: false,
    invoice_paid: false,
    source: "manual",
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
  avatar_url text default '',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.clients add column if not exists email text;
alter table public.clients add column if not exists avatar_url text default '';
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
      service_type: client.service_type || client.project || client.company || "General",
      client_value: client.client_value ?? 0,
      invoice_status: invoiceStatus,
      project: client.project || client.company || client.service_type || "",
      source: client.source || "manual",
      avatar_url: client.avatar_url || "",
    };
  };

  const getClientAvatarSrc = React.useCallback((avatarUrl) => {
    const raw = String(avatarUrl || "").trim();
    if (!raw) return "";

    // Convert signed Supabase URLs into public URL form so expired signatures do not break avatars.
    if (/^https?:\/\//i.test(raw)) {
      const signMarker = "/storage/v1/object/sign/";
      const signIndex = raw.indexOf(signMarker);
      if (signIndex >= 0) {
        const signedPath = raw.slice(signIndex + signMarker.length).split("?")[0];
        return `${raw.slice(0, signIndex)}/storage/v1/object/public/${signedPath}`;
      }
      return raw;
    }

    const cleanPath = raw.replace(/^\/+/, "");
    if (!cleanPath) return "";

    const bucketCandidates = ["model-images", "models", "images"];
    if (cleanPath.includes("/")) {
      const [firstSegment, ...rest] = cleanPath.split("/");
      if (bucketCandidates.includes(firstSegment) && rest.length) {
        const fromBucketPath = rest.join("/");
        const { data } = supabase.storage.from(firstSegment).getPublicUrl(fromBucketPath);
        return data?.publicUrl || "";
      }
    }

    const { data } = supabase.storage.from("model-images").getPublicUrl(cleanPath);
    return data?.publicUrl || "";
  }, []);

  const buildClientsFromBookings = (rows = []) => {
    const seen = new Map();

    (rows || []).forEach((booking) => {
      const key = ((booking.email || `${booking.name}-${booking.company || booking.service_type || "client"}`) || "").toLowerCase();
      if (seen.has(key)) return;

      seen.set(key, normalizeClient({
        id: `booking-${booking.id}`,
        name: booking.name || booking.company || "Client",
        email: booking.email || "",
        company: booking.company || "",
        project: booking.company || booking.service_type || "",
        service_type: booking.service_type || "General",
        status: ["confirmed", "completed"].includes(booking.status) ? "active" : "lead",
        invoice_status: "pending",
        invoice_paid: false,
        contract_signed: false,
        client_value: 0,
        source: "booking",
        created_at: booking.created_at,
      }));
    });

    return Array.from(seen.values());
  };

  const fetchBookingFallback = async () => {
    const { data, error: bookingError } = await supabase
      .from("bookings")
      .select("id, name, email, company, service_type, status, created_at")
      .order("created_at", { ascending: false })
      .limit(500);

    if (bookingError) throw bookingError;

    const fallbackClients = buildClientsFromBookings(data || []);
    setUsingFallbackData(true);
    setTableReady(false);
    setClients(fallbackClients);

    try {
      window.sessionStorage.setItem("clients-page-v1", JSON.stringify({ ts: Date.now(), data: fallbackClients, tableReady: false, usingFallbackData: true }));
    } catch {
      // ignore cache issues
    }
  };

  const fetchClients = async () => {
    try {
      const raw = window.sessionStorage.getItem("clients-page-v1");
      if (raw) {
        const cached = JSON.parse(raw);
        if (cached?.data && Date.now() - cached.ts < 60000) {
          setClients(cached.data);
          setTableReady(cached.tableReady !== false);
          setUsingFallbackData(!!cached.usingFallbackData);
          setLoading(false);
          return;
        }
      }
    } catch {
      // ignore cache issues
    }

    try {
      setError("");
      const { data, error } = await supabase
        .from("clients")
        .select("id, name, email, project, service_type, status, invoice_status, invoice_paid, contract_signed, client_value, source, avatar_url, created_at")
        .order("created_at", { ascending: false })
        .limit(500);

      if (error) throw error;
      const nextClients = (data || [])
        .map(normalizeClient)
        .filter((item) => (isBrandAmbassadorView ? isAmbassadorClient(item) : !isAmbassadorClient(item)));
      setTableReady(true);
      setUsingFallbackData(false);
      setClients(nextClients);
      try {
        window.sessionStorage.setItem("clients-page-v1", JSON.stringify({ ts: Date.now(), data: nextClients, tableReady: true, usingFallbackData: false }));
      } catch {
        // ignore cache issues
      }
    } catch (err) {
      if (isTableMissingError(err)) {
        try {
          await fetchBookingFallback();
        } catch (fallbackErr) {
          setError(fallbackErr.message || "Failed to load partner records");
        }
      } else {
        setError(err.message || "Failed to load partners");
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
      if (usingFallbackData || !tableReady) {
        const fallbackLead = {
          name: form.name.trim(),
          email: form.email.trim().toLowerCase(),
          company: form.company.trim() || form.name.trim(),
          service_type: form.service_type.trim() || "General",
          preferred_date: "",
          message: `${isBrandAmbassadorView ? "Brand ambassador" : "Partner"} lead created from ${isBrandAmbassadorView ? "Brand Ambassadors" : "Partners"} view${form.client_value ? ` · Value: $${form.client_value}` : ""}`,
          status: "pending",
          source: form.source || "manual",
          created_at: new Date().toISOString(),
        };

        const fallbackInsert = await supabase.from("bookings").insert([fallbackLead]);
        if (fallbackInsert.error) throw fallbackInsert.error;

        setForm({ name: "", email: "", company: "", service_type: "General", client_value: "", status: "lead", contract_signed: false, invoice_paid: false, source: isBrandAmbassadorView ? "brand_ambassador" : "manual" });
        fetchClients();
        return;
      }

      const clientPayload = {
        name: form.name.trim(),
        email: form.email.trim().toLowerCase(),
        project: form.company.trim() || form.service_type.trim(),
        service_type: form.service_type.trim(),
        client_value: Number(form.client_value || 0),
        status: form.status,
        invoice_status: form.invoice_paid ? "paid" : form.contract_signed ? "sent" : "pending",
        contract_signed: form.contract_signed,
        invoice_paid: form.invoice_paid,
        source: form.source || "manual",
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

      sendZapierEvent(isBrandAmbassadorView ? "brand_ambassador.created" : "client.created", {
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
          title: isBrandAmbassadorView ? "Brand ambassador record added" : "Partner record added",
          message: `${form.name.trim()} was added to ${isBrandAmbassadorView ? "brand ambassador" : "partner"} management.`,
          audience_role: "admin",
          source_type: isBrandAmbassadorView ? "brand_ambassador" : "partner",
          source_id: form.email.trim().toLowerCase() || form.name.trim(),
          level: form.status === "lead" ? "info" : "success",
        },
      ]);

      sendInternalTeamEmailAlert({
        subject: `${isBrandAmbassadorView ? "Brand ambassador" : "Partner"} added: ${form.name.trim()}`,
        message: `${form.name.trim()} was added to ${isBrandAmbassadorView ? "brand ambassador" : "partner"} management.\nEmail: ${form.email.trim() || "N/A"}\nStatus: ${form.status}`,
        roles: ["admin"],
        submissionEmail: form.email.trim(),
      });

      sendBackendWebhook(isBrandAmbassadorView ? "new_brand_ambassador" : "new_partner", {
        name: form.name.trim(),
        email: form.email.trim().toLowerCase(),
        stage: form.status,
      });

      setForm({ name: "", email: "", company: "", service_type: "General", client_value: "", status: "lead", contract_signed: false, invoice_paid: false, source: isBrandAmbassadorView ? "brand_ambassador" : "manual" });
      fetchClients();
    } catch (err) {
      if (isDuplicateClientError(err)) {
        setSaveError("A partner with that email already exists.");
      } else {
        setSaveError(err.message || "Failed to save partner");
      }
    }
  };

  const C = { ink:"#111111", slate:"#4a4a4a", dust:"#888888", smoke:"#e8e4dc", ivory:"#faf8f4", white:"#ffffff", warn:"#92560a", warnBg:"#fef8ec", ok:"#1a6636", okBg:"#edf7ee", err:"#9b1c1c", errBg:"#fef2f2", info:"#1e3a5f", infoBg:"#eff6ff", purple:"#6a1b9a", purpleBg:"rgba(106,27,154,0.10)" };
  const accent = isBrandAmbassadorView ? "#0891b2" : C.ink;
  const accentBg = isBrandAmbassadorView ? "rgba(8,145,178,0.08)" : C.ivory;
  const accentMid = isBrandAmbassadorView ? "rgba(8,145,178,0.18)" : C.smoke;
  const inp = { padding:"11px 13px", fontSize:13, color:C.ink, background:C.white, border:`1px solid ${C.smoke}`, borderRadius:8, outline:"none", fontFamily:"'Inter',sans-serif", width:"100%", boxSizing:"border-box" };
  const statusBadge = (st) => { const m={lead:[C.warnBg,C.warn],active:[C.okBg,C.ok],completed:[C.infoBg,C.info],inactive:[C.ivory,C.dust],churned:[C.errBg,C.err]}; const [bg,clr]=m[st]||[C.ivory,C.slate]; return {display:"inline-flex",alignItems:"center",padding:"3px 10px",borderRadius:99,fontSize:11,fontWeight:600,letterSpacing:"0.06em",textTransform:"uppercase",background:bg,color:clr}; };
  const invoiceBadge = (st) => { const m={pending:[C.warnBg,C.warn],sent:[C.infoBg,C.info],paid:[C.okBg,C.ok]}; const [bg,clr]=m[st]||[C.ivory,C.slate]; return {display:"inline-flex",alignItems:"center",padding:"3px 10px",borderRadius:99,fontSize:11,fontWeight:600,letterSpacing:"0.06em",textTransform:"uppercase",background:bg,color:clr}; };

  const activeCount = React.useMemo(() => clients.filter((c) => c.status === "active").length, [clients]);
  const leadCount = React.useMemo(() => clients.filter((c) => c.status === "lead").length, [clients]);
  const metrics = React.useMemo(
    () => [
      { label: isBrandAmbassadorView ? "Total Ambassadors" : "Total Partners", value: clients.length },
      { label: "Active", value: activeCount },
      { label: "Leads", value: leadCount },
    ],
    [clients.length, activeCount, leadCount, isBrandAmbassadorView]
  );

  return (
    <div style={{ padding:"32px 24px", maxWidth:1200, margin:"0 auto" }}>
      {isBrandAmbassadorView && (
        <div style={{ display:"inline-flex", alignItems:"center", gap:6, background:accentBg, border:`1px solid ${accentMid}`, borderRadius:99, padding:"4px 12px", marginBottom:10 }}>
          <span style={{ width:7, height:7, borderRadius:"50%", background:accent, display:"inline-block" }} />
          <span style={{ fontSize:11, fontWeight:700, letterSpacing:"0.1em", textTransform:"uppercase", color:accent }}>Brand Ambassador</span>
        </div>
      )}
      <h1 style={{ fontFamily:"'Cormorant Garamond',Georgia,serif", fontSize:"clamp(26px,4vw,38px)", fontWeight:500, color:isBrandAmbassadorView ? accent : C.ink, letterSpacing:"-0.02em", margin:"0 0 4px" }}>
        {isBrandAmbassadorView ? "Brand Ambassador Management" : "Partner Management"}
      </h1>
      <p style={{ color:C.dust, fontSize:13, marginBottom:24 }}>
        {isBrandAmbassadorView ? "Track brand ambassador leads, campaign status, and engagement details." : "Track your partner roster, contracts, and invoices."}
      </p>

      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(130px,1fr))", gap:12, marginBottom:24 }}>
        {metrics.map((m) => (
          <div key={m.label} style={{ background:C.white, border:`1px solid ${C.smoke}`, borderRadius:12, padding:18, boxShadow:"0 1px 4px rgba(17,17,17,0.04)" }}>
            <p style={{ margin:"0 0 4px", fontSize:11, fontWeight:600, letterSpacing:"0.1em", textTransform:"uppercase", color:C.dust }}>{m.label}</p>
            <p style={{ margin:0, fontFamily:"'Cormorant Garamond',Georgia,serif", fontSize:32, fontWeight:500, color:C.ink, lineHeight:1 }}>{m.value}</p>
          </div>
        ))}
      </div>

      {!tableReady && (
        <div style={{ background:C.infoBg, border:`1px solid rgba(30,58,95,0.15)`, borderRadius:12, padding:"18px 22px", marginBottom:24 }}>
          <p style={{ margin:"0 0 6px", fontWeight:600, color:C.info, fontSize:14 }}>
            {isBrandAmbassadorView ? "Brand ambassador view restored" : "Partner view restored"}
          </p>
          <p style={{ margin:"0 0 10px", color:C.slate, fontSize:13 }}>
            {isBrandAmbassadorView
              ? "The dedicated data table is not available yet, so this page is using booking records as a live fallback instead of blocking the Brand Ambassador tab."
              : "The dedicated partners table is not available yet, so this page is now using your booking records as a live fallback instead of blocking the Business tab."}
          </p>
          <div style={{ display:"flex", gap:10, flexWrap:"wrap" }}>
            <button onClick={fetchClients} style={{ padding:"9px 16px", background:C.ink, color:C.white, border:"none", borderRadius:8, fontSize:12, fontWeight:600, letterSpacing:"0.07em", textTransform:"uppercase", cursor:"pointer", fontFamily:"'Inter',sans-serif" }}>Refresh</button>
            <button onClick={()=>navigator.clipboard.writeText(SETUP_SQL)} style={{ padding:"9px 16px", background:C.white, color:C.ink, border:`1px solid ${C.smoke}`, borderRadius:8, fontSize:12, fontWeight:600, letterSpacing:"0.07em", textTransform:"uppercase", cursor:"pointer", fontFamily:"'Inter',sans-serif" }}>Copy setup SQL</button>
          </div>
        </div>
      )}

      {(tableReady || usingFallbackData) && (
        <div style={{ background:C.white, border:`1px solid ${isBrandAmbassadorView ? accentMid : C.smoke}`, borderTop:isBrandAmbassadorView ? `3px solid ${accent}` : `1px solid ${C.smoke}`, borderRadius:12, padding:"22px 22px", marginBottom:24, boxShadow:"0 1px 4px rgba(17,17,17,0.04)" }}>
          <p style={{ fontFamily:"'Cormorant Garamond',Georgia,serif", fontSize:18, fontWeight:500, color:isBrandAmbassadorView ? accent : C.ink, margin:"0 0 14px" }}>
            {usingFallbackData
              ? (isBrandAmbassadorView ? "Add Ambassador Lead" : "Add Partner Lead")
              : (isBrandAmbassadorView ? "Add Brand Ambassador" : "Add Partner")}
          </p>
          <form onSubmit={saveClient} style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
            <input value={form.name} placeholder={isBrandAmbassadorView ? "Ambassador name" : "Partner name"} onChange={(e)=>setForm({...form,name:e.target.value})} required style={inp} />
            <input value={form.email} placeholder={isBrandAmbassadorView ? "Ambassador email" : "Partner email"} type="email" onChange={(e)=>setForm({...form,email:e.target.value})} style={inp} />
            <input value={form.company} placeholder={isBrandAmbassadorView ? "Brand / platform" : "Company / brand"} onChange={(e)=>setForm({...form,company:e.target.value})} style={inp} />
            <input value={form.service_type} placeholder="Service / project" onChange={(e)=>setForm({...form,service_type:e.target.value})} required style={inp} />
            <input value={form.client_value} placeholder={isBrandAmbassadorView ? "Estimated ambassador value (optional)" : "Partner value (optional)"} type="number" min="0" step="0.01" onChange={(e)=>setForm({...form,client_value:e.target.value})} style={inp} />
            <select value={form.source || "manual"} onChange={(e)=>setForm({...form,source:e.target.value})} style={{ ...inp, appearance:"none", cursor:"pointer" }}>
              <option value="manual">Manual</option>
              <option value="public">Public Form</option>
              <option value="brand_ambassador">Brand Ambassador</option>
              <option value="zapier">Zapier</option>
            </select>
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
            <button style={{ gridColumn:"1/-1", padding:"12px 20px", background:accent, color:C.white, border:"none", borderRadius:8, fontSize:12, fontWeight:600, letterSpacing:"0.08em", textTransform:"uppercase", cursor:"pointer", fontFamily:"'Inter',sans-serif" }}>
              {usingFallbackData
                ? (isBrandAmbassadorView ? "Save Ambassador Lead" : "Save Partner Lead")
                : (isBrandAmbassadorView ? "Save Brand Ambassador" : "Save Partner")}
            </button>
          </form>
        </div>
      )}

      {loading && <p style={{ color:C.dust }}>{isBrandAmbassadorView ? "Loading brand ambassadors…" : "Loading partners…"}</p>}
      {error && <p style={{ color:C.err, fontSize:13 }}>{error}</p>}
      {!loading && tableReady && clients.length === 0 && <p style={{ color:C.dust }}>{isBrandAmbassadorView ? "No brand ambassadors yet. Add one above." : "No partners yet. Add one above."}</p>}

      {!loading && clients.map(client => {
        const initials = (client.name || "?").split(" ").map(w => w[0]).slice(0,2).join("").toUpperCase();
        const isUploading = uploadingId === String(client.id);
        const isBookingBackfill = String(client.id).startsWith("booking-");
        const canUpload = !isBookingBackfill;
        const avatarSrc = getClientAvatarSrc(client.avatar_url);
        const moveDisabled = !!moveToModelsLoading[client.id] || isBookingBackfill;

        return (
          <div key={client.id} style={{ background:C.white, border:`1px solid ${isBrandAmbassadorView ? accentMid : C.smoke}`, borderRadius:12, padding:"16px 18px", marginBottom:12, boxShadow:"0 1px 4px rgba(17,17,17,0.04)" }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:12, flexWrap:"wrap" }}>
              <div style={{ display:"flex", alignItems:"flex-start", gap:12 }}>
                <div style={{ position:"relative", flexShrink:0 }}>
                  <div
                    onClick={() => canUpload && avatarInputRef.current[client.id]?.click()}
                    title={canUpload ? "Click to upload avatar" : ""}
                    style={{ width:52, height:52, borderRadius:10, overflow:"hidden", border:`1px solid ${C.smoke}`, background:C.ivory, display:"flex", alignItems:"center", justifyContent:"center", cursor:canUpload ? "pointer" : "default", position:"relative" }}
                  >
                    {avatarSrc ? (
                      <img src={avatarSrc} alt={client.name} loading="lazy" decoding="async" style={{ width:"100%", height:"100%", objectFit:"cover", display:"block" }} />
                    ) : (
                      <span style={{ fontSize:20, color:C.dust, fontFamily:"'Cormorant Garamond',Georgia,serif" }}>{initials || "?"}</span>
                    )}
                    {isUploading && (
                      <div style={{ position:"absolute", inset:0, background:"rgba(255,255,255,0.7)", display:"flex", alignItems:"center", justifyContent:"center" }}>
                        <span style={{ fontSize:11, color:C.slate }}>…</span>
                      </div>
                    )}
                  </div>
                  {canUpload && (
                    <input
                      type="file"
                      accept="image/*"
                      style={{ display:"none" }}
                      ref={el => { avatarInputRef.current[client.id] = el; }}
                      onChange={e => { const f = e.target.files?.[0]; if (f) uploadAvatar(client.id, f); e.target.value = ""; }}
                    />
                  )}
                </div>

                <div>
                  <p style={{ margin:"0 0 4px", fontSize:15, fontWeight:600, color:C.ink }}>{client.name}</p>
                  <p style={{ margin:"0 0 2px", fontSize:13, color:C.dust }}>{client.email || "No email"}</p>
                  <p style={{ margin:"0 0 2px", fontSize:13, color:C.dust }}>{client.service_type || client.project || "General"}</p>
                  <p style={{ margin:0, fontSize:12, color:C.dust }}>Created: {new Date(client.created_at).toLocaleString()}</p>
                  {Number(client.client_value || 0) > 0 && <p style={{ margin:"4px 0 0", fontSize:13, color:C.slate }}>Value: ${Number(client.client_value).toLocaleString()}</p>}
                </div>
              </div>

              <div style={{ display:"flex", gap:8, alignItems:"center", flexWrap:"wrap" }}>
                {isBrandAmbassadorView && <span style={{ ...statusBadge("active"), background:accentBg, color:accent }}>Brand Ambassador</span>}
                <span style={statusBadge(client.status)}>{client.status}</span>
                <span style={invoiceBadge(client.invoice_status)}>{client.invoice_status}</span>
                {client.contract_signed && <span style={{ ...statusBadge("active"), background:C.purpleBg, color:C.purple }}>Contract ✓</span>}
              </div>
            </div>

            <div style={{ display:"flex", gap:8, flexWrap:"wrap", marginTop:10, paddingTop:10, borderTop:`1px solid ${C.smoke}` }}>
              {canUpload && (
                <button
                  onClick={() => avatarInputRef.current[client.id]?.click()}
                  style={{ padding:"4px 10px", background:C.ivory, color:C.slate, border:`1px solid ${C.smoke}`, borderRadius:7, fontSize:11, fontWeight:600, letterSpacing:"0.05em", textTransform:"uppercase", cursor:"pointer", fontFamily:"'Inter',sans-serif" }}
                >
                  Upload Avatar
                </button>
              )}

              {isBrandAmbassadorView && (
                <button
                  onClick={() => !moveDisabled && moveBackToModels(client)}
                  disabled={moveDisabled}
                  title={isBookingBackfill ? "Unavailable for fallback booking rows" : "Move this ambassador back into Models"}
                  style={{
                    padding: "4px 10px",
                    background: movedToModels[client.id] ? C.okBg : "rgba(146,86,10,0.1)",
                    color: movedToModels[client.id] ? C.ok : C.warn,
                    border: `1px solid ${movedToModels[client.id] ? "rgba(26,102,54,0.25)" : "rgba(146,86,10,0.25)"}`,
                    borderRadius: 7,
                    fontSize: 11,
                    fontWeight: 600,
                    letterSpacing: "0.05em",
                    textTransform: "uppercase",
                    cursor: moveDisabled ? "not-allowed" : "pointer",
                    fontFamily: "'Inter',sans-serif",
                    opacity: moveDisabled ? 0.65 : 1,
                  }}
                >
                  {moveToModelsLoading[client.id] ? "Moving..." : movedToModels[client.id] ? "Moved" : "Move Back to Models"}
                </button>
              )}

              <button
                onClick={() => navigator.clipboard.writeText(`${window.location.origin}/digitals/${client.id}`)}
                title="Copy photo upload link"
                style={{ padding:"4px 10px", background:C.okBg, color:C.ok, border:`1px solid rgba(26,102,54,0.2)`, borderRadius:7, fontSize:11, fontWeight:600, letterSpacing:"0.05em", textTransform:"uppercase", cursor:"pointer", fontFamily:"'Inter',sans-serif" }}
              >
                Copy Upload Link
              </button>
              <button
                onClick={() => window.open(`${window.location.origin}/digitals/${client.id}`, "_blank", "noopener,noreferrer")}
                title="Open photo upload portal"
                style={{ padding:"4px 10px", background:C.ink, color:C.white, border:`1px solid ${C.ink}`, borderRadius:7, fontSize:11, fontWeight:600, letterSpacing:"0.05em", textTransform:"uppercase", cursor:"pointer", fontFamily:"'Inter',sans-serif" }}
              >
                Open Upload
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
