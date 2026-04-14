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

  const C = { ink:"#111111", slate:"#4a4a4a", dust:"#888888", smoke:"#e8e4dc", ivory:"#faf8f4", white:"#ffffff", warn:"#92560a", warnBg:"#fef8ec", ok:"#1a6636", okBg:"#edf7ee", err:"#9b1c1c", errBg:"#fef2f2", info:"#1e3a5f", infoBg:"#eff6ff" };
  const btnS = (bg,fg,extra={}) => ({ padding:"9px 14px", background:bg, color:fg, border:"none", borderRadius:8, fontSize:12, fontWeight:600, letterSpacing:"0.07em", textTransform:"uppercase", cursor:"pointer", fontFamily:"'Inter',sans-serif", transition:"opacity 0.2s", ...extra });
  const statusBadge = (st) => {
    const m = { pending:[C.warnBg,C.warn], confirmed:[C.okBg,C.ok], completed:[C.infoBg,C.info], cancelled:[C.errBg,C.err] };
    const [bg,clr] = m[st] || [C.ivory,C.slate];
    return { padding:"3px 12px", borderRadius:99, fontSize:11, fontWeight:600, letterSpacing:"0.06em", textTransform:"uppercase", background:bg, color:clr, display:"inline-flex" };
  };

  return (
    <div style={{ padding:"32px 24px", maxWidth:1200, margin:"0 auto" }}>
      <h1 style={{ fontFamily:"'Cormorant Garamond',Georgia,serif", fontSize:"clamp(26px,4vw,38px)", fontWeight:500, color:C.ink, letterSpacing:"-0.02em", margin:"0 0 4px" }}>
        Booking Requests
      </h1>
      <p style={{ color:C.dust, fontSize:13, marginBottom:24 }}>Manage and confirm incoming client booking requests.</p>

      {loading && <p style={{ color:C.dust }}>Loading bookings…</p>}
      {error && <div style={{ background:C.errBg, border:`1px solid rgba(155,28,28,0.2)`, borderRadius:10, padding:"12px 16px", marginBottom:20, color:C.err, fontSize:13 }}>Error: {error}</div>}
      {!loading && bookings.length === 0 && <p style={{ color:C.dust }}>No booking requests yet.</p>}

      {!loading && bookings.map(booking => (
        <div key={booking.id} style={{ border:`1px solid ${C.smoke}`, borderRadius:12, padding:20, marginBottom:16, background:C.white, boxShadow:"0 1px 4px rgba(17,17,17,0.04)" }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:16, flexWrap:"wrap" }}>
            <div style={{ flex:1, minWidth:220 }}>
              <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:10, flexWrap:"wrap" }}>
                <h3 style={{ margin:0, fontSize:17, fontWeight:600, color:C.ink }}>{booking.name}</h3>
                <span style={statusBadge(booking.status)}>{booking.status}</span>
              </div>
              <p style={{ margin:"0 0 4px", color:C.dust, fontSize:13 }}><span style={{ color:C.slate, fontWeight:500 }}>Company:</span> {booking.company}</p>
              <p style={{ margin:"0 0 4px", color:C.dust, fontSize:13 }}><span style={{ color:C.slate, fontWeight:500 }}>Email:</span> {booking.email}</p>
              <p style={{ margin:"0 0 4px", color:C.dust, fontSize:13 }}><span style={{ color:C.slate, fontWeight:500 }}>Service:</span> {booking.service_type}</p>
              {booking.preferred_date && <p style={{ margin:"0 0 4px", color:C.dust, fontSize:13 }}><span style={{ color:C.slate, fontWeight:500 }}>Date:</span> {new Date(booking.preferred_date).toLocaleDateString()}</p>}
              {booking.message && <p style={{ margin:"10px 0 0", padding:"10px 12px", background:C.ivory, borderRadius:8, color:C.slate, fontSize:13 }}>{booking.message}</p>}
              {booking.zoom_link && (
                <p style={{ margin:"8px 0 0", fontSize:13, color:C.dust }}>
                  <span style={{ color:C.slate, fontWeight:500 }}>Zoom:</span>{" "}
                  <a href={booking.zoom_link} target="_blank" rel="noreferrer" style={{ color:C.ink }}>{booking.zoom_link}</a>
                </p>
              )}
              <div style={{ display:"flex", gap:8, marginTop:12, flexWrap:"wrap" }}>
                <input placeholder="Attach Zoom link…" value={zoomDrafts[booking.id]||""} onChange={(e)=>setZoomDrafts(p=>({...p,[booking.id]:e.target.value}))}
                  style={{ flex:"1 1 220px", padding:"9px 12px", border:`1px solid ${C.smoke}`, borderRadius:8, fontSize:13, background:C.white, color:C.ink, outline:"none", fontFamily:"'Inter',sans-serif" }} />
                <button onClick={()=>saveZoomLink(booking.id)} style={btnS(C.ink,C.white)}>Save Zoom</button>
              </div>
              <p style={{ margin:"8px 0 0", color:C.dust, fontSize:12 }}>Received: {new Date(booking.created_at).toLocaleString()}</p>
            </div>
            <div style={{ display:"flex", flexDirection:"column", gap:8, alignItems:"flex-end" }}>
              {booking.status === "pending" && (
                <button onClick={()=>updateBookingStatus(booking.id,"confirmed")} disabled={actionLoading[booking.id]}
                  style={btnS(C.okBg,C.ok,{ border:`1px solid rgba(26,102,54,0.2)`, opacity:actionLoading[booking.id]?0.5:1, cursor:actionLoading[booking.id]?"not-allowed":"pointer" })}>
                  {actionLoading[booking.id] ? "…" : "✓ Confirm"}
                </button>
              )}
              {booking.status === "confirmed" && (
                <button onClick={()=>updateBookingStatus(booking.id,"completed")} disabled={actionLoading[booking.id]}
                  style={btnS(C.infoBg,C.info,{ border:`1px solid rgba(30,58,95,0.2)`, opacity:actionLoading[booking.id]?0.5:1, cursor:actionLoading[booking.id]?"not-allowed":"pointer" })}>
                  {actionLoading[booking.id] ? "…" : "✓ Completed"}
                </button>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
