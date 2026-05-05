import { createClient } from "@supabase/supabase-js";
import { requireBusinessAccess } from "../_business-access.js";

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

const admin = supabaseUrl && serviceRoleKey ? createClient(supabaseUrl, serviceRoleKey) : null;

const ALLOWED_FIELDS = new Set([
  "pipeline_stage",
  "priority_level",
  "internal_notes",
  "next_step",
  "status",
  "last_updated",
  "avatar_url",
]);

const isMissingColumnError = (err) =>
  err?.code === "42703" ||
  (err?.message || "").toLowerCase().includes("column") ||
  (err?.message || "").toLowerCase().includes("schema cache");

const getMissingColumnName = (err) => {
  const msg = String(err?.message || "");
  const m = msg.match(/'([a-zA-Z0-9_]+)'/);
  return m?.[1] || "";
};

const normalizeEmail = (v) => String(v || "").trim().toLowerCase();

async function insertClientWithColumnFallback(payload) {
  const mutable = { ...payload };
  for (let i = 0; i < 10; i += 1) {
    const { error } = await admin.from("clients").insert([mutable]);
    if (!error) return null;
    if (!isMissingColumnError(error)) return error;

    const missing = getMissingColumnName(error);
    if (!missing || !(missing in mutable)) return error;
    delete mutable[missing];
  }
  return new Error("Failed to insert client after column fallbacks");
}

const mapPartnerStatusToClientStatus = (status) => {
  const value = String(status || "").toLowerCase();
  if (["approved", "active", "completed"].includes(value)) return "active";
  if (["rejected", "inactive", "churned"].includes(value)) return "inactive";
  return "lead";
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!supabaseUrl || !serviceRoleKey || !admin) {
    return res.status(503).json({ error: "Missing Supabase server environment variables" });
  }

  if (!(await requireBusinessAccess({ req, res, admin }))) return;

  const { clientId, partnerId, updates } = req.body || {};
  const recordId = partnerId || clientId;
  if (!recordId || !updates || typeof updates !== "object") {
    return res.status(400).json({ error: "Missing partnerId (or clientId) or updates" });
  }

  const cleaned = Object.fromEntries(Object.entries(updates).filter(([key]) => ALLOWED_FIELDS.has(key)));
  if (Object.keys(cleaned).length === 0) {
    return res.status(400).json({ error: "No valid fields to update" });
  }

  const recordIdStr = String(recordId || "");
  if (recordIdStr.startsWith("partner-")) {
    const partnerSourceId = recordIdStr.slice("partner-".length);
    if (!partnerSourceId) {
      return res.status(400).json({ error: "Invalid partnerId" });
    }

    const { data: partnerRow, error: partnerError } = await admin
      .from("partners")
      .select("id, name, email, company, status, created_at, submitted_at")
      .eq("id", partnerSourceId)
      .maybeSingle();

    if (partnerError) {
      return res.status(500).json({ error: partnerError.message || "Failed to resolve partner record" });
    }
    if (!partnerRow) {
      return res.status(404).json({ error: "Partner record not found" });
    }

    const email = normalizeEmail(partnerRow.email);
    let existing = null;
    if (email) {
      const { data: existingRow, error: existingError } = await admin
        .from("clients")
        .select("id")
        .eq("email", email)
        .maybeSingle();
      if (existingError) {
        return res.status(500).json({ error: existingError.message || "Failed to check existing client" });
      }
      existing = existingRow;
    }

    if (existing?.id) {
      const { error: updateError } = await admin
        .from("clients")
        .update({ ...cleaned, source: "brand_ambassador", updated_at: new Date().toISOString() })
        .eq("id", existing.id);
      if (updateError) {
        return res.status(500).json({ error: updateError.message || "Failed to update client" });
      }
      return res.status(200).json({ ok: true, clientId: existing.id, mode: "updated" });
    }

    const now = new Date().toISOString();
    const payload = {
      name: partnerRow.name || "",
      email,
      project: partnerRow.company || "Brand Ambassador",
      service_type: partnerRow.company || "Brand Ambassador",
      status: mapPartnerStatusToClientStatus(partnerRow.status),
      source: "brand_ambassador",
      avatar_url: "",
      created_at: partnerRow.created_at || partnerRow.submitted_at || now,
      updated_at: now,
      ...cleaned,
    };

    const insertError = await insertClientWithColumnFallback(payload);
    if (insertError) {
      return res.status(500).json({ error: insertError.message || "Failed to create client" });
    }

    return res.status(200).json({ ok: true, mode: "created" });
  }

  const { error } = await admin.from("clients").update(cleaned).eq("id", recordId);
  if (error) {
    return res.status(500).json({ error: error.message || "Failed to update partner pipeline" });
  }

  return res.status(200).json({ ok: true });
}
