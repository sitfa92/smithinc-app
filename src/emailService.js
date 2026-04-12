/**
 * Email Notification Service
 * Uses Resend for email delivery
 * All API calls go through a backend/serverless function for security
 */

/**
 * Send email when model submits application
 * @param {Object} model - Model data (name, email, etc.)
 */
export const sendModelSubmissionEmail = async (model) => {
  try {
    const response = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-model-submission-email`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          modelName: model.name,
          modelEmail: model.email,
          instagram: model.instagram,
        }),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Failed to send email");
    }

    console.log("✓ Submission confirmation email sent to model");
    console.log("✓ Admin notification email sent");
    return true;
  } catch (error) {
    console.error("Email sending error:", error);
    // Don't throw - email failure shouldn't break the app
    return false;
  }
};

/**
 * Send email when admin approves/rejects model
 * @param {Object} model - Model data
 * @param {string} status - 'approved' or 'rejected'
 */
export const sendModelStatusUpdateEmail = async (model, status) => {
  try {
    const response = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-model-status-email`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          modelName: model.name,
          modelEmail: model.email,
          status: status,
        }),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Failed to send email");
    }

    console.log(
      `✓ Status update email sent (${status}) to ${model.name}`
    );
    return true;
  } catch (error) {
    console.error("Email sending error:", error);
    return false;
  }
};

/**
 * Send email when new booking is submitted
 * @param {Object} booking - Booking data
 */
export const sendBookingConfirmationEmail = async (booking) => {
  try {
    const response = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-booking-confirmation-email`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          clientName: booking.name,
          clientEmail: booking.email,
          company: booking.company,
          serviceType: booking.service_type,
          preferredDate: booking.preferred_date,
        }),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Failed to send email");
    }

    console.log(
      `✓ Booking confirmation email sent to ${booking.name}`
    );
    console.log(`✓ Admin notification email sent`);
    return true;
  } catch (error) {
    console.error("Email sending error:", error);
    return false;
  }
};

/**
 * Send email when booking is confirmed by admin
 * @param {Object} booking - Booking data
 */
export const sendBookingConfirmedEmail = async (booking) => {
  try {
    const response = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-booking-confirmed-email`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          clientName: booking.name,
          clientEmail: booking.email,
          serviceType: booking.service_type,
        }),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Failed to send email");
    }

    console.log(
      `✓ Booking confirmed email sent to ${booking.name}`
    );
    return true;
  } catch (error) {
    console.error("Email sending error:", error);
    return false;
  }
};
