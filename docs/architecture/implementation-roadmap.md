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
- Expand deterministic pre-LLM policy checks.
- Add candidate scoring by pantry fit, prep time, and budget realism.
- Standardize fallback behavior when providers fail.
- Add quality telemetry for suggestion outcomes.

Exit criteria:
- measurable increase in recommendation acceptance,
- unsafe suggestion incidents remain zero,
- reduced response variance for similar inputs.

## Phase 3 - Personalization Engine (P1/P2)
- Add recommendation outcome events.
- Create user feature snapshots (daily/weekly).
- Apply lightweight reranking from user behavior.
- Improve contextual nudges (timing and motivation).

Exit criteria:
- higher week-over-week adherence,
- improved retention in active cohorts,
- fewer repeated ignored suggestions.

## Phase 4 - Scale and Governance (P2)
- Add structured architecture decision records (ADR folder).
- Introduce periodic schema consistency checks.
- Define SLOs and runbook for core routes/workers.

Exit criteria:
- predictable reliability under growth,
- faster incident diagnosis,
- lower regression rate in production.
