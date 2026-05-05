import express from "express";
import dotenv from "dotenv";

dotenv.config();

const app = express();

app.use(express.urlencoded({ extended: false }));
app.use(express.json());

const PORT = Number(process.env.PORT || 5050);
const PUBLIC_BASE_URL = String(process.env.PUBLIC_BASE_URL || "").trim().replace(/\/$/, "");
const OPENAI_API_KEY = String(process.env.OPENAI_API_KEY || "").trim();
const OPENAI_MODEL = String(process.env.OPENAI_MODEL || "gpt-4o-mini").trim();
const SUPABASE_URL = String(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "").trim().replace(/\/+$/, "");
const SUPABASE_SERVICE_ROLE_KEY = String(process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
const RESEND_API_KEY = String(process.env.RESEND_API_KEY || "").trim();
const ALERT_FROM_EMAIL = String(process.env.ALERT_FROM_EMAIL || "onboarding@meet-serenity.online").trim();
const REQUIRED_ADMIN_EMAILS = ["sitfa92@gmail.com", "marthajohn223355@gmail.com"];
const ADMIN_NOTIFICATION_EMAILS = String(
  process.env.ADMIN_NOTIFICATION_EMAILS || ""
)
  .split(",")
  .concat(REQUIRED_ADMIN_EMAILS)
  .map((email) => String(email || "").trim().toLowerCase())
  .filter((email, idx, arr) => /.+@.+\..+/.test(email) && arr.indexOf(email) === idx);
const BOT_NAME = String(process.env.BOT_NAME || "Serenity").trim();
const SYSTEM_PROMPT = String(
  process.env.SYSTEM_PROMPT ||
    "You are a concise, friendly phone assistant. Keep answers brief and clear for voice calls."
).trim();
const MAIN_PROGRAM_INFO_EN = String(
  process.env.MAIN_PROGRAM_INFO_EN ||
    "Main info: Meet Serenity is SmithInc's fashion consulting and model development platform. SmithInc is not a modeling agency. The program helps manage model portfolios, coordinate brand bookings, and track pipeline workflows. Starter, Growth, and Elite tiers provide coaching, positioning support, and accountability to prepare top models for placement across different areas of the industry."
).trim();
const MAIN_PROGRAM_INFO_FR = String(
  process.env.MAIN_PROGRAM_INFO_FR ||
    "Information principale: Meet Serenity est la plateforme de conseil mode et de developpement de modeles de SmithInc. SmithInc n'est pas une agence de mannequinat. Le programme aide a gerer les portfolios, coordonner les reservations de marques et suivre le pipeline. Les niveaux Starter, Growth et Elite offrent coaching, accompagnement de positionnement et suivi pour preparer des top modeles au placement dans differents secteurs de l'industrie."
).trim();
const PROGRAM_INFO_MESSAGE = String(
  process.env.PROGRAM_INFO_MESSAGE ||
    `${MAIN_PROGRAM_INFO_EN} To apply, visit meet-serenity.online and select apply for the program.`
).trim();
const BOOKING_INFO_MESSAGE = String(
  process.env.BOOKING_INFO_MESSAGE ||
    "For bookings and consultations, visit meet-serenity.online slash book. You can submit your name, email, company, service type, and preferred date. Our team will review and confirm your request quickly."
).trim();
const PROGRAM_INFO_MESSAGE_FR = String(
  process.env.PROGRAM_INFO_MESSAGE_FR ||
    `${MAIN_PROGRAM_INFO_FR} Pour candidater, visitez meet-serenity.online et choisissez apply for the program.`
).trim();
const BOOKING_INFO_MESSAGE_FR = String(
  process.env.BOOKING_INFO_MESSAGE_FR ||
    "Pour les reservations et consultations, visitez meet-serenity.online slash book. Vous pouvez envoyer votre nom, email, entreprise, type de service et date souhaitee. Notre equipe examinera puis confirmera votre demande rapidement."
).trim();

const WHATSAPP_SYSTEM_PROMPT = String(
  process.env.WHATSAPP_SYSTEM_PROMPT ||
    `You are Serenity, the AI assistant for SmithInc, a fashion consulting agency with a model development program. SmithInc is not a modeling agency. You help international clients and aspiring models via WhatsApp. Be warm, professional, and clear. Answer questions about the agency, the Meet Serenity Program, how to apply, requirements, and next steps. Explain that the program is focused on developing top models for placement across different parts of the fashion industry. Keep replies concise and easy to read on a phone screen. Use plain text only - no markdown. If someone wants to apply or submit materials, direct them to meet-serenity.online or tell them to send their digitals and runway video to +1 (773) 694-4567 on WhatsApp.`
).trim();

const VOICE_CONFIG = {
  en: { locale: "en-US", voice: "Polly.Joanna" },
  fr: { locale: "fr-FR", voice: "Polly.Celine" },
};

const COPY = {
  intro: {
    en: "Hi, this is {bot}. Press 1 for Meet Serenity program info. Press 2 for booking help. Press 3 to leave a callback request. Or tell me how I can help you today.",
    fr: "Bonjour, ici {bot}. Appuyez sur 1 pour les informations du programme Meet Serenity. Appuyez sur 2 pour l'aide de reservation. Appuyez sur 3 pour demander un rappel. Ou dites-moi comment je peux vous aider aujourd'hui.",
  },
  gatherPrompt: {
    en: "Press 1 for program info. Press 2 for booking help. Press 3 to leave a callback request. Or speak now.",
    fr: "Appuyez sur 1 pour les informations du programme. Appuyez sur 2 pour l'aide de reservation. Appuyez sur 3 pour demander un rappel. Ou parlez maintenant.",
  },
  missedInput: {
    en: "I did not catch that. Goodbye.",
    fr: "Je n'ai pas bien compris. Au revoir.",
  },
  callbackAsk: {
    en: "Please say your full name, phone number, and the best time to call you back.",
    fr: "Veuillez indiquer votre nom complet, votre numero de telephone et le meilleur moment pour vous rappeler.",
  },
  callbackPrompt: {
    en: "You can speak your callback details now.",
    fr: "Vous pouvez maintenant donner vos informations pour le rappel.",
  },
  callbackMissed: {
    en: "I did not catch that. Please call again, or visit meet-serenity.online slash contact-team.",
    fr: "Je n'ai pas bien compris. Veuillez rappeler, ou visitez meet-serenity.online slash contact-team.",
  },
  callbackHearError: {
    en: "I could not hear your callback details. Please call again.",
    fr: "Je n'ai pas pu entendre vos informations de rappel. Veuillez rappeler.",
  },
  callbackSaved: {
    en: "Thank you. Your callback request has been noted. Our team will follow up soon.",
    fr: "Merci. Votre demande de rappel a bien ete enregistree. Notre equipe vous contactera bientot.",
  },
  consultAsk: {
    en: "Great. To request a consultation follow-up, please say your full name, email address, and any details you want us to know.",
    fr: "Parfait. Pour demander un suivi de consultation, veuillez indiquer votre nom complet, votre adresse email et tout detail utile.",
  },
  consultPrompt: {
    en: "You can share your details now.",
    fr: "Vous pouvez partager vos informations maintenant.",
  },
  consultSaved: {
    en: "Thank you. Your consultation request has been saved and our team will follow up shortly.",
    fr: "Merci. Votre demande de consultation a ete enregistree et notre equipe vous contactera rapidement.",
  },
  consultMissing: {
    en: "I did not hear your details clearly. Please call again or visit meet-serenity.online slash book.",
    fr: "Je n'ai pas bien entendu vos informations. Veuillez rappeler ou visiter meet-serenity.online slash book.",
  },
  silenceEnd: {
    en: "I could not hear anything. Please call again.",
    fr: "Je n'ai rien entendu. Veuillez rappeler.",
  },
  goodbye: {
    en: "Thanks for calling. Goodbye.",
    fr: "Merci pour votre appel. Au revoir.",
  },
  aiFallback: {
    en: "Sorry, I am having trouble right now. Please try again later.",
    fr: "Desole, je rencontre un probleme pour le moment. Veuillez reessayer plus tard.",
  },
  unconfigured: {
    en: "This bot is not configured yet. Missing PUBLIC_BASE_URL environment variable.",
    fr: "Ce bot n'est pas encore configure. La variable d'environnement PUBLIC_BASE_URL est manquante.",
  },
};

// In-memory WhatsApp conversation memory (keyed by sender number)
const WA_CONVERSATIONS = new Map();
const WA_CONVO_TTL_MS = 30 * 60 * 1000;
const WA_MAX_HISTORY = 10;

function getWAConversation(from) {
  const now = Date.now();
  const existing = WA_CONVERSATIONS.get(from);
  if (existing && now - existing.lastAt < WA_CONVO_TTL_MS) {
    existing.lastAt = now;
    return existing;
  }
  const fresh = { messages: [], lastAt: now };
  WA_CONVERSATIONS.set(from, fresh);
  return fresh;
}

function escapeXml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function copy(key, lang, vars = {}) {
  const template = COPY[key]?.[lang] || COPY[key]?.en || "";
  return Object.entries(vars).reduce(
    (acc, [k, v]) => acc.replaceAll(`{${k}}`, String(v)),
    template
  );
}

function getLanguageConfig(lang) {
  return VOICE_CONFIG[lang] || VOICE_CONFIG.en;
}

function looksFrench(text) {
  const value = String(text || "").toLowerCase();
  if (!value) return false;
  if (/[àâçéèêëîïôùûüÿœ]/i.test(value)) return true;
  const frenchSignals = [
    "bonjour",
    "salut",
    "merci",
    "s'il vous plait",
    "svp",
    "je veux",
    "je souhaite",
    "programme",
    "reservation",
    "rappel",
    "au revoir",
    "francais",
  ];
  return frenchSignals.some((signal) => value.includes(signal));
}

function normalizeLang(raw) {
  const value = String(raw || "").trim().toLowerCase();
  if (!value) return "";
  if (value === "fr" || value.startsWith("fr-")) return "fr";
  if (value === "en" || value.startsWith("en-")) return "en";
  return "";
}

function normalizeCountry(raw) {
  return String(raw || "").trim().toUpperCase();
}

function isIvoryCoastCaller({ fromCountry, callerCountry, fromNumber }) {
  const c1 = normalizeCountry(fromCountry);
  const c2 = normalizeCountry(callerCountry);
  if (c1 === "CI" || c1 === "CIV" || c2 === "CI" || c2 === "CIV") return true;
  const num = String(fromNumber || "").trim();
  return /^\+?225/.test(num);
}

function detectCallLanguage({ queryLang, speechLanguage, text, fromCountry, callerCountry, fromNumber, acceptLanguage }) {
  // Business rule: all Ivory Coast callers should be handled in French.
  if (isIvoryCoastCaller({ fromCountry, callerCountry, fromNumber })) return "fr";

  const explicit = normalizeLang(queryLang) || normalizeLang(speechLanguage);
  if (explicit) return explicit;

  const browserLang = String(acceptLanguage || "")
    .split(",")
    .map((part) => part.split(";")[0].trim())
    .find(Boolean);
  const browserDetected = normalizeLang(browserLang);
  if (browserDetected) return browserDetected;

  return looksFrench(text) ? "fr" : "en";
}

function twimlSayAndListen({ message, actionPath = "/gather", first = false, lang = "en" }) {
  const cfg = getLanguageConfig(lang);
  const actionUrl = `${PUBLIC_BASE_URL}${actionPath}${actionPath.includes("?") ? "&" : "?"}lang=${lang}`;
  const intro = first
    ? `<Say voice="${cfg.voice}">${escapeXml(copy("intro", lang, { bot: BOT_NAME }))}</Say>`
    : "";

  return `<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<Response>\n  ${intro}\n  ${message ? `<Say voice=\"${cfg.voice}\">${escapeXml(message)}</Say>` : ""}\n  <Gather input=\"dtmf speech\" numDigits=\"1\" speechTimeout=\"auto\" timeout=\"5\" action=\"${escapeXml(actionUrl)}\" method=\"POST\" language=\"${cfg.locale}\">\n    <Say voice=\"${cfg.voice}\">${escapeXml(copy("gatherPrompt", lang))}</Say>\n  </Gather>\n  <Say voice=\"${cfg.voice}\">${escapeXml(copy("missedInput", lang))}</Say>\n  <Hangup/>\n</Response>`;
}

function twimlCollectCallbackRequest(lang = "en") {
  const cfg = getLanguageConfig(lang);
  const actionUrl = `${PUBLIC_BASE_URL}/gather?mode=callback_collect&lang=${lang}`;
  return `<?xml version="1.0" encoding="UTF-8"?>\n<Response>\n  <Say voice="${cfg.voice}">${escapeXml(copy("callbackAsk", lang))}</Say>\n  <Gather input="speech" speechTimeout="auto" timeout="6" action="${escapeXml(actionUrl)}" method="POST" language="${cfg.locale}">\n    <Say voice="${cfg.voice}">${escapeXml(copy("callbackPrompt", lang))}</Say>\n  </Gather>\n  <Say voice="${cfg.voice}">${escapeXml(copy("callbackMissed", lang))}</Say>\n  <Hangup/>\n</Response>`;
}

function twimlCollectConsultRequest(lang = "en") {
  const cfg = getLanguageConfig(lang);
  const actionUrl = `${PUBLIC_BASE_URL}/gather?mode=consult_collect&lang=${lang}`;
  return `<?xml version="1.0" encoding="UTF-8"?>\n<Response>\n  <Say voice="${cfg.voice}">${escapeXml(copy("consultAsk", lang))}</Say>\n  <Gather input="speech" speechTimeout="auto" timeout="7" action="${escapeXml(actionUrl)}" method="POST" language="${cfg.locale}">\n    <Say voice="${cfg.voice}">${escapeXml(copy("consultPrompt", lang))}</Say>\n  </Gather>\n  <Say voice="${cfg.voice}">${escapeXml(copy("consultMissing", lang))}</Say>\n  <Hangup/>\n</Response>`;
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

  // 1) Direct email spoken as normal text (already contains @).
  const direct = raw.match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i);
  if (direct?.[0]) return direct[0].toLowerCase();

  // 2) Spoken format after cues like "email is" / "email address".
  const spokenCue = raw.match(/(?:email(?:\s+address)?\s*(?:is|:)?\s*)(.+)$/i);
  const spokenTail = spokenCue?.[1] ? spokenCue[1].split(/[,;]|\s(?:and|i|my|please|thank)\s/i)[0] : "";
  const normalizedTail = normalizeSpokenEmail(spokenTail);
  const tailMatch = normalizedTail.match(/[a-z0-9._%+-]{1,64}@[a-z0-9.-]{3,255}\.[a-z]{2,}/i);
  if (tailMatch?.[0]) return tailMatch[0].toLowerCase();

  // 3) Last-resort scan in normalized full phrase, but reject suspiciously long local parts.
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

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}

