# Supabase Setup Guide for SmithInc App

## Step 1: Create a Supabase Project

1. Go to [supabase.com](https://supabase.com) and sign up/log in
2. Click "New Project"
3. Fill in the project details:
   - **Name**: smithinc-app
   - **Database Password**: Create a strong password
   - **Region**: Choose closest to your users
4. Wait for the project to be created (2-3 minutes)

## Step 2: Get Your API Keys

1. Once the project is ready, go to **Settings > API**
2. Copy:
   - **Project URL** → `VITE_SUPABASE_URL`
   - **anon public** key → `VITE_SUPABASE_ANON_KEY`

## Step 3: Add Environment Variables

Open `.env` in the project root and replace with your actual keys:

```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key_here
```

## Step 4: Create the Models Table

In Supabase dashboard:

1. Go to **SQL Editor** (left sidebar)
2. Click **New Query**
3. Copy and paste this SQL, then run it:

```sql
-- Create models table
CREATE TABLE models (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  instagram TEXT,
  submitted_at TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create index on email for faster lookups
CREATE INDEX idx_models_email ON models(email);

-- Create index for sorting by submission date
CREATE INDEX idx_models_submitted_at ON models(submitted_at DESC);
```

4. Click **Run** (or Ctrl+Enter)

## Step 5: Test the Setup

1. Make sure `.env` file has your real keys
2. **Don't restart** the dev server (it won't pick up .env changes) - close and reopen it with `npm run dev`
3. Go to `http://localhost:5173/model-signup`
4. Fill out the form and submit
5. Check Supabase dashboard → **Table Editor** → **models** table
6. You should see your submission there!
7. Go to `/submissions` page to verify it displays the data

## Security Notes

- **Row Level Security (RLS)**: Currently disabled for simplicity
- For production, enable RLS and add policies to control who can:
  - Insert (public can submit)
  - Select (only admins can see submissions)
  - Delete (only admins can delete)

## Troubleshooting

### "Missing Supabase environment variables" error
- Check `.env` file exists in project root (same level as `package.json`)
- Make sure keys are correct
- Close dev server and restart it (Vite needs to reload .env)

### Submissions not appearing
- Check browser console for errors (F12)
- Verify table was created in Supabase
- Check that .env keys are correct
- Go to Supabase → Authentication and verify RLS is disabled

### CORS errors
- This shouldn't happen with the anon key, but if it does:
  - Go to Supabase → Settings → API
  - Check CORS configurations

## Next Steps

Once everything works:
1. Add Row Level Security policies
2. Add user authentication with Supabase Auth
3. Connect admin panel to real auth system
4. Add file uploads for model profiles (images, portfolio)
