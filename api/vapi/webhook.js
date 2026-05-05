import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const ZAPIER_WEBHOOK_URL = String(process.env.ZAPIER_WEBHOOK_URL || "").trim();
const RESEND_API_KEY = String(process.env.RESEND_API_KEY || "").trim();
const ALERT_FROM_EMAIL = String(process.env.ALERT_FROM_EMAIL || "onboarding@meet-serenity.online").trim();
const CALENDLY_US_LINK = String(process.env.CALENDLY_US_LINK || "https://calendly.com/").trim();
const CALENDLY_INTL_LINK = String(process.env.CALENDLY_INTL_LINK || "https://calendly.com/").trim();
const MJ_VA_EMAIL = "marthajohn223355@gmail.com";
const REQUIRED_ADMIN_EMAILS = ["sitfa92@gmail.com", "marthajohn223355@gmail.com"];
const ADMIN_NOTIFICATION_EMAILS = String(
  process.env.ADMIN_NOTIFICATION_EMAILS || ""
)
  .split(",")
  .concat(REQUIRED_ADMIN_EMAILS)
  .map((value) => String(value || "").trim().toLowerCase())
  .filter((value, idx, arr) => /.+@.+\..+/.test(value) && arr.indexOf(value) === idx);

const SEO_TOPIC_PATTERNS = [
  { topic: "sleep", pattern: /sleep|insomnia|bedtime|rest(ed)?|night routine/i },
  { topic: "stress", pattern: /stress|overwhelm(ed)?|pressure|tense|anxious/i },
  { topic: "burnout", pattern: /burnout|burnt out|exhaust(ed|ion)|fatigue/i },
  { topic: "anxiety", pattern: /anxiety|panic|worry|nervous/i },
  { topic: "meditation", pattern: /meditat(e|ion)|mindful(ness)?|breath(ing)?/i },
  { topic: "pre-meeting calm", pattern: /meeting|presentation|interview|before work/i },
  { topic: "relationship calm", pattern: /relationship|partner|argument|conflict/i },
];

const CITY_PATTERN = /\b(?:in|from|near|around)\s+([A-Z][a-z]+(?:\s[A-Z][a-z]+){0,2})\b/g;

function normalizeText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function normalizePhone(raw = "") {
  const value = String(raw || "").trim();
  if (!value) return "";
  if (value.startsWith("+")) return `+${value.slice(1).replace(/[^0-9]/g, "")}`;
  const digits = value.replace(/[^0-9]/g, "");
  return digits ? `+${digits}` : "";
}

function buildCallerKey({ callerPhone = "", callerKeyHint = "" }) {
  const explicit = String(callerKeyHint || "").trim();
  if (explicit) return explicit;
  const normalizedPhone = normalizePhone(callerPhone);
  if (normalizedPhone) return `phone:${normalizedPhone}`;
  return "";
}

function isMissingTableError(err) {
  const msg = String(err?.message || "").toLowerCase();
  return msg.includes("does not exist") || msg.includes("relation") || msg.includes("permission") || msg.includes("policy") || msg.includes("rls");
}

