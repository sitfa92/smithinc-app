import { createClient } from "@supabase/supabase-js";
import { requireBusinessAccess } from "../_business-access.js";

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

const admin = supabaseUrl && serviceRoleKey ? createClient(supabaseUrl, serviceRoleKey) : null;

const isMissingColumnError = (err) =>
  err?.code === "42703" ||
  (err?.message || "").toLowerCase().includes("column") ||
  (err?.message || "").toLowerCase().includes("schema cache");

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!supabaseUrl || !serviceRoleKey || !admin) {
    return res.status(503).json({ error: "Missing Supabase server environment variables" });
  }

  if (!(await requireBusinessAccess({ req, res, admin }))) return;

  const selectFields = [
    "id", "name", "email", "project", "service_type", "status",
    "invoice_status", "invoice_paid", "contract_signed", "client_value",
    "source", "avatar_url", "pipeline_stage", "priority_level",
    "internal_notes", "next_step", "last_updated", "created_at",
  ].join(", ");

  // First try full select with pipeline columns
  let pipelineSchemaReady = true;
  let champSchemaReady = true;
  let { data, error } = await admin
    .from("clients")
    .select(selectFields)
    .order("last_updated", { ascending: false });

  if (error) {
    pipelineSchemaReady = false;
    // Fallback: strip pipeline columns if schema not yet updated
    const fallbackFields = "id, name, email, project, service_type, status, invoice_status, invoice_paid, contract_signed, client_value, source, avatar_url, created_at";
    const fallback = await admin
      .from("clients")
      .select(fallbackFields)
      .order("created_at", { ascending: false });

    if (fallback.error) {
      return res.status(500).json({ error: fallback.error.message || "Failed to load clients" });
    }
    data = fallback.data;
  }

  const champFields = "id, champ_c_score, champ_h_score, champ_m_score, champ_p_score, champ_c_notes, champ_h_notes, champ_m_notes, champ_p_notes, champ_total, champ_recommendation";
  const { data: champRows, error: champError } = await admin.from("clients").select(champFields);

  if (champError) {
    champSchemaReady = false;
    if (!isMissingColumnError(champError)) {
      console.error("Failed to load CHAMP data:", champError.message || champError);
    }
  } else if (Array.isArray(data) && Array.isArray(champRows)) {
    const champById = new Map((champRows || []).map((row) => [row.id, row]));
    data = data.map((row) => ({ ...row, ...(champById.get(row.id) || {}) }));
  }

  return res.status(200).json({ clients: data || [], pipelineSchemaReady, champSchemaReady });
}
