const FALLBACK_ADMIN_EMAILS = new Set([
  "sitfa92@gmail.com",
  "chizzyboi72@gmail.com",
  "marthajohn223355@gmail.com",
]);

const normalizeEmail = (v) => String(v || "").trim().toLowerCase();

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

    if (FALLBACK_ADMIN_EMAILS.has(email)) {
      return true;
    }

    const { data: roleRow, error: roleError } = await admin
      .from("users")
      .select("role, is_active")
      .eq("email", email)
      .maybeSingle();

    if (roleError) {
      res.status(500).json({ error: roleError.message || "Failed to verify access" });
      return false;
    }

    const role = String(roleRow?.role || "").toLowerCase();
    const isActive = roleRow?.is_active !== false;
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
