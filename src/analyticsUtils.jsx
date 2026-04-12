/**
 * Analytics Utilities
 * Calculate metrics from Supabase data
 */

import React from "react";

/**
 * Calculate metrics from models and bookings data
 * @param {Array} models - Array of model records
 * @param {Array} bookings - Array of booking records
 * @returns {Object} Calculated metrics
 */
export const calculateMetrics = (models = [], bookings = []) => {
  // Model metrics
  const totalModels = models.length;
  const approvedModels = models.filter((m) => m.status === "approved").length;
  const rejectedModels = models.filter((m) => m.status === "rejected").length;
  const pendingModels = models.filter((m) => m.status === "pending").length;

  // Booking metrics
  const totalBookings = bookings.length;
  const confirmedBookings = bookings.filter((b) => b.status === "confirmed").length;
  const completedBookings = bookings.filter((b) => b.status === "completed").length;
  const pendingBookings = bookings.filter((b) => b.status === "pending").length;

  // This week (last 7 days)
  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

  const modelsThisWeek = models.filter((m) => {
    const date = new Date(m.submitted_at);
    return date >= oneWeekAgo;
  }).length;

  const bookingsThisWeek = bookings.filter((b) => {
    const date = new Date(b.created_at);
    return date >= oneWeekAgo;
  }).length;

  return {
    // Model metrics
    totalModels,
    approvedModels,
    rejectedModels,
    pendingModels,

    // Booking metrics
    totalBookings,
    confirmedBookings,
    completedBookings,
    pendingBookings,

    // Time-based metrics
    modelsThisWeek,
    bookingsThisWeek,
  };
};

/**
 * Metric Card Component
 */
export const MetricCard = ({ label, value, color = "#333" }) => {
  const [isMobile, setIsMobile] = React.useState(window.innerWidth <= 768);

  React.useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return (
    <div
      style={{
        flex: isMobile ? "1 1 calc(100% - 10px)" : "1 1 calc(50% - 10px)",
        minWidth: 150,
        padding: "15px",
        backgroundColor: "#f5f5f5",
        borderRadius: 8,
        textAlign: "center",
        border: "1px solid #e0e0e0",
        boxSizing: "border-box",
      }}
    >
      <div style={{ fontSize: "clamp(24px, 5vw, 32px)", fontWeight: "bold", color, marginBottom: 8 }}>
        {value}
      </div>
      <div style={{ fontSize: "clamp(12px, 3vw, 14px)", color: "#666", fontWeight: 500 }}>
        {label}
      </div>
    </div>
  );
};
