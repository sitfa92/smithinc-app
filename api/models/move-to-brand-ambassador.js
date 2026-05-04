import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

const ADMIN_EMAILS = new Set(["sitfa92@gmail.com", "chizzyboi72@gmail.com", "marthajohn223355@gmail.com"]);
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

async function requireAdminOrAgent(req, res) {
  const authHeader = req.headers.authorization || "";
  if (!authHeader.startsWith("Bearer ")) {
    res.status(401).json({ error: "Authentication required" });
    return false;
  }

  const token = authHeader.slice(7).trim();
  try {
    const {
      data: { user },
      error,
    } = await admin.auth.getUser(token);

    if (error || !user?.email || !ADMIN_EMAILS.has(normalizeEmail(user.email))) {
      res.status(403).json({ error: "Forbidden" });
      return false;
    }
  } catch (_err) {
    res.status(401).json({ error: "Authentication failed" });
    return false;
  }

  return true;
}

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

const mapModelStatusToClientStatus = (status) => {
  const value = String(status || "").toLowerCase();
  if (["approved", "active", "signed", "booked"].includes(value)) return "active";
  if (["rejected", "declined"].includes(value)) return "inactive";
  if (["completed", "done"].includes(value)) return "completed";
  return "lead";
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!supabaseUrl || !serviceRoleKey || !admin) {
    return res.status(503).json({ error: "Missing Supabase server environment variables" });
  }

  if (!(await requireAdminOrAgent(req, res))) return;

  const { modelId } = req.body || {};
  if (!modelId) {
    return res.status(400).json({ error: "Missing modelId" });
  }

  const { data: model, error: modelError } = await admin
    .from("models")
    .select("id, name, email, instagram, image_url, status, agency_name, scouting_notes, internal_notes")
    .eq("id", modelId)
    .single();

  if (modelError || !model) {
    return res.status(404).json({ error: "Model not found" });
  }

  const email = normalizeEmail(model.email);
  const combinedNotes = [
    model.scouting_notes ? `Scouting: ${model.scouting_notes}` : "",
    model.internal_notes ? `Internal: ${model.internal_notes}` : "",
    model.instagram ? `Instagram: ${model.instagram}` : "",
    `Moved from Models on ${new Date().toISOString()}`,
  ]
    .filter(Boolean)
    .join("\n");

  const now = new Date().toISOString();
  const payload = {
    name: model.name || "",
    email,
    project: model.agency_name || "Brand Ambassador",
    service_type: "Brand Ambassador",
    status: mapModelStatusToClientStatus(model.status),
    source: "brand_ambassador",
    avatar_url: model.image_url || "",
    internal_notes: combinedNotes,
    created_at: now,
    updated_at: now,
    last_updated: now,
  };

  if (email) {
    const { data: existing, error: existingError } = await admin
      .from("clients")
      .select("id, internal_notes")
      .eq("email", email)
      .maybeSingle();

    if (existingError) {
      return res.status(500).json({ error: existingError.message || "Failed to check existing brand ambassador" });
    }

    if (existing?.id) {
      const mergedNotes = [existing.internal_notes || "", combinedNotes].filter(Boolean).join("\n\n");
      const updatePayload = {
        source: "brand_ambassador",
        avatar_url: payload.avatar_url,
        service_type: "Brand Ambassador",
        project: payload.project,
        status: payload.status,
        internal_notes: mergedNotes,
        updated_at: now,
        last_updated: now,
      };
      const { error: updateError } = await admin.from("clients").update(updatePayload).eq("id", existing.id);
      if (updateError) {
        return res.status(500).json({ error: updateError.message || "Failed to update existing brand ambassador record" });
      }

      return res.status(200).json({ ok: true, clientId: existing.id, mode: "updated" });
    }
  }

  const insertError = await insertClientWithColumnFallback(payload);
  if (insertError) {
    return res.status(500).json({ error: insertError.message || "Failed to create brand ambassador record" });
  }

  return res.status(200).json({ ok: true, mode: "inserted" });
}