function formatEmailDate(value) {
  if (!value) return "Unknown";
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return String(value);
  return dt.toLocaleString("en-US", { dateStyle: "full", timeStyle: "short" });
}

async function sendLeadNotificationEmail({
  leadType = "consultation",
  name = "Voice Caller",
  email = "",
  phone = "",
  lang = "en",
  fromCountry = "",
  callerCountry = "",
  details = "",
  createdAt = new Date().toISOString(),
}) {
  if (!RESEND_API_KEY || ADMIN_NOTIFICATION_EMAILS.length === 0) return false;

  const safeLeadType = escapeHtml(leadType);
  const safeName = escapeHtml(name || "Voice Caller");
  const safeEmail = escapeHtml(email || "not provided");
  const safePhone = escapeHtml(phone || "unknown");
  const safeLang = escapeHtml(lang || "unknown");
  const safeFromCountry = escapeHtml(fromCountry || "unknown");
  const safeCallerCountry = escapeHtml(callerCountry || "unknown");
  const safeDetails = escapeHtml(details || "").replace(/\n/g, "<br>");
  const formattedDate = escapeHtml(formatEmailDate(createdAt));

  const subject = `New Voice AI ${leadType === "callback" ? "Callback" : "Consultation"} Lead`;
  const html = `<!DOCTYPE html>
<html lang="en">
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f7f7f8; padding: 20px; color: #111;">
  <div style="max-width: 620px; margin: 0 auto; background: #fff; border: 1px solid #eee; border-radius: 10px; overflow: hidden;">
    <div style="background: #111; color: #fff; padding: 16px 20px; font-weight: 700; letter-spacing: 0.04em;">SMITH INC - VOICE LEAD ALERT</div>
    <div style="padding: 20px; line-height: 1.6;">
      <p style="margin: 0 0 14px;">A new <strong>${safeLeadType}</strong> lead was captured from the voice bot.</p>
      <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse: collapse; margin: 0 0 14px;">
        <tr><td style="padding: 8px 0; color: #666; width: 170px;">Name</td><td style="padding: 8px 0;">${safeName}</td></tr>
        <tr><td style="padding: 8px 0; color: #666;">Email</td><td style="padding: 8px 0;">${safeEmail}</td></tr>
        <tr><td style="padding: 8px 0; color: #666;">Phone</td><td style="padding: 8px 0;">${safePhone}</td></tr>
        <tr><td style="padding: 8px 0; color: #666;">Language</td><td style="padding: 8px 0;">${safeLang}</td></tr>
        <tr><td style="padding: 8px 0; color: #666;">From Country</td><td style="padding: 8px 0;">${safeFromCountry}</td></tr>
        <tr><td style="padding: 8px 0; color: #666;">Caller Country</td><td style="padding: 8px 0;">${safeCallerCountry}</td></tr>
        <tr><td style="padding: 8px 0; color: #666;">Captured At</td><td style="padding: 8px 0;">${formattedDate}</td></tr>
      </table>
      <p style="margin: 0 0 8px;"><strong>Captured Details</strong></p>
      <div style="margin: 0; padding: 12px; border: 1px solid #eee; background: #fafafa; border-radius: 8px; white-space: normal;">${safeDetails || "No additional details provided."}</div>
    </div>
  </div>
</body>
</html>`;

  const text = [
    `New Voice AI ${leadType === "callback" ? "Callback" : "Consultation"} Lead`,
    `Name: ${name || "Voice Caller"}`,
    `Email: ${email || "not provided"}`,
    `Phone: ${phone || "unknown"}`,
    `Language: ${lang || "unknown"}`,
    `From Country: ${fromCountry || "unknown"}`,
    `Caller Country: ${callerCountry || "unknown"}`,
    `Captured At: ${formatEmailDate(createdAt)}`,
    "",
    "Captured Details:",
    details || "No additional details provided.",
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
      reply_to: /.+@.+\..+/.test(String(email || "")) ? String(email).trim() : undefined,
    }),
  });

  if (!resp.ok) {
    const errorText = await resp.text().catch(() => "");
    throw new Error(`Resend notification failed (${resp.status}): ${errorText || "unknown"}`);
  }

  return true;
}

