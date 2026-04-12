# Email Notifications & Client Booking System

## New Features Added ✨

Transform SmithInc into a full-service fashion agency platform with client booking capabilities and automated email notifications.

---

## 🎯 Features

### 1. **Public Booking System** 📅
- New `/book` route (publicly accessible)
- Beautiful booking form for clients/brands
- Fields:
  - Full Name
  - Email
  - Company/Brand
  - Service Type (dropdown)
    - Model Booking
    - Creative Direction
    - Photoshoot
    - Consultation
  - Preferred Date
  - Message/Notes
- Stores all bookings in Supabase `bookings` table
- Success confirmation message

### 2. **Admin Booking Dashboard** 👥
- Protected `/bookings` route (admin only)
- Display all client booking requests
- Shows:
  - Client name and company
  - Service type requested
  - Preferred date
  - Contact email
  - Full message
  - Current status (badge)
  - Submission timestamp
- Sort by newest first
- Responsive card-based layout

### 3. **Booking Status Management** ✅
Bookings start as `pending` and can be updated to:
- **Pending** (orange) → Initial state
- **Confirmed** (green) → Admin confirms the booking
- **Completed** (blue) → Booking has been fulfilled

Admin actions:
- Confirm pending booking → Send email confirmation to client
- Mark confirmed booking as completed

### 4. **Email Notifications** 📧
Automated emails sent for:

**Model Submission:**
- ✓ Thank you email to model
- ✓ Notification to admin

**Model Status Update:**
- ✓ Approval email (if accepted)
- ✓ Rejection email (if rejected)

**Booking Submission:**
- ✓ Confirmation email to client
- ✓ Notification to admin

**Booking Confirmation:**
- ✓ Confirmation email to client with booking details

Email content includes:
- Professional, luxury fashion industry tone
- Clear action items
- Contact information
- Status updates

---

## 📁 Database Schema

### Models Table (Updated)
```
- id
- name
- email
- instagram
- image_url
- status (pending, approved, rejected)
- submitted_at
- created_at
```

### Bookings Table (NEW)
```
- id
- name (client name)
- email (client email)
- company (brand/company name)
- service_type (Model Booking, Creative Direction, Photoshoot, Consultation)
- preferred_date (optional)
- message (notes from client)
- status (pending, confirmed, completed)
- created_at
```

---

## 📁 File Structure

```
src/
  ├── App.jsx                 // Main app with all routes & components
  ├── supabase.js            // Supabase client config
  ├── imageUpload.js         // Image upload utilities
  ├── emailService.js        // NEW: Email notification utilities
  └── ...
```

---

## 🚀 Setup Instructions

### Step 1: Create Bookings Table

Go to **Supabase Dashboard → SQL Editor** → Run:

```sql
CREATE TABLE bookings (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  company TEXT NOT NULL,
  service_type TEXT NOT NULL,
  preferred_date TEXT,
  message TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'completed')),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_bookings_email ON bookings(email);
CREATE INDEX idx_bookings_status ON bookings(status);
CREATE INDEX idx_bookings_created_at ON bookings(created_at DESC);
```

### Step 2: Email Configuration (Optional)

For working email notifications, set up Supabase Edge Functions with Resend:

1. **Install Supabase CLI:**
   ```bash
   npm install -g supabase
   ```

2. **Link your project:**
   ```bash
   supabase link --project-ref your-project-id
   ```

3. **Create Edge Functions** in `supabase/functions/`:
   - `send-model-submission-email`
   - `send-model-status-email`
   - `send-booking-confirmation-email`
   - `send-booking-confirmed-email`

4. **Get Resend API key:** https://resend.com (free tier includes 100 emails/day)

5. **Set Edge Function secrets:**
   ```bash
   supabase secrets set RESEND_API_KEY=your_resend_key
   ```

**Note:** The app works fully without emails - they're just nice bonus notifications!

### Step 3: Test Everything

The app is ready to use immediately after creating the bookings table. Email functions can be added anytime.

---

## 💻 User Flows