async function learnCallerMemoryFromVapiCall({
  callerPhone = "",
  callerKeyHint = "",
  name = "",
  email = "",
  summary = "",
  transcript = "",
  intent = "general_inquiry",
  endedAt = "",
}) {
  const callerKey = buildCallerKey({ callerPhone, callerKeyHint });
  if (!callerKey) return;

  try {
    const { data: existing, error: existingError } = await supabase
      .from("caller_memory")
      .select("caller_key, total_calls, first_call_at, name, email, preferred_language")
      .eq("caller_key", callerKey)
      .maybeSingle();

    if (existingError && !isMissingTableError(existingError)) {
      console.error("caller memory read error:", existingError.message || existingError);
      return;
    }

    const now = endedAt || new Date().toISOString();
    const payload = {
      caller_key: callerKey,
      phone: normalizePhone(callerPhone) || null,
      name: String(name || existing?.name || "").trim() || null,
      email: String(email || existing?.email || "").trim().toLowerCase() || null,
      preferred_language: existing?.preferred_language || null,
      last_intent: intent || null,
      last_summary: String(summary || "").trim().slice(0, 700) || null,
      last_transcript_excerpt: String(transcript || "").trim().slice(0, 700) || null,
      total_calls: Number(existing?.total_calls || 0) + 1,
      first_call_at: existing?.first_call_at || now,
      last_call_at: now,
      updated_at: now,
    };

    const { error } = await supabase.from("caller_memory").upsert(payload, { onConflict: "caller_key" });
    if (error && !isMissingTableError(error)) {
      console.error("caller memory upsert error:", error.message || error);
    }
  } catch (err) {
    console.error("caller memory learn error:", err?.message || err);
  }
}

function normalizeSpokenEmail(text = "") {
  return String(text || "")
    .toLowerCase()
    .replace(/\s*\(at\)\s*/g, "@")
    .replace(/\s+at\s+/g, "@")
    .replace(/\s*\(dot\)\s*/g, ".")
    .replace(/\s+dot\s+/g, ".")
    .replace(/\s+underscore\s+/g, "_")
    .replace(/\s+dash\s+/g, "-")
    .replace(/\s+/g, "")
    .replace(/[^a-z0-9@._+-]/g, "");
}

function extractEmail(text = "") {
  const raw = String(text || "").trim();
  const direct = raw.match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i);
  if (direct?.[0]) return direct[0].toLowerCase();

  const spokenCue = raw.match(/(?:email(?:\s+address)?\s*(?:is|:)?\s*)(.+)$/i);
  const spokenTail = spokenCue?.[1] ? spokenCue[1].split(/[,;]|\s(?:and|i|my|please|thank)\s/i)[0] : "";
  const normalizedTail = normalizeSpokenEmail(spokenTail);
  const tailMatch = normalizedTail.match(/[a-z0-9._%+-]{1,64}@[a-z0-9.-]{3,255}\.[a-z]{2,}/i);
  if (tailMatch?.[0]) return tailMatch[0].toLowerCase();

  const normalized = normalizeSpokenEmail(raw);
  const candidates = normalized.match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi) || [];
  for (const candidate of candidates) {
    const [localPart = "", domainPart = ""] = candidate.split("@");
    if (localPart.length > 32 || domainPart.length > 255) continue;
    return candidate.toLowerCase();
  }

  return "";
}

function extractName(text = "") {
  const cleaned = String(text || "").replace(/\s+/g, " ").trim();
  if (!cleaned) return "";
  const match = cleaned.match(/(?:my name is|this is|i am|je m'appelle|je suis)\s+([a-zA-Z][a-zA-Z' -]{1,60})/i);
  const raw = (match?.[1] || "").trim();
  if (!raw) return "";
  return raw
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0].toUpperCase() + part.slice(1).toLowerCase())
    .join(" ")
    .slice(0, 80);
}

function detectConsultIntent(text = "") {
  return /consult(ation)?|book(ing)?|schedule|call me|follow\s*up|appointment|rendez[-\s]?vous|reservation/i.test(
    String(text || "")
  );
}

function isUSPhone(phone = "") {
  return String(phone || "").trim().startsWith("+1");
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}

