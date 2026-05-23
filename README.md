# One Stop Planner

Unified life planner from the [Figma Make design](https://www.figma.com/make/2ULVMYxiSGscNIaBneXMiG/Unified-Life-Planner-App).

## Stack

- React 18 + TypeScript + Vite
- Tailwind CSS 4
- Supabase (username/password accounts + cloud save)

## Accounts & cloud sync

Each account uses a **username + password**. Your events, tasks, meals, workouts, and goals are stored in Supabase and load automatically when you sign in on any device.

Usernames are 3–24 characters: letters, numbers, and underscores.

## One-time Supabase setup

1. Create a free project at [supabase.com](https://supabase.com) (or use the Figma Make project).

2. Copy `.env.example` → `.env` and fill in:
   - **Project Settings → API → Project URL** → `VITE_SUPABASE_URL`
   - **anon public** key → `VITE_SUPABASE_ANON_KEY`

3. In **SQL Editor**, run the script in [`supabase/schema.sql`](supabase/schema.sql).

4. In **Authentication → Providers → Email**, turn **off** “Confirm email” (required because logins use an internal `@one-stop-planner.local` address).

5. Ensure **Sign ups** are enabled under Authentication settings.

## Run locally

```bash
npm install
npm run dev
```

Open `http://localhost:5173`, create an account, and start planning.

## Build

```bash
npm run build
npm run preview
```

## Sign out

On the **Today** tab, tap your initials (top right) → **Sign out**.

## Use on your phone (anywhere)

Deploy to **Vercel** (free). Takes about 10 minutes.

### 1. Put the project on GitHub

In the project folder:

```bash
git init
git add .
git commit -m "One Stop Planner"
```

Create a **new** repo on [github.com/new](https://github.com/new) (e.g. `one-stop-planner`), then:

```bash
git remote add origin https://github.com/YOUR_USERNAME/one-stop-planner.git
git branch -M main
git push -u origin main
```

### 2. Deploy on Vercel

1. Go to [vercel.com](https://vercel.com) → **Add New** → **Project**
2. Import your GitHub repo
3. **Environment Variables** — add both (copy from your `.env`):
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
4. Click **Deploy**

You’ll get a URL like `https://one-stop-planner.vercel.app`.

### 3. Allow the URL in Supabase

[Supabase Dashboard](https://supabase.com/dashboard) → your project → **Authentication** → **URL configuration**:

- **Site URL:** `https://your-app.vercel.app`
- **Redirect URLs:** add `https://your-app.vercel.app/**`

Save.

### 4. On your phone

1. Open the Vercel URL in Safari or Chrome
2. Sign in with your username and password
3. **Add to Home Screen** for an app icon:
   - **iPhone:** Share → Add to Home Screen
   - **Android:** Menu → Add to Home screen / Install app

Your data syncs from Supabase — same account as on your computer.