async function createVoiceConsultLead({ said = "", from = "", lang = "en", fromCountry = "", callerCountry = "" }) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.warn("Voice consult lead not saved: missing Supabase env vars in ai-voice-bot.");
    return false;
  }

  const now = new Date().toISOString();
  const extractedEmail = extractEmail(said);
  const extractedName = extractName(said);
  const fallbackId = Date.now();
  const payload = {
    name: extractedName || "Voice Caller",
    email: extractedEmail || `voice-lead-${fallbackId}@noemail.local`,
    company: "Voice AI Intake",
    service_type: "Consultation - Voice AI Lead",
    preferred_date: null,
    message: [
      "Voice consultation lead captured from phone bot.",
      `Caller number: ${from || "unknown"}`,
      `Detected language: ${lang || "unknown"}`,
      `FromCountry: ${fromCountry || "unknown"}`,
      `CallerCountry: ${callerCountry || "unknown"}`,
      `Captured details: ${said}`,
    ].join("\n"),
    status: "pending",
    created_at: now,
  };

  const resp = await fetch(`${SUPABASE_URL}/rest/v1/bookings`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      Prefer: "return=minimal",
    },
    body: JSON.stringify([payload]),
  });

  if (!resp.ok) {
    const body = await resp.text().catch(() => "");
    throw new Error(`Supabase insert failed (${resp.status}): ${body || "unknown error"}`);
  }

  try {
    await sendLeadNotificationEmail({
      leadType: "consultation",
      name: payload.name,
      email: extractedEmail,
      phone: from,
      lang,
      fromCountry,
      callerCountry,
      details: said,
      createdAt: payload.created_at,
    });
  } catch (err) {
    console.warn("consult lead email notification failed:", err?.message || err);
  }

  return true;
}

