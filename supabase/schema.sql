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

-- ─── Push Notification Subscriptions ─────────────────────────────────────────

-- Stores push notification subscriptions for Web Push API
create table if not exists public.user_push_subscriptions (
  user_id uuid primary key references auth.users (id) on delete cascade,
  
  -- Push subscription details
  endpoint text not null,
  keys jsonb not null,
  
  -- Whether push notifications are enabled for this user
  enabled boolean not null default true,
  
  -- When the subscription was created/last updated
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.user_push_subscriptions enable row level security;

drop policy if exists "push_subscriptions_select_own" on public.user_push_subscriptions;
drop policy if exists "push_subscriptions_insert_own" on public.user_push_subscriptions;
drop policy if exists "push_subscriptions_update_own" on public.user_push_subscriptions;
drop policy if exists "push_subscriptions_delete_own" on public.user_push_subscriptions;

create policy "push_subscriptions_select_own"
  on public.user_push_subscriptions for select
  using (auth.uid() = user_id);

create policy "push_subscriptions_insert_own"
  on public.user_push_subscriptions for insert
  with check (auth.uid() = user_id);

create policy "push_subscriptions_update_own"
  on public.user_push_subscriptions for update
  using (auth.uid() = user_id);

create policy "push_subscriptions_delete_own"
  on public.user_push_subscriptions for delete
  using (auth.uid() = user_id);

-- Index for querying active subscriptions
create index if not exists idx_user_push_subscriptions_enabled
  on public.user_push_subscriptions (user_id, enabled)
  where enabled = true;

-- ─── Budget Categories (Global Master Library) ─────────────────────────────────

-- Master category library - categories exist globally and can be assigned to any month
create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  
  -- Category details
  name text not null,
  icon text,
  color text not null,
  type text not null default 'expense' check (type in ('expense', 'income')),
  
  -- Timestamps
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  
  -- Ensure unique category names per user
  unique(user_id, name)
);

alter table public.categories enable row level security;

drop policy if exists "categories_select_own" on public.categories;
drop policy if exists "categories_insert_own" on public.categories;
drop policy if exists "categories_update_own" on public.categories;
drop policy if exists "categories_delete_own" on public.categories;

create policy "categories_select_own"
  on public.categories for select
  using (auth.uid() = user_id);

create policy "categories_insert_own"
  on public.categories for insert
  with check (auth.uid() = user_id);

create policy "categories_update_own"
  on public.categories for update
  using (auth.uid() = user_id);

create policy "categories_delete_own"
  on public.categories for delete
  using (auth.uid() = user_id);

-- Index for efficient querying of user's categories
create index if not exists idx_categories_user_id
  on public.categories (user_id);

-- ─── Monthly Budget Categories (Month-Scoped Allocations) ─────────────────────

-- Junction table linking categories to specific months with allocated amounts
create table if not exists public.monthly_budget_categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  
  -- Month identifier (format: "YYYY-MM")
  month text not null,
  
  -- Reference to the global category
  category_id uuid not null references public.categories (id) on delete cascade,
  
  -- Budget allocation for this category in this month
  allocated_amount numeric(10,2) not null default 0,
  
  -- Timestamps
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  
  -- Ensure a category can only be assigned once per month per user
  unique(user_id, month, category_id)
);

alter table public.monthly_budget_categories enable row level security;

drop policy if exists "monthly_budget_categories_select_own" on public.monthly_budget_categories;
drop policy if exists "monthly_budget_categories_insert_own" on public.monthly_budget_categories;
drop policy if exists "monthly_budget_categories_update_own" on public.monthly_budget_categories;
drop policy if exists "monthly_budget_categories_delete_own" on public.monthly_budget_categories;

create policy "monthly_budget_categories_select_own"
  on public.monthly_budget_categories for select
  using (auth.uid() = user_id);

create policy "monthly_budget_categories_insert_own"
  on public.monthly_budget_categories for insert
  with check (auth.uid() = user_id);

create policy "monthly_budget_categories_update_own"
  on public.monthly_budget_categories for update
  using (auth.uid() = user_id);

create policy "monthly_budget_categories_delete_own"
  on public.monthly_budget_categories for delete
  using (auth.uid() = user_id);

-- Index for efficient querying of categories by month
create index if not exists idx_monthly_budget_categories_user_month
  on public.monthly_budget_categories (user_id, month);

-- Index for efficient querying by category
create index if not exists idx_monthly_budget_categories_category_id
  on public.monthly_budget_categories (category_id);

-- ─── Budget Transactions ──────────────────────────────────────────────────────

