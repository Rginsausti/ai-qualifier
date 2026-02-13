alter table public.chat_messages
  add column if not exists client_message_id text;

create index if not exists idx_chat_messages_user_intent_client_message
  on public.chat_messages(user_id, intent, client_message_id)
  where client_message_id is not null;
