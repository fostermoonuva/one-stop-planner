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
| **Events** | Title, start/end date & time, optional repeat days, group, notes, **multiple notification times + computed alert timestamps** |
| **Tasks** | Title, due date/time, optional repeat, group, notes, done flag, **subtasks**, **alert option** |
| **Subtasks** | Title, optional due date, done flag (nested under a task) |
| **Meals** | Name, type (breakfast/lunch/dinner/snack), date/time, calories, protein/carbs/fat |
| **Workouts** | Name, date, start/end time, exercises with sets (weight, reps, done) |
| **Goals** | Title, days of week, amount + unit (times/minutes), group, **multiple notification times + computed alert timestamps** |
| **Goal logs** | Per goal + date when completed |
| **Groups** | Named color tags (School, Work, Personal, Fitness, Food, Wellness by default) |
| **Active workout** | In-progress session (name, start time, live exercises/sets, optional custom date/time override) |
| **Categories (global library)** | Name, color, type (expense/income), icon — master list of all budget categories available to assign to any month |
| **Monthly budget categories** | Month (YYYY-MM), category ID, allocated amount — links a global category to a specific month with its budget cap |
| **Budget transactions** | Category, amount, description, date, type (expense/income/transfer/credit_payment), account, payment method (debit/credit/cash), credit card paid status, flow type (spending/saving/investing/income), from/to account IDs for transfers and credit payments |
| **Accounts** | Name, type (checking/credit/cash/hysa/investment/savings), current balance |
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
| Dock buttons | 40px account avatar (forest green tint + border), pill-shaped current-tab selector (frosted dark pine), solid forest green + button with glow |
| Detail sheets | Tap an item to view, edit, delete, or toggle completion |
| Theme | **Forest Sage & Natural Slate** — high-contrast Light/Dark modes, frosted glassmorphism (`backdrop-blur-md`), WCAG AA/AAA legible text, Inter font |

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
| Grid styling | Day number pinned **top-right** of each cell; centered event-count badge + workload indicator dot |
| Auto-resizing cells | `min-h` flex cells grow so the date, event badge, and workload indicators never clip or overflow |
| Workload colors | Green → yellow → red based on **total scheduled hours** for the day (events + tasks with durations) |
| Legend | Light (≤2h) / Moderate (≤6h) / Busy (>6h) |
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
| **Month navigation** | Flip through current, previous, and future budget months with prev/next arrows |
| **Dynamic category allocation** | Create and customize budget categories on a month-to-month basis (e.g., add "Frat Dues" for August 2026 without forcing it onto September 2026) |
| **Global category master library** | Maintain a master list of all historical categories (e.g., "Car", "Utilities") so users can quickly re-add existing categories to any new month |
| **Automated surplus rollover engine** | Closed/past month net surpluses automatically carry forward as "Previous Surplus" incoming row items for the next month's starting available cash |
| **4-Pillar Financial Matrix** | Side-by-side comparison of Expected vs. Actual totals for Income, Spend (Expenses), Save (Tax Withholdings), and Invest (Portfolios) |
| **Monthly summary** | Income, expenses, net balance, daily spending rate, projected month total, and pace indicator (On Track / Near Limit / Over Budget) |
| **Multi-account management** | Add/manage multiple accounts (Checking, HYSA, Savings, Credit Cards, Cash, Investment) with live balance tracking and total liquid net worth |
| **Account balances** | Auto-updated based on transactions; color-coded by account type (Savings uses teal/emerald accent) |
| **Inter-account transfers** | Transfer money between accounts with dual From/To selectors, real-time balance updates on both accounts, and exclusion from monthly income/expense totals |
| **Transfer tagging** | Optionally tag transfers with sub-goals/categories (e.g., "Emergency Fund", "House Downpayment") for tracking intent without affecting expense roll-ups |
| **Transaction itemization** | Each budget category can contain an itemized sub-table of individual transactions (receipt roll-ups) with dynamic summation |
| **Transaction classifications** | Tag every line item by type: Spending, Saving, Investing, or Income with color-coded badges |
| **Payment method tagging** | Tag transactions as Debit Card, Credit Card, or Cash |
| **Credit card payment transactions** | Dedicated `credit_payment` transaction type with Pay From (liquid accounts) and Pay To (credit account) selectors. Payments reduce liquid account balance and increase credit card balance (moving toward $0). Credit card balances tracked as negative numbers and excluded from liquid net worth |
| **Credit card reconciliation** | Track individual Credit Card charges in a dedicated ledger, mark as Paid/Cleared or Pending |
| **Credit utilization guardrails** | Track total Credit Limit and display real-time 10% Credit Utilization alerts with customizable thresholds |
| **Category group sets** | Save category templates and apply them to future months for quick budget setup |
| **Progress bars** | Visual spending progress per category (red when over cap) |
| **Over-spending warnings** | Automatic flags for categories exceeding their budget, displayed prominently mid-month |
| **Wealth projections (Outlook model)** | Interactive 1/3/5/10-year net worth projections with compound growth, customizable liquid/investment growth rates |
| **Income milestones** | Support scheduled salary step-ups mapped to future calendar dates (e.g., stipend increases) |
| **Expense escalation models** | Support variable inflation/escalation rate inputs for future Insurance, Living, Food, and Vehicle costs |
| **Real-time savings rate tracker** | Calculate total net surplus ratio and display overall Savings Rate percentage |
| **Budget metadata & audit** | Display Last Updated timestamps (e.g., "Last Update: 7/31/26") and status flags on main summary cards |
| **Delete** | Remove categories from a month, delete transactions, delete accounts, and manage category templates |
| **Step-by-step transaction entry** | Two-step workflow for adding transactions: Step 1 presents 4 visual type selectors (Expense, Income, Transfer, Credit Payment) with icons and descriptions; Step 2 shows a tailored form based on the selected type. Expense form shows Account + Category selectors (no payment method dropdown). Income form shows Destination Account + Category. Transfer form shows Transfer From/To account selectors with optional category tagging. Credit Payment form shows Pay From (liquid accounts only) and Pay To (credit accounts only) selectors. Modal is fully scrollable with `max-h-[85vh]` viewport support and auto-closes after submission. |
| **Account type restrictions** | Income transactions: Destination Account dropdown filters to liquid accounts only (checking, savings, HYSA, cash). Transfer transactions: From and To account dropdowns exclude credit cards. Expense transactions: All accounts available. Credit Payment transactions: Pay From shows liquid accounts only, Pay To shows credit accounts only. |
| **Negative balance warnings** | Liquid accounts (checking, savings, HYSA, cash) that drop below $0 display prominent warning indicators: red alert banner in the main budget view listing all negative accounts, red outline + AlertTriangle icon on account cards in the Accounts Summary section, and an inline warning banner in the Account Details modal stating "Warning: Account balance is under $0." |

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
| **Event alerts** | Multi-select chip list: At time of event, 15/30 minutes before, 1 hour before, 1 day before, Custom (minutes) — multiple triggers can be selected simultaneously |
| **Task alerts** | Dropdown selector: None, At due time, 15 mins before, 1 hour before, 9:00 AM on due date |
| **Goal alerts** | Multi-select chip list (same options as events) for scheduling multiple reminder triggers per goal |
| **Goal daily reminders** | Time picker for daily check-in reminder (e.g., "Remind me daily at 8:00 PM") |
| **Budget alerts** | Toggle switches for 80% category limit warnings and upcoming recurring bill reminders (1 day before) |
| **Per-item overrides** | When creating/editing events or goals, the "Remind Me" multi-select pre-fills from your saved/default settings but can be toggled on/off per item |
| **Scheduled push queue** | Alert notifications are stored in `alert_notifications` table with computed `alert_timestamp` |
| **Background delivery** | Vercel Cron job runs every 5 minutes to query due alerts (`sent = false` AND `alert_timestamp` within the current 1-minute window) and sends Web Push notifications to active subscriptions |
| **Context-aware notification payloads** | Push titles/bodies are built per entity type: Events → `"Upcoming Event: {title}"` / `"Starts at {startTime} ({alertTimingText})"`, Goals → `"Goal Reminder: {title}"` / `"Time to check in on your goal!"`, Tasks → `"Task Due: {title}"` / `"Due at {dueTime}"` |
| **Duplicate prevention** | Alerts are only selected within a narrow `[now, now + 1 minute]` window, and each alert is immediately marked `sent = true` after successful dispatch so subsequent cron pings ignore it |
| **Scheduled dispatcher API** | `api/send-scheduled-notifications.ts` — on-demand serverless route that queries due, un-sent alerts from `alert_notifications` and dispatches context-aware Web Push payloads via `web-push` to the user's active subscriptions (`user_push_subscriptions` where `enabled = true`). Expired endpoints (HTTP 404/410) are automatically deleted. Returns `{ success, notificationsSent, timestamp }` |
| **Deep linking** | Push notifications include deep-link destination URLs to open the relevant item in the app |
| **Push subscription management** | Users can enable/disable push notifications in Account Settings with a toggle switch. Tapping the toggle requests browser permission (`Notification.requestPermission()`), creates a Push API subscription via Service Worker, and saves the subscription endpoint + keys to the `user_push_subscriptions` table in Supabase |
| **iOS synchronous gesture handling** | On iOS, `Notification.requestPermission()` and `pushManager.subscribe()` execute synchronously inside the click handler before any async backend queries, so the toggle works from the Home Screen shortcut. The service worker (`/sw.js`) is registered at app load and cached for immediate use |
| **VAPID key validation** | The VAPID public key is read from `VITE_VAPID_PUBLIC_KEY`. If missing, an explicit error toast displays: "Configuration Error: VAPID Public Key missing" |
| **Success toast** | After a successful subscription, a green toast displays: "Notifications enabled & subscribed!" and the toggle switches to ON |
| **iOS permission handling** | If permission is denied (common on iOS), an inline alert banner displays: "Notifications blocked by iOS. Please go to iPhone Settings > One Stop Planner > Notifications and allow notifications." The toggle resets to OFF so it doesn't stay falsely checked |
| **Test notification button** | When push is enabled, a "Send Test Notification" button appears to immediately verify that push banners display on the device |
| **Diagnostic error toasts** | When enabling push notifications fails, the error banner surfaces the exact thrown exception details (prefixed with "Push Error:") instead of a generic fallback message. The subscription helpers in `pushNotifications.ts` wrap failures with the specific operation name (e.g., `subscribeToPush failed:`, `savePushSubscription failed:`, `removePushSubscription failed:`) plus the underlying error message or serialized error object, so the root cause is visible in the UI |
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
VITE_VAPID_PUBLIC_KEY=your_vapid_public_key_here
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