function twimlEnd(message, lang = "en") {
  const cfg = getLanguageConfig(lang);
  return `<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<Response>\n  <Say voice=\"${cfg.voice}\">${escapeXml(message)}</Say>\n  <Hangup/>\n</Response>`;
}

function twimlMessage(text) {
  return `<?xml version="1.0" encoding="UTF-8"?>\n<Response>\n  <Message>${escapeXml(text)}</Message>\n</Response>`;
}

async function callOpenAI({ systemPrompt, messages, maxTokens = 180 }) {
  const resp = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      temperature: 0.5,
      max_tokens: maxTokens,
      messages: [{ role: "system", content: systemPrompt }, ...messages],
    }),
  });

  const json = await resp.json().catch(() => ({}));
  if (!resp.ok) throw new Error(json?.error?.message || "AI request failed");
  return String(json?.choices?.[0]?.message?.content || "").trim() || "Could you repeat that?";
}

async function askOpenAI(userText, lang = "en") {
  if (!OPENAI_API_KEY) return "Thanks for calling. Our team will get back to you shortly.";
  const languageGuard =
    lang === "fr"
      ? "Always answer in French unless the caller asks to switch languages."
      : "Always answer in English unless the caller asks to switch languages.";
  const mainInfoGuard =
    lang === "fr"
      ? `Use this as the main info section when callers ask who you are or what the program is: ${MAIN_PROGRAM_INFO_FR}`
      : `Use this as the main info section when callers ask who you are or what the program is: ${MAIN_PROGRAM_INFO_EN}`;
  return callOpenAI({
    systemPrompt: `${SYSTEM_PROMPT}\n\n${languageGuard}\n\n${mainInfoGuard}`,
    messages: [{ role: "user", content: userText }],
  });
}

