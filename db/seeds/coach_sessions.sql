-- Seed data for coach_sessions. Use this in dev/CI via the Supabase SQL editor
-- or via the supabase CLI: `supabase db query < db/seeds/coach_sessions.sql`.

insert into public.coach_sessions (energy, pantry, mood, locale, email, source, created_at)
values
  ('alta', 'arroz, huevo', 'contento', 'es', 'seed1@example.com', 'seed', now()),
  ('media', 'pasta, tomate', 'tranquilo', 'es', 'seed2@example.com', 'seed', now()),
  ('baja', 'lentejas', 'cansado', 'es', 'seed3@example.com', 'seed', now());

-- Note: Run this only in non-production environments or CI tests.
