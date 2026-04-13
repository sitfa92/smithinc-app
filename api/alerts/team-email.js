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
    const safeSubject = String(subject || "Internal alert").slice(0, 180);
    const safeMessage = String(message || "").slice(0, 5000);

    const htmlBody = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
    <tr><td align="center" style="padding:40px 16px;">
      <table width="100%" style="max-width:560px;" cellpadding="0" cellspacing="0" role="presentation">
        <tr><td style="background:#000;padding:20px 28px;border-radius:8px 8px 0 0;">
          <p style="margin:0;color:#fff;font-size:15px;font-weight:700;letter-spacing:3px;">SMITH INC</p>
          <p style="margin:4px 0 0;color:#aaa;font-size:11px;letter-spacing:1px;text-transform:uppercase;">Internal Alert</p>
        </td></tr>
        <tr><td style="background:#fff;padding:28px;border-radius:0 0 8px 8px;">
          <h2 style="margin:0 0 16px;font-size:17px;color:#111;">${safeSubject}</h2>
          <div style="white-space:pre-wrap;color:#444;font-size:14px;line-height:1.7;margin:0 0 24px;">${safeMessage.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")}</div>
          <hr style="border:none;border-top:1px solid #eee;margin:24px 0 16px;">
          <p style="margin:0;color:#bbb;font-size:12px;">Smith Inc &nbsp;·&nbsp; <a href="https://meet-serenity.online" style="color:#bbb;">meet-serenity.online</a></p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

    const payload = {
      from: fromEmail,
      to,
      subject: safeSubject,
      html: htmlBody,
      text: safeMessage,
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