-- Create quick_logs table to store user daily check-ins
create table if not exists public.quick_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  energy text, -- 'high', 'medium', 'low'
  hunger integer, -- 1-5
  craving text, -- 'sweet', 'savory', 'fresh'
  notes text,
  created_at timestamptz default now()
);

-- Enable RLS
alter table public.quick_logs enable row level security;

-- Policies
create policy "Users can view their own logs"
  on public.quick_logs for select
  using (auth.uid() = user_id);

create policy "Users can insert their own logs"
  on public.quick_logs for insert
  with check (auth.uid() = user_id);
