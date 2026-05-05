import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ZAPIER_WEBHOOK_SECRET = process.env.ZAPIER_WEBHOOK_SECRET;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
const DEDUPE_EVENT_TYPE = "SEO_DEDUPE_GUARD";

function validateSecret(req) {
  if (!ZAPIER_WEBHOOK_SECRET) return;
  const headerSecret = req.headers["x-zapier-secret"];
  if (!headerSecret || headerSecret !== ZAPIER_WEBHOOK_SECRET) {
    throw new Error("Invalid or missing webhook secret");
  }
}

function clampTtlHours(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 24 * 30;
  return Math.max(1, Math.min(24 * 180, Math.floor(parsed)));
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    validateSecret(req);

    const body = req.body || {};
    const dedupeKey = String(body.dedupe_key || "").trim();
    const eventType = String(body.event_type || "seo.question.captured").trim();
    const seoPillar = String(body.seo_pillar || "general").trim();
    const clusterKey = String(body.cluster_key || "").trim();
    const happenedAt = body.happened_at || new Date().toISOString();
    const ttlHours = clampTtlHours(body.ttl_hours);

    if (!dedupeKey) {
      return res.status(400).json({ ok: false, error: "Missing dedupe_key" });
    }

    const cutoffIso = new Date(Date.now() - ttlHours * 60 * 60 * 1000).toISOString();

    const { data: existing, error: readError } = await supabase
      .from("workflow_events")
      .select("id, created_at, event_data")
      .eq("event_type", DEDUPE_EVENT_TYPE)
      .eq("source", "zapier")
      .contains("event_data", { dedupe_key: dedupeKey })
      .gte("created_at", cutoffIso)
      .limit(1);

    if (readError) {
      // Fail open: if dedupe lookup fails, let Zapier continue processing.
      return res.status(200).json({
        ok: true,
        should_process: true,
        duplicate: false,
        degraded: true,
        warning: "dedupe_lookup_failed",
      });
    }

    if (existing && existing.length > 0) {
      return res.status(200).json({
        ok: true,
        should_process: false,
        duplicate: true,
        dedupe_key: dedupeKey,
        existing_id: existing[0].id,
        first_seen_at: existing[0].created_at,
      });
    }

    const { data: inserted, error: insertError } = await supabase
      .from("workflow_events")
      .insert({
        event_type: DEDUPE_EVENT_TYPE,
        event_data: {
          dedupe_key: dedupeKey,
          cluster_key: clusterKey || null,
          event_type: eventType,
          seo_pillar: seoPillar,
          ttl_hours: ttlHours,
          happened_at: happenedAt,
        },
        status: "success",
        source: "zapier",
        happened_at: happenedAt,
        created_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (insertError) {
      // Fail open: do not block content generation if state write fails.
      return res.status(200).json({
        ok: true,
        should_process: true,
        duplicate: false,
        degraded: true,
        warning: "dedupe_store_failed",
      });
    }

    return res.status(200).json({
      ok: true,
      should_process: true,
      duplicate: false,
      dedupe_key: dedupeKey,
      dedupe_id: inserted?.id || null,
      ttl_hours: ttlHours,
    });
  } catch (error) {
    return res.status(401).json({ ok: false, error: error.message || "Unauthorized" });
  }
}
