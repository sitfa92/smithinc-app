# Image Upload & Model Approval System

## New Features Added ✨

This enhancement transforms SmithInc into a complete model management system with visual review capabilities.

### 1. **Image Upload System** 📸
- Models can now upload profile images during signup
- Supports: JPG, PNG, GIF, WebP
- Max file size: 5MB
- Automatic validation and error handling
- Real-time image preview before submission

**New File:** `src/imageUpload.js`
- `uploadImage(file, folder)` - Upload to Supabase Storage
- `deleteImage(imageUrl)` - Remove images if needed
- Error handling for file type and size

### 2. **Database Schema Updates** 🗄️
Updated `models` table with new fields:
```
- image_url (TEXT): URL to uploaded profile image
- status (TEXT): Default 'pending'
  * 'pending' - Awaiting review
  * 'approved' - Accepted talent
  * 'rejected' - Not selected
```

### 3. **Enhanced Model Signup** 📝
The `/model-signup` page now:
- Requires profile image upload
- Shows real-time image preview
- Better form layout with labels
- Improved error messages
- Success confirmation
- Auto-resets on successful submission

### 4. **Admin Submissions Dashboard** 👥
The `/submissions` (protected) page now displays:
- **Image preview** for each model
- Name, email, and Instagram profile
- Current approval status (badge)
- Submission timestamp
- **Action buttons** (when status is "pending"):
  - ✓ Approve button (turns model approved → green)
  - ✕ Reject button (turns model rejected → red)

### 5. **Approval System** ✅/❌
- Admin can instantly approve or reject pending submissions
- Status updates in real-time on the dashboard
- Approved/rejected models are locked (no more actions)

---

## Setup Instructions 🚀

### Step 1: Update Supabase Database

Go to **Supabase Dashboard** → **SQL Editor** → Run this query:

```sql
-- Update models table with new fields
ALTER TABLE models 
ADD COLUMN image_url TEXT,
ADD COLUMN status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected'));

-- Add index for filtering by status
CREATE INDEX idx_models_status ON models(status);
```

### Step 2: Create Storage Bucket

1. Go to **Supabase** → **Storage**
2. Click **Create a new bucket**
3. Name: `model-images`
4. Set to **Public** (for public access)
5. Click **Save**

That's it! The app is ready to go.

---

## How It Works 🔄

### Model Signup Flow
1. Model visits `/model-signup`
2. Enters name, email, Instagram (optional)
3. Uploads profile image (JPG/PNG/GIF/WebP, max 5MB)
4. Sees live preview of their image
5. Clicks "Submit Application"
6. Image is uploaded to Storage → URL is generated
7. Model record created with `status: 'pending'`
8. Success message shown

### Admin Review Flow
1. Admin logs in with `admin@smithinc.com` / `password123`
2. Clicks "Submissions" in navigation
3. Sees all model applications with images
4. Once per application, can choose:
   - ✓ Approve → Sets status to "approved" (green badge)
   - ✕ Reject → Sets status to "rejected" (red badge)
5. Status updates instantly

---

## File Structure 

```
src/
  ├── App.jsx                 // Main app with routes & components
  ├── supabase.js            // Supabase client config
  ├── imageUpload.js         // NEW: Image upload utilities
  └── ...
```

---

## Security Notes 🔐

**Current State:**
- Public read/write to Storage (for demo)
- No RLS enabled on database (for simplicity)

**For Production:**
Enable Row Level Security (RLS) and add policies:
```sql
-- Allow public to insert (create submissions)
CREATE POLICY "Public can submit models" ON models
  FOR INSERT WITH CHECK (true);

-- Allow public to read only pending/approved (not rejected details)
CREATE POLICY "Public can view approved models" ON models
  FOR SELECT USING (status IN ('pending', 'approved'));

-- Allow admin (auth.email = 'admin@smithinc.com') to update status
CREATE POLICY "Admin can update status" ON models
  FOR UPDATE USING (auth.jwt() ->> 'email' = 'admin@smithinc.com');
```

---

## UI Features 🎨

- **Model Card Layout**: Image on left, info on right
- **Status Badge**: Color-coded (Orange=Pending, Green=Approved, Red=Rejected)
- **Image Preview**: 150px × 200px crop, rounded corners
- **Responsive**: Works on desktop with max-width container
- **Loading States**: Buttons show loading feedback during actions
- **Error Messages**: Red background, clear error text

---

## Testing the Feature

### 1. Test Upload (as model)
- Go to `http://localhost:5173/model-signup`
- Fill in name & email
- Upload an image (JPG/PNG)
- Click "Submit Application"
- ✓ Should see success message
- ✓ Image should appear in Supabase Storage

### 2. Test Admin Review (as admin)
- Go to `http://localhost:5173/login`
- Login: `admin@smithinc.com` / `password123`
- Click "Submissions"
- ✓ Should see model card with image
- ✓ Should see status badge (pending/orange)
- ✓ Click "Approve" button
- ✓ Should see status change to "approved" (green)
- ✓ Buttons should disappear (no more actions for approved models)

### 3. Test Error Handling
- Try uploading a 10MB file → Should show "File too large" error
- Try uploading a PDF → Should show "Invalid file type" error
- Try submitting without image → Should show "Please upload a profile image" error

---

## Existing Features (Still Working ✅)

- User authentication (login/logout)
- Admin dashboard
- Navigation between pages
- All existing routes protected correctly

---

## Next Steps (Future Enhancements)

1. **Bulk Actions**: Approve/reject multiple at once
2. **Search/Filter**: Find models by status, email, etc.
3. **Profile Pages**: Public-facing model profiles
4. **Notifications**: Email models when status changes
5. **Analytics**: Track approvals, submissions over time
6. **Image Gallery**: Show approved models portfolio
7. **Custom Fields**: Add height, measurements, etc.
8. **Real Authentication**: Replace dummy login with Supabase Auth

---

## Troubleshooting 🔧

### Images not uploading
- Check Supabase Storage bucket exists and is public
- Check browser console (F12) for errors
- Verify `.env` has correct VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY

### Status not updating
- Check admin is logged in
- Check network tab in DevTools
- Verify database `models` table has `status` column

### Image not displaying in admin panel
- Check image URL is accessible (test in new tab)
- Verify image is in Supabase Storage
- Check storage bucket permissions (should be public)

---

## Code Examples 💻

### Upload an image
```javascript
import { uploadImage } from "./imageUpload";

const imageUrl = await uploadImage(file);
// Returns: https://...supabase...model-images/1234-abc.jpg
```

### Update model status
```javascript
const { error } = await supabase
  .from("models")
  .update({ status: "approved" })
  .eq("id", modelId);
```

### Fetch all models with pending status
```javascript
const { data } = await supabase
  .from("models")
  .select("*")
  .eq("status", "pending")
  .order("submitted_at", { ascending: false });
```

---

**Built with:** React + Vite + Supabase
**Last Updated:** April 12, 2026
