-- Create daily_plans table to store AI-generated daily insights
create table if not exists public.daily_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  date date not null default current_date,
  content jsonb not null,
  created_at timestamptz default now(),
  unique(user_id, date)
);

-- Enable RLS
alter table public.daily_plans enable row level security;

-- Policies
create policy "Users can view their own daily plans"
  on public.daily_plans for select
  using (auth.uid() = user_id);

create policy "Service role can manage all daily plans"
  on public.daily_plans for all
  using (true)
  with check (true);