async function sendVoiceCallAlertEmail({
  callId = "",
  callerPhone = "",
  summary = "",
  transcript = "",
  duration = null,
  startedAt = "",
  endedAt = "",
  endedReason = "",
  leadCreated = false,
  extractedName = "",
  extractedEmail = "",
}) {
  if (!RESEND_API_KEY || ADMIN_NOTIFICATION_EMAILS.length === 0) return { ok: false, skipped: true };

  const subject = leadCreated
    ? "Voice Call Lead Captured - Action Needed"
    : "Voice Call Completed - Follow-up Summary";

  const html = `<!DOCTYPE html>
<html lang="en">
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background:#f7f7f8; padding:20px; color:#111;">
  <div style="max-width:640px; margin:0 auto; background:#fff; border:1px solid #eee; border-radius:10px; overflow:hidden;">
    <div style="background:#111; color:#fff; padding:16px 20px; font-weight:700; letter-spacing:0.04em;">SMITH INC - VOICE CALL ALERT</div>
    <div style="padding:20px; line-height:1.6;">
      <p style="margin:0 0 14px;">${leadCreated ? "A consultation lead was captured from the actual phone number." : "A voice call completed on the actual phone number."}</p>
      <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse; margin:0 0 14px;">
        <tr><td style="padding:8px 0; color:#666; width:170px;">Call ID</td><td style="padding:8px 0;">${escapeHtml(callId || "unknown")}</td></tr>
        <tr><td style="padding:8px 0; color:#666;">Caller Phone</td><td style="padding:8px 0;">${escapeHtml(callerPhone || "unknown")}</td></tr>
        <tr><td style="padding:8px 0; color:#666;">Duration</td><td style="padding:8px 0;">${duration ?? "unknown"} sec</td></tr>
        <tr><td style="padding:8px 0; color:#666;">Started</td><td style="padding:8px 0;">${escapeHtml(startedAt || "unknown")}</td></tr>
        <tr><td style="padding:8px 0; color:#666;">Ended</td><td style="padding:8px 0;">${escapeHtml(endedAt || "unknown")}</td></tr>
        <tr><td style="padding:8px 0; color:#666;">End Reason</td><td style="padding:8px 0;">${escapeHtml(endedReason || "unknown")}</td></tr>
        <tr><td style="padding:8px 0; color:#666;">Lead Created</td><td style="padding:8px 0;">${leadCreated ? "yes" : "no"}</td></tr>
        <tr><td style="padding:8px 0; color:#666;">Name</td><td style="padding:8px 0;">${escapeHtml(extractedName || "not detected")}</td></tr>
        <tr><td style="padding:8px 0; color:#666;">Email</td><td style="padding:8px 0;">${escapeHtml(extractedEmail || "not detected")}</td></tr>
      </table>
      <p style="margin:0 0 8px;"><strong>Summary</strong></p>
      <div style="margin:0 0 14px; padding:12px; border:1px solid #eee; background:#fafafa; border-radius:8px;">${escapeHtml(summary || "No summary").replace(/\n/g, "<br>")}</div>
      <p style="margin:0 0 8px;"><strong>Transcript</strong></p>
      <div style="margin:0; padding:12px; border:1px solid #eee; background:#fafafa; border-radius:8px;">${escapeHtml(transcript || "No transcript").replace(/\n/g, "<br>")}</div>
    </div>
  </div>
</body>
</html>`;

  const text = [
    leadCreated ? "A consultation lead was captured from the actual phone number." : "A voice call completed on the actual phone number.",
    `Call ID: ${callId || "unknown"}`,
    `Caller Phone: ${callerPhone || "unknown"}`,
    `Duration: ${duration ?? "unknown"} sec`,
    `Started: ${startedAt || "unknown"}`,
    `Ended: ${endedAt || "unknown"}`,
    `End Reason: ${endedReason || "unknown"}`,
    `Lead Created: ${leadCreated ? "yes" : "no"}`,
    `Name: ${extractedName || "not detected"}`,
    `Email: ${extractedEmail || "not detected"}`,
    "",
    "Summary:",
    summary || "No summary",
    "",
    "Transcript:",
    transcript || "No transcript",
  ].join("\n");

  const resp = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from: ALERT_FROM_EMAIL,
      to: ADMIN_NOTIFICATION_EMAILS,
      subject,
      html,
      text,
      reply_to: /.+@.+\..+/.test(String(extractedEmail || "")) ? extractedEmail : undefined,
    }),
  });

  if (!resp.ok) {
    const body = await resp.text().catch(() => "");
    return { ok: false, error: body || `status_${resp.status}` };
  }

  return { ok: true };
}

