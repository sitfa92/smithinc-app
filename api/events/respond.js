import { createClient } from "@supabase/supabase-js";

const RESEND_API_URL = "https://api.resend.com/emails";
const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const resendKey = (process.env.RESEND_API_KEY || "").trim();
const fromEmail = (process.env.ALERT_FROM_EMAIL || "onboarding@meet-serenity.online").trim();

const admin = supabaseUrl && serviceRoleKey ? createClient(supabaseUrl, serviceRoleKey) : null;

const ALLOWED_ORIGINS = new Set([
  "https://meet-serenity.online",
  "https://smithinc-app.vercel.app",
  "http://localhost:5173",
  "http://localhost:3000",
]);

const DEFAULT_ROLE_BY_EMAIL = {
  "sitfa92@gmail.com": "admin",
  "marthajohn223355@gmail.com": "va",
  "chizzyboi72@gmail.com": "agent",
};

const normalizeEmail = (value) => (value || "").trim().toLowerCase();
const isValidEmail = (value) => /.+@.+\..+/.test(normalizeEmail(value));
const escapeHtml = (value) => String(value || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const formatDate = (value) => {
  if (!value) return "To be announced";
  const dt = new Date(value);
  return Number.isNaN(dt.getTime())
    ? String(value)
    : dt.toLocaleString("en-US", { dateStyle: "full", timeStyle: "short" });
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const origin = req.headers.origin || req.headers.referer || "";
  const originBase = origin.split("/").slice(0, 3).join("/");
  if (origin && !ALLOWED_ORIGINS.has(originBase)) {
    return res.status(403).json({ error: "Forbidden" });
  }

  const {
    modelName = "there",
    modelEmail = "",
    eventTitle = "Event",
    eventType = "meeting",
    eventAt = "",
    action = "confirm",
    requestedTime = "",
    message = "",
  } = req.body || {};

  const cleanEmail = normalizeEmail(modelEmail);
  if (!isValidEmail(cleanEmail)) {
    return res.status(400).json({ error: "Missing or invalid model email" });
  }

  const normalizedAction = ["confirm", "reschedule", "cancel"].includes(action) ? action : "confirm";
  const requestedLabel = requestedTime ? formatDate(requestedTime) : "Not provided";
  const titleByAction = {
    confirm: "Model confirmed event",
    reschedule: "Model requested reschedule",
    cancel: "Model cancelled event",
  };
  const levelByAction = {
    confirm: "success",
    reschedule: "warning",
    cancel: "error",
  };

  const internalTitle = `${titleByAction[normalizedAction]}: ${modelName}`;
  const internalMessage = [
    `${modelName} responded to an event invitation.`,
    `Action: ${normalizedAction}`,
    `Event: ${eventTitle}`,
    `Type: ${eventType}`,
    `Scheduled for: ${formatDate(eventAt)}`,
    `Model email: ${cleanEmail}`,
    normalizedAction === "reschedule" ? `Requested new time: ${requestedLabel}` : null,
    message ? `Message: ${message}` : null,
  ].filter(Boolean).join("\n");

  if (admin) {
    try {
      await admin.from("alerts").insert([
        {
          title: internalTitle,
          message: internalMessage,
          audience_role: "admin",
          audience_email: null,
          source_type: "model_event_response",
          source_id: `${cleanEmail}:${eventTitle}`,
          level: levelByAction[normalizedAction],
          status: "unread",
          created_at: new Date().toISOString(),
        },
        {
          title: internalTitle,
          message: internalMessage,
          audience_role: "agent",
          audience_email: null,
          source_type: "model_event_response",
          source_id: `${cleanEmail}:${eventTitle}`,
          level: levelByAction[normalizedAction],
          status: "unread",
          created_at: new Date().toISOString(),
        },
      ]);
    } catch (_err) {
      // non-blocking
    }
  }

  const recipients = Object.keys(DEFAULT_ROLE_BY_EMAIL).filter(isValidEmail);
  if (resendKey && recipients.length > 0) {
    try {
      const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
    <tr><td align="center" style="padding:40px 16px;">
      <table width="100%" style="max-width:560px;" cellpadding="0" cellspacing="0" role="presentation">
        <tr><td style="background:#000;padding:20px 28px;border-radius:8px 8px 0 0;">
          <p style="margin:0;color:#fff;font-size:15px;font-weight:700;letter-spacing:3px;">SMITH INC</p>
          <p style="margin:4px 0 0;color:#aaa;font-size:11px;letter-spacing:1px;text-transform:uppercase;">Model Event Response</p>
        </td></tr>
        <tr><td style="background:#fff;padding:28px;border-radius:0 0 8px 8px;">
          <h2 style="margin:0 0 16px;font-size:17px;color:#111;">${escapeHtml(internalTitle)}</h2>
          <div style="white-space:pre-wrap;color:#444;font-size:14px;line-height:1.7;margin:0 0 24px;">${escapeHtml(internalMessage)}</div>
          <hr style="border:none;border-top:1px solid #eee;margin:24px 0 16px;">
          <p style="margin:0;color:#bbb;font-size:12px;">Smith Inc · meet-serenity.online</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

      await fetch(RESEND_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${resendKey}`,
        },
        body: JSON.stringify({
          from: fromEmail,
          to: recipients,
          subject: internalTitle,
          html,
          text: internalMessage,
          reply_to: cleanEmail,
        }),
      });
    } catch (_err) {
      // non-blocking
    }
  }

  return res.status(200).json({ ok: true, action: normalizedAction });
}
