import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ZAPIER_WEBHOOK_SECRET = process.env.ZAPIER_WEBHOOK_SECRET;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

function validateSecret(req) {
  if (!ZAPIER_WEBHOOK_SECRET) return;
  const headerSecret = req.headers["x-zapier-secret"];
  if (!headerSecret || headerSecret !== ZAPIER_WEBHOOK_SECRET) {
    throw new Error("Invalid or missing webhook secret");
  }
}

function toInt(value, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(1, Math.floor(n));
}

function daysAgoIso(days) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

function buildFallbackClusters(rows = []) {
  const map = new Map();
  for (const row of rows) {
    const data = row?.event_data || {};
    const clusterKey = String(data.cluster_key || "").trim();
    const seoPillar = String(data.seo_pillar || "general").trim();
    const eventType = String(data.event_type || "seo.question.captured").trim();
    if (!clusterKey) continue;

    const existing = map.get(clusterKey) || {
      cluster_key: clusterKey,
      seo_pillar: seoPillar,
      sample_event_type: eventType,
      first_seen_at: row.created_at,
      last_seen_at: row.created_at,
      count: 0,
    };

    existing.count += 1;
    if (row.created_at < existing.first_seen_at) existing.first_seen_at = row.created_at;
    if (row.created_at > existing.last_seen_at) existing.last_seen_at = row.created_at;
    map.set(clusterKey, existing);
  }

  return [...map.values()].sort((a, b) => b.count - a.count);
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    validateSecret(req);

    const lookbackDays = toInt(req.query?.lookback_days, 30);
    const staleDays = toInt(req.query?.stale_days, 90);
    const maxItems = Math.min(200, toInt(req.query?.limit, 50));

    const activeCutoff = daysAgoIso(lookbackDays);
    const staleCutoff = daysAgoIso(staleDays);

    // Primary source: dedicated dedupe table (post migration).
    const { data: keysRows, error: keysError } = await supabase
      .from("zapier_dedupe_keys")
      .select("dedupe_key, event_type, seo_pillar, cluster_key, first_seen_at, last_seen_at, expires_at, ttl_hours")
      .gte("first_seen_at", activeCutoff)
      .order("first_seen_at", { ascending: false })
      .limit(maxItems);

    if (!keysError) {
      const activeRows = (keysRows || []).filter((row) => new Date(row.expires_at).getTime() > Date.now());

      const byCluster = new Map();
      for (const row of activeRows) {
        const key = String(row.cluster_key || "").trim() || String(row.dedupe_key || "").trim();
        if (!key) continue;

        const existing = byCluster.get(key) || {
          cluster_key: key,
          seo_pillar: row.seo_pillar || "general",
          sample_event_type: row.event_type || "seo.question.captured",
          first_seen_at: row.first_seen_at,
          last_seen_at: row.last_seen_at,
          count: 0,
          stale_candidate: false,
        };

        existing.count += 1;
        if (row.first_seen_at < existing.first_seen_at) existing.first_seen_at = row.first_seen_at;
        if (row.last_seen_at > existing.last_seen_at) existing.last_seen_at = row.last_seen_at;
        existing.stale_candidate = new Date(existing.last_seen_at).toISOString() < staleCutoff;

        byCluster.set(key, existing);
      }

      const clusters = [...byCluster.values()].sort((a, b) => b.count - a.count).slice(0, maxItems);

      return res.status(200).json({
        ok: true,
        source: "zapier_dedupe_keys",
        lookback_days: lookbackDays,
        stale_days: staleDays,
        generated_at: new Date().toISOString(),
        clusters,
      });
    }

    // Fallback source for environments before migration or if table unavailable.
    const { data: fallbackRows, error: fallbackError } = await supabase
      .from("workflow_events")
      .select("created_at, event_data")
      .eq("event_type", "SEO_DEDUPE_GUARD")
      .eq("source", "zapier")
      .gte("created_at", activeCutoff)
      .order("created_at", { ascending: false })
      .limit(400);

    if (fallbackError) {
      return res.status(500).json({ ok: false, error: fallbackError.message || "Failed to build SEO backlog" });
    }

    const clusters = buildFallbackClusters(fallbackRows).slice(0, maxItems).map((item) => ({
      ...item,
      stale_candidate: new Date(item.last_seen_at).toISOString() < staleCutoff,
    }));

    return res.status(200).json({
      ok: true,
      source: "workflow_events_fallback",
      lookback_days: lookbackDays,
      stale_days: staleDays,
      generated_at: new Date().toISOString(),
      clusters,
    });
  } catch (error) {
    return res.status(401).json({ ok: false, error: error.message || "Unauthorized" });
  }
}
