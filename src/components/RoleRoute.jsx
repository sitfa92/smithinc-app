import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../auth";

export const canAccessRoute = (role, routeKey) => {
  if (role === "admin") return true;
  if (role === "va") {
    return ["dashboard", "models", "model-pipeline", "submissions", "bookings", "partners", "partner-pipeline", "partner-submissions", "brand-ambassadors", "brand-ambassador-pipeline", "brand-ambassador-submissions", "analytics", "team", "team-docs", "integrations", "contact-team"].includes(routeKey);
  }
  if (role === "agent") {
    return ["dashboard", "models", "model-pipeline", "submissions", "analytics", "contact-team"].includes(routeKey);
  }
  if (role === "user") {
    return ["dashboard", "models", "contact-team"].includes(routeKey);
  }
  return false;
};

export default function RoleRoute({ routeKey, children }) {
  const { role, loading } = useAuth();

  if (loading) {
    return (
      <div style={{ padding: 40, textAlign: "center" }}>
        <p>Loading...</p>
      </div>
    );
  }

  if (!canAccessRoute(role, routeKey)) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}
