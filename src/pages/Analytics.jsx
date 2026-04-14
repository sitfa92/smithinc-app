import React from "react";
import { supabase } from "../supabase";
import { calculateMetrics, MetricCard } from "../analyticsUtils";

export default function Analytics() {
  const [models, setModels] = React.useState([]);
  const [bookings, setBookings] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");

  React.useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setError("");
      const [modelsResult, bookingsResult] = await Promise.all([
        supabase.from("models").select("*"),
        supabase.from("bookings").select("*"),
      ]);

      if (modelsResult.error) throw modelsResult.error;
      if (bookingsResult.error) throw bookingsResult.error;

      setModels(modelsResult.data || []);
      setBookings(bookingsResult.data || []);
    } catch (err) {
      setError(err.message || "Failed to load analytics");
      console.error("Analytics error:", err);
    } finally {
      setLoading(false);
    }
  };

  const metrics = calculateMetrics(models, bookings);

  const metricsGridStyle = {
    display: "flex",
    flexWrap: "wrap",
    gap: "15px",
    justifyContent: "center",
  };

  return (
    <div style={{ padding: "20px", maxWidth: "1200px", margin: "0 auto", boxSizing: "border-box" }}>
      <h1 style={{ margin: "0 0 30px 0", textAlign: "center", fontSize: "clamp(24px, 5vw, 32px)" }}>Analytics</h1>

      {loading && <p style={{ textAlign: "center" }}>Loading analytics...</p>}
      {error && (
        <div style={{ color: "#d32f2f", marginBottom: 20, padding: 15, backgroundColor: "#ffebee", borderRadius: 4, textAlign: "center" }}>
          Error: {error}
        </div>
      )}

      {!loading && (
        <>
          <div style={{ marginBottom: 40 }}>
            <h2 style={{ fontSize: "clamp(18px, 4vw, 20px)", marginBottom: 20, color: "#333" }}>Model Pipeline</h2>
            <div style={metricsGridStyle}>
              <MetricCard label="Total Submissions" value={metrics.totalModels} color="#333" />
              <MetricCard label="Pending Review" value={metrics.pendingModels} color="#ff9800" />
              <MetricCard label="Approved" value={metrics.approvedModels} color="#4caf50" />
              <MetricCard label="Rejected" value={metrics.rejectedModels} color="#f44336" />
            </div>
          </div>

          <div style={{ marginBottom: 40 }}>
            <h2 style={{ fontSize: "clamp(18px, 4vw, 20px)", marginBottom: 20, color: "#333" }}>Booking Activity</h2>
            <div style={metricsGridStyle}>
              <MetricCard label="Total Bookings" value={metrics.totalBookings} color="#333" />
              <MetricCard label="Pending" value={metrics.pendingBookings} color="#ff9800" />
              <MetricCard label="Confirmed" value={metrics.confirmedBookings} color="#4caf50" />
              <MetricCard label="Completed" value={metrics.completedBookings} color="#2196f3" />
            </div>
          </div>

          <div style={{ marginBottom: 20 }}>
            <h2 style={{ fontSize: "clamp(18px, 4vw, 20px)", marginBottom: 20, color: "#333" }}>This Week</h2>
            <div style={metricsGridStyle}>
              <MetricCard label="Model Submissions" value={metrics.modelsThisWeek} color="#667bc6" />
              <MetricCard label="New Bookings" value={metrics.bookingsThisWeek} color="#667bc6" />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