async function askOpenAIChat(messages) {
  return callOpenAI({ systemPrompt: WHATSAPP_SYSTEM_PROMPT, messages, maxTokens: 320 });
}

app.get("/health", (_req, res) => {
  res.status(200).json({
    ok: true,
    service: "ai-voice-bot",
    openaiConfigured: !!OPENAI_API_KEY,
    publicBaseUrlConfigured: !!PUBLIC_BASE_URL,
  });
});

app.post("/voice", (req, res) => {
  if (!PUBLIC_BASE_URL) {
    res.type("text/xml").status(200).send(
      twimlEnd(copy("unconfigured", "en"), "en")
    );
    return;
  }
  const lang = detectCallLanguage({
    queryLang: req.query?.lang,
    fromCountry: req.body?.FromCountry,
    callerCountry: req.body?.CallerCountry,
    fromNumber: req.body?.From,
    acceptLanguage: req.headers?.["accept-language"],
  });
  res.type("text/xml").status(200).send(twimlSayAndListen({ first: true, lang }));
});

app.post("/voice-fr", (_req, res) => {
  if (!PUBLIC_BASE_URL) {
    res.type("text/xml").status(200).send(
      twimlEnd(copy("unconfigured", "fr"), "fr")
    );
    return;
  }
  res.type("text/xml").status(200).send(twimlSayAndListen({ first: true, lang: "fr" }));
});

