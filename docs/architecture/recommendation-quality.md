# Recommendation Quality

## Goal
Increase recommendation usefulness while enforcing nutrition safety.

## Quality pillars
- Safety: avoid contraindicated suggestions.
- Relevance: align with user profile, pantry, context, and budget.
- Actionability: concrete options with low friction.
- Trust: avoid hallucinated prices or unsupported health claims.

## Decision pipeline (target)
1. Input validation and context assembly.
2. Deterministic policy checks (allergens/intolerances/therapeutic constraints).
3. Retrieval/ranking of candidate options.
4. LLM generation with strict prompt contract.
5. Output sanity checks before response.

## Guardrails (must hold)
- Never recommend items that conflict with profile restrictions.
- No medical diagnosis or treatment instructions.
- When risk signals appear, recommend licensed professional consultation.
- Respect hard constraints from `docs/kb/guardrails/guardrails-obligatorios.md`.

## Iteration plan
- Start with hard safety checks pre-LLM.
- Add scoring function for pantry fit + prep time + cost realism.
- Add feedback loop (`helpful/not helpful`, `did it/not`) to rerank suggestions.

## KPIs
- recommendation acceptance rate,
- 24h adherence rate,
- unsafe recommendation incident count (target: 0),
- average time-to-first-actionable-option.