- **Multiple Scheduled Notification Times for Events & Goals** — Events and Goals now support multiple alert triggers per item. The single "Remind Me" dropdown was replaced with a multi-select chip list (At time of event, 15/30 minutes before, 1 hour before, 1 day before, Custom minutes). Each selected option stores a `notificationTimes: string[]` array and a computed `alertTimestamps: string[]` array on the item so the backend cron handler can process each trigger independently. Edit mode pre-populates the checkboxes with the item's saved notification times, and legacy single `alertOption` values migrate automatically to arrays on load.
- **Context-Aware Notification Titles & Duplicate Prevention** — Push notifications now display entity-specific titles and bodies: Events show `"Upcoming Event: {title}"` with `"Starts at {startTime} ({alertTimingText})"`, Goals show `"Goal Reminder: {title}"` with `"Time to check in on your goal!"`, and Tasks show `"Task Due: {title}"` with `"Due at {dueTime}"`. Both `api/send-scheduled-notifications.ts` and the Vercel cron handler (`api/cron/send-alerts.js`) now query due alerts within a narrow `[now, now + 1 minute]` window, mark alerts as `sent = true` immediately after dispatch, and the cron schedule runs every 5 minutes (`*/5 * * * *`) so alerts fire exactly once without repeating on subsequent pings.
- **Scheduled Notification Dispatcher API** — added `api/send-scheduled-notifications.ts`, a serverless route that queries active Web Push subscriptions from the `user_push_subscriptions` table and dispatches a scheduled "upcoming items due" notification payload to each endpoint using `web-push`. Expired subscriptions (HTTP 404/410) are cleaned up automatically. Requires server-side env vars `SUPABASE_SERVICE_ROLE_KEY` and `VAPID_PRIVATE_KEY` (documented in `.env.example`). New dependencies: `web-push`, `@types/web-push`, and `@vercel/node`.
- **Diagnostic Push Failure Toasts** — push notification failures now surface the exact thrown exception details in the Account Settings error banner. The `handlePushToggle` catch block in `AccountMenu.tsx` builds a "Push Error: …" message from the thrown value (string, `error.message`, or serialized object). The subscription helpers in `pushNotifications.ts` wrap failures with the specific operation name (e.g., `subscribeToPush failed:`, `savePushSubscription failed:`, `removePushSubscription failed:`, `sendTestNotification failed:`) plus the underlying error detail, so the root cause is visible in the UI instead of a generic fallback string.
- **iOS Push Notification Subscription Fix** — fixed the "Granted but Not Subscribed" toggle bug on iOS PWAs. `Notification.requestPermission()` and `pushManager.subscribe()` now execute synchronously inside the click handler before any async backend queries, so tapping the toggle from the iOS Home Screen shortcut registers a valid Web Push subscription. The service worker (`/sw.js`) is registered at app load and cached for immediate use. The VAPID public key is read from `VITE_VAPID_PUBLIC_KEY` with an explicit "Configuration Error: VAPID Public Key missing" toast if absent. Successful subscriptions show a "Notifications enabled & subscribed!" toast and save the endpoint + keys to `user_push_subscriptions` in Supabase. Subscription failures surface descriptive error toasts instead of failing silently.
- **Account Detail Drill-Down & Transaction Editing** — added account detail modal accessible by clicking any account card in the budget view. The modal displays account name, type, current balance, and credit limit (if applicable), along with a filtered ledger of all transactions associated with that account (income, expenses, transfers, and credit payments). Includes an Edit Account button to update account name. Added click-to-edit functionality for transactions: clicking any transaction in the main transaction history opens an Edit/Delete Transaction modal where users can modify amount, description, and date. Deleting or updating a transaction invokes balance reversal math to maintain accurate account balances across all affected accounts. Removed receipt attachment/itemized receipt scanning feature from transaction details.
- **Account Dropdown Restrictions & Negative Balance Warnings** — enforced strict account type filtering in the Add Transaction modal based on flow type: Income destination accounts filter to liquid accounts only (checking, savings, HYSA, cash); Transfer From/To dropdowns exclude credit cards; Credit Payment forms show liquid accounts in Pay From and credit accounts only in Pay To. Added negative balance warning system for liquid accounts: red alert banner in the main budget view listing all accounts below $0, red outline with AlertTriangle icon on account cards, and inline warning banner in the Account Details modal. Transactions process successfully regardless of account balance (including $0 or negative starting balances).
- **Credit Card Payment Transactions & Account Mechanics** — added a new `credit_payment` transaction type for paying down credit card debt. When selected, the form shows **Pay From** (liquid accounts: Checking, Savings, Cash) and **Pay To (Credit Account)** selectors, filtering out credit cards from the source and showing only credit accounts as the destination. Executing a $100 credit payment reduces the source liquid account by $100 and increases the credit card balance by $100 (moving it toward $0). Credit card balances are tracked as negative numbers (e.g., -$100 means $100 of debt), and credit limits are stored as negative values (e.g., -$1,000). Credit card balances are excluded from liquid net worth calculations. When an expense is charged to a credit card account, the balance becomes more negative (increasing debt) without affecting liquid accounts. Deleting a credit payment transaction automatically reverses the operation, restoring both account balances. Credit utilization alerts display when usage exceeds customizable thresholds.
- **Global Category Pool & Month-Specific Category Scoping** — refactored the Budget page category system to use a two-tier architecture. Users now maintain a master library of budget categories (e.g., "Car", "Groceries", "Gym") that persists across all months. Each month maintains its own set of active category assignments with allocated budget amounts via the new `monthly_budget_categories` table. Users can add or remove categories from individual months without deleting them from the global library or affecting past/future months. Added a "Manage Categories" modal (Settings icon) that allows creating new global categories, adding existing categories to the current month, setting budget amounts, and removing categories from the current month. Database schema updated with new `categories` (global library) and `monthly_budget_categories` (month-scoped allocations) tables with proper RLS policies.
- **Calendar Busy Indicator Based on Scheduled Hours** — updated the Month view workload indicator (green/yellow/red traffic light) to calculate busyness based on total active scheduled hours/duration for the day rather than item count. Events contribute their actual start/end time duration (defaulting to 1 hour if times are identical), while timed tasks contribute 30 minutes each. Thresholds: Light (≤2h), Moderate (≤6h), Busy (>6h). The visible badge on calendar day tiles remains as the count of total events for that day.
- **Push Notification Subscription Management & Mobile UX Fixes** — added complete Web Push subscription flow in Account Settings. Users can now toggle push notifications ON, which triggers `Notification.requestPermission()`, creates a Push API subscription via Service Worker (`navigator.serviceWorker.ready` → `pushManager.subscribe()`), and saves the subscription (endpoint + keys) to the new `user_push_subscriptions` table in Supabase. If permission is denied (e.g., iOS blocking), an inline alert banner displays instructions to enable notifications in iPhone Settings, and the toggle resets to OFF. A "Send Test Notification" button appears when push is enabled for immediate testing. Fixed mobile navigation lock in Account Settings by adding a prominent back arrow button (←) in the top-left header, keeping the X close button in the top-right, and ensuring the backdrop overlay closes the modal. Added a bottom hint text: "Tap outside or use the back button to return to the app." The sticky bottom navigation bar remains accessible since the modal is a bottom sheet that doesn't cover the full screen.
- **Strong-style Workout Tracking & Historical Logging** — upgraded the workout tracking system to support mid-session editing. Users can now edit weight, reps, and set types (Normal, Warmup, Drop Set, Failure), delete sets, and reorder exercises while a workout is active. Added support for retroactive logging with custom Date and Time overrides, ensuring workouts appear correctly in history and calendar views regardless of when they were logged.
- **Calendar View refactor** — redesigned the Month grid so the day number is pinned to the **top-right** of each cell with a centered task-count pill + workload hours; grid cells auto-resize (`min-h` flex) to avoid clipping. Clicking any day opens a **Daily View** bottom sheet with a full 24-hour timeline that **auto-scrolls to 9:00 AM** (you can still scroll up to see 12 AM), plus a **Day Tasks** list. Added an **"Upcoming Events & Tasks"** feed below the grid with a chronological list of next occurrences (date tile, title, Event/Task badge, and "Today"/"Tomorrow"/"Aug 12" labels).
- **Floating dock bottom navigation** — converted the bottom bar into a compact, centered, floating dock: frosted-glass pill shell (`bg-slate-900/85 backdrop-blur-xl border-slate-800/80 shadow-2xl rounded-full`), 40px indigo-tinted account avatar with border, frosted pill-shaped current-tab selector (`px-5 py-2.5 bg-slate-800/80`), and a solid indigo + button with glow (`shadow-indigo-500/30`).
- **Calendar dark mode legibility fix** — Month view day numbers now use `text-slate-100` in dark mode (was hardcoded dark `#1C1917`), out-of-month/past days use `text-slate-600`, selected days use high-contrast `text-white` on an indigo fill, and busy/moderate/light workload cells use translucent tints (`bg-rose-500/20`, `bg-amber-500/20`, `bg-emerald-500/20`) so text stays readable in both themes.
- **Forest Sage & Natural Slate theme system** — complete UI refactor to an organic forest palette with dynamic Light/Dark mode tokens (`--bg-primary`, `--card-bg`, `--text-primary`, `--accent-primary`). Light mode uses Warm Off-White (`#FAF8F5`) with translucent white glass cards, Deep Forest Charcoal text (`#1C2421`), Soft Sage Grey subtext (`#52605B`), and Deep Forest Green accents (`#2D5A27`). Dark mode uses Deep Pine Obsidian (`#0E1412`) with translucent dark forest glass cards, Soft Crisp Green-White text (`#F0F4F2`), Muted Sage Green subtext, and Vibrant Spring Green accents (`#4ADE80`). Entity accents updated: Events=Deep Forest Green, Tasks/Goals=Natural Slate, Fitness/Meals=Warm Amber, Budget=Emerald. Form inputs use white backgrounds with sage borders in light mode and dark pine with green-tinted borders in dark mode. Removed hardcoded slate/grey colors in favor of dynamic theme tokens for WCAG AA/AAA legibility.
- **Budget Highlights on Home Page** — added monthly budget overview to the Today screen showing total budget, spending, and remaining balance, plus per-category breakdown with progress bars and remaining/over budget indicators.
- **Home page layout refresh** — moved the Budget Highlights block to appear directly under "Today's Highlights" in the left column (previously in the right "Life Snapshot" column); made the budget block always visible even when no categories exist (shows a "No budget categories yet" empty state); removed the Quick Action Bar (quick new task/event/workout/meal buttons) that previously sat under Today's Highlights.
- **Dark mode card & text support** — workout, nutrition, and budget cards now properly switch to dark backgrounds (`dark:bg-stone-900/60`) with readable text (`dark:text-stone-100`/`dark:text-stone-400`) in dark mode across FitnessView, BudgetView, and the home page ExecutiveCommandCenter.