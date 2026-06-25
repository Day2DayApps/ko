# Quant Tracker - Render Deployment Setup

This project is a static HTML, CSS, and JavaScript website with Supabase authentication and database integration.

## Prerequisites

- A GitHub repository containing this project
- A Supabase project
- A Render account

## 1. Configure Supabase

1. Open your Supabase project dashboard.
2. Go to SQL Editor.
3. Run the full schema from `supabase/schema.sql`.
4. Go to Project Settings > API.
5. Copy these values:
   - Project URL
   - anon public key
6. Open `js/config.js` and replace:

```js
const SUPABASE_URL = 'YOUR_SUPABASE_URL';
const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY';
```

with your Supabase values.

## 2. Push Code to GitHub

Commit and push the project to GitHub before deploying on Render.

```bash
git add .
git commit -m "Integrate Supabase backend"
git push origin main
```

## 3. Create a Render Static Site

1. Log in to Render.
2. Click New +.
3. Select Static Site.
4. Connect your GitHub repository.
5. Use these settings:

| Setting | Value |
| --- | --- |
| Name | `quant-tracker` |
| Branch | `main` |
| Root Directory | leave blank |
| Build Command | leave blank |
| Publish Directory | `.` |

6. Click Create Static Site.

Render will deploy the site directly from the project root because `index.html` is in the root directory.

## 4. Supabase Auth URL Settings

After Render gives you a live URL, configure Supabase Auth redirects:

1. Open Supabase Dashboard.
2. Go to Authentication > URL Configuration.
3. Set Site URL to your Render URL, for example:

```text
https://quant-tracker.onrender.com
```

4. Add the same Render URL to Redirect URLs.
5. Save the settings.

## 5. Create the First Owner Account

1. Open the Render site.
2. Register a new user account.
3. In Supabase SQL Editor, promote that account to owner:

```sql
update public.profiles
set role = 'owner'
where email = 'your-email@example.com';
```

Replace `your-email@example.com` with the email used during registration.

## 6. Verify Deployment

Check these features on the Render URL:

- User registration
- User login
- Logout
- Local progress saving
- Supabase cloud sync after login
- Leaderboard loading after Supabase is configured
- Profile/settings save

## Notes

- This is a static Render deployment. No Node server is required.
- Supabase Row Level Security policies are defined in `supabase/schema.sql`.
- Admin and owner functions are available through JavaScript service helpers in `js/supabase-services.js` for future UI expansion.
- Telegram OTP UI remains visible, but Telegram OTP requires a Supabase Edge Function or separate bot backend.
