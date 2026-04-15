import React from "react";
import { supabase } from "./supabase";
import { DEFAULT_ROLE_BY_EMAIL, isStaticallyAllowed } from "./utils";

export const AuthContext = React.createContext(null);

const useProvideAuth = () => {
  const [user, setUser] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [roleByEmail, setRoleByEmail] = React.useState(DEFAULT_ROLE_BY_EMAIL);

  React.useEffect(() => {
    let mounted = true;

    const loadRoles = async () => {
      try {
        const { data, error } = await supabase
          .from("users")
          .select("email, role, is_active");

        if (error) throw error;

        const mapped = {};
        (data || []).forEach((row) => {
          const email = (row.email || "").trim().toLowerCase();
          if (email && row.is_active !== false) {
            mapped[email] = row.role || "user";
          }
        });

        if (mounted && Object.keys(mapped).length > 0) {
          setRoleByEmail({ ...mapped, ...DEFAULT_ROLE_BY_EMAIL });
        }
      } catch (_err) {
        if (mounted) {
          setRoleByEmail(DEFAULT_ROLE_BY_EMAIL);
        }
      }
    };

    loadRoles();

    const initSession = async () => {
      const { data, error } = await supabase.auth.getSession();
      if (!mounted) return;

      if (error) {
        // session fetch failed — user stays signed out
      }

      const sessionUser = data?.session?.user ?? null;
      if (sessionUser?.email && !isStaticallyAllowed(sessionUser.email)) {
        await supabase.auth.signOut();
        setUser(null);
      } else {
        setUser(sessionUser);
      }
      setLoading(false);
    };

    initSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      const sessionUser = session?.user ?? null;
      if (sessionUser?.email && !isStaticallyAllowed(sessionUser.email)) {
        supabase.auth.signOut();
        setUser(null);
      } else {
        setUser(sessionUser);
      }
      setLoading(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const login = async (email, password) => {
    if (!isStaticallyAllowed(email)) {
      throw new Error("This account is not authorized for this platform.");
    }

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
  const isAdmin = role === "admin";

  return { user, login, logout, loading, role, isAdmin, roleByEmail };
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