app.post("/gather", async (req, res) => {
  const mode = String(req.query?.mode || "").trim().toLowerCase();
  const digits = String(req.body?.Digits || "").trim();
  const said = String(req.body?.SpeechResult || "").trim();
  const lang = detectCallLanguage({
    queryLang: req.query?.lang,
    speechLanguage: req.body?.SpeechLanguage,
    text: said,
    fromCountry: req.body?.FromCountry,
    callerCountry: req.body?.CallerCountry,
    fromNumber: req.body?.From,
    acceptLanguage: req.headers?.["accept-language"],
  });

  if (mode === "callback_collect") {
    if (!said) {
      res.type("text/xml").status(200).send(twimlEnd(copy("callbackHearError", lang), lang));
      return;
    }

    const from = String(req.body?.From || "unknown").trim();
    console.log("callback request:", {
      from,
      spokenDetails: said,
      at: new Date().toISOString(),
    });

    try {
      await sendLeadNotificationEmail({
        leadType: "callback",
        name: extractName(said) || "Voice Caller",
        email: extractEmail(said),
        phone: from,
        lang,
        fromCountry: req.body?.FromCountry,
        callerCountry: req.body?.CallerCountry,
        details: said,
        createdAt: new Date().toISOString(),
      });
    } catch (err) {
      console.warn("callback lead email notification failed:", err?.message || err);
    }

    res
      .type("text/xml")
      .status(200)
      .send(twimlEnd(copy("callbackSaved", lang), lang));
    return;
  }

  if (mode === "consult_collect") {
    if (!said) {
      res.type("text/xml").status(200).send(twimlEnd(copy("consultMissing", lang), lang));
      return;
    }

    const from = String(req.body?.From || "unknown").trim();
    try {
      await createVoiceConsultLead({
        said,
        from,
        lang,
        fromCountry: req.body?.FromCountry,
        callerCountry: req.body?.CallerCountry,
      });
    } catch (err) {
      console.error("consult lead save error:", err?.message || err);
    }

    res.type("text/xml").status(200).send(twimlEnd(copy("consultSaved", lang), lang));
    return;
  }

  if (digits === "1") {
    const infoMessage = lang === "fr" ? PROGRAM_INFO_MESSAGE_FR : PROGRAM_INFO_MESSAGE;
    res.type("text/xml").status(200).send(twimlSayAndListen({ message: infoMessage, lang }));
    return;
  }
  if (digits === "2") {
    res.type("text/xml").status(200).send(twimlCollectConsultRequest(lang));
    return;
  }
  if (digits === "3") {
    res.type("text/xml").status(200).send(twimlCollectCallbackRequest(lang));
    return;
  }

  if (!said) {
    res.type("text/xml").status(200).send(twimlEnd(copy("silenceEnd", lang), lang));
    return;
  }

  const lowered = said.toLowerCase();
  if (
    lowered.includes("option 1") ||
    lowered.includes("press 1") ||
    lowered.includes("program info") ||
    lowered.includes("programme")
  ) {
    const infoMessage = lang === "fr" ? PROGRAM_INFO_MESSAGE_FR : PROGRAM_INFO_MESSAGE;
    res.type("text/xml").status(200).send(twimlSayAndListen({ message: infoMessage, lang }));
    return;
  }
  if (
    lowered.includes("option 2") ||
    lowered.includes("press 2") ||
    lowered.includes("booking") ||
    lowered.includes("reservation") ||
    lowered.includes("consultation") ||
    lowered.includes("schedule") ||
    lowered.includes("book a call") ||
    lowered.includes("book call")
  ) {
    res.type("text/xml").status(200).send(twimlCollectConsultRequest(lang));
    return;
  }
  if (
    lowered.includes("option 3") ||
    lowered.includes("press 3") ||
    lowered.includes("callback") ||
    lowered.includes("rappel")
  ) {
    res.type("text/xml").status(200).send(twimlCollectCallbackRequest(lang));
    return;
  }
  if (
    lowered.includes("goodbye") ||
    lowered.includes("bye") ||
    lowered.includes("stop") ||
    lowered.includes("au revoir")
  ) {
    res.type("text/xml").status(200).send(twimlEnd(copy("goodbye", lang), lang));
    return;
  }

  try {
    const answer = await askOpenAI(said, lang);
    res.type("text/xml").status(200).send(twimlSayAndListen({ message: answer, lang }));
  } catch (err) {
    const fallback = copy("aiFallback", lang);
    console.error("gather error:", err?.message || err);
    res.type("text/xml").status(200).send(twimlEnd(fallback, lang));
  }
});

