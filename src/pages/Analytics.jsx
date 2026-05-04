import React from "react";
import { supabase } from "../supabase";
import { calculateMetrics, MetricCard } from "../analyticsUtils";

export default function Analytics() {
  const [models, setModels] = React.useState([]);
  const [bookings, setBookings] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");

  const fetchData = React.useCallback(async () => {
    try {
      setError("");
      const [modelsResult, bookingsResult] = await Promise.all([
        supabase.from("models").select("id, status, submitted_at, created_at"),
        supabase.from("bookings").select("id, status, service_type, preferred_date, created_at"),
      ]);

      if (modelsResult.error) throw modelsResult.error;
      if (bookingsResult.error) throw bookingsResult.error;

      setModels(modelsResult.data || []);
      setBookings(bookingsResult.data || []);
    } catch (err) {
      setError(err.message || "Failed to load analytics");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchData();
  }, [fetchData]);

  const metrics = React.useMemo(() => calculateMetrics(models, bookings), [models, bookings]);

  const C = { ink:"#111111", slate:"#4a4a4a", dust:"#888888", smoke:"#e8e4dc", white:"#ffffff", warn:"#92560a", warnBg:"#fef8ec", ok:"#1a6636", okBg:"#edf7ee", err:"#9b1c1c", errBg:"#fef2f2", info:"#1e3a5f", infoBg:"#eff6ff" };
  const statCard = (label, value, extra={}) => (
    <div style={{ background:C.white, border:`1px solid ${C.smoke}`, borderRadius:12, padding:20, boxShadow:"0 1px 4px rgba(17,17,17,0.04)", ...extra }}>
      <p style={{ margin:"0 0 6px", fontSize:11, fontWeight:600, letterSpacing:"0.1em", textTransform:"uppercase", color:C.dust }}>{label}</p>
      <p style={{ margin:0, fontFamily:"'Cormorant Garamond',Georgia,serif", fontSize:36, fontWeight:500, color:C.ink, lineHeight:1 }}>{value}</p>
    </div>
  );

  return (
    <div style={{ padding:"32px 24px", maxWidth:1200, margin:"0 auto" }}>
      <h1 style={{ fontFamily:"'Cormorant Garamond',Georgia,serif", fontSize:"clamp(26px,4vw,38px)", fontWeight:500, color:C.ink, letterSpacing:"-0.02em", margin:"0 0 4px" }}>Analytics</h1>
      <p style={{ color:C.dust, fontSize:13, marginBottom:32 }}>Performance overview across talent and bookings.</p>

      {loading && <p style={{ color:C.dust }}>Loading analytics…</p>}
      {error && <div style={{ background:C.errBg, border:`1px solid rgba(155,28,28,0.2)`, borderRadius:10, padding:"12px 16px", marginBottom:20, color:C.err, fontSize:13 }}>Error: {error}</div>}

      {!loading && (
        <>
          <p style={{ fontFamily:"'Cormorant Garamond',Georgia,serif", fontSize:20, fontWeight:500, color:C.ink, margin:"0 0 14px" }}>Model Pipeline</p>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))", gap:12, marginBottom:32 }}>
            {statCard("Total Submissions", metrics.totalModels)}
            {statCard("Pending Review", metrics.pendingModels)}
            {statCard("Approved", metrics.approvedModels)}
            {statCard("Rejected", metrics.rejectedModels)}
          </div>

          <p style={{ fontFamily:"'Cormorant Garamond',Georgia,serif", fontSize:20, fontWeight:500, color:C.ink, margin:"0 0 14px" }}>Booking Activity</p>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))", gap:12, marginBottom:32 }}>
            {statCard("Total Bookings", metrics.totalBookings)}
            {statCard("Pending", metrics.pendingBookings)}
            {statCard("Confirmed", metrics.confirmedBookings)}
            {statCard("Completed", metrics.completedBookings)}
          </div>

          <p style={{ fontFamily:"'Cormorant Garamond',Georgia,serif", fontSize:20, fontWeight:500, color:C.ink, margin:"0 0 14px" }}>This Week</p>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))", gap:12 }}>
            {statCard("New Submissions", metrics.modelsThisWeek)}
            {statCard("New Bookings", metrics.bookingsThisWeek)}
          </div>
        </>
      )}
    </div>
  );
}
