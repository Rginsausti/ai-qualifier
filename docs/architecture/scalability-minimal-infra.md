# Scalability With Minimal Infrastructure

## Goal
Support growth without adding heavy infrastructure.

## Strategy
- Keep Vercel serverless functions short and deterministic.
- Use Supabase tables as job queues where possible.
- Use Upstash for rate limiting, lightweight dedupe, and counters.

## Request path rules
- API routes should validate input quickly and return fast.
- No long-running fire-and-forget inside request handlers.
- Expensive tasks must be enqueued and processed by worker cron endpoints.
- Keep store discovery and product scraping separable so discovery can succeed even when catalog scraping fails.

## Job pattern
1. Client/API enqueues job in `scraping_jobs` as `pending`.
2. Worker endpoint claims pending jobs, marks `running`.
3. Worker writes results and marks `completed` or `failed`.
4. Failures increment `retry_count` and requeue until max retries.

## Operational guardrails
- Per-route rate limits (`/api/chat`, `/api/ai/*`, scraping endpoints).
- Secret-based auth on cron/worker routes.
- Bounded batch sizes and retries via env vars.

## Suggested metrics
- p95 latency by route.
- failure rate by route and provider.
- queued vs completed jobs per day.
- token usage and cost per successful response.
- nearby stores discovered vs stores with usable catalog.
- produce query precision (fresh items vs packaged false positives).

## Local commerce scaling notes
- Discover nearby stores from OSM/geo sources first, persist regardless of catalog availability.
- Run scraping only for stores with supported brand adapters or valid website sources.
- Surface "no online catalog" stores in the UX to avoid silent coverage gaps.
- Use shorter cache TTL for volatile produce queries than for stable packaged-goods searches.
