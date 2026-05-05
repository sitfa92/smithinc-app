const RESEND_API_URL = "https://api.resend.com/emails";
const APP_BASE_URL = (process.env.APP_BASE_URL || "https://meet-serenity.online").trim().replace(/\/$/, "");
const DEFAULT_ADMIN_EMAILS = ["sitfa92@gmail.com"];
const CALENDLY_US_LINK = (process.env.CALENDLY_US_LINK || "https://calendly.com/").trim();
const CALENDLY_INTL_LINK = (process.env.CALENDLY_INTL_LINK || "https://calendly.com/").trim();

const escapeHtml = (str) =>
  String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");

const normalizeEmail = (v) => (v || "").trim().toLowerCase();
const isValidEmail = (v) => /.+@.+\..+/.test(normalizeEmail(v));

const extractCountryCodeFromMessage = (value = "") => {
  const text = String(value || "");
  const match = text.match(/(?:FromCountry|CallerCountry|Country)\s*:\s*([A-Za-z]{2,3})/i);
  return (match?.[1] || "").trim().toUpperCase();
};

const extractCallerNumberFromMessage = (value = "") => {
  const text = String(value || "");
  const match = text.match(/(?:Caller\s*number|Phone)\s*:\s*([^\n]+)/i);
  return String(match?.[1] || "").trim();
};

const isUSBooking = (data = {}) => {
  const countryCode = String(data.countryCode || data.country || "").trim().toUpperCase();
  if (countryCode) return countryCode === "US" || countryCode === "USA";

  const fromMessage = extractCountryCodeFromMessage(data.message || "");
  if (fromMessage) return fromMessage === "US" || fromMessage === "USA";

  const callerPhone = String(data.phone || extractCallerNumberFromMessage(data.message || "")).trim();
  if (callerPhone.startsWith("+1")) return true;

  return false;
};

const chooseCalendlyLink = (data = {}) => (isUSBooking(data) ? CALENDLY_US_LINK : CALENDLY_INTL_LINK);

const getAdminRecipients = () => {
  const configured = String(process.env.ADMIN_NOTIFICATION_EMAILS || "")
    .split(",")
    .map(normalizeEmail)
    .filter(isValidEmail);

  const merged = configured.length ? configured : DEFAULT_ADMIN_EMAILS;
  return Array.from(new Set(merged.map(normalizeEmail).filter(isValidEmail)));
};