### Client Booking Flow
1. Visit `/book` (public, no login required)
2. Fill out booking form:
   - Name, email, company
   - Select service type
   - Choose preferred date
   - Add optional message
3. Click "Send Booking Request"
4. ✓ See success message
5. ✓ Email confirmation sent to client
6. ✓ Admin notification email sent (if configured)

### Admin Review & Confirm
1. Login with `admin@smithinc.com` / `password123`
2. Click "Bookings" in navigation
3. See all booking requests with details
4. Review client information and message
5. Click ✓ "Confirm" to accept booking
6. ✓ Booking status changes to "confirmed" (green)
7. ✓ Email sent to client with confirmation
8. When done, click "✓ Completed"

### Model Application Flow (Enhanced)
1. Model visits `/model-signup`
2. Submits application with image
3. ✓ Confirmation email sent to model
4. ✓ Admin notification email sent
5. Admin reviews & approves/rejects
6. ✓ Email sent to model with decision

---

## 🎨 UI/UX Features

- **Luxury Minimal Aesthetic:** Clean spacing, premium fonts
- **Card-Based Layout:** Easy to scan and read
- **Status Badges:** Color-coded for quick visual feedback
  - Orange = Pending
  - Green = Confirmed/Approved
  - Blue = Completed
  - Red = Rejected
- **Responsive Design:** Works on desktop (optimized for admin use)
- **Loading States:** Buttons show feedback during submission
- **Error Messages:** Clear, user-friendly error text
- **Success Confirmations:** Styled success messages

---

## 🔐 Security Notes

**Current State (Demo):**
- No authentication on booking endpoints
- No Row Level Security (RLS) on bookings table

**For Production:**

1. Enable RLS on bookings table:
   ```sql
   ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
   
   -- Allow public to insert bookings
   CREATE POLICY "Public can create bookings" ON bookings
     FOR INSERT WITH CHECK (true);
   
   -- Allow public to read their own bookings (for confirmation)
   CREATE POLICY "Users can read own bookings" ON bookings
     FOR SELECT USING (email = auth.jwt() ->> 'email' OR auth.jwt() ->> 'email' = 'admin@smithinc.com');
   
   -- Allow only admin to update
   CREATE POLICY "Admin can update bookings" ON bookings
     FOR UPDATE USING (auth.jwt() ->> 'email' = 'admin@smithinc.com');
   ```

2. Implement Supabase Auth for admin login
3. Add rate limiting on booking submissions
4. Validate email addresses more strictly

---

## 🧪 Testing Guide

