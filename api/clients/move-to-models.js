import { createClient } from "@supabase/supabase-js";
import { requireBusinessAccess } from "../_business-access";

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

const normalizeEmail = (v) => (v || "").trim().toLowerCase();

const admin = supabaseUrl && serviceRoleKey ? createClient(supabaseUrl, serviceRoleKey) : null;

const isMissingColumnError = (err) =>
  err?.code === "42703" ||
  (err?.message || "").toLowerCase().includes("column") ||
  (err?.message || "").toLowerCase().includes("schema cache");

const getMissingColumnName = (err) => {
  const msg = String(err?.message || "");
  const m = msg.match(/'([a-zA-Z0-9_]+)'/);
  return m?.[1] || "";
};

async function insertModelWithColumnFallback(payload) {
  const mutable = { ...payload };

  for (let i = 0; i < 10; i += 1) {
    const { error } = await admin.from("models").insert([mutable]);
    if (!error) return null;
    if (!isMissingColumnError(error)) return error;

    const missing = getMissingColumnName(error);
    if (!missing || !(missing in mutable)) return error;
    delete mutable[missing];
  }

  return new Error("Failed to insert model after column fallbacks");
}

const mapClientStatusToModelStatus = (status) => {
  const value = String(status || "").toLowerCase();
  if (["active", "approved", "completed"].includes(value)) return "approved";
  if (["inactive", "churned"].includes(value)) return "rejected";
  return "pending";
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!supabaseUrl || !serviceRoleKey || !admin) {
    return res.status(503).json({ error: "Missing Supabase server environment variables" });
  }

  if (!(await requireBusinessAccess({ req, res, admin }))) return;

  const { clientId } = req.body || {};
  if (!clientId) {
    return res.status(400).json({ error: "Missing clientId" });
  }

  const { data: client, error: clientError } = await admin
    .from("clients")
    .select("id, name, email, service_type, project, avatar_url, internal_notes, status, source")
    .eq("id", clientId)
    .single();

  if (clientError || !client) {
    return res.status(404).json({ error: "Brand ambassador record not found" });
  }

  const email = normalizeEmail(client.email);
  const now = new Date().toISOString();
  const newInternalNotes = [
    client.internal_notes || "",
    `Moved back from Brand Ambassadors on ${now}`,
  ]
    .filter(Boolean)
    .join("\n\n");

  const payload = {
    name: client.name || "",
    email,
    image_url: client.avatar_url || "",
    status: mapClientStatusToModelStatus(client.status),
    source: "manual",
    agency_name: client.project || client.service_type || "",
    internal_notes: newInternalNotes,
    pipeline_stage: "submitted",
    priority_level: "medium",
    submitted_at: now,
    last_updated: now,
  };

  if (email) {
    const { data: existing, error: existingError } = await admin
      .from("models")
      .select("id, internal_notes")
      .eq("email", email)
      .maybeSingle();

    if (existingError) {
      return res.status(500).json({ error: existingError.message || "Failed to check existing model" });
    }

    if (existing?.id) {
      const mergedNotes = [existing.internal_notes || "", newInternalNotes].filter(Boolean).join("\n\n");
      const updatePayload = {
        image_url: payload.image_url,
        status: payload.status,
        source: "manual",
        agency_name: payload.agency_name,
        internal_notes: mergedNotes,
        last_updated: now,
      };
      const { error: updateError } = await admin.from("models").update(updatePayload).eq("id", existing.id);
      if (updateError) {
        return res.status(500).json({ error: updateError.message || "Failed to update existing model" });
      }

      const { error: sourceUpdateError } = await admin
        .from("clients")
        .update({ source: "manual", updated_at: now, last_updated: now })
        .eq("id", client.id);
      if (sourceUpdateError) {
        return res.status(500).json({ error: sourceUpdateError.message || "Model updated, but failed to update brand ambassador source" });
      }

      return res.status(200).json({ ok: true, modelId: existing.id, mode: "updated" });
    }
  }

  const insertError = await insertModelWithColumnFallback(payload);
  if (insertError) {
    return res.status(500).json({ error: insertError.message || "Failed to create model record" });
  }

  const { error: sourceUpdateError } = await admin
    .from("clients")
    .update({ source: "manual", updated_at: now, last_updated: now })
    .eq("id", client.id);
  if (sourceUpdateError) {
    return res.status(500).json({ error: sourceUpdateError.message || "Model created, but failed to update brand ambassador source" });
  }

  return res.status(200).json({ ok: true, mode: "inserted" });
}