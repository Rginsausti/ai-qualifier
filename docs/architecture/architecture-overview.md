# Architecture Overview

## Product objective
Build a nutrition coach that:
- scales with minimal infrastructure,
- gives high-quality meal suggestions,
- improves guidance per user over time.

## Current stack
- Frontend/API: Next.js App Router (Vercel).
- Data/Auth: Supabase (Postgres + Auth).
- Rate limit/metrics: Upstash Redis.
- AI providers: Groq and Hugging Face fallback.

## Current strengths
- Lean, cost-efficient platform components are already in place.
- Rich domain knowledge exists in `docs/kb/*`.
- Main user loop (onboarding -> chat -> logs -> dashboard) is implemented.

## Current risks
- Runtime coupling: some critical routes handle too many concerns.
- Reliability gaps for background work in serverless context.
- Data model drift risk across migrations/routes.
- Recommendation safety relies heavily on prompt behavior.

## Target architecture
- Keep request path fast and predictable.
- Move heavy/slow operations to queued jobs.
- Centralize recommendation safety and ranking rules.
- Persist behavior signals and use them for adaptive guidance.

## Core principles
- Safety before creativity in nutrition guidance.
- Deterministic policy checks before LLM generation.
- Observable pipelines (latency, cost, quality, adherence).
- Small, reversible increments over big rewrites.
