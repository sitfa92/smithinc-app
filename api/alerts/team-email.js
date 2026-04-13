const DEFAULT_ROLE_BY_EMAIL = {
  "sitfa92@gmail.com": "admin",
  "marthajohn223355@gmail.com": "va",
  "chizzyboi72@gmail.com": "agent",
};

const RESEND_API_URL = "https://api.resend.com/emails";

const normalizeEmail = (value) => (value || "").trim().toLowerCase();

const isValidEmail = (value) => /.+@.+\..+/.test(normalizeEmail(value));

const getRecipientsFromRoles = (roles) => {
  const requested = new Set((roles || []).map((role) => String(role || "").trim().toLowerCase()));
  return Object.entries(DEFAULT_ROLE_BY_EMAIL)
    .filter(([, role]) => requested.has(role))
    .map(([email]) => normalizeEmail(email));
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const resendKey = (process.env.RESEND_API_KEY || "").trim();
  const fromEmail = (process.env.ALERT_FROM_EMAIL || "onboarding@resend.dev").trim();

  const {
    roles = [],
    subject = "Internal alert",
    message = "",
    extraRecipients = [],
    submissionEmail = "",
  } = req.body || {};

  const roleRecipients = getRecipientsFromRoles(roles);
  const manualRecipients = (extraRecipients || [])
    .map(normalizeEmail)
    .filter(isValidEmail);

  const to = Array.from(new Set([...roleRecipients, ...manualRecipients]));

  if (!resendKey) {
    return res.status(200).json({ ok: true, skipped: true, reason: "RESEND_API_KEY not configured" });
  }

  if (to.length === 0) {
    return res.status(200).json({ ok: true, skipped: true, reason: "No recipients" });
  }

  try {
    const payload = {
      from: fromEmail,
      to,
      subject: String(subject || "Internal alert").slice(0, 180),
      text: String(message || "").slice(0, 5000),
    };

    const replyTo = normalizeEmail(submissionEmail);
    if (isValidEmail(replyTo)) {
      payload.reply_to = replyTo;
    }

    const resendResp = await fetch(RESEND_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${resendKey}`,
      },
      body: JSON.stringify(payload),
    });

    if (!resendResp.ok) {
      const errorText = await resendResp.text();
      throw new Error(errorText || "Resend request failed");
    }

    return res.status(200).json({ ok: true, sentTo: to.length });
  } catch (error) {
    return res.status(500).json({ error: error.message || "Failed to send internal alert email" });
  }
}