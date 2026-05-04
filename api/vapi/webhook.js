import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const TWILIO_FROM_NUMBER = process.env.TWILIO_PHONE_NUMBER;

async function sendSms(to, body) {
  const creds = Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString("base64");
  const res = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${creds}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        To: to,
        From: TWILIO_FROM_NUMBER,
        Body: body,
      }),
    }
  );
  return res.json();
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

  // 2 — Send follow-up SMS if we have the caller's number
  if (callerPhone && TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN && TWILIO_FROM_NUMBER) {
    const smsBody =
      `Hi, it's Serenity from Smith Inc! Here's everything you need to get started:\n\n` +
      `📸 Submit your digitals: Check your email for the upload link.\n` +
      `📲 WhatsApp us your runway video + measurements (height, weight, bust/chest, waist, hips, inseam, shoe size, dress/suit size).\n\n` +
      `We're excited to have you. — Smith Inc`;

    const smsResult = await sendSms(callerPhone, smsBody);
    if (smsResult.error_code) {
      console.error("SMS error:", smsResult.message);
    }
  }

  return res.status(200).json({ ok: true });
}
