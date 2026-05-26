import { createClient } from "@supabase/supabase-js";
import { resolveMergedUserAccess } from "../_business-access.js";

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const admin = supabaseUrl && serviceRoleKey ? createClient(supabaseUrl, serviceRoleKey) : null;

const normalizeEmail = (v) => String(v || "").trim().toLowerCase();

async function requireOwner(req, res) {
  const authHeader = req.headers.authorization || "";
  if (!authHeader.startsWith("Bearer ")) {
    res.status(401).json({ error: "Authentication required" });
    return null;
  }

  const token = authHeader.slice(7).trim();
  const {
    data: { user },
    error,
  } = await admin.auth.getUser(token);

  const email = normalizeEmail(user?.email);
  if (error || !email) {
    res.status(403).json({ error: "Forbidden" });
    return null;
  }

  const resolved = await resolveMergedUserAccess(admin, email);
  if (resolved?.error) {
    res.status(500).json({ error: resolved.error.message || "Failed to resolve access" });
    return null;
  }

  if (resolved?.isActive !== true || String(resolved?.role || "").toLowerCase() !== "owner") {
    res.status(403).json({ error: "Owner access required" });
    return null;
  }

  return { email };
}

async function updateModelWithColumnFallback(modelId, values) {
  const mutable = { ...values };
  for (let i = 0; i < 10; i += 1) {
    const { error } = await admin.from("models").update(mutable).eq("id", modelId);
    if (!error) return null;
    const message = String(error?.message || "");
    const missing = message.match(/'([a-zA-Z0-9_]+)'/)?.[1] || "";
    const isMissingColumn = error?.code === "42703" || message.toLowerCase().includes("column") || message.toLowerCase().includes("schema cache");
    if (!isMissingColumn || !missing || !(missing in mutable)) {
      return error;
    }
    delete mutable[missing];
  }
  return new Error("Failed to update model after column fallbacks");
}

function parsePaidAt(value) {
  const raw = String(value || "").trim();
  if (!raw) return new Date().toISOString();
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return new Date().toISOString();
  return parsed.toISOString();
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!admin || !supabaseUrl || !serviceRoleKey) {
    return res.status(503).json({ error: "Missing Supabase server environment variables" });
  }

  const owner = await requireOwner(req, res);
  if (!owner) return;

  const { modelId = "", amount = 0, paidAt = "", reference = "", status = "MANUAL_COMPLETED" } = req.body || {};
  const paidAmount = Number(amount || 0);
  if (!modelId) {
    return res.status(400).json({ error: "modelId is required" });
  }
  if (!Number.isFinite(paidAmount) || paidAmount <= 0) {
    return res.status(400).json({ error: "A positive amount is required" });
  }

  let currentTotal = 0;
  const totalResp = await admin
    .from("models")
    .select("id, agency_subscription_payments_total")
    .eq("id", modelId)
    .maybeSingle();

  if (totalResp.error) {
    const message = String(totalResp.error?.message || "").toLowerCase();
    const missingCol = totalResp.error?.code === "42703" || message.includes("column") || message.includes("schema cache");
    if (!missingCol) {
      return res.status(500).json({ error: totalResp.error.message || "Failed to load model" });
    }
  } else if (!totalResp.data) {
    return res.status(404).json({ error: "Model not found" });
  } else {
    currentTotal = Number(totalResp.data.agency_subscription_payments_total || 0);
  }

  const nowIso = new Date().toISOString();
  const paidAtIso = parsePaidAt(paidAt);
  const cleanedStatus = String(status || "MANUAL_COMPLETED").trim().slice(0, 40) || "MANUAL_COMPLETED";
  const cleanedReference = String(reference || "").trim().slice(0, 120);
  const manualRef = cleanedReference || `manual-${Date.now()}`;

  const updates = {
    agency_subscription_payments_total: (Number.isFinite(currentTotal) ? currentTotal : 0) + paidAmount,
    agency_subscription_last_paid_at: paidAtIso,
    agency_subscription_last_paid_amount: paidAmount,
    agency_subscription_last_paid_order_id: manualRef,
    agency_subscription_last_paid_status: cleanedStatus,
    last_updated: nowIso,
  };

  const updateError = await updateModelWithColumnFallback(modelId, updates);
  if (updateError) {
    return res.status(500).json({ error: updateError.message || "Failed to record manual payment" });
  }

  return res.status(200).json({
    ok: true,
    model: {
      id: modelId,
      ...updates,
    },
  });
}