async function sendCallerBookingConfirmationEmail({
  name = "there",
  email = "",
  serviceType = "Consultation",
  callerPhone = "",
}) {
  if (!RESEND_API_KEY) return { ok: false, skipped: true, reason: "missing_resend_api_key" };
  const normalizedEmail = String(email || "").trim().toLowerCase();
  if (!/.+@.+\..+/.test(normalizedEmail)) return { ok: false, skipped: true, reason: "invalid_email" };

  const calendlyLink = isUSPhone(callerPhone) ? CALENDLY_US_LINK : CALENDLY_INTL_LINK;
  const linkLabel = isUSPhone(callerPhone) ? "US Consultation Link" : "International Consultation Link";
  const safeName = escapeHtml(name || "there");
  const safeServiceType = escapeHtml(serviceType || "Consultation");
  const safeCalendlyLink = escapeHtml(calendlyLink);

  const subject = "Booking request received - Smith Inc";
  const html = `<!DOCTYPE html>
<html lang="en">
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
    <tr><td align="center" style="padding:40px 16px;">
      <table width="100%" style="max-width:560px;" cellpadding="0" cellspacing="0" role="presentation">
        <tr><td style="background:#000;padding:24px 32px;border-radius:8px 8px 0 0;"><p style="margin:0;color:#fff;font-size:18px;font-weight:700;letter-spacing:3px;">SMITH INC</p></td></tr>
        <tr><td style="background:#fff;padding:32px;border-radius:0 0 8px 8px;">
          <h2 style="margin:0 0 20px;font-size:20px;color:#111;">Booking Request Received ✓</h2>
          <p style="margin:0 0 12px;color:#444;line-height:1.7;">Hi <strong>${safeName}</strong>,</p>
          <p style="margin:0 0 20px;color:#444;line-height:1.7;">We've received your ${safeServiceType} request and will follow up shortly.</p>
          <p style="margin:0 0 12px;color:#444;line-height:1.7;">To speed up scheduling, use your consultation link below:</p>
          <p style="margin:0 0 20px;"><a href="${safeCalendlyLink}" style="display:inline-block;background:#111;color:#fff;text-decoration:none;padding:12px 18px;border-radius:8px;font-size:13px;font-weight:600;letter-spacing:0.04em;">${linkLabel}</a></p>
          <p style="margin:0 0 20px;color:#666;font-size:13px;line-height:1.7;">If the button does not work, copy this link into your browser:<br>${safeCalendlyLink}</p>
          <p style="margin:0;color:#444;line-height:1.7;">— <strong>The Smith Inc Team</strong></p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
  const text = [
    `Hi ${name || "there"},`,
    "",
    `We've received your ${serviceType || "Consultation"} request and will follow up shortly.`,
    "",
    `Consultation link: ${calendlyLink}`,
    "",
    "- The Smith Inc Team",
  ].join("\n");

  const resp = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from: ALERT_FROM_EMAIL,
      to: [normalizedEmail],
      subject,
      html,
      text,
      reply_to: normalizedEmail,
    }),
  });

  if (!resp.ok) {
    const body = await resp.text().catch(() => "");
    return { ok: false, error: body || `status_${resp.status}` };
  }

  return { ok: true };
}

