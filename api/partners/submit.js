import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

const admin = supabaseUrl && serviceRoleKey ? createClient(supabaseUrl, serviceRoleKey) : null;

const ALLOWED_ORIGINS = new Set([
  "https://meet-serenity.online",
  "https://smithinc-app.vercel.app",
  "http://localhost:5173",
  "http://localhost:3000",
]);

const normalizeEmail = (value) => (value || "").trim().toLowerCase();
const isValidEmail = (value) => /.+@.+\..+/.test(normalizeEmail(value));
const ALLOWED_SOURCES = new Set(["public", "brand_ambassador", "manual", "zapier"]);

const isTableMissingError = (err) => {
  const msg = (err?.message || "").toLowerCase();
  return (
    err?.code === "42P01" ||
    (msg.includes("does not exist") && msg.includes("partners")) ||
    msg.includes("relation \"partners\"")
  );
};

const isMissingColumnError = (err) =>
  err?.code === "42703" ||
  (err?.message || "").toLowerCase().includes("column") ||
  (err?.message || "").toLowerCase().includes("schema cache");

const getMissingColumnName = (err) => {
  const msg = String(err?.message || "");
  const m = msg.match(/'([a-zA-Z0-9_]+)'/);
  return m?.[1] || "";
};

async function insertWithColumnFallback(payload) {
  const mutable = { ...payload };

  for (let i = 0; i < 8; i += 1) {
    const { error } = await admin.from("partners").insert([mutable]);
    if (!error) return null;
    if (!isMissingColumnError(error)) return error;

    const missing = getMissingColumnName(error);
    if (!missing || !(missing in mutable)) return error;
    delete mutable[missing];
  }

  return new Error("Failed to insert partner record after column fallbacks");
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!supabaseUrl || !serviceRoleKey || !admin) {
    return res.status(503).json({ error: "Missing Supabase server environment variables" });
  }

  const origin = req.headers.origin || req.headers.referer || "";
  const originBase = origin.split("/").slice(0, 3).join("/");
  if (origin && !ALLOWED_ORIGINS.has(originBase)) {
    return res.status(403).json({ error: "Forbidden" });
  }

  const {
    name = "",
    email = "",
    company = "",
    website = "",
    notes = "",
    source = "public",
  } = req.body || {};

  const cleanName = String(name || "").trim();
  const cleanEmail = normalizeEmail(email);

  if (!cleanName || !isValidEmail(cleanEmail)) {
    return res.status(400).json({ error: "Name and valid email are required" });
  }

  const payload = {
    name: cleanName,
    email: cleanEmail,
    company: String(company || "").trim(),
    website: String(website || "").trim(),
    notes: String(notes || "").trim(),
    source: ALLOWED_SOURCES.has(String(source || "").trim()) ? String(source || "").trim() : "public",
    status: "pending",
    submitted_at: new Date().toISOString(),
    last_updated: new Date().toISOString(),
  };

  try {
    const insertError = await insertWithColumnFallback(payload);
    if (insertError) {
      if (isTableMissingError(insertError)) {
        return res.status(503).json({ error: "Partners table is not set up yet" });
      }
      throw insertError;
    }

    await admin.from("alerts").insert([
      {
        title: "New partner submission",
        message: `${cleanName} submitted a partner application.`,
        audience_role: "admin",
        source_type: "partner_submission",
        source_id: cleanEmail,
        level: "info",
        status: "unread",
        created_at: new Date().toISOString(),
      },
    ]).then(() => {}).catch(() => {});

    return res.status(200).json({ ok: true });
  } catch (err) {
    return res.status(500).json({ error: err.message || "Failed to submit partner application" });
  }
}
