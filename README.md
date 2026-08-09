# One Stop Planner

A mobile-first unified life planner: calendar, tasks (with subtasks), fitness (workouts + nutrition), budget tracking, and goals — with username/password accounts and cloud sync via Supabase.

**Design source:** [Figma Make — Unified Life Planner](https://www.figma.com/make/2ULVMYxiSGscNIaBneXMiG/Unified-Life-Planner-App)

> **Maintainer note:** Keep this README in sync whenever features change. See [Keeping this README updated](#keeping-this-readme-updated).

---

## Table of contents

1. [How the app works](#how-the-app-works)
2. [Current functionality](#current-functionality)
3. [Tech stack](#tech-stack)
4. [Project structure](#project-structure)
5. [Setup (local)](#setup-local)
6. [Deploy (phone / anywhere)](#deploy-phone--anywhere)
7. [Keeping this README updated](#keeping-this-readme-updated)

---

## How the app works

### High-level flow

1. You open the app (localhost or Vercel URL).
2. If not signed in, you see **Sign in / Create account** (username + password).
3. After auth, your planner data loads from **Supabase** (with a local browser backup).
4. You use five main tabs: **Today**, **Month**, **Fitness**, **Goals**, **Budget**.
5. The purple **+** FAB opens a menu to add Event, Task, Meal, Workout, or Goal.
6. Changes auto-save to the cloud (~0.7s after you edit) and to a per-user local backup.

### Accounts & sync

| Piece | Behavior |
|--------|----------|
| Username | 3–24 chars: letters, numbers, underscores |
| Password | At least 6 characters |
| Auth backend | Supabase Auth (email provider; usernames map to `username@one-stop-planner.local`) |
| Cloud storage | One JSON blob per user in table `planner_data` |
| Local backup | `localStorage` key `lifeplanner_v2:<userId>` |
| First login | If cloud is empty, migrates legacy `lifeplanner_v2` data if present |
| Sign out | Today tab → initials (top right) → Account → Sign out |

### Data model (what gets saved)

| Entity | Main fields |
|--------|-------------|
| **Events** | Title, start/end date & time, optional repeat days, group, notes, **alert option + computed alert timestamp** |
| **Tasks** | Title, due date/time, optional repeat, group, notes, done flag, **subtasks**, **alert option** |
| **Subtasks** | Title, optional due date, done flag (nested under a task) |
| **Meals** | Name, type (breakfast/lunch/dinner/snack), date/time, calories, protein/carbs/fat |
| **Workouts** | Name, date, start/end time, exercises with sets (weight, reps, done) |
| **Goals** | Title, days of week, amount + unit (times/minutes), group |
| **Goal logs** | Per goal + date when completed |
| **Groups** | Named color tags (School, Work, Personal, Fitness, Food, Wellness by default) |
| **Active workout** | In-progress session (name, start time, live exercises/sets, optional custom date/time override) |
| **Budget categories** | Name, color, monthly spending cap |
| **Budget transactions** | Category, amount, description, date, type (expense/income), account, payment method (debit/credit/cash), credit card paid status, flow type (spending/saving/investing/income) |
| **Accounts** | Name, type (checking/credit/cash/hysa/investment), current balance |
| **Notification settings** | Per-user default alert rules (event default timing, task default timing, goal daily reminder time, budget alert toggles) |
| **Push subscriptions** | Per-user Web Push subscription data (endpoint URL, P256DH + auth keys, enabled flag) stored in `user_push_subscriptions` table |
| **Alert notifications** | Scheduled push notification queue (item type, item ID, alert timestamp, title, body, deep link, sent status) |

---

## Current functionality

### Global chrome

| Feature | Description |
|---------|-------------|
| Bottom navigation | Compact, centered floating dock (Today · Month · Fitness · Goals · Budget) with frosted-glass pill shell (`rounded-full`, `backdrop-blur-xl`) |
| Floating + button | Opens add menu (Event, Task, Meal, Workout, Goal) |
| Account menu | Initials on Today → username, sync status, sign out |
| Dock buttons | 40px account avatar (indigo tint + border), pill-shaped current-tab selector (frosted `slate-800/80`), solid indigo + button with glow |
| Detail sheets | Tap an item to view, edit, delete, or toggle completion |
| Theme | **Electric Cobalt & Midnight Navy** — high-contrast Light/Dark modes, frosted glassmorphism (`backdrop-blur-md`), WCAG AA/AAA legible text, Inter font |

### Today

| Feature | Description |
|---------|-------------|
| Date header | Day name + month/day; chevrons to change day |
| Jump to today | "Today" chip when viewing another day |
| Week strip | 7-day strip centered on selected date; today outline; selected dot |
| Filter tabs | All · Events · Tasks · Goals · Active (with count badges) |
| Timeline | Hour grid (~6 AM–11 PM); overlapping layout; now line on current day |
| Events on timeline | **Solid time-block containers** with prominent left accent bar (`border-l-4`), explicit time ranges, **no checkboxes** (locked time commitments) |
| Timed tasks | **Floating glass cards** with interactive circular checkbox on the left + compact due-time badge using Sky/Sapphire task accent |
| Untimed tasks | **Collapsible "Due Today (Anytime)"** section at top of day view with task accent color count badge |
| Goals for the day | List with log/unlog for selected date |
| Active / workouts | In-progress workout banner + completed workouts for the day |
| Budget highlights | Always-visible monthly budget summary (total budget, spent, remaining) + per-category spending breakdown with progress bars; shows "No budget categories yet" empty state when no categories exist |
| Empty state | "Nothing scheduled — tap + to add" |

### Month

| Feature | Description |
|---------|-------------|
| Month calendar | Navigate months with chevrons |
| Grid styling | Day number pinned **top-right** of each cell; centered task-count pill + workload hours indicator |
| Auto-resizing cells | `min-h` flex cells grow so the date, task badge, and workload indicators never clip or overflow |
| Workload colors | Green → yellow → red by event+task count that day |
| Legend | Light / Moderate / Busy |
| Day drill-down | Tap any date cell to open a **Daily View** bottom sheet |
| 24-hour timeline | Scrollable 12:00 AM → 11:59 PM schedule; **auto-scrolls so 9:00 AM is at the top** (you can still scroll up to see 12 AM–8:59 AM) |
| Day Tasks list | Dedicated section in the day sheet listing all tasks due that date (timed + anytime) |
| Upcoming feed | "Upcoming Events & Tasks" list below the grid — chronological, with date tile, title, and Event/Task type badge; labels use "Today" / "Tomorrow" / "Aug 12" |
| Day select | Tap a day to set the selected date (used by Today / Meal) |
| Dark mode legibility | Day numbers use `text-slate-100` in dark mode; busy/moderate/light cells use translucent tints (`bg-rose-500/20`, `bg-amber-500/20`, `bg-emerald-500/20`) so text stays readable |

### Fitness (Workouts + Nutrition)

| Feature | Description |
|---------|-------------|
| | Sub-navigation | Toggle between "Workouts" and "Nutrition" sub-views |
| | Cross-domain banner | Today's workout status + nutrition calorie/macro rings |
| | Workouts | Start workout, active overlay, history with duration/exercises/volume |
| | Strong-style Editing | Edit sets (weight, reps, type), add/delete sets, and reorder exercises mid-session |
| | Set Types | Support for Normal, Warmup, Drop Set, and Failure set types |
| | Past Workouts | Retroactive logging with custom Date and Time overrides |
| | Nutrition | Day navigation, daily totals (calories + protein/carbs/fat), meal type sections |
| | Log meal | Name, description, type, date/time, macros |
| | Empty slots | "+ Log {type}" dashed buttons |

### Budget

| Feature | Description |
|---------|-------------|
| Day navigation | Prev/next day |
| Daily totals | Calories + protein / carbs / fat |
| By meal type | Breakfast, lunch, dinner, snack sections |
| Log meal | Name, description, type, date/time, macros |
| Empty slots | "+ Log {type}" dashed buttons |

### Budget

| Feature | Description |
|---------|-------------|
| **Month navigation** | Flip through months with prev/next arrows to view historical or plan future budgets |
| **Monthly summary** | Income, expenses, net balance, daily spending rate, and projected month total |
| **Pace indicator** | On Track / Near Limit / Over Budget status based on spending rate vs. budget |
| **Multi-account management** | Add/manage multiple accounts (Checking, HYSA, Credit Cards, Cash, Investment) with live balance tracking |
| **Account balances** | Auto-updated based on transactions; shows total liquid net worth |
| **Category budgets** | Create categories with custom colors and monthly spending caps |
| **Progress bars** | Visual spending progress per category (red when over cap) |
| **Over-spending alerts** | Automatic flags for categories exceeding their budget |
| **Transactions** | Log expenses/income with category, amount, description, date, account, payment method, and flow type |
| **Payment method tagging** | Tag transactions as Debit Card, Credit Card, or Cash |
| **Credit card tracking** | Mark credit card charges as Paid/Unpaid; visual badges show settlement status |
| **Flow type classification** | Tag transactions as Pure Spending, Saving, Investing, or Income with color-coded badges |
| **Wealth projections** | Interactive 1/3/5/10-year net worth projections based on current balances, average surplus, and compound growth |
| **Delete** | Remove categories, transactions, and accounts |

### Goals

| Feature | Description |
|---------|-------------|
| Goal cards | Title, amount/unit, schedule days, group chip — **Violet accent** with streak indicators |
| 7-day streak bars | Last 7 days; logged / scheduled / empty states |
| Log today | Toggle completion for today when goal applies |
| Groups | Color chips + Manage (add/delete custom groups) |
| New goal | Days required; optional group |

### Events (add / detail)

| Feature | Description |
|---------|-------------|
| New event | Name, start date, start/end time, optional repeat days, end/until date, group, notes |
| Detail | View dates, times, repeats, notes; edit or delete |

### Tasks & subtasks (add / detail)

| Feature | Description |
|---------|-------------|
| New task | Main task name, due date/time, repeat, group, notes |
| Subtasks on create | Optional list while creating a task |
| Subtasks on detail | Add and check off without entering Edit |
| Subtasks on edit | Full editor: add, toggle, remove, optional per-subtask due date |
| Progress badge | Task rows show `done/total` when subtasks exist |
| Auto-complete parent | When all subtasks are done, the main task is marked done |

### Auth screens

| Feature | Description |
|---------|-------------|
| Sign in | Username + password |
| Sign up | Username + password + confirm |
| Setup gate | If env vars missing, shows "Supabase not configured" help |

### Notifications & Alerts

| Feature | Description |
|---------|-------------|
| **Default alert rules** | Configurable per-category notification preferences in Account Settings (Account → Default Alert Rules) |
| **Event alerts** | Dropdown selector: None, At time of event, 5/15/30 mins before, 1 hour before, 1 day before |
| **Task alerts** | Dropdown selector: None, At due time, 15 mins before, 1 hour before, 9:00 AM on due date |
| **Goal daily reminders** | Time picker for daily check-in reminder (e.g., "Remind me daily at 8:00 PM") |
| **Budget alerts** | Toggle switches for 80% category limit warnings and upcoming recurring bill reminders (1 day before) |
| **Per-item overrides** | When creating/editing events or tasks, the "Remind Me" selector pre-fills from your default but can be overridden or set to "None" |
| **Scheduled push queue** | Alert notifications are stored in `alert_notifications` table with computed `alert_timestamp` |
| **Background delivery** | Vercel Cron job runs every minute to query pending alerts (`alert_timestamp <= NOW() AND sent = false`) and sends Web Push notifications to active subscriptions |
| **Deep linking** | Push notifications include deep-link destination URLs to open the relevant item in the app |
| **Push subscription management** | Users can enable/disable push notifications in Account Settings with a toggle switch. Tapping the toggle requests browser permission (`Notification.requestPermission()`), creates a Push API subscription via Service Worker, and saves the subscription endpoint + keys to the `user_push_subscriptions` table in Supabase |
| **iOS permission handling** | If permission is denied (common on iOS), an inline alert banner displays: "Notifications blocked by iOS. Please go to iPhone Settings > One Stop Planner > Notifications and allow notifications." The toggle resets to OFF so it doesn't stay falsely checked |
| **Test notification button** | When push is enabled, a "Send Test Notification" button appears to immediately verify that push banners display on the device |
| **Mobile navigation** | Account Settings modal now has a prominent back arrow button (←) in the top-left corner and an X close button in the top-right. Tapping the backdrop overlay or either button closes the modal and returns to the main app. A hint at the bottom reminds users they can tap outside or use the back button |

---

## Tech stack

| Layer | Choice |
|-------|--------|
| UI | React 18 + TypeScript |
| Build | Vite 6 |
| Styling | Tailwind CSS 4 |
| Icons | lucide-react |
| Auth + DB | Supabase (`@supabase/supabase-js`) |
| Hosting (typical) | Vercel |

---

## Project structure

```
src/
  main.tsx                 # Entry
  Root.tsx                 # Auth gate → App
  app/App.tsx              # Screens, modals, planner state
  components/
    AuthScreen.tsx         # Sign in / sign up
    AccountMenu.tsx        # Account sheet
  hooks/useAuth.ts         # Session + sign in/up/out
  lib/
    supabase.ts            # Client from VITE_* env
    auth.ts                # Username ↔ email helpers
    plannerStorage.ts      # Cloud + local load/save
  styles/                  # Tailwind, theme, fonts
supabase/schema.sql        # planner_data table + RLS
WORKFLOW.md                # How to iterate and deploy
README.md                  # This file
```

---

## Setup (local)

### Prerequisites

- Node.js + npm
- A Supabase project

### Environment

1. Copy `.env.example` → `.env`
2. Set:

```env
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_or_publishable_key
```

3. In Supabase **SQL Editor**, run [`supabase/schema.sql`](supabase/schema.sql).
4. **Authentication → Providers → Email:** enable Email + sign ups; **disable Confirm email**.

### Run

```bash
npm install
npm run dev
```

Open http://localhost:5173

```bash
npm run build    # production build
npm run preview  # preview build
npm run dev:phone  # expose on LAN for same-Wi‑Fi phone testing
```

---

## Deploy (phone / anywhere)

1. Push the repo to GitHub.
2. Import on [Vercel](https://vercel.com); set the same two `VITE_*` env vars; deploy.
3. In Supabase **Authentication → URL configuration**, set Site URL / Redirect URLs to your Vercel URL.
4. Open the live URL on your phone → sign in → optional **Add to Home Screen**.

See [`WORKFLOW.md`](WORKFLOW.md) for the full day-to-day change → test → push → redeploy loop.

---

## Keeping this README updated

**Rule:** Whenever you add, remove, or change user-facing behavior, update this README in the same change (especially [Current functionality](#current-functionality) and [How the app works](#how-the-app-works) if the data model or sync behavior changes).

### What to update

| Change type | Update these sections |
|-------------|------------------------|
| New screen / tab / modal | Current functionality |
| New fields on events/tasks/etc. | Data model + relevant feature table |
| Auth / sync / storage | How the app works → Accounts & sync |
| New package or folder | Tech stack / Project structure |
| Setup or deploy steps | Setup / Deploy |

### For Cursor / AI sessions

A project rule (`.cursor/rules/update-readme.mdc`) reminds the agent to refresh this file when shipping new functionality. Human checklist after a feature:

```
[ ] Feature works on localhost
[ ] README "Current functionality" (and data model if needed) updated
[ ] Commit includes README.md
[ ] Push → verify on Vercel / phone
```

### Last major feature documented

- **Push Notification Subscription Management & Mobile UX Fixes** — added complete Web Push subscription flow in Account Settings. Users can now toggle push notifications ON, which triggers `Notification.requestPermission()`, creates a Push API subscription via Service Worker (`navigator.serviceWorker.ready` → `pushManager.subscribe()`), and saves the subscription (endpoint + keys) to the new `user_push_subscriptions` table in Supabase. If permission is denied (e.g., iOS blocking), an inline alert banner displays instructions to enable notifications in iPhone Settings, and the toggle resets to OFF. A "Send Test Notification" button appears when push is enabled for immediate testing. Fixed mobile navigation lock in Account Settings by adding a prominent back arrow button (←) in the top-left header, keeping the X close button in the top-right, and ensuring the backdrop overlay closes the modal. Added a bottom hint text: "Tap outside or use the back button to return to the app." The sticky bottom navigation bar remains accessible since the modal is a bottom sheet that doesn't cover the full screen.
- **Strong-style Workout Tracking & Historical Logging** — upgraded the workout tracking system to support mid-session editing. Users can now edit weight, reps, and set types (Normal, Warmup, Drop Set, Failure), delete sets, and reorder exercises while a workout is active. Added support for retroactive logging with custom Date and Time overrides, ensuring workouts appear correctly in history and calendar views regardless of when they are logged.
- **Calendar View refactor** — redesigned the Month grid so the day number is pinned to the **top-right** of each cell with a centered task-count pill + workload hours; grid cells auto-resize (`min-h` flex) to avoid clipping. Clicking any day opens a **Daily View** bottom sheet with a full 24-hour timeline that **auto-scrolls to 9:00 AM** (you can still scroll up to see 12 AM), plus a **Day Tasks** list. Added an **"Upcoming Events & Tasks"** feed below the grid with a chronological list of next occurrences (date tile, title, Event/Task badge, and "Today"/"Tomorrow"/"Aug 12" labels).
- **Floating dock bottom navigation** — converted the bottom bar into a compact, centered, floating dock: frosted-glass pill shell (`bg-slate-900/85 backdrop-blur-xl border-slate-800/80 shadow-2xl rounded-full`), 40px indigo-tinted account avatar with border, frosted pill-shaped current-tab selector (`px-5 py-2.5 bg-slate-800/80`), and a solid indigo + button with glow (`shadow-indigo-500/30`).
- **Calendar dark mode legibility fix** — Month view day numbers now use `text-slate-100` in dark mode (was hardcoded dark `#1C1917`), out-of-month/past days use `text-slate-600`, selected days use high-contrast `text-white` on an indigo fill, and busy/moderate/light workload cells use translucent tints (`bg-rose-500/20`, `bg-amber-500/20`, `bg-emerald-500/20`) so text stays readable in both themes.
- **Electric Cobalt & Midnight Navy theme system** — complete UI refactor to high-contrast modern theme with dynamic Light/Dark mode tokens (`--bg-primary`, `--card-bg`, `--text-primary`, `--accent-primary`), frosted glassmorphism on all cards, entity-specific accent colors (Events=Cobalt Blue, Tasks=Sky/Sapphire, Goals=Violet, Fitness=Crimson, Meals=Amber, Budget=Emerald), strict visual differentiation between events (solid time-blocks, no checkboxes), timed tasks (floating glass cards with circular checkboxes + due-time badges), and untimed tasks (collapsible "Due Today (Anytime)" section). Removed hardcoded colors in favor of dynamic `text-slate-900 dark:text-slate-50` / `text-slate-600 dark:text-slate-400` utilities for WCAG AA/AAA legibility.
- **Budget Highlights on Home Page** — added monthly budget overview to the Today screen showing total budget, spending, and remaining balance, plus per-category breakdown with progress bars and remaining/over budget indicators.
- **Home page layout refresh** — moved the Budget Highlights block to appear directly under "Today's Highlights" in the left column (previously in the right "Life Snapshot" column); made the budget block always visible even when no categories exist (shows a "No budget categories yet" empty state); removed the Quick Action Bar (quick new task/event/workout/meal buttons) that previously sat under Today's Highlights.
- **Dark mode card & text support** — workout, nutrition, and budget cards now properly switch to dark backgrounds (`dark:bg-stone-900/60`) with readable text (`dark:text-stone-100`/`dark:text-stone-400`) in dark mode across FitnessView, BudgetView, and the home page ExecutiveCommandCenter.
