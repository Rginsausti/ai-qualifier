create table if not exists public.chat_quality_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  intent text not null default 'nutrition',
  locale text,
  provider text,
  model text,
  finish_reason text,
  success boolean not null default true,
  failure_kind text,
  prompt_tokens integer,
  completion_tokens integer,
  total_tokens integer,
  latency_ms integer,
  fallback_count integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_chat_quality_events_user_intent_created_at
  on public.chat_quality_events(user_id, intent, created_at desc);

alter table public.chat_quality_events enable row level security;

create policy "Users can view their own chat quality events"
  on public.chat_quality_events for select
  using (auth.uid() = user_id);

create policy "Users can insert their own chat quality events"
  on public.chat_quality_events for insert
  with check (auth.uid() = user_id);