-- Individual budget transactions
create table if not exists public.budget_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  
  -- Transaction details
  category_id uuid references public.categories (id) on delete cascade,
  amount numeric(10,2) not null,
  description text,
  date date not null,
  type text not null check (type in ('expense', 'income', 'transfer')),
  
  -- Account and payment
  account_id uuid references public.accounts (id) on delete cascade,
  from_account_id uuid references public.accounts (id) on delete cascade,
  to_account_id uuid references public.accounts (id) on delete cascade,
  payment_method text check (payment_method in ('debit', 'credit', 'cash')),
  is_credit_paid boolean not null default false,
  
  -- Flow type classification
  flow_type text not null default 'spending' check (flow_type in ('spending', 'saving', 'investing', 'income')),
  
  -- Timestamps
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  
  -- Ensure transfer accounts are different
  constraint chk_transfer_accounts_differ check (
    type <> 'transfer' OR (from_account_id IS NOT NULL AND to_account_id IS NOT NULL AND from_account_id <> to_account_id)
  )
);

alter table public.budget_transactions enable row level security;

drop policy if exists "budget_transactions_select_own" on public.budget_transactions;
drop policy if exists "budget_transactions_insert_own" on public.budget_transactions;
drop policy if exists "budget_transactions_update_own" on public.budget_transactions;
drop policy if exists "budget_transactions_delete_own" on public.budget_transactions;

create policy "budget_transactions_select_own"
  on public.budget_transactions for select
  using (auth.uid() = user_id);

create policy "budget_transactions_insert_own"
  on public.budget_transactions for insert
  with check (auth.uid() = user_id);

create policy "budget_transactions_update_own"
  on public.budget_transactions for update
  using (auth.uid() = user_id);

create policy "budget_transactions_delete_own"
  on public.budget_transactions for delete
  using (auth.uid() = user_id);

-- Indexes for efficient querying
create index if not exists idx_budget_transactions_user_id
  on public.budget_transactions (user_id);

create index if not exists idx_budget_transactions_date
  on public.budget_transactions (user_id, date);

create index if not exists idx_budget_transactions_category
  on public.budget_transactions (user_id, category_id);

-- Index for transfer queries
create index if not exists idx_budget_transactions_from_account
  on public.budget_transactions (user_id, from_account_id)
  where type = 'transfer';

create index if not exists idx_budget_transactions_to_account
  on public.budget_transactions (user_id, to_account_id)
  where type = 'transfer';

-- ─── Transaction Items (Receipt Line Items) ────────────────────────────────────

-- Itemized transactions within a budget transaction (for receipt roll-ups)
create table if not exists public.transaction_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  
  -- Parent transaction
  transaction_id uuid not null references public.budget_transactions (id) on delete cascade,
  
  -- Item details
  description text not null,
  amount numeric(10,2) not null,
  flow_type text not null default 'spending' check (flow_type in ('spending', 'saving', 'investing', 'income')),
  
  -- Timestamps
  created_at timestamptz not null default now()
);

alter table public.transaction_items enable row level security;

drop policy if exists "transaction_items_select_own" on public.transaction_items;
drop policy if exists "transaction_items_insert_own" on public.transaction_items;
drop policy if exists "transaction_items_update_own" on public.transaction_items;
drop policy if exists "transaction_items_delete_own" on public.transaction_items;

create policy "transaction_items_select_own"
  on public.transaction_items for select
  using (auth.uid() = user_id);

create policy "transaction_items_insert_own"
  on public.transaction_items for insert
  with check (auth.uid() = user_id);

create policy "transaction_items_update_own"
  on public.transaction_items for update
  using (auth.uid() = user_id);

create policy "transaction_items_delete_own"
  on public.transaction_items for delete
  using (auth.uid() = user_id);

-- Index for efficient querying of items by transaction
create index if not exists idx_transaction_items_transaction_id
  on public.transaction_items (transaction_id);

-- ─── Accounts ─────────────────────────────────────────────────────────────────

-- Financial accounts (checking, savings, credit cards, investments)
create table if not exists public.accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  
  -- Account details
  name text not null,
  type text not null check (type in ('checking', 'credit', 'cash', 'hysa', 'investment', 'savings')),
  current_balance numeric(12,2) not null default 0,
  
  -- Credit card specific fields
  credit_limit numeric(10,2),
  credit_utilization_alert_threshold numeric(5,2) not null default 10.00, -- percentage
  
  -- Timestamps
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.accounts enable row level security;

drop policy if exists "accounts_select_own" on public.accounts;
drop policy if exists "accounts_insert_own" on public.accounts;
drop policy if exists "accounts_update_own" on public.accounts;
drop policy if exists "accounts_delete_own" on public.accounts;

create policy "accounts_select_own"
  on public.accounts for select
  using (auth.uid() = user_id);

create policy "accounts_insert_own"
  on public.accounts for insert
  with check (auth.uid() = user_id);

create policy "accounts_update_own"
  on public.accounts for update
  using (auth.uid() = user_id);

create policy "accounts_delete_own"
  on public.accounts for delete
  using (auth.uid() = user_id);

-- Index for efficient querying
create index if not exists idx_accounts_user_id
  on public.accounts (user_id);

-- ─── Category Group Sets ──────────────────────────────────────────────────────

-- Saved category group templates
create table if not exists public.category_group_sets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  
  -- Template details
  name text not null,
  categories jsonb not null, -- Array of {name, color, monthlyCap}
  
  -- Timestamps
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.category_group_sets enable row level security;

