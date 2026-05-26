import React from "react";
import { supabase } from "./supabase";
import { DEFAULT_ROLE_BY_EMAIL } from "./utils";

export const AuthContext = React.createContext(null);

const OWNER_PRIORITY_EMAILS = new Set([
  "sitfa92@gmail.com",
  "sita92@gmail.com",
]);

const useProvideAuth = () => {
  const [user, setUser] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [roleByEmail, setRoleByEmail] = React.useState(DEFAULT_ROLE_BY_EMAIL);
  const [agencyByEmail, setAgencyByEmail] = React.useState({});

  React.useEffect(() => {
    let mounted = true;

    const normalizeRole = (value) => String(value || "").trim().toLowerCase();
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
    const pickHigherRole = (a, b) => {
      const ra = ROLE_RANK[normalizeRole(a)] || 0;
      const rb = ROLE_RANK[normalizeRole(b)] || 0;
      return rb > ra ? normalizeRole(b) : normalizeRole(a);
    };

    const roleFromSessionMeta = (sessionUser) => {
      const userRole = normalizeRole(sessionUser?.user_metadata?.role);
      if (userRole) return userRole;
      const appRole = normalizeRole(sessionUser?.app_metadata?.role);
      if (appRole) return appRole;
      return "";
    };

    const agencyIdFromSessionMeta = (sessionUser) => {
      const userAgency = String(sessionUser?.user_metadata?.agency_id || "").trim();
      if (userAgency) return userAgency;
      const appAgency = String(sessionUser?.app_metadata?.agency_id || "").trim();
      if (appAgency) return appAgency;
      return null;
    };

    const loadRoles = async () => {
      try {
        const { data, error } = await supabase
          .from("users")
          .select("email, role, is_active, agency_id");

        if (error) throw error;

        const mapped = {};
        const agencyMap = {};
        const grouped = {};
        (data || []).forEach((row) => {
          const email = String(row?.email || "").trim().toLowerCase();
          if (!email) return;
          if (row?.is_active === false) return;
          if (!grouped[email]) grouped[email] = [];
          grouped[email].push(row);
        });

        Object.entries(grouped).forEach(([email, rows]) => {
          const sorted = [...rows].sort((a, b) => {
            const aRank = ROLE_RANK[normalizeRole(a?.role)] || 0;
            const bRank = ROLE_RANK[normalizeRole(b?.role)] || 0;
            return bRank - aRank;
          });
          if (sorted[0]?.role) mapped[email] = normalizeRole(sorted[0].role);
          const fallbackDefaultRole = normalizeRole(DEFAULT_ROLE_BY_EMAIL[email]);
          if (fallbackDefaultRole) {
            mapped[email] = pickHigherRole(mapped[email], fallbackDefaultRole);
          }
          if (OWNER_PRIORITY_EMAILS.has(email)) {
            mapped[email] = "owner";
          }
          const agencyRow = sorted.find((row) => row?.agency_id);
          if (agencyRow?.agency_id) agencyMap[email] = agencyRow.agency_id;
        });

        if (mounted) {
          setRoleByEmail({ ...DEFAULT_ROLE_BY_EMAIL, ...mapped });
          setAgencyByEmail(agencyMap);
        }

        return { mapped, agencyMap };
      } catch (_err) {
        if (mounted) {
          setRoleByEmail(DEFAULT_ROLE_BY_EMAIL);
          setAgencyByEmail({});
        }
        return { mapped: {}, agencyMap: {} };
      }
    };

    const initSession = async () => {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (!mounted) return;

        if (error) {
          // session fetch failed — user stays signed out
        }

        const sessionUser = data?.session?.user ?? null;
        if (sessionUser) {
          // Load roles from DB to validate this session user.
          // If their role is unrecognised (not in users table or is_active=false), sign them out.
          const { mapped, agencyMap } = await loadRoles();
          const email = (sessionUser.email || "").trim().toLowerCase();
          const fallbackRole = roleFromSessionMeta(sessionUser);
          const resolvedRole = OWNER_PRIORITY_EMAILS.has(email)
            ? "owner"
            : (mapped[email] || fallbackRole || DEFAULT_ROLE_BY_EMAIL[email]);
          const fallbackAgencyId = agencyIdFromSessionMeta(sessionUser);
          if (fallbackAgencyId) {
            setAgencyByEmail((prev) => ({ ...prev, [email]: agencyMap[email] || fallbackAgencyId }));
          }
          if (!resolvedRole || resolvedRole === "user") {
            await supabase.auth.signOut();
            if (mounted) setUser(null);
          } else {
            setRoleByEmail((prev) => ({ ...prev, [email]: resolvedRole }));
            if (mounted) setUser(sessionUser);
          }
        } else {
          setUser(null);
        }
      } catch (_err) {
        setUser(null);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    // initSession reads from localStorage (near-instant) and only fires the
    // Supabase DB query for roles when a logged-in session is detected.
    initSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;
      const sessionUser = session?.user ?? null;
      if (sessionUser?.email) {
        const email = String(sessionUser.email).trim().toLowerCase();
        const fallbackRole = roleFromSessionMeta(sessionUser);
        const fallbackAgencyId = agencyIdFromSessionMeta(sessionUser);
        if (OWNER_PRIORITY_EMAILS.has(email)) {
          setRoleByEmail((prev) => ({ ...prev, [email]: "owner" }));
        } else if (fallbackRole) {
          setRoleByEmail((prev) => ({ ...prev, [email]: prev[email] || fallbackRole }));
        }
        if (fallbackAgencyId) {
          setAgencyByEmail((prev) => ({ ...prev, [email]: prev[email] || fallbackAgencyId }));
        }
      }
      setUser(sessionUser);
      // Re-fetch roles on explicit sign-in so the role map is always fresh.
      if (event === "SIGNED_IN") loadRoles();
      // setLoading is intentionally omitted here — loading is already resolved
      // after initial session setup. This handler handles post-load auth changes only.
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const login = async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      throw error;
    }
    return true;
  };

  const logout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      throw error;
    }
  };

  const role = user?.email ? roleByEmail[user.email.toLowerCase()] || "user" : "user";
  const isOwner = role === "owner";
  const isAgencyAdmin = role === "agency_admin";
  const isAgencyMember = role === "agency_member";
  const isAdmin = role === "owner" || role === "admin";
  const agencyId = user?.email ? agencyByEmail[user.email.toLowerCase()] || null : null;
  return { user, login, logout, loading, role, isOwner, isAgencyAdmin, isAgencyMember, isAdmin, agencyId, roleByEmail };
};

export const AuthProvider = ({ children }) => {
  const auth = useProvideAuth();
  return <AuthContext.Provider value={auth}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = React.useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
};
