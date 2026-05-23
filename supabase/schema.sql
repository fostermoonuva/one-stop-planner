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
