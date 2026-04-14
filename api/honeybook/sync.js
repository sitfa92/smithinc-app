/**
 * POST /api/honeybook/sync
 *
 * Zapier calls this endpoint whenever a HoneyBook trigger fires.
 * Supported HoneyBook → Zapier triggers mapped here:
 *
 *   honeybook.contact.created       → upsert clients (status=lead)
 *   honeybook.project.created       → upsert clients (status=active) + bookings
 *   honeybook.project.stage_changed → update client status
 *   honeybook.invoice.sent          → update invoice_status=sent
 *   honeybook.invoice.paid          → update invoice_status=paid
 *   honeybook.contract.signed       → update contract_signed=true
 *   honeybook.payment.received      → update client_value / record payment
 *
 * Zapier Webhook setup:
 *   1. Create a Zap: Trigger = HoneyBook (any of the above events)
 *   2. Action = Webhooks by Zapier → POST
 *   3. URL = https://meet-serenity.online/api/honeybook/sync
 *   4. Payload type = JSON
 *   5. Add header: x-honeybook-secret = <HONEYBOOK_WEBHOOK_SECRET env var>
 *   6. Map the HoneyBook fields to the JSON body below (examples in comments)
 *
 * Required env var: HONEYBOOK_WEBHOOK_SECRET (set in Vercel)
 * Required env var: SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

const admin =
  supabaseUrl && serviceRoleKey
    ? createClient(supabaseUrl, serviceRoleKey)
    : null;

const normalize = (v) => (v || "").trim().toLowerCase();

// Map HoneyBook project/pipeline stage names → our client status values
const HB_STAGE_MAP = {
  inquiry:    "lead",
  lead:       "lead",
  proposal:   "lead",
  booked:     "active",
  active:     "active",
  "in progress": "active",
  retainer:   "active",
  completed:  "completed",
  archived:   "inactive",
  cancelled:  "churned",
  canceled:   "churned",
};

function mapStage(hbStage) {
  return HB_STAGE_MAP[normalize(hbStage)] || "lead";
}

// Build a normalized client payload from whatever HoneyBook sends
function buildClientPayload(body, defaultStatus = "lead") {
  const {
    // Contact / project core fields
    contact_name, client_name, name,
    contact_email, client_email, email,
    company_name, company,
    project_name, project_type, service_type, service,
    project_value, total_value, invoice_total, amount,
    pipeline_stage, stage, project_stage,
    // Invoice / contract flags
    invoice_status,
    contract_signed,
    // HoneyBook internal IDs
    honeybook_id, project_id, contact_id,
    // Timestamps
    created_at,
  } = body;

  const resolvedName = contact_name || client_name || name || "";
  const resolvedEmail = normalize(contact_email || client_email || email || "");
  const resolvedCompany = company_name || company || "";
  const resolvedService = project_name || project_type || service_type || service || "HoneyBook Project";
  const resolvedValue = Number(project_value || total_value || invoice_total || amount || 0);
  const resolvedStage = pipeline_stage || stage || project_stage || "";
  const resolvedHbId = honeybook_id || project_id || contact_id || "";

  const status = resolvedStage ? mapStage(resolvedStage) : defaultStatus;

  return {
    name: resolvedName,
    email: resolvedEmail || undefined,
    company: resolvedCompany || undefined,
    project: resolvedService,
    service_type: resolvedService,
    client_value: resolvedValue || undefined,
    status,
    honeybook_id: resolvedHbId || undefined,
    source: "honeybook",
    invoice_status: invoice_status || undefined,
    contract_signed:
      contract_signed === true || contract_signed === "true" || undefined,
    updated_at: new Date().toISOString(),
    created_at: created_at || new Date().toISOString(),
  };
}

// Remove undefined values so Supabase doesn't try to write null for missing columns
function clean(obj) {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== undefined && v !== null && v !== "")
  );
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // Verify shared secret set in Zapier header
  const secret = (process.env.HONEYBOOK_WEBHOOK_SECRET || "").trim();
  if (secret) {
    const incoming = (req.headers["x-honeybook-secret"] || "").trim();
    if (incoming !== secret) {
      return res.status(401).json({ error: "Unauthorized" });
    }
  }

  if (!admin) {
    return res.status(503).json({ error: "Supabase not configured" });
  }

  const body = req.body || {};
  const eventType = (body.event_type || body.eventType || "honeybook.contact.created").toLowerCase();

  try {
    switch (eventType) {
      // ── New contact / lead ──────────────────────────────────────────────
      case "honeybook.contact.created":
      case "contact.created": {
        const payload = clean(buildClientPayload(body, "lead"));
        if (!payload.name) return res.status(400).json({ error: "Missing contact name" });

        const { error } = await admin
          .from("clients")
          .upsert([payload], {
            onConflict: payload.honeybook_id ? "honeybook_id" : "email",
            ignoreDuplicates: false,
          });

        if (error) throw error;
        return res.status(200).json({ ok: true, action: "client.upserted", status: "lead" });
      }

      // ── New project booked ──────────────────────────────────────────────
      case "honeybook.project.created":
      case "project.created": {
        const payload = clean(buildClientPayload(body, "active"));
        if (!payload.name) return res.status(400).json({ error: "Missing contact name" });

        // Upsert client record
        const { error: clientErr } = await admin
          .from("clients")
          .upsert([payload], {
            onConflict: payload.honeybook_id ? "honeybook_id" : "email",
            ignoreDuplicates: false,
          });
        if (clientErr) throw clientErr;

        // Also create a booking record if preferred_date is present
        const { preferred_date, event_date, booking_date, meeting_date } = body;
        const date = preferred_date || event_date || booking_date || meeting_date;

        if (date && payload.email) {
          const bookingPayload = {
            name: payload.name,
            email: payload.email,
            company: payload.company || "",
            service_type: payload.service_type,
            preferred_date: date,
            message: `Auto-imported from HoneyBook project`,
            status: "confirmed",
            source: "honeybook",
            created_at: payload.created_at,
          };

          const { error: bookingErr } = await admin
            .from("bookings")
            .insert([clean(bookingPayload)]);

          // Non-fatal if booking insert fails (zoom_link column may be missing, etc.)
          if (bookingErr) {
            console.error("HoneyBook booking insert failed (non-fatal):", bookingErr.message);
          }
        }

        return res.status(200).json({ ok: true, action: "client.upserted", status: "active" });
      }

      // ── Project stage changed ────────────────────────────────────────────
      case "honeybook.project.stage_changed":
      case "project.stage_changed": {
        const { honeybook_id, project_id, pipeline_stage, stage } = body;
        const hbId = honeybook_id || project_id;
        const newStatus = mapStage(pipeline_stage || stage || "");

        if (!hbId) return res.status(400).json({ error: "Missing honeybook_id" });

        const { error } = await admin
          .from("clients")
          .update({ status: newStatus, updated_at: new Date().toISOString() })
          .eq("honeybook_id", hbId);

        if (error) throw error;
        return res.status(200).json({ ok: true, action: "client.status_updated", status: newStatus });
      }

      // ── Invoice sent ─────────────────────────────────────────────────────
      case "honeybook.invoice.sent":
      case "invoice.sent": {
        const { honeybook_id, project_id, email, client_email } = body;
        const hbId = honeybook_id || project_id;
        const resolvedEmail = normalize(email || client_email || "");

        const update = { invoice_status: "sent", updated_at: new Date().toISOString() };

        let error;
        if (hbId) {
          ({ error } = await admin.from("clients").update(update).eq("honeybook_id", hbId));
        } else if (resolvedEmail) {
          ({ error } = await admin.from("clients").update(update).eq("email", resolvedEmail));
        } else {
          return res.status(400).json({ error: "Missing honeybook_id or email" });
        }

        if (error) throw error;
        return res.status(200).json({ ok: true, action: "client.invoice_sent" });
      }

      // ── Invoice paid ─────────────────────────────────────────────────────
      case "honeybook.invoice.paid":
      case "invoice.paid": {
        const { honeybook_id, project_id, email, client_email, amount, total_paid } = body;
        const hbId = honeybook_id || project_id;
        const resolvedEmail = normalize(email || client_email || "");
        const paidAmount = Number(amount || total_paid || 0);

        const update = {
          invoice_status: "paid",
          invoice_paid: true,
          updated_at: new Date().toISOString(),
          ...(paidAmount > 0 && { client_value: paidAmount }),
        };

        let error;
        if (hbId) {
          ({ error } = await admin.from("clients").update(update).eq("honeybook_id", hbId));
        } else if (resolvedEmail) {
          ({ error } = await admin.from("clients").update(update).eq("email", resolvedEmail));
        } else {
          return res.status(400).json({ error: "Missing honeybook_id or email" });
        }

        if (error) throw error;
        return res.status(200).json({ ok: true, action: "client.invoice_paid" });
      }

      // ── Contract signed ───────────────────────────────────────────────────
      case "honeybook.contract.signed":
      case "contract.signed": {
        const { honeybook_id, project_id, email, client_email } = body;
        const hbId = honeybook_id || project_id;
        const resolvedEmail = normalize(email || client_email || "");

        const update = { contract_signed: true, updated_at: new Date().toISOString() };

        let error;
        if (hbId) {
          ({ error } = await admin.from("clients").update(update).eq("honeybook_id", hbId));
        } else if (resolvedEmail) {
          ({ error } = await admin.from("clients").update(update).eq("email", resolvedEmail));
        } else {
          return res.status(400).json({ error: "Missing honeybook_id or email" });
        }

        if (error) throw error;
        return res.status(200).json({ ok: true, action: "client.contract_signed" });
      }

      // ── Payment received ──────────────────────────────────────────────────
      case "honeybook.payment.received":
      case "payment.received": {
        const { honeybook_id, project_id, email, client_email, amount, payment_amount } = body;
        const hbId = honeybook_id || project_id;
        const resolvedEmail = normalize(email || client_email || "");
        const paidAmount = Number(amount || payment_amount || 0);

        const update = {
          updated_at: new Date().toISOString(),
          ...(paidAmount > 0 && { client_value: paidAmount }),
        };

        let error;
        if (hbId) {
          ({ error } = await admin.from("clients").update(update).eq("honeybook_id", hbId));
        } else if (resolvedEmail) {
          ({ error } = await admin.from("clients").update(update).eq("email", resolvedEmail));
        } else {
          return res.status(400).json({ error: "Missing honeybook_id or email" });
        }

        if (error) throw error;
        return res.status(200).json({ ok: true, action: "client.payment_received" });
      }

      default:
        return res.status(400).json({ error: `Unknown event_type: ${eventType}` });
    }
  } catch (err) {
    console.error("HoneyBook sync error:", err);
    return res.status(500).json({ error: err.message || "Internal error" });
  }
}
