-- Run this in Supabase: SQL Editor → New query → Run
-- Dashboard: https://supabase.com/dashboard/project/_/sql

create table if not exists public.planner_data (
  user_id uuid primary key references auth.users (id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.planner_data enable row level security;

drop policy if exists "planner_select_own" on public.planner_data;
drop policy if exists "planner_insert_own" on public.planner_data;
drop policy if exists "planner_update_own" on public.planner_data;

create policy "planner_select_own"
  on public.planner_data for select
  using (auth.uid() = user_id);

create policy "planner_insert_own"
  on public.planner_data for insert
  with check (auth.uid() = user_id);

create policy "planner_update_own"
  on public.planner_data for update
  using (auth.uid() = user_id);

-- ─── Notification Settings ────────────────────────────────────────────────────

-- Default notification preferences per user
create table if not exists public.user_notification_settings (
  user_id uuid primary key references auth.users (id) on delete cascade,
  
  -- Event alert defaults (stored as text: 'none', 'at_time', '5min', '15min', '30min', '1hour', '1day')
  event_default_alert text not null default '15min',
  
  -- Task alert defaults (stored as text: 'none', 'at_due', '15min', '1hour', '9am_due_date')
  task_default_alert text not null default '15min',
  
  -- Goal/habit daily check-in reminder time (HH:MM format, e.g., "20:00")
  goal_daily_reminder_time text,
  
  -- Budget alert toggles
  budget_alert_80_percent boolean not null default true,
  budget_alert_upcoming_bills boolean not null default true,
  
  updated_at timestamptz not null default now()
);

alter table public.user_notification_settings enable row level security;

drop policy if exists "notification_settings_select_own" on public.user_notification_settings;
drop policy if exists "notification_settings_insert_own" on public.user_notification_settings;
drop policy if exists "notification_settings_update_own" on public.user_notification_settings;

create policy "notification_settings_select_own"
  on public.user_notification_settings for select
  using (auth.uid() = user_id);

create policy "notification_settings_insert_own"
  on public.user_notification_settings for insert
  with check (auth.uid() = user_id);

create policy "notification_settings_update_own"
  on public.user_notification_settings for update
  using (auth.uid() = user_id);

-- Scheduled alert notifications queue
create table if not exists public.alert_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  
  -- What type of item triggered this alert
  item_type text not null check (item_type in ('event', 'task', 'goal', 'budget')),
  item_id text not null,
  
  -- When the alert should fire
  alert_timestamp timestamptz not null,
  
  -- Push notification content
  title text not null,
  body text not null,
  deep_link text not null,
  
  -- Delivery status
  sent boolean not null default false,
  sent_at timestamptz,
  error text,
  
  created_at timestamptz not null default now()
);

alter table public.alert_notifications enable row level security;

drop policy if exists "alert_notifications_select_own" on public.alert_notifications;
drop policy if exists "alert_notifications_insert_own" on public.alert_notifications;
drop policy if exists "alert_notifications_update_own" on public.alert_notifications;

create policy "alert_notifications_select_own"
  on public.alert_notifications for select
  using (auth.uid() = user_id);

create policy "alert_notifications_insert_own"
  on public.alert_notifications for insert
  with check (auth.uid() = user_id);

create policy "alert_notifications_update_own"
  on public.alert_notifications for update
  using (auth.uid() = user_id);

-- Index for efficient querying of pending alerts
create index if not exists idx_alert_notifications_pending
  on public.alert_notifications (user_id, alert_timestamp)
  where sent = false;

-- Index for cleaning up old sent alerts
create index if not exists idx_alert_notifications_cleanup
  on public.alert_notifications (sent, created_at);