app.post("/whatsapp", async (req, res) => {
  const incoming = String(req.body?.Body || "").trim();
  const from = String(req.body?.From || "unknown").trim();

  if (!incoming) {
    res.type("text/xml").status(200).send(
      twimlMessage("Hi! I'm Serenity, the SmithInc. assistant for our fashion consulting and model development program. How can I help you today? You can ask about our programs, how to apply, or what to send us.")
    );
    return;
  }

  const lowered = incoming.toLowerCase();
  const isGreeting = ["hi", "hello", "hey", "hola", "bonjour", "salut", "ciao", "ola", "yo"].includes(lowered);

  if (isGreeting) {
    const convo = getWAConversation(from);
    convo.messages = [];
    res.type("text/xml").status(200).send(
      twimlMessage("Hi! I'm Serenity, the SmithInc. assistant. SmithInc is a fashion consulting agency with a model development program. How can I help you today? You can ask about our programs, how to apply, or what materials to send.")
    );
    return;
  }

  if (["stop", "quit", "bye", "goodbye", "unsubscribe"].includes(lowered)) {
    WA_CONVERSATIONS.delete(from);
    res.type("text/xml").status(200).send(
      twimlMessage("Understood! Feel free to message us anytime. Visit meet-serenity.online to learn more about SmithInc.")
    );
    return;
  }

  if (!OPENAI_API_KEY) {
    res.type("text/xml").status(200).send(
      twimlMessage("Thank you for reaching out to SmithInc. A team member will follow up with you shortly.")
    );
    return;
  }

  const convo = getWAConversation(from);
  convo.messages.push({ role: "user", content: incoming });

  if (convo.messages.length > WA_MAX_HISTORY * 2) {
    convo.messages = convo.messages.slice(-(WA_MAX_HISTORY * 2));
  }

  try {
    const answer = await askOpenAIChat(convo.messages);
    convo.messages.push({ role: "assistant", content: answer });
    res.type("text/xml").status(200).send(twimlMessage(answer));
  } catch (err) {
    console.error("whatsapp error:", err?.message || err);
    res.type("text/xml").status(200).send(
      twimlMessage("Sorry, I'm having a moment. Please try again or call us at +1 (773) 694-4567.")
    );
  }
});

app.listen(PORT, () => {
  console.log(`AI voice bot listening on http://localhost:${PORT}`);
});
