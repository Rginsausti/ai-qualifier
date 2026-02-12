# Recommendation Quality

## Goal
Increase recommendation usefulness while enforcing nutrition safety.

## Quality pillars
- Safety: avoid contraindicated suggestions.
- Relevance: align with user profile, pantry, context, and budget.
- Actionability: concrete options with low friction.
- Trust: avoid hallucinated prices or unsupported health claims.
- Commerce fidelity: represent local availability honestly, including missing-catalog cases.

## Decision pipeline (target)
1. Input validation and context assembly.
2. Deterministic policy checks (allergens/intolerances/therapeutic constraints).
3. Retrieval/ranking of candidate options (including semantic intent filters like fresh produce vs packaged).
4. LLM generation with strict prompt contract.
5. Output sanity checks before response.

## Commerce truthfulness rules
- If price evidence is missing, explicitly state that no verified price is available.
- Label results by confidence (`verified`, `estimated`, `no_catalog`) instead of guessing.
- For produce intent (`fruta`, `verdura`, etc.), exclude packaged lookalikes (`te frutal`, `mix frutos secos`, decorative baskets).
- Do not collapse discovery coverage and product coverage into one number; report both.

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
- unverified-price response rate (target: explicit fallback, no fabricated values),
- produce search precision@topN.