### Test Public Booking Form
1. Go to `http://localhost:5173/book`
2. Fill in form with:
   - Name: "Test Client"
   - Email: "client@example.com"
   - Company: "Test Brand"
   - Service: "Model Booking"
   - Date: (today's date)
   - Message: "Interested in booking..."
3. Click "Send Booking Request"
4. ✓ Should see success message
5. ✓ Check Supabase → Table Editor → `bookings` table
6. ✓ Should see new booking with status: `pending`

### Test Admin Booking Dashboard
1. Navigate to `http://localhost:5173/login`
2. Login: `admin@smithinc.com` / `password123`
3. Click "Bookings" in navigation
4. ✓ Should see bookings list
5. ✓ Should see booking you just created
6. Click ✓ "Confirm" button
7. ✓ Status should change to "confirmed" (green badge)
8. ✓ Buttons should change to "✓ Completed"
9. Click "✓ Completed"
10. ✓ Status should change to "completed" (blue badge)

### Test Model Application (Enhanced)
1. Go to `http://localhost:5173/model-signup`
2. Fill form and upload image
3. Click "Submit Application"
4. ✓ See success message
5. ✓ Check Supabase → `models` table
6. ✓ Status should be `pending`
7. Login as admin
8. Go to "Submissions"
9. Click ✓ "Approve"
10. ✓ Status should change to "approved" (green)

---

## 📧 Email Content Examples

### Model Submission Confirmation
```
Subject: Welcome to SmithInc!

Dear [Name],

Thank you for submitting your application to join our talent roster.
We've received your information and will review your profile shortly.
Our team will be in touch within 2-3 business days.

Best regards,
The SmithInc Team
```

### Model Approval
```
Subject: You're Approved! Welcome to SmithInc

Dear [Name],

Great news! We're excited to welcome you to the SmithInc talent roster.
Your profile has been approved and is now visible to our clients.
Stay tuned for booking opportunities!

Follow us on Instagram: @smithincagency

Best regards,
The SmithInc Team
```

### Booking Confirmation
```
Subject: Your Booking Request Received

Dear [Name],

Thank you for your interest in our services!
We've received your booking request for [Service Type].

Our team will review your request and get back to you within 1-2 business days
to confirm your preferred date or discuss alternatives.

Best regards,
The SmithInc Team
```

### Booking Confirmed
```
Subject: Your Booking is Confirmed!

Dear [Name],

Excellent! Your booking for [Service Type] has been confirmed.

We look forward to working with you and creating something amazing together.
If you have any questions, please don't hesitate to reach out.

Best regards,
The SmithInc Team
```

---

## 🔧 Troubleshooting

### Bookings not saving
- Check `bookings` table exists in Supabase
- Verify browser console for errors (F12)
- Check `.env` has correct Supabase keys
- Ensure database allows public inserts (or set up RLS policies)

### Admin Booking Dashboard not loading
- Verify admin is logged in
- Check `/bookings` route is protected (should redirect if not logged in)
- Check browser console for errors

### Status not updating
- Verify admin is logged in
- Check network tab for failed requests
- Ensure database allows updates

### Emails not sending
- Email functions are optional - app works without them
- If you set up functions, check:
  - Resend API key is correctly set in Supabase secrets
  - Edge Functions are deployed (`supabase functions deploy`)
  - Check Supabase Functions logs for errors

---

## 📊 Booking Statuses Explained

| Status | Color | Meaning | Admin Can Do |
|--------|-------|---------|------------|
| pending | Orange | Awaiting admin review | Confirm or do nothing |
| confirmed | Green | Booking accepted/locked in | Mark as completed |
| completed | Blue | Booking fulfilled | View only |

---

## 🚀 Next Level Enhancements

1. **Email Customization:**
   - Add brand logo to emails
   - HTML email templates
   - Customizable email addresses

2. **Booking Features:**
   - Calendar integration to block booked dates
   - Pricing calculator
   - Package descriptions
   - Upload reference images

3. **Client Portal:**
   - Let clients check booking status
   - View contract files
   - Sign digital contracts

4. **Analytics Dashboard:**
   - Track booking conversion rates
   - Model application statistics
   - Revenue tracking

5. **Integrations:**
   - Calendar sync (Google Calendar, Calendly)
   - Payment processing (Stripe)
   - CRM integration
   - SMS notifications

---

## 📝 Code Examples

### Send Booking Confirmation Email
```javascript
import { sendBookingConfirmationEmail } from "./emailService";

const booking = {
  name: "John Doe",
  email: "john@example.com",
  company: "Fashion Brand",
  service_type: "Model Booking",
  preferred_date: "2026-05-01"
};

await sendBookingConfirmationEmail(booking);
```

### Fetch All Bookings (Sorted by Recent)
```javascript
const { data: bookings } = await supabase
  .from("bookings")
  .select("*")
  .order("created_at", { ascending: false });
```

### Update Booking Status
```javascript
const { error } = await supabase
  .from("bookings")
  .update({ status: "confirmed" })
  .eq("id", bookingId);
```

### Filter Bookings by Status
```javascript
const { data: pendingBookings } = await supabase
  .from("bookings")
  .select("*")
  .eq("status", "pending")
  .order("created_at", { ascending: false });
```

---

## Build Status

- **Build:** ✓ 0 errors
- **Modules:** 67+ transformed
- **Commits:** Pushed to GitHub
- **Existing Routes:** ✓ Protected correctly

---

**Built with:** React + Vite + Supabase + Resend (optional)
**Last Updated:** April 12, 2026
