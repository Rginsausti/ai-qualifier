-- Create user_profiles table to store onboarding data
create table if not exists public.user_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade unique,
  goals text[] default '{}',
  weight numeric,
  height numeric,
  unit_system text default 'metric',
  allergens text[] default '{}',
  intolerances text[] default '{}',
  lifestyle text,
  therapeutic text[] default '{}',
  cultural text[] default '{}',
  other_restrictions text,
  calculated_calories integer,
  locale text default 'es',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Enable RLS
alter table public.user_profiles enable row level security;

-- Policies
create policy "Users can view their own profile"
  on public.user_profiles for select
  using (auth.uid() = user_id);

create policy "Users can insert their own profile"
  on public.user_profiles for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own profile"
  on public.user_profiles for update
  using (auth.uid() = user_id);
