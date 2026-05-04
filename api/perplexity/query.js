import { requireStaffSession } from "../_security";

const PERPLEXITY_API_KEY = (process.env.PERPLEXITY_API_KEY || "").trim();
const PERPLEXITY_MODEL = (process.env.PERPLEXITY_MODEL || "sonar").trim();

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const session = await requireStaffSession(req, res, ["admin", "va", "agent"]);
  if (!session) return;

  if (!PERPLEXITY_API_KEY) {
    return res.status(503).json({
      ok: false,
      configured: false,
      error: "Missing PERPLEXITY_API_KEY",
    });
  }

  const prompt = String(req.body?.prompt || "").trim();
  const system = String(req.body?.system || "You are a research assistant for a fashion agency operations team.").trim();

  if (!prompt) {
    return res.status(400).json({ ok: false, error: "Missing prompt" });
  }

  try {
    const perplexityResp = await fetch("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${PERPLEXITY_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: PERPLEXITY_MODEL,
        temperature: 0.2,
        messages: [
          { role: "system", content: system },
          { role: "user", content: prompt },
        ],
      }),
    });

    const json = await perplexityResp.json().catch(() => ({}));

    if (!perplexityResp.ok) {
      const message = json?.error?.message || json?.error || "Perplexity request failed";
      return res.status(502).json({ ok: false, configured: true, error: message });
    }

    const answer = json?.choices?.[0]?.message?.content || "";
    const citations = Array.isArray(json?.citations) ? json.citations : [];

    return res.status(200).json({
      ok: true,
      configured: true,
      model: PERPLEXITY_MODEL,
      answer,
      citations,
    });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      configured: true,
      error: err.message || "Unexpected Perplexity error",
    });
  }
}
