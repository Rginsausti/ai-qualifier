create table if not exists public.chat_feedback_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  intent text not null default 'nutrition',
  client_message_id text not null,
  assistant_excerpt text not null,
  feedback text not null check (feedback in ('up', 'down')),
  reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists uq_chat_feedback_events_user_intent_message
  on public.chat_feedback_events(user_id, intent, client_message_id);

create index if not exists idx_chat_feedback_events_user_intent_created_at
  on public.chat_feedback_events(user_id, intent, created_at desc);

alter table public.chat_feedback_events enable row level security;

create policy "Users can view their own chat feedback"
  on public.chat_feedback_events for select
  using (auth.uid() = user_id);

create policy "Users can insert their own chat feedback"
  on public.chat_feedback_events for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own chat feedback"
  on public.chat_feedback_events for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
