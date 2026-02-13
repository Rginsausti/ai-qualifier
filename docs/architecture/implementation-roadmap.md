# Implementation Roadmap

## Phase 1 - Stability and Foundations (P0)
- Harden cron route auth and fail fast on missing secrets.
- Fix profile lookup mismatches affecting restrictions.
- Remove fragile fire-and-forget background pattern.
- Introduce queued scraping worker with bounded retries.
- Add architecture docs and align README links.

Exit criteria:
- no middleware/auth runtime timeouts,
- registration/login stable,
- scraping jobs are auditable by status,
- critical safety rules enforced in chat prompt contract.

## Phase 2 - Recommendation Quality (P1)
- Status: in progress (2026-02-13)
- Expand deterministic pre-LLM policy checks.
- Add candidate scoring by pantry fit, prep time, and budget realism.
- Standardize fallback behavior when providers fail. (done)
- Add quality telemetry for suggestion outcomes. (in progress: LLM usage + latency telemetry persisted)
- Enforce commerce-truthfulness guardrails (no unverified prices, explicit fallback messaging). (done)
- Add semantic intent filters for local search (fresh produce vs packaged lookalikes). (done)

Exit criteria:
- measurable increase in recommendation acceptance,
- unsafe suggestion incidents remain zero,
- reduced response variance for similar inputs,
- produce search precision improves with stable regression tests.

## Phase 2.5 - Local Commerce Coverage and Trust (P1)
- Split discovery and catalog coverage in APIs and UI.
- Persist and show nearby stores even when no online catalog exists.
- Expand store discovery sources and deduplication for neighborhood coverage.
- Add confidence labels (`verified`, `estimated`, `no_catalog`) for market data.
- Tune cache policy by query intent (shorter TTL for volatile produce searches).

Exit criteria:
- increase in nearby stores surfaced per search area,
- lower chain-only bias in visible options,
- fewer user reports of irrelevant produce results,
- zero fabricated price responses when evidence is missing.

## Phase 3 - Personalization Engine (P1/P2)
- Add recommendation outcome events.
- Create user feature snapshots (daily/weekly).
- Apply lightweight reranking from user behavior.
- Improve contextual nudges (timing and motivation).
- Add local-search feedback events (false positives, unavailable nearby, price mismatch).

Exit criteria:
- higher week-over-week adherence,
- improved retention in active cohorts,
- fewer repeated ignored suggestions,
- measurable drop in repeated low-trust local-search outcomes.

## Phase 4 - Scale and Governance (P2)
- Add structured architecture decision records (ADR folder).
- Introduce periodic schema consistency checks.
- Define SLOs and runbook for core routes/workers.

Exit criteria:
- predictable reliability under growth,
- faster incident diagnosis,
- lower regression rate in production.
