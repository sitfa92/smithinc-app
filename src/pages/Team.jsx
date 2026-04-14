import React from "react";
import { supabase } from "../supabase";
import { useAuth } from "../auth";
import { DEFAULT_ROLE_BY_EMAIL, buildPrefilledLoginLink } from "../utils";

export default function Team() {
  const [members, setMembers] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [tableReady, setTableReady] = React.useState(true);
  const [error, setError] = React.useState("");
  const [form, setForm] = React.useState({ email: "", role: "user", is_active: true });

  const SETUP_SQL = `-- Run this in your Supabase SQL Editor:
create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  role text not null default 'user',
  is_active boolean not null default true,
  created_at timestamptz default now()
);

-- Disable RLS so the app can read/write (internal admin tool):
alter table public.users disable row level security;

-- Seed your three team members:
insert into public.users (email, role, is_active) values
  ('sitfa92@gmail.com', 'admin', true),
  ('marthajohn223355@gmail.com', 'va', true),
  ('chizzyboi72@gmail.com', 'agent', true)
on conflict (email) do nothing;`;

  const isTableMissingError = (err) =>
    err?.code === "42P01" ||
    err?.code === "42501" ||
    err?.message?.toLowerCase().includes("does not exist") ||
    err?.message?.toLowerCase().includes("relation") ||
    err?.message?.toLowerCase().includes("permission") ||
    err?.message?.toLowerCase().includes("policy") ||
    err?.message?.toLowerCase().includes("rls");

  const DEFAULT_MEMBERS = Object.entries(DEFAULT_ROLE_BY_EMAIL).map(([email, role]) => ({
    id: email,
    email,
    role,
    is_active: true,
    created_at: null,
  }));

  const fetchMembers = async () => {
    try {
      setError("");
      const { data, error } = await supabase
        .from("users")
        .select("id, email, role, is_active, created_at")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setTableReady(true);
      setMembers(data || []);
    } catch (err) {
      if (isTableMissingError(err)) {
        setTableReady(false);
        setMembers(DEFAULT_MEMBERS);
      } else {
        setError(err.message || "Failed to load team");
      }
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    fetchMembers();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const addMember = async (e) => {
    e.preventDefault();
    try {
      const { error } = await supabase.from("users").insert([{
        email: form.email.trim().toLowerCase(),
        role: form.role,
        is_active: form.is_active,
        created_at: new Date().toISOString(),
      }]);
      if (error) throw error;
      setForm({ email: "", role: "user", is_active: true });
      fetchMembers();
    } catch (err) {
      setError(err.message || "Failed to add team member");
    }
  };

  const updateRole = async (memberId, role) => {
    try {
      const { error } = await supabase.from("users").update({ role }).eq("id", memberId);
      if (error) throw error;
      fetchMembers();
    } catch (err) {
      setError(err.message || "Failed to update role");
    }
  };

  const toggleActive = async (memberId, isActive) => {
    try {
      const { error } = await supabase.from("users").update({ is_active: !isActive }).eq("id", memberId);
      if (error) throw error;
      fetchMembers();
    } catch (err) {
      setError(err.message || "Failed to update status");
    }
  };

  const roleLabel = { admin: "Admin", va: "Virtual Assistant", agent: "Agent", user: "User" };
  const nonAdminLoginLinks = members
    .filter((member) => member.is_active !== false && (member.role || "user") !== "admin")
    .map((member) => ({
      email: (member.email || "").trim().toLowerCase(),
      role: roleLabel[member.role] || member.role || "User",
      loginUrl: buildPrefilledLoginLink(member.email),
    }));

  const C = { ink:"#111111", slate:"#4a4a4a", dust:"#888888", smoke:"#e8e4dc", ivory:"#faf8f4", white:"#ffffff", warn:"#92560a", warnBg:"#fef8ec", ok:"#1a6636", okBg:"#edf7ee", err:"#9b1c1c", errBg:"#fef2f2", info:"#1e3a5f", infoBg:"#eff6ff" };
  const inp = { padding:"11px 13px", fontSize:13, color:C.ink, background:C.white, border:`1px solid ${C.smoke}`, borderRadius:8, outline:"none", fontFamily:"'Inter',sans-serif", width:"100%", boxSizing:"border-box" };

  return (
    <div style={{ padding:"32px 24px", maxWidth:1000, margin:"0 auto" }}>
      <h1 style={{ fontFamily:"'Cormorant Garamond',Georgia,serif", fontSize:"clamp(26px,4vw,38px)", fontWeight:500, color:C.ink, letterSpacing:"-0.02em", margin:"0 0 4px" }}>Team Management</h1>
      <p style={{ color:C.dust, fontSize:13, marginBottom:24 }}>Manage allowed users and assign role access.</p>

      {!tableReady && (
        <div style={{ background:C.warnBg, border:`1px solid rgba(146,86,10,0.2)`, borderRadius:12, padding:"18px 22px", marginBottom:24 }}>
          <p style={{ margin:"0 0 6px", fontWeight:600, color:C.warn, fontSize:14 }}>Database setup required</p>
          <p style={{ margin:"0 0 10px", color:C.slate, fontSize:13 }}>
            The users table doesn't exist yet. Copy and run this SQL in your{" "}
            <a href="https://supabase.com/dashboard/project/jjmmakbnjzzxbuflucck/sql" target="_blank" rel="noreferrer" style={{ color:C.ink }}>Supabase SQL Editor</a>.
            Until then, your team is shown from the built-in defaults (read-only).
          </p>
          <pre style={{ background:C.ivory, border:`1px solid ${C.smoke}`, padding:"12px 14px", borderRadius:8, fontSize:11, overflowX:"auto", whiteSpace:"pre-wrap", color:C.slate }}>{SETUP_SQL}</pre>
          <button onClick={()=>navigator.clipboard.writeText(SETUP_SQL)} style={{ marginTop:10, padding:"9px 16px", background:C.ink, color:C.white, border:"none", borderRadius:8, fontSize:12, fontWeight:600, letterSpacing:"0.07em", textTransform:"uppercase", cursor:"pointer", fontFamily:"'Inter',sans-serif" }}>Copy SQL</button>
        </div>
      )}

      {tableReady && (
        <div style={{ background:C.white, border:`1px solid ${C.smoke}`, borderRadius:12, padding:"22px 22px", marginBottom:24, boxShadow:"0 1px 4px rgba(17,17,17,0.04)" }}>
          <p style={{ fontFamily:"'Cormorant Garamond',Georgia,serif", fontSize:18, fontWeight:500, color:C.ink, margin:"0 0 14px" }}>Add Team Member</p>
          <form onSubmit={addMember} style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
            <input value={form.email} placeholder="team@meetserenity.com" type="email" onChange={(e)=>setForm({...form,email:e.target.value})} required style={{ ...inp, gridColumn:"1/-1" }} />
            <select value={form.role} onChange={(e)=>setForm({...form,role:e.target.value})} style={{ ...inp, appearance:"none", cursor:"pointer" }}>
              <option value="admin">Admin</option>
              <option value="va">Virtual Assistant</option>
              <option value="agent">Agent</option>
              <option value="user">User</option>
            </select>
            <label style={{ display:"flex", alignItems:"center", gap:8, fontSize:13, color:C.slate, cursor:"pointer" }}>
              <input type="checkbox" checked={form.is_active} onChange={(e)=>setForm({...form,is_active:e.target.checked})} /> Active account
            </label>
            <button style={{ gridColumn:"1/-1", padding:"12px 20px", background:C.ink, color:C.white, border:"none", borderRadius:8, fontSize:12, fontWeight:600, letterSpacing:"0.08em", textTransform:"uppercase", cursor:"pointer", fontFamily:"'Inter',sans-serif" }}>Add Team Member</button>
          </form>
        </div>
      )}

      <div style={{ background:C.white, border:`1px solid ${C.smoke}`, borderRadius:12, padding:"22px 22px", marginBottom:24, boxShadow:"0 1px 4px rgba(17,17,17,0.04)" }}>
        <p style={{ fontFamily:"'Cormorant Garamond',Georgia,serif", fontSize:18, fontWeight:500, color:C.ink, margin:"0 0 4px" }}>Non-Admin Login Links</p>
        <p style={{ color:C.dust, fontSize:13, marginBottom:14 }}>Share these links with your VA and agent users. Each link opens the team login with their email prefilled.</p>
        {nonAdminLoginLinks.length === 0 && <p style={{ color:C.dust, fontSize:13 }}>No active non-admin users found.</p>}
        {nonAdminLoginLinks.map(item => (
          <div key={item.email} style={{ border:`1px solid ${C.smoke}`, borderRadius:8, padding:"12px 14px", marginBottom:8 }}>
            <p style={{ margin:"0 0 3px", fontWeight:600, fontSize:13, color:C.ink }}>{item.role}: {item.email}</p>
            <p style={{ margin:"0 0 8px", color:C.dust, fontSize:12, wordBreak:"break-all" }}>{item.loginUrl}</p>
            <button onClick={()=>navigator.clipboard.writeText(item.loginUrl)} style={{ padding:"8px 14px", background:C.ink, color:C.white, border:"none", borderRadius:6, fontSize:12, fontWeight:600, letterSpacing:"0.07em", textTransform:"uppercase", cursor:"pointer", fontFamily:"'Inter',sans-serif" }}>Copy Link</button>
          </div>
        ))}
      </div>

      {loading && <p style={{ color:C.dust }}>Loading team…</p>}
      {error && <p style={{ color:C.err, fontSize:13 }}>{error}</p>}

      {!loading && members.map(member => (
        <div key={member.id} style={{ border:`1px solid ${C.smoke}`, borderRadius:12, padding:"14px 18px", marginBottom:10, background:C.white, boxShadow:"0 1px 4px rgba(17,17,17,0.04)" }}>
          <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap", justifyContent:"space-between" }}>
            <p style={{ margin:0, fontWeight:600, color:C.ink, fontSize:14 }}>{member.email}</p>
            <span style={{ padding:"3px 10px", borderRadius:99, fontSize:11, fontWeight:600, letterSpacing:"0.06em", textTransform:"uppercase", background:member.is_active ? C.okBg : C.errBg, color:member.is_active ? C.ok : C.err }}>
              {member.is_active ? "Active" : "Inactive"}
            </span>
          </div>
          <div style={{ display:"flex", gap:8, marginTop:10, flexWrap:"wrap" }}>
            {tableReady ? (
              <>
                <select value={member.role || "user"} onChange={(e)=>updateRole(member.id, e.target.value)} style={{ padding:"8px 12px", border:`1px solid ${C.smoke}`, borderRadius:6, fontSize:13, fontFamily:"'Inter',sans-serif", background:C.ivory, color:C.ink }}>
                  <option value="admin">Admin</option>
                  <option value="va">Virtual Assistant</option>
                  <option value="agent">Agent</option>
                  <option value="user">User</option>
                </select>
                <button onClick={()=>toggleActive(member.id, !!member.is_active)} style={{ padding:"8px 14px", border:"none", borderRadius:6, cursor:"pointer", fontSize:12, fontWeight:600, letterSpacing:"0.07em", textTransform:"uppercase", fontFamily:"'Inter',sans-serif", background:member.is_active ? C.errBg : C.okBg, color:member.is_active ? C.err : C.ok }}>
                  {member.is_active ? "Deactivate" : "Activate"}
                </button>
              </>
            ) : (
              <span style={{ color:C.dust, fontSize:13 }}>Role: {roleLabel[member.role] || member.role} (read-only until table is created)</span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
