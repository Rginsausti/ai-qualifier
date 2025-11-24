-- Create nutrition_logs table
create table if not exists public.nutrition_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  name text not null,
  calories integer not null,
  protein integer default 0,
  carbs integer default 0,
  fats integer default 0,
  meal_type text, -- 'breakfast', 'lunch', 'dinner', 'snack'
  created_at timestamptz default now()
);

-- Create water_logs table
create table if not exists public.water_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  amount_ml integer not null,
  created_at timestamptz default now()
);

-- Add goals to user_profiles
alter table public.user_profiles 
add column if not exists protein_goal integer default 110,
add column if not exists carbs_goal integer default 220,
add column if not exists fats_goal integer default 65,
add column if not exists water_goal_ml integer default 2000;

-- Enable RLS for nutrition_logs
alter table public.nutrition_logs enable row level security;

create policy "Users can view their own nutrition logs"
  on public.nutrition_logs for select
  using (auth.uid() = user_id);

create policy "Users can insert their own nutrition logs"
  on public.nutrition_logs for insert
  with check (auth.uid() = user_id);

create policy "Users can delete their own nutrition logs"
  on public.nutrition_logs for delete
  using (auth.uid() = user_id);

-- Enable RLS for water_logs
alter table public.water_logs enable row level security;

create policy "Users can view their own water logs"
  on public.water_logs for select
  using (auth.uid() = user_id);

create policy "Users can insert their own water logs"
  on public.water_logs for insert
  with check (auth.uid() = user_id);

create policy "Users can delete their own water logs"
  on public.water_logs for delete
  using (auth.uid() = user_id);
