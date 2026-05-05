import { createClient } from "@supabase/supabase-js";
import { requireBusinessAccess } from "../_business-access";

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

const normalizeEmail = (v) => (v || "").trim().toLowerCase();

const admin = supabaseUrl && serviceRoleKey ? createClient(supabaseUrl, serviceRoleKey) : null;

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
  if (!supabaseUrl || !serviceRoleKey || !admin) {
    return res.status(503).json({ error: "Missing Supabase server environment variables" });
  }

  if (!(await requireBusinessAccess({ req, res, admin }))) return;

  if (req.method === "GET") {
    // Use schema-tolerant reads to avoid false setup failures when optional columns are missing.
    let { data, error } = await admin
      .from("partners")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500);

    if (error && isMissingColumnError(error) && getMissingColumnName(error) === "created_at") {
      const fallback = await admin
        .from("partners")
        .select("*")
        .limit(500);
      data = fallback.data;
      error = fallback.error;
    }

    if (error) {
      if (isTableMissingError(error)) {
        return res.status(503).json({ error: "Partners table is not set up yet", code: "TABLE_SETUP_REQUIRED" });
      }
      return res.status(500).json({ error: error.message || "Failed to load partner submissions" });
    }

    const normalized = (data || []).map((row) => ({
      id: row.id,
      name: row.name || "",
      email: row.email || "",
      company: row.company || "",
      website: row.website || "",
      notes: row.notes || "",
      status: row.status || "pending",
      source: row.source || "manual",
      submitted_at: row.submitted_at || row.created_at || null,
      created_at: row.created_at || row.submitted_at || null,
    }));

    return res.status(200).json({ ok: true, data: normalized });
  }

  if (req.method === "POST") {
    const { name = "", email = "", company = "", website = "", notes = "", source = "manual" } = req.body || {};
    const payload = {
      name: String(name || "").trim(),
      email: normalizeEmail(email),
      company: String(company || "").trim(),
      website: String(website || "").trim(),
      notes: String(notes || "").trim(),
      source: String(source || "manual").trim() || "manual",
      status: "pending",
      submitted_at: new Date().toISOString(),
      last_updated: new Date().toISOString(),
    };

    if (!payload.name || !payload.email) {
      return res.status(400).json({ error: "Name and email are required" });
    }

    const error = await insertWithColumnFallback(payload);
    if (error) {
      if (isTableMissingError(error)) {
        return res.status(503).json({ error: "Partners table is not set up yet", code: "TABLE_SETUP_REQUIRED" });
      }
      return res.status(500).json({ error: error.message || "Failed to save partner submission" });
    }

    return res.status(200).json({ ok: true });
  }

  if (req.method === "PATCH") {
    const { submissionId, nextStatus } = req.body || {};
    if (!submissionId || !nextStatus) {
      return res.status(400).json({ error: "Missing submissionId or nextStatus" });
    }

    let { error } = await admin
      .from("partners")
      .update({ status: nextStatus, last_updated: new Date().toISOString() })
      .eq("id", submissionId);

    if (error && isMissingColumnError(error) && getMissingColumnName(error) === "last_updated") {
      const retry = await admin
        .from("partners")
        .update({ status: nextStatus })
        .eq("id", submissionId);
      error = retry.error;
    }

    if (error) {
      return res.status(500).json({ error: error.message || "Failed to update partner submission" });
    }

    return res.status(200).json({ ok: true });
  }

  if (req.method === "DELETE") {
    const { rejectedOnly = false, scope = "all" } = req.body || {};
    if (!rejectedOnly) {
      return res.status(400).json({ error: "Only rejectedOnly delete is supported" });
    }

    let scan = admin
      .from("partners")
      .select("id, source")
      .eq("status", "rejected")
      .limit(5000);

    if (scope === "brand_ambassador") {
      scan = scan.eq("source", "brand_ambassador");
    } else if (scope === "partner") {
      scan = scan.neq("source", "brand_ambassador");
    }

    const { data: rejectedRows, error: scanError } = await scan;
    if (scanError) {
      return res.status(500).json({ error: scanError.message || "Failed to load rejected submissions" });
    }

    const ids = (rejectedRows || []).map((row) => row.id).filter(Boolean);
    if (!ids.length) {
      return res.status(200).json({ ok: true, deletedCount: 0 });
    }

    const { error: deleteError } = await admin.from("partners").delete().in("id", ids);
    if (deleteError) {
      return res.status(500).json({ error: deleteError.message || "Failed to delete rejected submissions" });
    }

    return res.status(200).json({ ok: true, deletedCount: ids.length });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
