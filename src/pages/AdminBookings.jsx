import React from "react";
import { supabase } from "../supabase";
import { sendBookingConfirmedEmail } from "../emailService";
import { sendZapierEvent, createInAppAlerts, sendInternalTeamEmailAlert } from "../utils";

export default function AdminBookings() {
  const [bookings, setBookings] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const [actionLoading, setActionLoading] = React.useState({});
  const [zoomDrafts, setZoomDrafts] = React.useState({});

  React.useEffect(() => {
    fetchBookings();
  }, []);

  const fetchBookings = async () => {
    try {
      setError("");
      const { data, error: supabaseError } = await supabase
        .from("bookings")
        .select("*")
        .order("created_at", { ascending: false });

      if (supabaseError) throw supabaseError;
      setBookings(data || []);
    } catch (err) {
      setError(err.message || "Failed to load bookings");
      console.error("Fetch error:", err);
    } finally {
      setLoading(false);
    }
  };

  const updateBookingStatus = async (bookingId, newStatus) => {
    const booking = bookings.find((b) => b.id === bookingId);
    if (!booking) return;

    setActionLoading((prev) => ({ ...prev, [bookingId]: true }));
    try {
      const { error: supabaseError } = await supabase
        .from("bookings")
        .update({ status: newStatus })
        .eq("id", bookingId);

      if (supabaseError) throw supabaseError;

      if (newStatus === "confirmed") {
        sendBookingConfirmedEmail(booking);
        sendZapierEvent("booking.confirmed", {
          id: booking.id,
          name: booking.name,
          email: booking.email,
          company: booking.company,
          service_type: booking.service_type,
          preferred_date: booking.preferred_date,
          status: newStatus,
          zoom_link: booking.zoom_link || null,
        });

        createInAppAlerts([
          {
            title: "Booking confirmed",
            message: `${booking.name || "A booking"} was confirmed.`,
            audience_role: "admin",
            source_type: "booking_status",
            source_id: bookingId,
            level: "success",
          },
          {
            title: "Confirmed booking",
            message: `${booking.name || "A booking"} is confirmed and ready for next steps.`,
            audience_role: "va",
            source_type: "booking_status",
            source_id: bookingId,
            level: "success",
          },
        ]);

        sendInternalTeamEmailAlert({
          subject: `Booking confirmed: ${booking.name || "Booking"}`,
          message: `${booking.name || "A booking"} was confirmed.\nEmail: ${booking.email || "N/A"}\nCompany: ${booking.company || "N/A"}`,
          roles: ["admin", "va"],
          submissionEmail: booking.email || "",
        });
      }

      setBookings((prev) =>
        prev.map((b) => (b.id === bookingId ? { ...b, status: newStatus } : b))
      );
    } catch (err) {
      console.error("Update error:", err);
      alert(`Failed to update booking: ${err.message}`);
    } finally {
      setActionLoading((prev) => ({ ...prev, [bookingId]: false }));
    }
  };

  const saveZoomLink = async (bookingId) => {
    const zoomLink = (zoomDrafts[bookingId] || "").trim();
    if (!zoomLink) return;

    try {
      const { error: supabaseError } = await supabase
        .from("bookings")
        .update({ zoom_link: zoomLink })
        .eq("id", bookingId);

      if (supabaseError) throw supabaseError;

      setBookings((prev) =>
        prev.map((b) => (b.id === bookingId ? { ...b, zoom_link: zoomLink } : b))
      );
      setZoomDrafts((prev) => ({ ...prev, [bookingId]: "" }));
    } catch (err) {
      alert(err.message || "Failed to save Zoom link. Ensure bookings table has zoom_link column.");
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "confirmed": return "#4caf50";
      case "completed": return "#2196f3";
      case "pending":
      default: return "#ff9800";
    }
  };

  return (
    <div style={{ padding: "20px", maxWidth: "1200px", margin: "0 auto", boxSizing: "border-box" }}>
      <h1 style={{ fontSize: "clamp(24px, 5vw, 32px)" }}>Booking Requests</h1>

      {loading && <p>Loading bookings...</p>}
      {error && (
        <div style={{ color: "#d32f2f", marginBottom: 20, padding: 10, backgroundColor: "#ffebee", borderRadius: 4 }}>
          Error: {error}
        </div>
      )}

      {!loading && bookings.length === 0 && (
        <p style={{ color: "#999", fontSize: 16 }}>No booking requests yet.</p>
      )}

      {!loading &&
        bookings.map((booking) => {
          const isMobile = window.innerWidth <= 768;
          return (
            <div
              key={booking.id}
              style={{ padding: 20, marginBottom: 20, border: "1px solid #e0e0e0", borderRadius: 8, backgroundColor: "#fafafa", boxSizing: "border-box" }}
            >
              <div style={{
                display: "flex",
                flexDirection: isMobile ? "column" : "row",
                justifyContent: "space-between",
                alignItems: isMobile ? "flex-start" : "flex-start",
                gap: isMobile ? "15px" : "20px",
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <h3 style={{ margin: "0 0 10px 0", fontSize: "clamp(16px, 4vw, 18px)" }}>{booking.name}</h3>
                  <p style={{ margin: "5px 0", color: "#666", wordBreak: "break-word" }}><strong>Company:</strong> {booking.company}</p>
                  <p style={{ margin: "5px 0", color: "#666", wordBreak: "break-word" }}><strong>Email:</strong> {booking.email}</p>
                  <p style={{ margin: "5px 0", color: "#666", wordBreak: "break-word" }}><strong>Service:</strong> {booking.service_type}</p>
                  {booking.preferred_date && (
                    <p style={{ margin: "5px 0", color: "#666" }}>
                      <strong>Preferred Date:</strong> {new Date(booking.preferred_date).toLocaleDateString()}
                    </p>
                  )}
                  {booking.message && (
                    <p style={{ margin: "10px 0 0 0", padding: 10, backgroundColor: "#fff", borderRadius: 4, color: "#555", wordBreak: "break-word" }}>
                      <strong>Message:</strong> {booking.message}
                    </p>
                  )}
                  {booking.zoom_link && (
                    <p style={{ margin: "10px 0 0 0", color: "#666", wordBreak: "break-word" }}>
                      <strong>Zoom:</strong> <a href={booking.zoom_link} target="_blank" rel="noreferrer">{booking.zoom_link}</a>
                    </p>
                  )}
                  <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <input
                      placeholder="Attach Zoom meeting link"
                      value={zoomDrafts[booking.id] || ""}
                      onChange={(e) => setZoomDrafts((prev) => ({ ...prev, [booking.id]: e.target.value }))}
                      style={{ flex: "1 1 260px", padding: 8, border: "1px solid #ccc", borderRadius: 4 }}
                    />
                    <button
                      onClick={() => saveZoomLink(booking.id)}
                      style={{ padding: "8px 12px", border: "none", backgroundColor: "#333", color: "white", borderRadius: 4 }}
                    >
                      Save Zoom Link
                    </button>
                  </div>
                  <p style={{ margin: "10px 0 0 0", color: "#999", fontSize: "0.9em" }}>
                    Received: {new Date(booking.created_at).toLocaleString()}
                  </p>
                </div>

                <div style={{ marginLeft: isMobile ? 0 : 20, textAlign: isMobile ? "left" : "right", width: isMobile ? "100%" : "auto" }}>
                  <span
                    style={{
                      display: "inline-block",
                      padding: "6px 12px",
                      backgroundColor: getStatusColor(booking.status),
                      color: "white",
                      borderRadius: 20,
                      fontSize: "0.85em",
                      fontWeight: "bold",
                      textTransform: "uppercase",
                      marginBottom: isMobile ? 10 : 15,
                    }}
                  >
                    {booking.status}
                  </span>

                  {booking.status === "pending" && (
                    <div style={{ display: "flex", flexDirection: isMobile ? "row" : "column", gap: 8 }}>
                      <button
                        onClick={() => updateBookingStatus(booking.id, "confirmed")}
                        disabled={actionLoading[booking.id]}
                        style={{
                          flex: isMobile ? "1 1 100%" : "auto",
                          padding: isMobile ? "10px 16px" : "8px 12px",
                          backgroundColor: "#4caf50",
                          color: "white",
                          border: "none",
                          borderRadius: 4,
                          cursor: actionLoading[booking.id] ? "not-allowed" : "pointer",
                          opacity: actionLoading[booking.id] ? 0.6 : 1,
                          fontSize: "0.9em",
                          fontWeight: 500,
                        }}
                      >
                        {actionLoading[booking.id] ? "..." : "✓ Confirm"}
                      </button>
                    </div>
                  )}
                  {booking.status === "confirmed" && (
                    <button
                      onClick={() => updateBookingStatus(booking.id, "completed")}
                      disabled={actionLoading[booking.id]}
                      style={{
                        width: isMobile ? "100%" : "auto",
                        padding: isMobile ? "10px 16px" : "8px 12px",
                        backgroundColor: "#2196f3",
                        color: "white",
                        border: "none",
                        borderRadius: 4,
                        cursor: actionLoading[booking.id] ? "not-allowed" : "pointer",
                        opacity: actionLoading[booking.id] ? 0.6 : 1,
                        fontSize: "0.9em",
                        fontWeight: 500,
                      }}
                    >
                      {actionLoading[booking.id] ? "..." : "✓ Completed"}
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
    </div>
  );
}