// ─── HTML shell ───────────────────────────────────────────────────────────────
const shell = (bodyContent) => `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
    <tr><td align="center" style="padding:40px 16px;">
      <table width="100%" style="max-width:560px;" cellpadding="0" cellspacing="0" role="presentation">
        <!-- Header -->
        <tr><td style="background:#000;padding:24px 32px;border-radius:8px 8px 0 0;">
          <p style="margin:0;color:#fff;font-size:18px;font-weight:700;letter-spacing:3px;">SMITH INC</p>
        </td></tr>
        <!-- Body -->
        <tr><td style="background:#fff;padding:32px;border-radius:0 0 8px 8px;">
          ${bodyContent}
          <hr style="border:none;border-top:1px solid #eee;margin:28px 0 20px;">
          <p style="margin:0;color:#bbb;font-size:12px;">Smith Inc &nbsp;·&nbsp; <a href="https://meet-serenity.online" style="color:#bbb;">meet-serenity.online</a></p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

const formatDateTime = (value) => {
  if (!value) return "To be announced";
  const dt = new Date(value);
  return Number.isNaN(dt.getTime())
    ? String(value)
    : dt.toLocaleString("en-US", { dateStyle: "full", timeStyle: "short" });
};

const buildEventResponseLink = ({ name = "", email = "", eventTitle = "", eventType = "", eventAt = "", action = "confirm" }) => {
  const params = new URLSearchParams({
    name,
    email,
    eventTitle,
    eventType,
    eventAt,
    action,
  });
  return `${APP_BASE_URL}/event-response?${params.toString()}`;
};

// ─── Templates ────────────────────────────────────────────────────────────────
const templates = {
  "model-submission": ({ name: rawName = "there", instagram: rawInstagram = "" }) => {
    const name = escapeHtml(rawName);
    const instagram = escapeHtml(rawInstagram);
    return {
    subject: "Application received — Smith Inc",
    html: shell(`
      <h2 style="margin:0 0 20px;font-size:20px;color:#111;">Application Received ✓</h2>
      <p style="margin:0 0 12px;color:#444;line-height:1.7;">Hi <strong>${name}</strong>,</p>
      <p style="margin:0 0 20px;color:#444;line-height:1.7;">
        Thank you for applying to Smith Inc. We've received your submission and our team will review it shortly.
        We'll reach back out to you here once a decision has been made.
      </p>
      ${instagram ? `<p style="margin:0 0 20px;color:#888;font-size:14px;">Instagram submitted: <strong>@${instagram.replace(/^@/, "")}</strong></p>` : ""}
      <p style="margin:0;color:#444;line-height:1.7;">Talk soon,<br><strong>The Smith Inc Team</strong></p>
    `),
    text: `Hi ${rawName},\n\nThank you for applying to Smith Inc. We've received your model application and will be in touch shortly.\n\n— The Smith Inc Team`,
    };
  },

  "model-status": ({ name: rawName = "there", status = "", digitalsLink = "" }) => {
    const name = escapeHtml(rawName);
    const approved = status === "approved";
    return {
      subject: approved ? "Congratulations — you're accepted to the program" : "Application update — Smith Inc",
      html: shell(`
        <h2 style="margin:0 0 20px;font-size:20px;color:${approved ? "#16a34a" : "#dc2626"};">
          ${approved ? "Congratulations! 🎉" : "Application Update"}
        </h2>
        <p style="margin:0 0 12px;color:#444;line-height:1.7;">Hi <strong>${name}</strong>,</p>
        <p style="margin:0 0 20px;color:#444;line-height:1.7;">
          ${approved
            ? "You’ve been <strong>accepted into our model development program</strong>. We’re excited to support your next steps and help you start your career with Smith Inc."
            : "After reviewing your application, we've decided not to move forward at this time. We appreciate your interest and encourage you to apply again in the future."}
        </p>
        ${approved && digitalsLink ? `
          <p style="margin:0 0 18px;color:#444;line-height:1.7;">Please upload your digitals using the secure link below:</p>
          <p style="margin:0 0 22px;">
            <a href="${digitalsLink}" style="display:inline-block;background:#111;color:#fff;text-decoration:none;padding:12px 18px;border-radius:8px;font-size:13px;font-weight:600;letter-spacing:0.04em;">Upload Your Digitals</a>
          </p>
          <p style="margin:0 0 20px;color:#666;font-size:13px;line-height:1.7;">If the button does not work, copy this link into your browser:<br>${digitalsLink}</p>
        ` : ""}
        <p style="margin:0;color:#444;line-height:1.7;">— <strong>The Smith Inc Team</strong></p>
      `),
      text: approved
        ? `Hi ${rawName},\n\nCongratulations — you have been accepted into our model development program. ${digitalsLink ? `Please upload your digitals here: ${digitalsLink}\n\n` : ""}— The Smith Inc Team`
        : `Hi ${rawName},\n\nThank you for applying. We've decided not to move forward at this time.\n\n— The Smith Inc Team`,
    };
  },

  "model-event": ({ name: rawName = "there", email = "", eventTitle: rawEventTitle = "Casting call", eventType: rawEventType = "casting", eventAt = "", notes: rawNotes = "" }) => {
    const name = escapeHtml(rawName);
    const eventTitle = escapeHtml(rawEventTitle);
    const eventType = escapeHtml(rawEventType);
    const notes = escapeHtml(rawNotes).replace(/\n/g, "<br>");
    return {
    subject: `Casting call invitation — ${eventTitle}`,
    html: (() => {
      const submitUrl = buildEventResponseLink({ name: rawName, email, eventTitle: rawEventTitle, eventType: rawEventType, eventAt, action: "available" });
      return shell(`
        <h2 style="margin:0 0 20px;font-size:20px;color:#111;">Casting call invitation</h2>
        <p style="margin:0 0 12px;color:#444;line-height:1.7;">Hi <strong>${name}</strong>,</p>
        <p style="margin:0 0 16px;color:#444;line-height:1.7;">
          You have a new ${eventType || "casting"} casting call from Smith Inc.
        </p>
        <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 22px;border:1px solid #eee;border-radius:6px;overflow:hidden;">
          <tr><td style="padding:10px 16px;background:#fafafa;border-bottom:1px solid #eee;font-size:13px;color:#888;">Casting call</td><td style="padding:10px 16px;background:#fafafa;border-bottom:1px solid #eee;font-size:13px;color:#111;">${eventTitle}</td></tr>
          <tr><td style="padding:10px 16px;background:#fff;border-bottom:1px solid #eee;font-size:13px;color:#888;">Category</td><td style="padding:10px 16px;background:#fff;border-bottom:1px solid #eee;font-size:13px;color:#111;">${eventType || "Casting"}</td></tr>
          <tr><td style="padding:10px 16px;background:#fafafa;font-size:13px;color:#888;">Date & time</td><td style="padding:10px 16px;background:#fafafa;font-size:13px;color:#111;">${formatDateTime(eventAt)}</td></tr>
        </table>
        ${rawNotes ? `<p style="margin:0 0 18px;color:#444;line-height:1.7;"><strong>Details:</strong><br>${notes}</p>` : ""}
        <p style="margin:0 0 12px;color:#444;line-height:1.7;">Please submit your casting response using the button below:</p>
        <p style="margin:0 0 10px;display:flex;gap:8px;flex-wrap:wrap;">
          <a href="${submitUrl}" style="display:inline-block;background:#111;color:#fff;text-decoration:none;padding:11px 16px;border-radius:8px;font-size:13px;font-weight:600;">Submit Casting Response</a>
        </p>
        <p style="margin:0;color:#666;font-size:12px;line-height:1.7;">If the button does not work, reply to this email and the team will manually log your response.</p>
      `);
    })(),
      text: `Hi ${rawName},\n\nYou have a new ${rawEventType || "casting"} casting call from Smith Inc.\nCasting call: ${rawEventTitle}\nDate & time: ${formatDateTime(eventAt)}${rawNotes ? `\nDetails: ${rawNotes}` : ""}\n\nSubmit response: ${buildEventResponseLink({ name: rawName, email, eventTitle: rawEventTitle, eventType: rawEventType, eventAt, action: "available" })}\n\n— The Smith Inc Team`,
    };
  },

  "booking-confirmation": (payload = {}) => {
    const { name: rawName = "there", company: rawCompany = "", serviceType: rawServiceType = "", preferredDate: rawPreferredDate = "" } = payload;
    const name = escapeHtml(rawName);
    const company = escapeHtml(rawCompany);
    const serviceType = escapeHtml(rawServiceType);
    const preferredDate = escapeHtml(rawPreferredDate);
    const calendlyLink = chooseCalendlyLink(payload);
    const safeCalendlyLink = escapeHtml(calendlyLink);
    const linkLabel = isUSBooking(payload) ? "US Consultation Link" : "International Consultation Link";
    return {
    subject: "Booking request received — Smith Inc",
    html: shell(`
      <h2 style="margin:0 0 20px;font-size:20px;color:#111;">Booking Request Received ✓</h2>
      <p style="margin:0 0 12px;color:#444;line-height:1.7;">Hi <strong>${name}</strong>,</p>
      <p style="margin:0 0 20px;color:#444;line-height:1.7;">
        We've received your booking request and will confirm availability shortly.
      </p>
      <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;border:1px solid #eee;border-radius:6px;overflow:hidden;">
        ${company ? `<tr><td style="padding:10px 16px;background:#fafafa;border-bottom:1px solid #eee;font-size:13px;color:#888;">Company</td><td style="padding:10px 16px;background:#fafafa;border-bottom:1px solid #eee;font-size:13px;color:#111;">${company}</td></tr>` : ""}
        ${serviceType ? `<tr><td style="padding:10px 16px;background:#fff;border-bottom:1px solid #eee;font-size:13px;color:#888;">Service</td><td style="padding:10px 16px;background:#fff;border-bottom:1px solid #eee;font-size:13px;color:#111;">${serviceType}</td></tr>` : ""}
        ${preferredDate ? `<tr><td style="padding:10px 16px;background:#fafafa;font-size:13px;color:#888;">Preferred date</td><td style="padding:10px 16px;background:#fafafa;font-size:13px;color:#111;">${preferredDate}</td></tr>` : ""}
      </table>
      <p style="margin:0 0 12px;color:#444;line-height:1.7;">To speed up scheduling, use your consultation link below:</p>
      <p style="margin:0 0 20px;">
        <a href="${safeCalendlyLink}" style="display:inline-block;background:#111;color:#fff;text-decoration:none;padding:12px 18px;border-radius:8px;font-size:13px;font-weight:600;letter-spacing:0.04em;">${linkLabel}</a>
      </p>
      <p style="margin:0 0 20px;color:#666;font-size:13px;line-height:1.7;">If the button does not work, copy this link into your browser:<br>${safeCalendlyLink}</p>
      <p style="margin:0;color:#444;line-height:1.7;">We'll follow up with confirmation details soon.<br><strong>— The Smith Inc Team</strong></p>
    `),
    text: `Hi ${rawName},\n\nWe've received your booking request for ${rawServiceType || "our services"}${rawPreferredDate ? " on " + rawPreferredDate : ""}. We'll be in touch shortly to confirm.\n\nConsultation link: ${calendlyLink}\n\n— The Smith Inc Team`,
    };
  },

  "booking-confirmed": (payload = {}) => {
    const { name: rawName = "there", serviceType: rawServiceType = "" } = payload;
    const name = escapeHtml(rawName);
    const serviceType = escapeHtml(rawServiceType);
    const calendlyLink = chooseCalendlyLink(payload);
    const safeCalendlyLink = escapeHtml(calendlyLink);
    const linkLabel = isUSBooking(payload) ? "Book Your US Consultation" : "Book Your International Consultation";
    return {
    subject: "Your booking is confirmed — Smith Inc",
    html: shell(`
      <h2 style="margin:0 0 20px;font-size:20px;color:#16a34a;">Booking Confirmed ✓</h2>
      <p style="margin:0 0 12px;color:#444;line-height:1.7;">Hi <strong>${name}</strong>,</p>
      <p style="margin:0 0 20px;color:#444;line-height:1.7;">
        Your booking${serviceType ? ` for <strong>${serviceType}</strong>` : ""} has been <strong>confirmed</strong> by our team.
        We're looking forward to working with you.
      </p>
      <p style="margin:0 0 20px;color:#444;line-height:1.7;">
        If you have any questions before then, feel free to reply to this email.
      </p>
      <p style="margin:0 0 12px;color:#444;line-height:1.7;">Use the link below to schedule your consultation time:</p>
      <p style="margin:0 0 20px;">
        <a href="${safeCalendlyLink}" style="display:inline-block;background:#111;color:#fff;text-decoration:none;padding:12px 18px;border-radius:8px;font-size:13px;font-weight:600;letter-spacing:0.04em;">${linkLabel}</a>
      </p>
      <p style="margin:0 0 20px;color:#666;font-size:13px;line-height:1.7;">If the button does not work, copy this link into your browser:<br>${safeCalendlyLink}</p>
      <p style="margin:0;color:#444;line-height:1.7;">See you soon,<br><strong>The Smith Inc Team</strong></p>
    `),
    text: `Hi ${rawName},\n\nYour booking${rawServiceType ? " for " + rawServiceType : ""} is confirmed. We're looking forward to working with you.\n\nSchedule your consultation here: ${calendlyLink}\n\n— The Smith Inc Team`,
    };
  },
};

