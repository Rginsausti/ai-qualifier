-- Create chat_messages table for per-user daily memory persistence
create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  intent text not null default 'nutrition',
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  hidden boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_chat_messages_user_intent_created_at
  on public.chat_messages(user_id, intent, created_at desc);

alter table public.chat_messages enable row level security;

create policy "Users can view their own chat messages"
  on public.chat_messages for select
  using (auth.uid() = user_id);

create policy "Users can insert their own chat messages"
  on public.chat_messages for insert
  with check (auth.uid() = user_id);
