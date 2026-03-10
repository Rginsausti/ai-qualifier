create table if not exists public.recommendation_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  intent text not null default 'nutrition',
  source text not null default 'chat',
  recommendation_text text,
  strategy text,
  modules text[] not null default '{}',
  outcome text not null default 'unknown',
  outcome_reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint recommendation_events_outcome_check check (outcome in ('unknown', 'accepted', 'skipped', 'replaced'))
);

create index if not exists idx_recommendation_events_user_intent_created
  on public.recommendation_events(user_id, intent, created_at desc);

create table if not exists public.user_feature_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  intent text not null default 'nutrition',
  window_days integer not null default 14,
  helpful_rate numeric not null default 0,
  low_value_rate numeric not null default 0,
  avg_latency_ms integer not null default 0,
  fallback_rate numeric not null default 0,
  recommendation_acceptance_rate numeric not null default 0,
  module_focus text[] not null default '{}',
  stats jsonb not null default '{}'::jsonb,
  computed_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint uniq_user_feature_snapshot unique (user_id, intent, window_days)
);

create index if not exists idx_user_feature_snapshots_user_intent
  on public.user_feature_snapshots(user_id, intent, computed_at desc);

alter table public.recommendation_events enable row level security;
alter table public.user_feature_snapshots enable row level security;

create policy "Users can view their own recommendation events"
  on public.recommendation_events for select
  using (auth.uid() = user_id);

create policy "Users can insert their own recommendation events"
  on public.recommendation_events for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own recommendation events"
  on public.recommendation_events for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can view their own feature snapshots"
  on public.user_feature_snapshots for select
  using (auth.uid() = user_id);
