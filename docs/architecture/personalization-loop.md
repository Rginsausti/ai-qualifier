# Personalization Loop

## Goal
Make Alma progressively more helpful for each user.

## Signals to capture
- profile constraints (allergens, intolerances, therapeutic/cultural needs),
- daily logs (energy, hunger, cravings, hydration, meal events),
- recommendation outcomes (accepted, skipped, replaced),
- time/context patterns (morning/evening, weekdays/weekends).
- local search behavior (queries, clicked stores, ignored results, no-result reports).

## Learning loop
1. Collect behavior signals from interactions.
2. Aggregate into compact user features (weekly summary).
3. Use features to rank suggestions before generation.
4. Generate concise options tailored to likely adherence.
5. Capture feedback and update ranking weights.

## Personalization rules
- Prioritize stable habit improvements over aggressive plans.
- Prefer feasible suggestions over idealized ones.
- Keep language supportive and direct.
- Escalate caution when health-risk context appears.

## Data model direction
- Add recommendation event log (request, candidates, selected, result).
- Add user feature snapshot table (updated daily/weekly).
- Keep raw logs and derived features separate.
- Add search-quality feedback events (false positive, not available nearby, price mismatch).

## KPIs
- repeat-use retention,
- adherence trend per user,
- time to meaningful habit improvement,
- reduction in repeated low-value suggestions.
