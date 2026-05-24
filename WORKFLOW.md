# Development workflow — changing the app with AI prompts

Use this guide whenever you ask Cursor (or another AI) to change or add features to **One Stop Planner**.

---

## Overview

```
You describe what you want
        ↓
AI edits code in this folder
        ↓
You test on localhost
        ↓
You push to GitHub
        ↓
Vercel deploys automatically
        ↓
You test on your phone (live URL)
```

---

## Part 1 — Before you ask for changes

### 1.1 Open the right project in Cursor

- **Folder to open:** `One Stop Planner` (the folder that contains `package.json`, `src/`, `.env`)
- **Path:** `c:\Users\foste\OneDrive - University of Virginia\Foster\Personal\One Stop Planner`

### 1.2 Keep these accounts ready (bookmarks)

| Service | URL | What it’s for |
|---------|-----|----------------|
| **Supabase** | https://supabase.com/dashboard/project/mtkkyeaiefeihtqzxmwq | Database, auth, API keys |
| **Vercel** | https://vercel.com/dashboard | Live app hosting |
| **GitHub** | Your repo page | Code backup + triggers deploy |

### 1.3 Local `.env` (only on your computer)

**File:** `.env` in the project root (same folder as `package.json`)

**Should contain exactly:**

```env
VITE_SUPABASE_URL=https://mtkkyeaiefeihtqzxmwq.supabase.co
VITE_SUPABASE_ANON_KEY=<your full anon key starting with eyJ...>
```

- Copy values from **Supabase → Project Settings → API**
- **Never** commit `.env` to GitHub (it’s in `.gitignore`)
- If login breaks locally, check this file is saved and restart the dev server

---

## Part 2 — How to ask for changes (prompts)

### 2.1 Write a clear prompt

**Good prompts include:**

1. **What** you want (feature, fix, design change)
2. **Where** in the app (Today tab, Goals, login screen, etc.)
3. **How it should behave** (step-by-step or “like the Figma screenshot”)
4. **Screenshots** if you have them (drag into chat)

**Examples:**

- “On the Today tab, add a button that jumps to the current hour on the timeline.”
- “When I complete a goal, play a short celebration animation.”
- “Fix: tasks I add on mobile don’t show until I refresh.”

**Avoid:**

- “Make it better” (too vague)
- Asking for 10 unrelated features in one message (split into several prompts)

### 2.2 Where the AI will usually edit

| Area | File(s) |
|------|---------|
| Main app / screens | `src/app/App.tsx` |
| Login / sign up | `src/components/AuthScreen.tsx` |
| Account menu | `src/components/AccountMenu.tsx` |
| Auth logic | `src/lib/auth.ts`, `src/hooks/useAuth.ts` |
| Saving to cloud | `src/lib/plannerStorage.ts` |
| Supabase connection | `src/lib/supabase.ts` |
| Colors / fonts | `src/styles/theme.css` |
| New database table/column | `supabase/schema.sql` (you must run SQL in Supabase) |

You don’t need to name these files — the AI will find them. Naming the **screen** (Today, Month, Goals) is enough.

### 2.3 What the AI does NOT need from you

- You usually **don’t** need to edit code yourself
- You **don’t** need to run SQL unless the AI says “run this in Supabase SQL Editor”
- You **don’t** need to change Vercel env vars unless the AI adds **new** `VITE_*` variables

---

## Part 3 — Test changes on your computer

### 3.1 Start the dev server

Open a terminal in the project folder:

```bash
cd "c:\Users\foste\OneDrive - University of Virginia\Foster\Personal\One Stop Planner"
npm run dev
```

### 3.2 Open the app

- Browser: **http://localhost:5173**
- Sign in with your **username + password** (same account as phone)

### 3.3 If the AI changed code but you don’t see it

1. Save all files in Cursor (or let auto-save run)
2. Check the terminal — Vite usually **hot-reloads** automatically
3. If not, press **Ctrl+C** in the terminal, then run `npm run dev` again
4. Hard refresh the browser: **Ctrl+Shift+R**

### 3.4 If login / data doesn’t work locally

| Problem | Fix |
|---------|-----|
| “Supabase not configured” | Fix `.env`, restart `npm run dev` |
| “Failed to fetch” | Check Supabase project isn’t paused; fix URL in `.env` |
| “Email signups disabled” | Supabase → Authentication → Email → enable sign ups |
| Data missing | Sign in with the same username you use on phone |

### 3.5 Optional: test on phone at home (same Wi‑Fi)

```bash
npm run dev:phone
```

Use the **Network** URL shown in the terminal (e.g. `http://192.168.1.5:5173`) on your phone. Laptop must stay on and running the server.

---

## Part 4 — Put changes live (phone anywhere)

### 4.1 Commit and push to GitHub

In the project folder:

```bash
git add .
git commit -m "Short description of what changed"
git push
```

**Use `git` before every command** (e.g. `git push`, not `push`).

