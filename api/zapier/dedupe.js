import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ZAPIER_WEBHOOK_SECRET = process.env.ZAPIER_WEBHOOK_SECRET;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
const FALLBACK_EVENT_TYPE = "SEO_DEDUPE_GUARD";

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

async function fallbackDedupeUsingWorkflowEvents({
  dedupeKey,
  eventType,
  seoPillar,
  clusterKey,
  happenedAt,
  ttlHours,
}) {
  const cutoffIso = new Date(Date.now() - ttlHours * 60 * 60 * 1000).toISOString();

  const { data: rows, error: readError } = await supabase
    .from("workflow_events")
    .select("id, created_at, event_data")
    .eq("event_type", FALLBACK_EVENT_TYPE)
    .eq("source", "zapier")
    .gte("created_at", cutoffIso)
    .order("created_at", { ascending: false })
    .limit(250);

  if (readError) {
    return {
      ok: true,
      should_process: true,
      duplicate: false,
      degraded: true,
      warning: "fallback_lookup_failed",
    };
  }

  const duplicate = (rows || []).find((row) => {
    const key = row?.event_data?.dedupe_key || "";
    return String(key).trim() === dedupeKey;
  });

  if (duplicate) {
    return {
      ok: true,
      should_process: false,
      duplicate: true,
      dedupe_key: dedupeKey,
      existing_id: duplicate.id,
      first_seen_at: duplicate.created_at,
      degraded: true,
      warning: "fallback_mode",
    };
  }

  const { error: storeError } = await supabase.from("workflow_events").insert({
    event_type: FALLBACK_EVENT_TYPE,
    event_data: {
      dedupe_key: dedupeKey,
      event_type: eventType,
      seo_pillar: seoPillar,
      cluster_key: clusterKey || null,
      ttl_hours: ttlHours,
      happened_at: happenedAt,
    },
    status: "success",
    source: "zapier",
    happened_at: happenedAt,
    created_at: new Date().toISOString(),
  });

  if (storeError) {
    return {
      ok: true,
      should_process: true,
      duplicate: false,
      degraded: true,
      warning: "fallback_store_failed",
    };
  }

  return {
    ok: true,
    should_process: true,
    duplicate: false,
    dedupe_key: dedupeKey,
    degraded: true,
    warning: "fallback_mode",
  };
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

    const now = new Date();
    const nowIso = now.toISOString();
    const expiresAt = new Date(now.getTime() + ttlHours * 60 * 60 * 1000).toISOString();

    const { error: insertError } = await supabase.from("zapier_dedupe_keys").insert({
      dedupe_key: dedupeKey,
      event_type: eventType,
      seo_pillar: seoPillar,
      cluster_key: clusterKey || null,
      first_seen_at: nowIso,
      last_seen_at: nowIso,
      ttl_hours: ttlHours,
      expires_at: expiresAt,
      metadata: {
        happened_at: happenedAt,
      },
    });

    if (!insertError) {
      return res.status(200).json({
        ok: true,
        should_process: true,
        duplicate: false,
        dedupe_key: dedupeKey,
        ttl_hours: ttlHours,
        expires_at: expiresAt,
      });
    }

    const isDuplicate = /duplicate key|already exists/i.test(String(insertError.message || ""));
    if (!isDuplicate) {
      const fallback = await fallbackDedupeUsingWorkflowEvents({
        dedupeKey,
        eventType,
        seoPillar,
        clusterKey,
        happenedAt,
        ttlHours,
      });
      return res.status(200).json(fallback);
    }

    const { data: existing, error: readError } = await supabase
      .from("zapier_dedupe_keys")
      .select("dedupe_key, first_seen_at, expires_at")
      .eq("dedupe_key", dedupeKey)
      .single();

    if (readError || !existing) {
      return res.status(200).json({
        ok: true,
        should_process: true,
        duplicate: false,
        degraded: true,
        warning: "dedupe_lookup_failed",
      });
    }

    const stillActive = new Date(existing.expires_at).getTime() > now.getTime();
    if (stillActive) {
      return res.status(200).json({
        ok: true,
        should_process: false,
        duplicate: true,
        dedupe_key: dedupeKey,
        first_seen_at: existing.first_seen_at,
        expires_at: existing.expires_at,
      });
    }

    const { error: refreshError } = await supabase
      .from("zapier_dedupe_keys")
      .update({
        event_type: eventType,
        seo_pillar: seoPillar,
        cluster_key: clusterKey || null,
        first_seen_at: nowIso,
        last_seen_at: nowIso,
        ttl_hours: ttlHours,
        expires_at: expiresAt,
        metadata: { happened_at: happenedAt },
      })
      .eq("dedupe_key", dedupeKey);

    if (refreshError) {
      return res.status(200).json({
        ok: true,
        should_process: true,
        duplicate: false,
        degraded: true,
        warning: "dedupe_refresh_failed",
      });
    }

    return res.status(200).json({
      ok: true,
      should_process: true,
      duplicate: false,
      dedupe_key: dedupeKey,
      ttl_hours: ttlHours,
      expires_at: expiresAt,
    });
  } catch (error) {
    return res.status(401).json({ ok: false, error: error.message || "Unauthorized" });
  }
}
