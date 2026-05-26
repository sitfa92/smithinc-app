const FALLBACK_ADMIN_EMAILS = new Set([
  "sitfa92@gmail.com",
  "chizzyboi72@gmail.com",
  "marthajohn223355@gmail.com",
]);
const OWNER_PRIORITY_EMAILS = new Set([
  "sitfa92@gmail.com",
]);

const normalizeEmail = (v) => String(v || "").trim().toLowerCase();

const ROLE_RANK = {
  owner: 100,
  admin: 90,
  va: 80,
  agency_admin: 70,
  agency_member: 60,
  agency: 55,
  agent: 50,
  user: 10,
};

export async function resolveMergedUserAccess(admin, email) {
  const normalized = normalizeEmail(email);
  if (!normalized) return { role: "", isActive: false, agencyId: null };

  const { data: rows, error } = await admin
    .from("users")
    .select("role, is_active, agency_id")
    .eq("email", normalized);

  if (error) {
    return { error };
  }

  const activeRows = (rows || []).filter((row) => row?.is_active !== false);
  if (activeRows.length === 0) {
    if (OWNER_PRIORITY_EMAILS.has(normalized)) {
      return { role: "owner", isActive: true, agencyId: null };
    }
    return { role: "", isActive: false, agencyId: null };
  }

  const sorted = [...activeRows].sort((a, b) => {
    const aRank = ROLE_RANK[String(a?.role || "").toLowerCase()] || 0;
    const bRank = ROLE_RANK[String(b?.role || "").toLowerCase()] || 0;
    return bRank - aRank;
  });

  const topRole = String(sorted[0]?.role || "").toLowerCase();
  const agencyId = sorted.find((row) => row?.agency_id)?.agency_id || null;

  if (OWNER_PRIORITY_EMAILS.has(normalized)) {
    return {
      role: "owner",
      isActive: true,
      agencyId,
    };
  }

  return {
    role: topRole,
    isActive: true,
    agencyId,
  };
}

export async function requireBusinessAccess({ req, res, admin, allowedRoles = ["admin", "va"] }) {
  const authHeader = req.headers.authorization || "";
  if (!authHeader.startsWith("Bearer ")) {
    res.status(401).json({ error: "Authentication required" });
    return false;
  }

  const token = authHeader.slice(7).trim();
  try {
    const {
      data: { user },
      error,
    } = await admin.auth.getUser(token);

    const email = normalizeEmail(user?.email);
    if (error || !email) {
      res.status(403).json({ error: "Forbidden" });
      return false;
    }

    // Owner email has priority and can always access business endpoints
    if (OWNER_PRIORITY_EMAILS.has(email)) {
      return true;
    }

    if (FALLBACK_ADMIN_EMAILS.has(email)) {
      return true;
    }

    const resolved = await resolveMergedUserAccess(admin, email);
    if (resolved?.error) {
      res.status(500).json({ error: resolved.error.message || "Failed to verify access" });
      return false;
    }

    const role = String(resolved?.role || "").toLowerCase();
    const isActive = resolved?.isActive === true;
    if (isActive && role === "owner") {
      return true;
    }
    if (!isActive || !allowedRoles.includes(role)) {
      res.status(403).json({ error: "Forbidden" });
      return false;
    }
  } catch (_err) {
    res.status(401).json({ error: "Authentication failed" });
    return false;
  }

  return true;
}
