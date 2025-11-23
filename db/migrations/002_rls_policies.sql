-- Enable Row Level Security and create policies for coach_sessions and ai_responses
alter table if exists public.coach_sessions enable row level security;
alter table if exists public.ai_responses enable row level security;

-- Allow public SELECT on both tables for read-only feeds
create policy if not exists "public_read_coach_sessions"
  on public.coach_sessions
  for select
  to public
  using ( true );

create policy if not exists "public_read_ai_responses"
  on public.ai_responses
  for select
  to public
  using ( true );

-- Allow authenticated users to INSERT into coach_sessions and ai_responses
create policy if not exists "auth_insert_coach_sessions"
  on public.coach_sessions
  for insert
  to authenticated
  with check ( auth.role() = 'authenticated' );

create policy if not exists "auth_insert_ai_responses"
  on public.ai_responses
  for insert
  to authenticated
  with check ( auth.role() = 'authenticated' );

-- For admin/service role, Supabase service role bypasses RLS; no policy needed for server inserts
