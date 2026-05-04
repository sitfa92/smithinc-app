/**
 * Zapier Webhook Handler for Serenity App
 *
 * Receives structured events from Zapier automations and processes:
 * - NEW_LEAD: Lead intake from inbound inquiry
 * - CLIENT_CONVERTED: Lead becomes paying client
 * - PROGRAM_ENROLLMENT: Client enrolls in model development program
 *
 * All events are logged to in-app dashboard for visibility
 */

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ZAPIER_WEBHOOK_SECRET = process.env.ZAPIER_WEBHOOK_SECRET;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const resolveExternalRecordId = (payload = {}) =>
  payload.external_record_id || payload.crm_record_id || payload.honeybook_id || "";

// Validate webhook secret from Zapier
function validateSecret(req) {
  const headerSecret = req.headers["x-zapier-secret"];
  if (!headerSecret || headerSecret !== ZAPIER_WEBHOOK_SECRET) {
    throw new Error("Invalid or missing webhook secret");
  }
}

// Log workflow event to dashboard
async function logWorkflowEvent(type, data, status = "success", error = null) {
  try {
    await supabase.from("workflow_events").insert({
      event_type: type,
      event_data: data,
      status: status,
      error_message: error,
      created_at: new Date().toISOString(),
      source: "zapier",
    });
  } catch (err) {
    console.error("Failed to log workflow event:", err.message);
  }
}

// NEW_LEAD: Capture inquiry from webhook automation
async function handleNewLead(data) {
  const { name, email, phone, service_type, message } = data;
  const externalRecordId = resolveExternalRecordId(data);

  if (!email || !name) {
    throw new Error("Missing required fields: name, email");
  }

  // Check for duplicate email
  const { data: existing } = await supabase
    .from("leads")
    .select("id")
    .eq("email", email)
    .single();

  if (existing) {
    return { success: true, message: "Lead already exists", leadId: existing.id };
  }

  // Insert new lead
  const { data: lead, error } = await supabase.from("leads").insert({
    name: name.trim(),
    email: email.toLowerCase().trim(),
    phone: phone || "",
    service_type: service_type || "inquiry",
    message: message || "",
    honeybook_id: externalRecordId,
    source: "zapier",
    status: "new",
    created_at: new Date().toISOString(),
  });

  if (error) {
    throw new Error(`Failed to insert lead: ${error.message}`);
  }

  return { success: true, message: "Lead captured", leadId: lead?.[0]?.id };
}

// CLIENT_CONVERTED: Move lead to client, mark as paid
async function handleClientConverted(data) {
  const { email, contract_signed, invoice_paid, service_type, client_value } = data;
  const externalRecordId = resolveExternalRecordId(data);

  if (!email) {
    throw new Error("Missing required field: email");
  }

  // Find the lead
  const { data: lead, error: leadError } = await supabase
    .from("leads")
    .select("id, name")
    .eq("email", email.toLowerCase().trim())
    .single();

  if (leadError || !lead) {
    throw new Error(`Lead not found for email: ${email}`);
  }

  // Update lead status to converted
  const { error: updateError } = await supabase
    .from("leads")
    .update({
      status: "converted",
      honeybook_id: externalRecordId || lead.honeybook_id,
      conversion_date: new Date().toISOString(),
    })
    .eq("id", lead.id);

  if (updateError) {
    throw new Error(`Failed to update lead: ${updateError.message}`);
  }

  // Insert into clients table
  const { data: client, error: clientError } = await supabase.from("clients").insert({
    name: lead.name,
    email: email.toLowerCase().trim(),
    honeybook_id: externalRecordId,
    service_type: service_type || "general",
    client_value: client_value || 0,
    status: "active",
    contract_signed: contract_signed || false,
    invoice_paid: invoice_paid || true,
    source: "zapier",
    created_at: new Date().toISOString(),
  });

  if (clientError) {
    throw new Error(`Failed to create client: ${clientError.message}`);
  }

  return { success: true, message: "Client converted", clientId: client?.[0]?.id };
}

// PROGRAM_ENROLLMENT: Student enrolls in model development program
async function handleProgramEnrollment(data) {
  const { email, program_name, program_tier, start_date } = data;
  const externalRecordId = resolveExternalRecordId(data);

  if (!email || !program_name) {
    throw new Error("Missing required fields: email, program_name");
  }

  // Find the client
  const { data: client, error: clientError } = await supabase
    .from("clients")
    .select("id, name")
    .eq("email", email.toLowerCase().trim())
    .single();

  if (clientError || !client) {
    throw new Error(`Client not found for email: ${email}`);
  }

  // Insert enrollment record
  const { data: enrollment, error: enrollError } = await supabase
    .from("program_enrollments")
    .insert({
      client_id: client.id,
      student_name: client.name,
      email: email.toLowerCase().trim(),
      program_name: program_name,
      program_tier: program_tier || "standard",
      start_date: start_date || new Date().toISOString(),
      honeybook_id: externalRecordId,
      status: "active",
      source: "zapier",
      created_at: new Date().toISOString(),
    });

  if (enrollError) {
    throw new Error(`Failed to enroll student: ${enrollError.message}`);
  }

  return { success: true, message: "Program enrollment recorded", enrollmentId: enrollment?.[0]?.id };
}

// Main handler
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    // Validate secret
    validateSecret(req);

    const { type, data } = req.body;

    if (!type || !data) {
      return res.status(400).json({ error: "Missing type or data field" });
    }

    let result;

    // Route to appropriate handler
    switch (type) {
      case "NEW_LEAD":
        result = await handleNewLead(data);
        await logWorkflowEvent(type, data, "success");
        break;

      case "CLIENT_CONVERTED":
        result = await handleClientConverted(data);
        await logWorkflowEvent(type, data, "success");
        break;

      case "PROGRAM_ENROLLMENT":
        result = await handleProgramEnrollment(data);
        await logWorkflowEvent(type, data, "success");
        break;

      default:
        return res.status(400).json({ error: `Unknown event type: ${type}` });
    }

    return res.status(200).json({ success: true, ...result });
  } catch (error) {
    const errorMsg = error.message || "Unknown error";
    console.error("Zapier webhook error:", errorMsg);

    // Log failed event
    await logWorkflowEvent(req.body?.type || "unknown", req.body?.data || {}, "failed", errorMsg);

    return res.status(400).json({ error: errorMsg });
  }
}
