const LEGAL_AI_API_KEY = String(process.env.LEGAL_AI_API_KEY || process.env.OPENAI_API_KEY || "").trim();
const LEGAL_AI_MODEL = String(process.env.LEGAL_AI_MODEL || process.env.OPENAI_MODEL || "gpt-4o-mini").trim();
const COMPANY_NAME = String(process.env.LEGAL_AI_COMPANY_NAME || "SmithInc").trim();

const LEGAL_PLAYBOOK = [
  "Program and pricing facts:",
  "- Tier 1 Starter: GBP 22.06 monthly.",
  "- Tier 2 Growth: GBP 44.12 monthly.",
  "- Tier 3 Elite: GBP 62.51 monthly.",
  "- Timeline options: 3-6 months or 6-9 months.",
  "- Cancellation: 14 days written notice required.",
  "- Referral credits can reduce future fees.",
  "- No commission is taken from models.",
  "Tier differentiation guidance:",
  "- Starter: affordable entry, basic portfolio development, photographer network access.",
  "- Growth: all Starter benefits plus deeper coaching and stronger agency placement support.",
  "- Elite: highest-touch support with priority access to top industry professionals.",
  "Contract explanation scope:",
  "- Explain non-compete (if applicable), IP ownership, liability limits, payment terms, late fees, post-cancellation portfolio material handling.",
  "- Explain in plain language and summarize sections when asked like Section 4.2.",
  "Qualification flow:",
  "- Ask about modeling experience, current agency representation, goals (commercial/fashion/runway), timeline to become agency-ready, and whether they need photography services.",
  "Safety and legal safeguards:",
  "- State clearly that this is AI and not a lawyer.",
  "- State explanations are informational and not legal advice.",
  "- Mention calls/chats may be recorded for quality assurance when relevant.",
  "Escalate to human legal team when:",
  "- User is confused/frustrated repeatedly, asks to modify contract terms, asks liability/negligence/dispute strategy, requests specific legal advice, or mentions discrimination/harassment/regulatory complaints.",
  "Conversation quality style:",
  "- Use natural, empathetic tone and plain language; avoid robotic legal phrasing.",
  "- Answer with practical examples and then ask a short follow-up question.",
].join(" ");

const MAX_MESSAGE_CHARS = 3000;
const MAX_REPLY_TOKENS = 700;

// Lightweight in-memory throttle per IP for basic abuse protection.
const WINDOW_MS = 60 * 1000;
const MAX_REQUESTS_PER_WINDOW = 10;

function getClientIp(req) {
  const forwarded = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim();
  return forwarded || req.socket?.remoteAddress || "unknown";
}

function isRateLimited(ip) {
  const now = Date.now();
  const store = (globalThis.__legalBotRateLimit ||= new Map());
  const current = store.get(ip) || { count: 0, resetAt: now + WINDOW_MS };
  if (now > current.resetAt) {
    const fresh = { count: 1, resetAt: now + WINDOW_MS };
    store.set(ip, fresh);
    return false;
  }
  current.count += 1;
  store.set(ip, current);
  return current.count > MAX_REQUESTS_PER_WINDOW;
}

function sanitizeUserInput(value) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, MAX_MESSAGE_CHARS);
}

function fallbackResponse(question) {
  const topic = question ? `You asked: "${question.slice(0, 220)}".` : "";
  return [
    `${topic} I can provide general legal information and help you prepare for attorney follow-up.`,
    "I am not a lawyer and this is not legal advice.",
    "Please share: 1) your jurisdiction/state, 2) the legal issue type, 3) any deadline/court date, 4) your preferred contact details.",
    `For urgent matters, contact a licensed attorney in your area immediately and notify ${COMPANY_NAME} legal operations directly.`,
  ]
    .filter(Boolean)
    .join("\n\n");
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const ip = getClientIp(req);
  if (isRateLimited(ip)) {
    return res.status(429).json({ ok: false, error: "Too many requests. Please wait a minute and try again." });
  }

  const message = sanitizeUserInput(req.body?.message);
  if (!message) {
    return res.status(400).json({ ok: false, error: "Missing message" });
  }

  const history = Array.isArray(req.body?.history) ? req.body.history.slice(-8) : [];
  const normalizedHistory = history
    .map((item) => ({
      role: item?.role === "assistant" ? "assistant" : "user",
      content: sanitizeUserInput(item?.content),
    }))
    .filter((item) => item.content);

  if (!LEGAL_AI_API_KEY) {
    return res.status(200).json({
      ok: true,
      configured: false,
      answer: fallbackResponse(message),
    });
  }

  const systemPrompt = [
    `You are ${COMPANY_NAME}'s Legal Affairs AI Intake Assistant.`,
    "You can provide general legal information, legal process education, and intake summaries.",
    "Never claim to be a lawyer. Never provide definitive legal advice or representation.",
    "Always include a short disclaimer that this is not legal advice.",
    "Always disclose you are an AI assistant when asked who you are.",
    "Ask for jurisdiction and deadline if missing.",
    "If user indicates danger, criminal exposure, active court deadlines, or emergency, urge immediate licensed attorney contact.",
    "If user requests legal strategy or contract modifications, escalate to human legal team and stop short of legal advice.",
    "Keep answers concise, practical, and professional.",
    LEGAL_PLAYBOOK,
  ].join(" ");

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LEGAL_AI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: LEGAL_AI_MODEL,
        temperature: 0.2,
        max_tokens: MAX_REPLY_TOKENS,
        messages: [
          { role: "system", content: systemPrompt },
          ...normalizedHistory,
          { role: "user", content: message },
        ],
      }),
    });

    const json = await response.json().catch(() => ({}));
    if (!response.ok) {
      const apiError = json?.error?.message || json?.error || "Legal assistant request failed";
      return res.status(502).json({ ok: false, error: String(apiError) });
    }

    const answer = String(json?.choices?.[0]?.message?.content || "").trim();
    return res.status(200).json({
      ok: true,
      configured: true,
      model: LEGAL_AI_MODEL,
      answer: answer || fallbackResponse(message),
    });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      error: err?.message || "Unexpected legal assistant error",
    });
  }
}
