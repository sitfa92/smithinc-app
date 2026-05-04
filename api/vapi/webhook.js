import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

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

  return res.status(200).json({ ok: true });
}