async function createBookingLeadFromCall({
  transcript = "",
  summary = "",
  callerPhone = "",
  startedAt = "",
  endedAt = "",
  callId = "",
}) {
  const combined = normalizeText(`${summary || ""}\n${transcript || ""}`);
  if (!detectConsultIntent(combined)) return { created: false, name: "", email: "" };

  const email = extractEmail(combined);
  const name = extractName(combined) || "Voice Caller";
  const now = new Date().toISOString();
  const fallbackId = Date.now();

  const { data, error } = await supabase
    .from("bookings")
    .insert({
    name,
    email: email || `voice-lead-${fallbackId}@noemail.local`,
    company: "Voice AI Intake",
    service_type: "Consultation - Voice AI Lead",
    preferred_date: null,
    message: [
      "Voice consultation lead captured from Vapi webhook.",
      `Call ID: ${callId || "unknown"}`,
      `Caller number: ${callerPhone || "unknown"}`,
      `StartedAt: ${startedAt || "unknown"}`,
      `EndedAt: ${endedAt || "unknown"}`,
      `Summary: ${summary || "none"}`,
      `Transcript: ${transcript || "none"}`,
    ].join("\n"),
    status: "pending",
    created_at: now,
    })
    .select("id")
    .single();

  if (error) {
    console.error("Supabase booking insert error:", error.message);
    return { created: false, name, email };
  }

  return { created: true, name, email, bookingId: data?.id || "", createdAt: now };
}