**If Git complains about `.docx` or `.png`:**  
Those are ignored in `.gitignore`. Close Word if a doc is open, then `git add .` again.

### 4.2 Wait for Vercel

1. Go to **https://vercel.com/dashboard**
2. Open your **One Stop Planner** project
3. Open **Deployments** — a new build should appear (1–3 minutes)
4. When status is **Ready**, tap the deployment URL

Vercel rebuilds automatically when you **push to GitHub** (if the project is connected).

### 4.3 If Vercel build fails

1. Click the failed deployment → read the **Build Logs**
2. Copy the error and paste it into Cursor: “Vercel build failed with this error: …”
3. Common fix: TypeScript error in code — AI fixes, you push again

### 4.4 Test on your phone

1. Open your **Vercel URL** (e.g. `https://one-stop-planner.vercel.app`)
2. Sign in
3. Confirm the new feature works

**Important:** Live site uses env vars from **Vercel**, not your local `.env`.

---

## Part 5 — Vercel environment variables (rare changes)

**When to update:** Only if the AI adds new variables starting with `VITE_`, or you create a **new** Supabase project.

**Where:** Vercel → your project → **Settings** → **Environment Variables**

**Current variables (typical):**

| Name (exact) | Value (example) |
|--------------|-----------------|
| `VITE_SUPABASE_URL` | `https://mtkkyeaiefeihtqzxmwq.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | Full `eyJ...` key from Supabase → API |

**Rules:**

- **Name:** letters, numbers, underscores only — include the `VITE_` prefix
- **Value:** URL or key only — no quotes, no `NAME=value` in the value box
- Add **one variable per row** — click Add twice for two variables
- After any change: **Deployments → Redeploy**

---

## Part 6 — Supabase (database / auth)

**When you need this:** AI says “run this SQL” or auth breaks on the live site only.

### 6.1 Run new SQL

1. **https://supabase.com/dashboard** → your project
2. **SQL Editor** → New query
3. Paste SQL from `supabase/schema.sql` or from the AI message
4. **Run**

### 6.2 Auth settings (sign up / login)

**Authentication → Providers → Email**

- Enable **Email** provider
- Enable **sign ups**
- Turn **off** “Confirm email” (this app uses `username@one-stop-planner.local`)

### 6.3 Live site URL (after first Vercel deploy)

**Authentication → URL configuration**

- **Site URL:** `https://YOUR-APP.vercel.app`
- **Redirect URLs:** `https://YOUR-APP.vercel.app/**`

Replace with your real Vercel URL.

---

## Part 7 — Checklist per change

Copy this each time you ship something new:

```
[ ] Described the change clearly in Cursor
[ ] AI finished editing — I reviewed the summary
[ ] npm run dev — tested on http://localhost:5173
[ ] Signed in and clicked through the new behavior
[ ] git add . && git commit -m "..." && git push
[ ] Vercel deployment shows Ready
[ ] Tested on phone at Vercel URL
[ ] (If SQL was needed) Ran script in Supabase SQL Editor
[ ] (If new VITE_ env var) Added in Vercel + Redeployed
```

---

## Part 8 — Quick reference commands

```bash
# Go to project
cd "c:\Users\foste\OneDrive - University of Virginia\Foster\Personal\One Stop Planner"

# Run locally
npm run dev

# Run so phone on same Wi‑Fi can connect
npm run dev:phone

# Production build test (optional)
npm run build
npm run preview

# Ship to GitHub (then Vercel deploys)
git add .
git commit -m "Your message here"
git push
```

---

## Part 9 — When something goes wrong

| Symptom | Likely cause | What to do |
|---------|--------------|------------|
| Works locally, not on phone | Old Vercel deploy or wrong env vars | Redeploy; check Vercel env vars |
| Nothing works after AI edit | Dev server needs restart | Ctrl+C → `npm run dev` |
| Git “permission denied” on .docx | File open in Word | Close Word; files are gitignored |
| `'branch' is not recognized` | Missing `git` | Use `git branch -M main` |
| Vercel “invalid characters” in env name | Pasted `NAME=value` in name field | Name = `VITE_SUPABASE_URL` only |
| Lost data | Wrong account or new user | Sign in with original username |
| Build fails on Vercel | TypeScript error | Send build log to AI |

---

## Part 10 — Example end-to-end session

1. **You:** “Add a ‘duplicate task’ button on the task detail sheet.”
2. **AI:** Edits `App.tsx` (or related files).
3. **You:** `npm run dev` → open task → test duplicate.
4. **You:** `git add .` → `git commit -m "Add duplicate task"` → `git push`
5. **You:** Vercel → wait for Ready → open URL on phone → test again.
6. **Done.**

---

## Your live URLs (fill in once)

Write these here so you don’t have to look them up:

- **GitHub repo:** `https://github.com/________________/________________`
- **Vercel live app:** `https://________________.vercel.app`
- **Supabase project:** `https://supabase.com/dashboard/project/mtkkyeaiefeihtqzxmwq`
