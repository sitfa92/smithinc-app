import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const SYNC_SECRET =
  (process.env.SYNC_CURRENT_DATA_SECRET ||
    process.env.ZAPIER_WEBHOOK_SECRET ||
    process.env.MANYCHAT_WEBHOOK_SECRET ||
    "").trim();

const DEFAULT_ROLE_BY_EMAIL = {
  "sitfa92@gmail.com": "admin",
  "marthajohn223355@gmail.com": "va",
  "chizzyboi72@gmail.com": "agent",
};

const isTableMissingError = (err) =>
  err?.code === "42P01" ||
  err?.code === "42501" ||
  (err?.message || "").toLowerCase().includes("does not exist") ||
  (err?.message || "").toLowerCase().includes("relation") ||
  (err?.message || "").toLowerCase().includes("permission") ||
  (err?.message || "").toLowerCase().includes("policy") ||
  (err?.message || "").toLowerCase().includes("rls");

const normalizeEmail = (value) => (value || "").trim().toLowerCase();

const DEFAULT_ADMIN_EMAILS = new Set(
  Object.entries(DEFAULT_ROLE_BY_EMAIL)
    .filter(([, role]) => role === "admin")
    .map(([email]) => normalizeEmail(email))
);

async function isAuthorizedSyncRequest(req, admin) {
  if (SYNC_SECRET) {
    const providedSecret =
      (req.headers["x-sync-secret"] || req.headers["x-zapier-secret"] || "").trim();
    if (providedSecret && providedSecret === SYNC_SECRET) {
      return true;
    }
  }

  const authHeader = req.headers.authorization || "";
  if (!authHeader.startsWith("Bearer ")) {
    return false;
  }

  const token = authHeader.slice("Bearer ".length).trim();
  if (!token) {
    return false;
  }

  try {
    const {
      data: { user },
      error,
    } = await admin.auth.getUser(token);

    if (error || !user?.email) {
      return false;
    }

    return DEFAULT_ADMIN_EMAILS.has(normalizeEmail(user.email));
  } catch (_err) {
    return false;
  }
}

async function getAssigneeByRole(admin) {
  const fallback = { admin: "", va: "", agent: "" };

  Object.entries(DEFAULT_ROLE_BY_EMAIL).forEach(([email, role]) => {
    if (!fallback[role]) fallback[role] = email;
  });

  try {
    const { data, error } = await admin
      .from("users")
      .select("email, role, is_active")
      .order("created_at", { ascending: false });

    if (error) throw error;

    const assigneeByRole = { ...fallback };
    (data || [])
      .filter((member) => member.is_active !== false)
      .forEach((member) => {
        const role = (member.role || "").trim().toLowerCase();
        const email = normalizeEmail(member.email);
        if (["admin", "va", "agent"].includes(role) && email && !assigneeByRole[role]) {
          assigneeByRole[role] = email;
        }
      });

    return assigneeByRole;
  } catch (_err) {
    return fallback;
  }
}

function buildIntakeTasks(models, bookings, clients, assigneeByRole) {
  const now = new Date().toISOString();
  const tasks = [];

  (models || [])
    .filter((model) => (model.status || "pending") === "pending")
    .forEach((model) => {
      tasks.push({
        task_key: `model-review-${model.id}`,
        title: `Review model submission: ${model.name || "Unnamed"}`,
        description: "New model submission requires review and decision.",
        role: "agent",
        assigned_email: assigneeByRole.agent || null,
        source_type: "model",
        source_id: String(model.id),
        status: "pending",
        due_at: model.submitted_at || model.created_at || now,
        updated_at: now,
      });
    });

  (bookings || [])
    .filter((booking) => (booking.status || "pending") === "pending")
    .forEach((booking) => {
      tasks.push({
        task_key: `booking-confirm-${booking.id}`,
        title: `Confirm booking request: ${booking.name || "Unknown"}`,
        description: "New booking request requires follow-up and confirmation.",
        role: "va",
        assigned_email: assigneeByRole.va || null,
        source_type: "booking",
        source_id: String(booking.id),
        status: "pending",
        due_at: booking.preferred_date || booking.created_at || now,
        updated_at: now,
      });
    });

  (clients || [])
    .filter((client) => (client.status || "").toLowerCase() === "lead")
    .forEach((client) => {
      tasks.push({
        task_key: `client-onboard-${client.id}`,
        title: `Qualify new client lead: ${client.name || "Unnamed"}`,
        description: "New lead in client list needs onboarding decision.",
        role: "admin",
        assigned_email: assigneeByRole.admin || null,
        source_type: "client",
        source_id: String(client.id),
        status: "pending",
        due_at: client.created_at || now,
        updated_at: now,
      });
    });

  return tasks;
}

async function logSyncEvent(admin, payload) {
  try {
    await admin.from("workflow_events").insert({
      event_type: "CURRENT_DATA_SYNC",
      event_data: payload,
      status: "success",
      source: "system",
      created_at: new Date().toISOString(),
    });
  } catch (_err) {
    // Ignore if workflow_events does not exist or cannot be written.
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(503).json({ error: "Missing Supabase server environment variables" });
  }

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  if (!(await isAuthorizedSyncRequest(req, admin))) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const [modelsRes, bookingsRes, clientsRes, leadsRes, enrollmentsRes] = await Promise.all([
      admin.from("models").select("id, name, status, submitted_at, created_at"),
      admin.from("bookings").select("id, name, status, preferred_date, created_at"),
      admin.from("clients").select("id, name, status, created_at"),
      admin.from("leads").select("id", { count: "exact", head: true }),
      admin.from("program_enrollments").select("id", { count: "exact", head: true }),
    ]);

    if (modelsRes.error) throw modelsRes.error;
    if (bookingsRes.error) throw bookingsRes.error;
    if (clientsRes.error) throw clientsRes.error;

    const assigneeByRole = await getAssigneeByRole(admin);
    const generatedTasks = buildIntakeTasks(
      modelsRes.data || [],
      bookingsRes.data || [],
      clientsRes.data || [],
      assigneeByRole
    );

    let tasksSynced = 0;
    let tasksTableReady = true;

    if (generatedTasks.length > 0) {
      const { error: upsertError } = await admin
        .from("ops_tasks")
        .upsert(generatedTasks, { onConflict: "task_key" });

      if (upsertError) {
        if (isTableMissingError(upsertError)) {
          tasksTableReady = false;
        } else {
          throw upsertError;
        }
      } else {
        tasksSynced = generatedTasks.length;
      }
    }

    const payload = {
      synced_at: new Date().toISOString(),
      models_count: (modelsRes.data || []).length,
      bookings_count: (bookingsRes.data || []).length,
      clients_count: (clientsRes.data || []).length,
      leads_count: leadsRes.count || 0,
      enrollments_count: enrollmentsRes.count || 0,
      tasks_synced: tasksSynced,
      tasks_table_ready: tasksTableReady,
    };

    await logSyncEvent(admin, payload);

    return res.status(200).json({
      ok: true,
      message: "Current Supabase data synced successfully",
      ...payload,
    });
  } catch (error) {
    return res.status(500).json({
      error: error.message || "Failed to sync current data",
    });
  }
}