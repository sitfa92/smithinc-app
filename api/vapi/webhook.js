import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const ZAPIER_WEBHOOK_URL = String(process.env.ZAPIER_WEBHOOK_URL || "").trim();

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

function buildSeoSignals({ transcript, summary }) {
  const mergedText = redactPII(`${summary || ""} ${transcript || ""}`);
  const questions = extractQuestions(mergedText);
  const topics = extractTopicSignals(mergedText);
  const cities = extractCityHints(mergedText);
  const sentiment = detectSentiment(mergedText);
  const sessionType = detectSessionType(mergedText);
  const userGoal = detectUserGoal(mergedText);

  const keywordCandidates = uniqueValues([
    ...topics,
    sessionType,
    userGoal,
    ...cities.map((city) => `in ${city}`),
  ]).slice(0, 12);

  return {
    main_question: questions[0] || "",
    questions,
    topic_clusters: topics,
    keyword_candidates: keywordCandidates,
    city_hints: cities,
    local_landing_candidate: cities.length > 0,
    testimonial_candidate: sentiment === "positive" && /love|great|amazing|helpful|thank you|thanks/i.test(mergedText),
    sentiment,
    user_goal: userGoal,
    session_type: sessionType,
    transcript_excerpt: mergedText.slice(0, 1200),
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
  const transcript = call?.transcript || null;
  const duration = call?.durationSeconds || null;
  const callId = call?.call?.id || null;
  const summary = call?.summary || null;
  const startedAt = call?.startedAt || null;
  const endedAt = call?.endedAt || null;
  const endedReason = call?.endedReason || null;
  const seoSignals = buildSeoSignals({ transcript, summary });

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

  return res.status(200).json({ ok: true });
}
