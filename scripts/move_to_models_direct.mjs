import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;

const TARGET_EMAIL = "adebanjookikiola252@gmail.com";
const TARGET_NAME = "Adebanjo Okikiola";

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("Missing required env vars: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_SECRET_KEY)");
  process.exit(1);
}

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
const now = new Date().toISOString();

function mapStatus(status) {
  const v = String(status || "").toLowerCase();
  if (["active", "approved", "completed"].includes(v)) return "approved";
  if (["inactive", "churned"].includes(v)) return "rejected";
  return "pending";
}

async function run() {
  // 1. Find the client record
  const { data: clients, error: clientsError } = await admin
    .from("clients")
    .select("id, name, email, service_type, project, avatar_url, internal_notes, status, source")
    .ilike("email", TARGET_EMAIL);

  if (clientsError) {
    console.error("Error fetching clients:", clientsError.message);
    process.exit(1);
  }

  if (!clients || clients.length === 0) {
    console.log("No client record found for", TARGET_EMAIL, "— checking models table...");
  } else {
    console.log("Found client record(s):", clients.map(c => `${c.id} | ${c.name} | ${c.email} | source=${c.source}`));
  }

  // 2. Check if already in models
  const { data: existingModels, error: modelsError } = await admin
    .from("models")
    .select("id, name, email, status, internal_notes")
    .ilike("email", TARGET_EMAIL);

  if (modelsError) {
    console.error("Error checking models:", modelsError.message);
    process.exit(1);
  }

  const moveNote = `Moved back to Models on ${now}`;

  if (existingModels && existingModels.length > 0) {
    const existing = existingModels[0];
    console.log("Already in models table:", existing.id, existing.name, existing.email);

    // Update to ensure status is correct and notes reflect the move-back
    const mergedNotes = [existing.internal_notes || "", moveNote].filter(Boolean).join("\n\n");
    const { error: updateErr } = await admin
      .from("models")
      .update({ status: "approved", source: "manual", internal_notes: mergedNotes, last_updated: now })
      .eq("id", existing.id);

    if (updateErr) {
      console.error("Error updating model:", updateErr.message);
      process.exit(1);
    }
    console.log("✓ Model record updated to approved/manual.");
  } else {
    // Insert into models
    const client = clients?.[0] || {};
    const payload = {
      name: TARGET_NAME,
      email: TARGET_EMAIL,
      image_url: client.avatar_url || "",
      status: client ? mapStatus(client.status) : "pending",
      source: "manual",
      agency_name: client.project || client.service_type || "",
      internal_notes: [client.internal_notes || "", moveNote].filter(Boolean).join("\n\n"),
      pipeline_stage: "submitted",
      priority_level: "medium",
      submitted_at: now,
      last_updated: now,
    };

    // Strip unknown columns iteratively
    const keys = Object.keys(payload);
    let inserted = false;
    for (let attempt = 0; attempt < keys.length; attempt++) {
      const { error: insertErr } = await admin.from("models").insert([payload]);
      if (!insertErr) { inserted = true; break; }
      if (insertErr.code === "42703") {
        const m = insertErr.message.match(/'([a-zA-Z0-9_]+)'/);
        const col = m?.[1];
        if (col && col in payload) { delete payload[col]; continue; }
      }
      console.error("Insert error:", insertErr.message);
      process.exit(1);
    }
    if (inserted) console.log("✓ New model record inserted.");
  }

  // 3. Update client source so ambassador views stop picking them up
  if (clients && clients.length > 0) {
    for (const c of clients) {
      const updatedNotes = [c.internal_notes || "", moveNote].filter(Boolean).join("\n\n");
      const { error: cErr } = await admin
        .from("clients")
        .update({ source: "manual", internal_notes: updatedNotes, updated_at: now })
        .eq("id", c.id);
      if (cErr) console.warn("Warn: could not update client source:", cErr.message);
      else console.log(`✓ Client record ${c.id} source updated to manual.`);
    }
  }

  console.log("\nDone. Adebanjo Okikiola has been moved back to the Models side.");
}

run().catch((err) => { console.error(err); process.exit(1); });