// ─── Handler ──────────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const resendKey = (process.env.RESEND_API_KEY || "").trim();
  const fromEmail = (process.env.ALERT_FROM_EMAIL || "onboarding@meet-serenity.online").trim();

  if (!resendKey) {
    return res.status(200).json({ ok: true, skipped: true, reason: "RESEND_API_KEY not configured" });
  }

  const { type, data = {} } = req.body || {};
  const templateFn = templates[type];

  if (!templateFn) {
    return res.status(400).json({ error: `Unknown email type: ${type}` });
  }

  const recipientEmail = normalizeEmail(data.email);
  const adminRecipients = getAdminRecipients();

  const recipientTypes = new Set([
    "model-submission",
    "model-status",
    "model-event",
    "booking-confirmation",
    "booking-confirmed",
  ]);

  const toRecipients = recipientTypes.has(type)
    ? (isValidEmail(recipientEmail) ? [recipientEmail] : [])
    : adminRecipients;

  if (toRecipients.length === 0) {
    const reason = recipientTypes.has(type) ? "No recipient email available" : "No admin recipients configured";
    return res.status(200).json({ ok: true, skipped: true, reason });
  }

  const { subject, html, text } = templateFn(data);

  try {
    const resp = await fetch(RESEND_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${resendKey}`,
      },
      body: JSON.stringify({ from: fromEmail, to: toRecipients, subject, html, text, reply_to: isValidEmail(recipientEmail) ? recipientEmail : undefined }),
    });

    if (!resp.ok) {
      const errText = await resp.text();
      throw new Error(errText || "Resend request failed");
    }

    return res.status(200).json({
      ok: true,
      type,
      sentTo: toRecipients,
      intendedRecipient: recipientEmail,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message || "Failed to send email" });
  }
}
