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
const BOT_NAME = String(process.env.BOT_NAME || "Serenity").trim();
const SYSTEM_PROMPT = String(
  process.env.SYSTEM_PROMPT ||
    "You are a concise, friendly phone assistant. Keep answers brief and clear for voice calls."
).trim();
const PROGRAM_INFO_MESSAGE = String(
  process.env.PROGRAM_INFO_MESSAGE ||
    "Meet Serenity is a structured model development membership, not a modeling agency. It offers starter, growth, and elite tiers with coaching, positioning support, and accountability. It is designed for serious talent who want clear direction and industry readiness. To apply, visit meet-serenity.online and select apply for the program."
).trim();

const WHATSAPP_SYSTEM_PROMPT = String(
  process.env.WHATSAPP_SYSTEM_PROMPT ||
    `You are Serenity, the AI assistant for SmithInc. The Fashion Agency — a luxury fashion talent agency. You help international clients and aspiring models via WhatsApp. Be warm, professional, and clear. Answer questions about the agency, the Meet Serenity Program, how to apply, requirements, and next steps. Keep replies concise and easy to read on a phone screen. Use plain text only — no markdown. If someone wants to apply or submit materials, direct them to meet-serenity.online or tell them to send their digitals and runway video to +1 (773) 694-4567 on WhatsApp.`
).trim();

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

function twimlSayAndListen({ message, actionPath = "/gather", first = false }) {
  const actionUrl = `${PUBLIC_BASE_URL}${actionPath}`;
  const intro = first
    ? `<Say voice=\"Polly.Joanna\">Hi, this is ${escapeXml(BOT_NAME)}. Press 1 for Meet Serenity program info, or tell me how I can help you today.</Say>`
    : "";

  return `<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<Response>\n  ${intro}\n  ${message ? `<Say voice=\"Polly.Joanna\">${escapeXml(message)}</Say>` : ""}\n  <Gather input=\"dtmf speech\" numDigits=\"1\" speechTimeout=\"auto\" timeout=\"5\" action=\"${escapeXml(actionUrl)}\" method=\"POST\">\n    <Say voice=\"Polly.Joanna\">Press 1 for Meet Serenity program info, or speak now.</Say>\n  </Gather>\n  <Say voice=\"Polly.Joanna\">I did not catch that. Goodbye.</Say>\n  <Hangup/>\n</Response>`;
}

function twimlEnd(message) {
  return `<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<Response>\n  <Say voice=\"Polly.Joanna\">${escapeXml(message)}</Say>\n  <Hangup/>\n</Response>`;
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

async function askOpenAI(userText) {
  if (!OPENAI_API_KEY) return "Thanks for calling. Our team will get back to you shortly.";
  return callOpenAI({ systemPrompt: SYSTEM_PROMPT, messages: [{ role: "user", content: userText }] });
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

app.post("/voice", (_req, res) => {
  if (!PUBLIC_BASE_URL) {
    res.type("text/xml").status(200).send(
      twimlEnd("This bot is not configured yet. Missing PUBLIC_BASE_URL environment variable.")
    );
    return;
  }
  res.type("text/xml").status(200).send(twimlSayAndListen({ first: true }));
});

app.post("/gather", async (req, res) => {
  const digits = String(req.body?.Digits || "").trim();
  const said = String(req.body?.SpeechResult || "").trim();

  if (digits === "1") {
    res.type("text/xml").status(200).send(twimlSayAndListen({ message: PROGRAM_INFO_MESSAGE }));
    return;
  }

  if (!said) {
    res.type("text/xml").status(200).send(twimlEnd("I could not hear anything. Please call again."));
    return;
  }

  const lowered = said.toLowerCase();
  if (lowered.includes("option 1") || lowered.includes("press 1") || lowered.includes("program info")) {
    res.type("text/xml").status(200).send(twimlSayAndListen({ message: PROGRAM_INFO_MESSAGE }));
    return;
  }
  if (lowered.includes("goodbye") || lowered.includes("bye") || lowered.includes("stop")) {
    res.type("text/xml").status(200).send(twimlEnd("Thanks for calling. Goodbye."));
    return;
  }

  try {
    const answer = await askOpenAI(said);
    res.type("text/xml").status(200).send(twimlSayAndListen({ message: answer }));
  } catch (err) {
    const fallback = "Sorry, I am having trouble right now. Please try again later.";
    console.error("gather error:", err?.message || err);
    res.type("text/xml").status(200).send(twimlEnd(fallback));
  }
});

app.post("/whatsapp", async (req, res) => {
  const incoming = String(req.body?.Body || "").trim();
  const from = String(req.body?.From || "unknown").trim();

  if (!incoming) {
    res.type("text/xml").status(200).send(
      twimlMessage("Hi! I'm Serenity, the SmithInc. assistant. How can I help you today? You can ask about our programs, how to apply, or what to send us.")
    );
    return;
  }

  const lowered = incoming.toLowerCase();
  const isGreeting = ["hi", "hello", "hey", "hola", "bonjour", "salut", "ciao", "ola", "yo"].includes(lowered);

  if (isGreeting) {
    const convo = getWAConversation(from);
    convo.messages = [];
    res.type("text/xml").status(200).send(
      twimlMessage("Hi! I'm Serenity, the SmithInc. The Fashion Agency assistant. How can I help you today? You can ask about our programs, how to apply, or what materials to send.")
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