drop policy if exists "category_group_sets_select_own" on public.category_group_sets;
drop policy if exists "category_group_sets_insert_own" on public.category_group_sets;
drop policy if exists "category_group_sets_update_own" on public.category_group_sets;
drop policy if exists "category_group_sets_delete_own" on public.category_group_sets;

create policy "category_group_sets_select_own"
  on public.category_group_sets for select
  using (auth.uid() = user_id);

create policy "category_group_sets_insert_own"
  on public.category_group_sets for insert
  with check (auth.uid() = user_id);

create policy "category_group_sets_update_own"
  on public.category_group_sets for update
  using (auth.uid() = user_id);

create policy "category_group_sets_delete_own"
  on public.category_group_sets for delete
  using (auth.uid() = user_id);

-- Index for efficient querying
create index if not exists idx_category_group_sets_user_id
  on public.category_group_sets (user_id);

-- ─── Outlook Projections (Long-term Financial Engine) ─────────────────────────

-- Long-term wealth projection parameters and milestones
create table if not exists public.outlook_projections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  
  -- Income milestones (salary step-ups)
  income_milestones jsonb not null default '[]'::jsonb, -- Array of {date: "YYYY-MM", amount: number}
  
  -- Expense escalation rates (annual inflation assumptions)
  expense_escalation_rates jsonb not null default '{}'::jsonb, -- Object mapping category names to annual rate (e.g., {"Insurance": 0.05, "Food": 0.03})
  
  -- Growth assumptions
  liquid_growth_rate numeric(5,2) not null default 4.00, -- percentage
  investment_growth_rate numeric(5,2) not null default 8.00, -- percentage
  
  -- Timestamps
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.outlook_projections enable row level security;

drop policy if exists "outlook_projections_select_own" on public.outlook_projections;
drop policy if exists "outlook_projections_insert_own" on public.outlook_projections;
drop policy if exists "outlook_projections_update_own" on public.outlook_projections;
drop policy if exists "outlook_projections_delete_own" on public.outlook_projections;

create policy "outlook_projections_select_own"
  on public.outlook_projections for select
  using (auth.uid() = user_id);

create policy "outlook_projections_insert_own"
  on public.outlook_projections for insert
  with check (auth.uid() = user_id);

create policy "outlook_projections_update_own"
  on public.outlook_projections for update
  using (auth.uid() = user_id);

create policy "outlook_projections_delete_own"
  on public.outlook_projections for delete
  using (auth.uid() = user_id);

-- Index
create index if not exists idx_outlook_projections_user_id
  on public.outlook_projections (user_id);

-- ─── Budget Metadata (Last Updated Timestamps) ────────────────────────────────

-- Track when budgets were last updated for audit purposes
create table if not exists public.budget_metadata (
  user_id uuid primary key references auth.users (id) on delete cascade,
  
  -- Last update timestamp for each month
  last_updated_by_month jsonb not null default '{}'::jsonb, -- Object mapping "YYYY-MM" to ISO timestamp
  
  -- Overall budget last updated
  last_budget_update timestamptz not null default now(),
  
  -- Timestamps
  updated_at timestamptz not null default now()
);

alter table public.budget_metadata enable row level security;

drop policy if exists "budget_metadata_select_own" on public.budget_metadata;
drop policy if exists "budget_metadata_insert_own" on public.budget_metadata;
drop policy if exists "budget_metadata_update_own" on public.budget_metadata;

create policy "budget_metadata_select_own"
  on public.budget_metadata for select
  using (auth.uid() = user_id);

create policy "budget_metadata_insert_own"
  on public.budget_metadata for insert
  with check (auth.uid() = user_id);

create policy "budget_metadata_update_own"
  on public.budget_metadata for update
  using (auth.uid() = user_id);

-- ─── Surplus Carryover Tracking ───────────────────────────────────────────────

-- Track month-to-month surplus carryovers
create table if not exists public.surplus_carryovers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  
  -- Month details
  from_month text not null, -- "YYYY-MM"
  to_month text not null, -- "YYYY-MM"
  amount numeric(10,2) not null,
  
  -- Status
  applied boolean not null default false,
  applied_at timestamptz,
  
  -- Timestamps
  created_at timestamptz not null default now()
);

alter table public.surplus_carryovers enable row level security;

drop policy if exists "surplus_carryovers_select_own" on public.surplus_carryovers;
drop policy if exists "surplus_carryovers_insert_own" on public.surplus_carryovers;
drop policy if exists "surplus_carryovers_update_own" on public.surplus_carryovers;

create policy "surplus_carryovers_select_own"
  on public.surplus_carryovers for select
  using (auth.uid() = user_id);

create policy "surplus_carryovers_insert_own"
  on public.surplus_carryovers for insert
  with check (auth.uid() = user_id);

create policy "surplus_carryovers_update_own"
  on public.surplus_carryovers for update
  using (auth.uid() = user_id);

-- Index for efficient querying
create index if not exists idx_surplus_carryovers_user_months
  on public.surplus_carryovers (user_id, from_month, to_month);