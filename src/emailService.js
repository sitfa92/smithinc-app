/**
 * Email Notification Service
 * All transactional emails route through /api/send-email (Resend)
 */

const sendEmail = async (type, data) => {
  try {
    const res = await fetch("/api/send-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, data }),
    });
    if (!res.ok) throw new Error(await res.text());
    return true;
  } catch (err) {
    console.error("Email sending error:", err);
    return false;
  }
};

export const sendModelSubmissionEmail = (model) =>
  sendEmail("model-submission", {
    name: model.name,
    email: model.email,
    instagram: model.instagram,
  });

export const sendModelStatusUpdateEmail = (model, status, digitalsLink = "") =>
  sendEmail("model-status", {
    name: model.name,
    email: model.email,
    status,
    digitalsLink,
  });

export const sendModelEventEmail = (model, event) =>
  sendEmail("model-event", {
    name: model.name,
    email: model.email,
    eventTitle: event.title,
    eventType: event.event_type,
    eventAt: event.event_at,
    notes: event.notes,
  });

export const sendBookingConfirmationEmail = (booking) =>
  sendEmail("booking-confirmation", {
    name: booking.name,
    email: booking.email,
    company: booking.company,
    serviceType: booking.service_type,
    preferredDate: booking.preferred_date,
  });

export const sendBookingConfirmedEmail = (booking) =>
  sendEmail("booking-confirmed", {
    name: booking.name,
    email: booking.email,
    serviceType: booking.service_type,
    message: booking.message || "",
    phone: booking.phone || "",
    countryCode: booking.country_code || booking.country || "",
  });

