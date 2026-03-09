# Optimization Execution Plan (2 Weeks)

## Objectives
- Unblock delivery by upgrading runtime to Node `>=20.9.0` (target `20.11+`) and restoring green build pipeline.
- Reduce p95 latency and timeout risk in chat/scraping by moving heavy sync work to queue workers.
- Improve ingestion throughput by replacing sequential upserts with batch writes.
- Reduce dashboard payload/hydration cost by splitting large client components.
- Preserve functionality with feature flags, canary rollout, and config-based rollback.

## Week 1 (P0: Stability + De-risk)

### Day 1-2: Build unblock and baseline
- Upgrade local/CI runtime to Node 20.11+.
- Re-run `pnpm build` and keep baseline snapshots:
  - API latency (chat/search)
  - error/timeout rate
  - queue depth and retries
  - JS bundle size (dashboard route)

### Day 2-4: Remove sync bottlenecks (no contract changes)
- `app/api/chat/route.ts`
  - Extract orchestration modules: ingestion, guardrails, provider fallback, telemetry.
  - Keep response schema and status codes unchanged.
- `lib/scraping/orchestrator.ts`
  - Split into stages: validate -> load cache -> enqueue/trigger -> collect/persist -> respond.
  - Keep current behavior, but move expensive operations behind async path when possible.
- `app/api/scraping/trigger/route.ts`
  - Enforce idempotent enqueue contract (`store_id + query + time_bucket`).
- `app/api/scraping/worker/route.ts`
  - Harden retries/backoff and structured job logs.

### Day 4-5: Rollout safety
- Add feature flags:
  - `CHAT_ORCHESTRATOR_V2`
  - `SCRAPING_ASYNC_ENABLED`
  - `OSM_BATCH_UPSERT_ENABLED`
- Canary rollout: 10% -> 50% -> 100%.
- Keep immediate kill-switch fallback to previous flow.

## Week 2 (P1: Throughput + Frontend)

### Day 6-8: OSM ingestion throughput
- `lib/scraping/osm-discovery.ts`
  - Replace per-item upsert loop with chunked upsert.
  - Bounded concurrency for chunks.
  - Retry failed chunks only (partial-failure isolation).

### Day 8-10: Dashboard footprint
- `app/dashboard-client.tsx`
  - Split into smaller client islands.
  - Move non-interactive transforms/data prep server-side.
  - Defer non-critical panels with dynamic loading.

### Day 10: Hardening and completion
- Full regression pass: chat, product search, scraping worker paths, dashboard.
- Ramp to 100%, monitor 24h, keep old path behind flags for one release.

## Metrics and SLOs
- Chat p95 latency: improve 30-50% from baseline.
- Chat/search 5xx: `<0.5%`.
- Queue success after retries: `>=99%`.
- Queue lag p95: `<60s`.
- OSM ingestion throughput: `>=2x` baseline records/minute.
- Dashboard route initial JS: at least `-25%`.
- LCP p75 (dashboard): `<2.5s`.

## Rollback Strategy
- Config-only rollback via feature flags:
  - disable `CHAT_ORCHESTRATOR_V2`
  - disable `SCRAPING_ASYNC_ENABLED`
  - disable `OSM_BATCH_UPSERT_ENABLED`
- Rollback sequence:
  1. stop ramp
  2. toggle flag off
  3. drain in-flight jobs
  4. verify latency/error recovery

## Definition of Done
- Node 20+ is active in local + CI and `pnpm build` passes.
- Refactors preserve external API behavior.
- Async scraping path stable and observable.
- OSM batch path meets throughput target.
- Dashboard performance targets met.
- Rollout + rollback runbook validated.
