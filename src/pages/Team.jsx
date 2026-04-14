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

  return (
    <div style={{ padding: 20, maxWidth: 1000, margin: "0 auto" }}>
      <h1>Team Management</h1>
      <p style={{ color: "#666" }}>Manage allowed users and assign role access.</p>

      {!tableReady && (
        <div style={{ background: "#fff3e0", border: "1px solid #ff9800", borderRadius: 8, padding: 16, marginBottom: 20 }}>
          <strong style={{ color: "#e65100" }}>Database setup required</strong>
          <p style={{ margin: "8px 0", color: "#555" }}>The users table doesn't exist yet. Copy and run this SQL in your{" "}
            <a href="https://supabase.com/dashboard/project/jjmmakbnjzzxbuflucck/sql" target="_blank" rel="noreferrer">Supabase SQL Editor</a>.
            Until then, your team is shown from the built-in defaults (read-only).
          </p>
          <pre style={{ background: "#f5f5f5", padding: 12, borderRadius: 6, fontSize: 12, overflowX: "auto", whiteSpace: "pre-wrap" }}>{SETUP_SQL}</pre>
          <button onClick={() => { navigator.clipboard.writeText(SETUP_SQL); }}
            style={{ marginTop: 8, padding: "8px 14px", background: "#333", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer" }}>
            Copy SQL
          </button>
        </div>
      )}

      {tableReady && (
        <form onSubmit={addMember} style={{ display: "grid", gap: 10, marginTop: 14, marginBottom: 20 }}>
          <input value={form.email} placeholder="team@meetserenity.com" type="email"
            onChange={(e) => setForm({ ...form, email: e.target.value })} required
            style={{ padding: 10, border: "1px solid #ccc", borderRadius: 4 }} />
          <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}
            style={{ padding: 10, border: "1px solid #ccc", borderRadius: 4 }}>
            <option value="admin">Admin</option>
            <option value="va">Virtual Assistant</option>
            <option value="agent">Agent</option>
            <option value="user">User</option>
          </select>
          <label style={{ color: "#666" }}>
            <input type="checkbox" checked={form.is_active}
              onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
              style={{ marginRight: 8 }} />
            Active account
          </label>
          <button style={{ width: 160, padding: 10, background: "#333", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer" }}>
            Add Team Member
          </button>
        </form>
      )}

      <div style={{ border: "1px solid #e0e0e0", borderRadius: 8, padding: 14, marginBottom: 20 }}>
        <h2 style={{ marginTop: 0 }}>Non-Admin Login Links</h2>
        <p style={{ color: "#666", marginTop: 0 }}>
          Share these links with your VA and agent users. Each link opens the team login screen with their email prefilled.
        </p>
        {nonAdminLoginLinks.length === 0 && <p style={{ color: "#666" }}>No active non-admin users found.</p>}
        {nonAdminLoginLinks.map((item) => (
          <div key={item.email} style={{ border: "1px solid #eee", borderRadius: 6, padding: 10, marginBottom: 8 }}>
            <p style={{ margin: "0 0 4px 0", fontWeight: 600 }}>{item.role}: {item.email}</p>
            <p style={{ margin: "0 0 8px 0", color: "#666", wordBreak: "break-all" }}>{item.loginUrl}</p>
            <button
              onClick={() => navigator.clipboard.writeText(item.loginUrl)}
              style={{ padding: "8px 10px", border: "none", borderRadius: 4, cursor: "pointer", background: "#333", color: "white" }}
            >
              Copy Login Link
            </button>
          </div>
        ))}
      </div>

      {loading && <p>Loading team...</p>}
      {error && <p style={{ color: "#d32f2f" }}>{error}</p>}

      {!loading && members.map((member) => (
        <div key={member.id} style={{ border: "1px solid #e0e0e0", borderRadius: 8, padding: 12, marginBottom: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <p style={{ margin: 0, fontWeight: 600, flex: 1 }}>{member.email}</p>
            <span style={{
              padding: "3px 10px", borderRadius: 20, fontSize: 12, fontWeight: 600,
              background: member.is_active ? "#e8f5e9" : "#ffebee",
              color: member.is_active ? "#388e3c" : "#c62828",
            }}>
              {member.is_active ? "Active" : "Inactive"}
            </span>
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
            {tableReady ? (
              <>
                <select value={member.role || "user"} onChange={(e) => updateRole(member.id, e.target.value)}
                  style={{ padding: 8, border: "1px solid #ccc", borderRadius: 4 }}>
                  <option value="admin">Admin</option>
                  <option value="va">Virtual Assistant</option>
                  <option value="agent">Agent</option>
                  <option value="user">User</option>
                </select>
                <button onClick={() => toggleActive(member.id, !!member.is_active)}
                  style={{ padding: "8px 10px", border: "none", borderRadius: 4, cursor: "pointer",
                    background: member.is_active ? "#f44336" : "#4caf50", color: "white" }}>
                  {member.is_active ? "Deactivate" : "Activate"}
                </button>
              </>
            ) : (
              <span style={{ color: "#999", fontSize: 13 }}>Role: {roleLabel[member.role] || member.role} (read-only until table is created)</span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
