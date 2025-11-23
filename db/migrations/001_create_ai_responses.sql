-- Creates ai_responses table to store AI-generated text linked to sessions
create table if not exists public.ai_responses (
  id uuid primary key default gen_random_uuid(),
  session_id uuid,
  text text not null,
  created_at timestamptz default now()
);