async function createMjVoiceCallTask({ bookingId = "", callerPhone = "", callId = "", createdAt = "" }) {
  if (!bookingId) return;

  const payload = {
    task_key: `voice-call-followup-${bookingId}`,
    title: "Voice bot call follow-up",
    description: [
      "Review voice consultation lead, confirm details, and send scheduling follow-up.",
      `Caller: ${callerPhone || "unknown"}`,
      `Call ID: ${callId || "unknown"}`,
    ].join("\n"),
    role: "va",
    assigned_email: MJ_VA_EMAIL,
    source_type: "voice_call",
    source_id: String(bookingId),
    status: "pending",
    due_at: createdAt || new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase.from("ops_tasks").upsert(payload, { onConflict: "task_key" });
  if (!error) return;

  const errText = String(error.message || "").toLowerCase();
  if (errText.includes("does not exist") || errText.includes("relation") || errText.includes("permission") || errText.includes("policy") || errText.includes("rls")) {
    return;
  }
  console.error("MJ voice task upsert error:", error.message || error);
}

function redactPII(text) {
  return normalizeText(text)
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[email]")
    .replace(/\+?\d[\d\s().-]{7,}\d/g, "[phone]");
}

function uniqueValues(values) {
  return [...new Set(values.filter(Boolean))];
}

function extractQuestions(transcript) {
  const text = redactPII(transcript);
  const chunks = text
    .split(/[\n.]/)
    .map((line) => line.trim())
    .filter(Boolean);

  const explicitQuestions = chunks
    .filter((line) => line.includes("?") || /^(how|what|when|where|why|can|is|do)\b/i.test(line))
    .slice(0, 6);

  return explicitQuestions.length ? explicitQuestions : chunks.slice(0, 3);
}

function extractTopicSignals(text) {
  const hitTopics = SEO_TOPIC_PATTERNS
    .filter(({ pattern }) => pattern.test(text))
    .map(({ topic }) => topic);

  return uniqueValues(hitTopics);
}

function extractCityHints(text) {
  const hits = [];
  let match;
  while ((match = CITY_PATTERN.exec(text)) !== null) {
    hits.push(match[1]);
  }
  return uniqueValues(hits).slice(0, 3);
}

function detectSentiment(text) {
  const positive = /love|great|amazing|helpful|thank you|thanks|perfect|excellent/i.test(text);
  const negative = /bad|frustrat(ed|ing)|angry|upset|terrible|not helpful/i.test(text);
  if (positive && !negative) return "positive";
  if (negative && !positive) return "negative";
  return "neutral";
}

function detectSessionType(text) {
  if (/sleep|insomnia|night/i.test(text)) return "sleep";
  if (/work|meeting|career|office/i.test(text)) return "work-stress";
  if (/relationship|partner|family/i.test(text)) return "relationship";
  return "general-calm";
}

function detectUserGoal(text) {
  if (/sleep better|fall asleep|better sleep/i.test(text)) return "improve_sleep";
  if (/calm down|less stress|less anxious|reduce anxiety/i.test(text)) return "reduce_stress_anxiety";
  if (/focus|productive|clear mind/i.test(text)) return "improve_focus";
  return "general_wellbeing";
}

function mapSeoPillar({ topics, sessionType, userGoal }) {
  if (topics.includes("burnout") || /burnout/i.test(userGoal || "")) return "burnout";
  if (topics.includes("relationship calm") || sessionType === "relationship") return "relationship";
  if (topics.includes("sleep") || sessionType === "sleep" || userGoal === "improve_sleep") return "sleep";
  if (topics.includes("stress") || topics.includes("anxiety") || sessionType === "work-stress") return "stress";
  return "general";
}

function sha1(value) {
  return crypto.createHash("sha1").update(String(value || "")).digest("hex");
}

function computeDedupeKeys({ mainQuestion, topics, cities, sessionType, seoPillar }) {
  const questionSlug = normalizeText(mainQuestion).toLowerCase().slice(0, 180);
  const topicSlug = uniqueValues(topics).sort().join("|").toLowerCase();
  const citySlug = uniqueValues(cities).sort().join("|").toLowerCase() || "global";
  const base = [seoPillar, sessionType, citySlug, topicSlug, questionSlug].join("::");

  return {
    dedupe_key: sha1(base).slice(0, 16),
    cluster_key: sha1(`${seoPillar}::${sessionType}::${citySlug}`).slice(0, 16),
  };
}

function buildSeoSignals({ transcript, summary }) {
  const mergedText = redactPII(`${summary || ""} ${transcript || ""}`);
  const questions = extractQuestions(mergedText);
  const topics = extractTopicSignals(mergedText);
  const cities = extractCityHints(mergedText);
  const sentiment = detectSentiment(mergedText);
  const sessionType = detectSessionType(mergedText);
  const userGoal = detectUserGoal(mergedText);
  const seoPillar = mapSeoPillar({ topics, sessionType, userGoal });
  const dedupeKeys = computeDedupeKeys({
    mainQuestion: questions[0] || "",
    topics,
    cities,
    sessionType,
    seoPillar,
  });

  const keywordCandidates = uniqueValues([
    ...topics,
    sessionType,
    userGoal,
    ...cities.map((city) => `in ${city}`),
  ]).slice(0, 12);

  return {
    main_question: questions[0] || "",
    questions,
    seo_pillar: seoPillar,
    topic_clusters: topics,
    keyword_candidates: keywordCandidates,
    city_hints: cities,
    local_landing_candidate: cities.length > 0,
    testimonial_candidate: sentiment === "positive" && /love|great|amazing|helpful|thank you|thanks/i.test(mergedText),
    sentiment,
    user_goal: userGoal,
    session_type: sessionType,
    transcript_excerpt: mergedText.slice(0, 1200),
    dedupe_key: dedupeKeys.dedupe_key,
    cluster_key: dedupeKeys.cluster_key,
  };
}

async function forwardToZapier(eventType, payload, metadata = {}) {
  if (!ZAPIER_WEBHOOK_URL) return { ok: false, skipped: true, reason: "missing_webhook_url" };

  const body = {
    source: "meet-serenity-app",
    event_type: eventType,
    happened_at: new Date().toISOString(),
    payload,
    metadata: {
      source: "meet-serenity-app",
      environment: process.env.VERCEL_ENV || "production",
      integration: "vapi-webhook",
      ...metadata,
    },
  };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 2500);

  try {
    const resp = await fetch(ZAPIER_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    return { ok: resp.ok, status: resp.status };
  } catch (err) {
    return { ok: false, error: err?.name === "AbortError" ? "timeout" : (err?.message || "unknown") };
  } finally {
    clearTimeout(timeout);
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const event = req.body;
  const type = event?.message?.type;

  // Only process end-of-call-report events
  if (type !== "end-of-call-report") {
    return res.status(200).json({ ok: true, skipped: true });
  }

  const call = event.message;
  const callerPhone = call?.customer?.number || null;
  const callerKeyHint = call?.metadata?.caller_key || call?.customer?.metadata?.caller_key || "";
  const transcript = call?.transcript || null;
  const duration = call?.durationSeconds || null;
  const callId = call?.call?.id || null;
  const summary = call?.summary || null;
  const startedAt = call?.startedAt || null;
  const endedAt = call?.endedAt || null;
  const endedReason = call?.endedReason || null;
  const seoSignals = buildSeoSignals({ transcript, summary });

  const leadResult = await createBookingLeadFromCall({
    transcript,
    summary,
    callerPhone,
    startedAt,
    endedAt,
    callId,
  });

  await learnCallerMemoryFromVapiCall({
    callerPhone,
    callerKeyHint,
    name: leadResult?.name || "",
    email: leadResult?.email || "",
    summary: summary || "",
    transcript: transcript || "",
    intent: leadResult?.created ? "consultation_request" : "general_inquiry",
    endedAt: endedAt || new Date().toISOString(),
  });

  // 1 — Log to Supabase
  const { error: dbError } = await supabase.from("call_logs").insert({
    call_id: callId,
    caller_phone: callerPhone,
    transcript,
    summary,
    duration_seconds: duration,
    ended_reason: endedReason,
    started_at: startedAt,
    ended_at: endedAt,
  });

  if (dbError) {
    console.error("Supabase insert error:", dbError.message);
  }

  // 2 — Forward structured SEO signals to Zapier for content pipelines
  const basePayload = {
    call_id: callId,
    caller_phone_masked: callerPhone ? "[phone]" : null,
    duration_seconds: duration,
    ended_reason: endedReason,
    started_at: startedAt,
    ended_at: endedAt,
    summary: redactPII(summary || ""),
    ...seoSignals,
  };

  const forwardResults = await Promise.allSettled([
    forwardToZapier("vapi.call.completed", basePayload, { workflow: "voice-analytics" }),
    forwardToZapier("seo.question.captured", basePayload, { workflow: "seo-faq" }),
    seoSignals.local_landing_candidate
      ? forwardToZapier("seo.local_landing.signal", basePayload, { workflow: "seo-local-pages" })
      : Promise.resolve({ ok: true, skipped: true }),
    seoSignals.testimonial_candidate
      ? forwardToZapier("seo.testimonial.candidate", basePayload, { workflow: "social-proof" })
      : Promise.resolve({ ok: true, skipped: true }),
  ]);

  const rejected = forwardResults.filter((result) => result.status === "rejected");
  if (rejected.length) {
    console.error("Zapier forward rejected:", rejected.length);
  }

  const emailResult = await sendVoiceCallAlertEmail({
    callId,
    callerPhone,
    summary: summary || "",
    transcript: transcript || "",
    duration,
    startedAt,
    endedAt,
    endedReason,
    leadCreated: leadResult.created,
    extractedName: leadResult.name,
    extractedEmail: leadResult.email,
  });

  if (!emailResult.ok && !emailResult.skipped) {
    console.error("Voice call alert email failed:", emailResult.error || "unknown");
  }

  if (leadResult.created && leadResult.email) {
    const callerEmailResult = await sendCallerBookingConfirmationEmail({
      name: leadResult.name,
      email: leadResult.email,
      serviceType: "Consultation",
      callerPhone,
    });
    if (!callerEmailResult.ok && !callerEmailResult.skipped) {
      console.error("Caller booking confirmation email failed:", callerEmailResult.error || "unknown");
    }
  }

  if (leadResult.created && leadResult.bookingId) {
    await createMjVoiceCallTask({
      bookingId: leadResult.bookingId,
      callerPhone,
      callId,
      createdAt: leadResult.createdAt,
    });
  }

  return res.status(200).json({ ok: true });
}
