import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

// Secret token set in ManyChat webhook configuration and matched here.
const MANYCHAT_WEBHOOK_SECRET =
  (process.env.MANYCHAT_WEBHOOK_SECRET || "").trim();

// Matches the pattern used elsewhere in the codebase for missing-column errors.
const isMissingColumnError = (err) =>
  err?.code === "42703" ||
  (err?.message || "").toLowerCase().includes("column") ||
  (err?.message || "").toLowerCase().includes("does not exist");

/**
 * POST /api/manychat/webhook
 *
 * Accepts lead data from ManyChat (Instagram DM bot or website widget),
 * deduplicates by email, then inserts into the appropriate Supabase table.
 *
 * Expected body (all fields optional except email):
 * {
 *   secret?: string,          // must match MANYCHAT_WEBHOOK_SECRET env var
 *   name?: string,
 *   email: string,
 *   instagram?: string,
 *   interest?: "model" | "client",  // defaults to "model"
 *   phone?: string,
 *   message?: string
 * }
 */
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // --- Secret validation -------------------------------------------
  // Only enforce when the env var is set so local development still works.
  if (MANYCHAT_WEBHOOK_SECRET) {
    const providedSecret =
      req.headers["x-manychat-secret"] ||
      req.body?.secret ||
      "";
    if (providedSecret !== MANYCHAT_WEBHOOK_SECRET) {
      return res.status(401).json({ error: "Unauthorized" });
    }
  }

  if (!supabaseUrl || !serviceRoleKey) {
    return res
      .status(503)
      .json({ error: "Missing Supabase server environment variables" });
  }

  const {
    name = "",
    email = "",
    instagram = "",
    interest = "model",
    phone = "",
    message = "",
  } = req.body || {};

  const normalizedEmail = (email || "").trim().toLowerCase();
  if (!normalizedEmail) {
    return res.status(400).json({ error: "email is required" });
  }

  const admin = createClient(supabaseUrl, serviceRoleKey);
  const leadType = (interest || "model").trim().toLowerCase();
  const now = new Date().toISOString();

  try {
    if (leadType === "client") {
      // ---------------------------------------------------------------
      // CLIENT LEAD → bookings table
      // ---------------------------------------------------------------
      const { data: existing } = await admin
        .from("bookings")
        .select("id")
        .eq("email", normalizedEmail)
        .limit(1);

      if (existing && existing.length > 0) {
        return res.status(200).json({ ok: true, duplicate: true, table: "bookings" });
      }

      const { error: insertErr } = await admin.from("bookings").insert([
        {
          name: (name || "").trim(),
          email: normalizedEmail,
          company: (instagram || phone || "").trim() || "ManyChat Lead",
          service_type: "Model Booking",
          message: (message || "").trim(),
          status: "pending",
          source: "manychat",
          created_at: now,
        },
      ]);

      if (insertErr && isMissingColumnError(insertErr)) {
        // `source` column may not exist yet — retry without it.
        const { error: retryErr } = await admin.from("bookings").insert([
          {
            name: (name || "").trim(),
            email: normalizedEmail,
            company: (instagram || phone || "").trim() || "ManyChat Lead",
            service_type: "Model Booking",
            message: (message || "").trim(),
            status: "pending",
            created_at: now,
          },
        ]);
        if (retryErr) throw retryErr;
      } else if (insertErr) {
        throw insertErr;
      }
      return res.status(201).json({ ok: true, duplicate: false, table: "bookings" });
    }

    // -----------------------------------------------------------------
    // MODEL LEAD → models table (default)
    // -----------------------------------------------------------------
    const { data: existing } = await admin
      .from("models")
      .select("id")
      .eq("email", normalizedEmail)
      .limit(1);

    if (existing && existing.length > 0) {
      return res.status(200).json({ ok: true, duplicate: true, table: "models" });
    }

    const { error: insertErr } = await admin.from("models").insert([
      {
        name: (name || "").trim(),
        email: normalizedEmail,
        instagram: (instagram || "").replace(/^@/, "").trim(),
        status: "pending",
        source: "manychat",
        pipeline_stage: "submitted",
        priority_level: "medium",
        scouting_notes: (message || "").trim(),
        internal_notes: "",
        agency_name: "",
        submitted_at: now,
        last_updated: now,
      },
    ]);

    if (insertErr && isMissingColumnError(insertErr)) {
      // `source` column may not exist yet — retry without it.
      const { error: retryErr } = await admin.from("models").insert([
        {
          name: (name || "").trim(),
          email: normalizedEmail,
          instagram: (instagram || "").replace(/^@/, "").trim(),
          status: "pending",
          pipeline_stage: "submitted",
          priority_level: "medium",
          scouting_notes: (message || "").trim(),
          internal_notes: "",
          agency_name: "",
          submitted_at: now,
          last_updated: now,
        },
      ]);
      if (retryErr) throw retryErr;
    } else if (insertErr) {
      throw insertErr;
    }
    return res.status(201).json({ ok: true, duplicate: false, table: "models" });
  } catch (err) {
    console.error("ManyChat webhook error:", err);
    return res
      .status(500)
      .json({ error: err.message || "Unexpected error processing ManyChat lead" });
  }
}
