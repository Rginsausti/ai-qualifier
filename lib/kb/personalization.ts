import { getDbPool } from "@/lib/db/pool";

export type PersonalizationSnapshot = {
  helpfulRate: number;
  lowValueRate: number;
  avgLatencyMs: number;
  fallbackRate: number;
  recommendationAcceptanceRate: number;
  moduleFocus: string[];
  windowDays: number;
};

type RecommendationEventInput = {
  userId: string;
  intent: string;
  strategy: string;
  recommendationText: string;
  modules: string[];
  metadata?: Record<string, unknown>;
};

const clampPct = (value: number) => {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
};

export function inferKnowledgeModules(snapshot: PersonalizationSnapshot | null): string[] {
  if (!snapshot) {
    return ["patrones", "guardrails", "recetas"];
  }

  const selected = new Set<string>();
  selected.add("guardrails");

  if (snapshot.lowValueRate >= 0.35) {
    selected.add("recetas");
    selected.add("patrones");
  }

  if (snapshot.recommendationAcceptanceRate < 0.45) {
    selected.add("filosofia");
    selected.add("recetas");
  }

  snapshot.moduleFocus.forEach((module) => selected.add(module));

  if (selected.size < 2) {
    selected.add("patrones");
  }

  return Array.from(selected).slice(0, 4);
}

export async function getPersonalizationSnapshot(
  userId: string,
  intent: string,
  windowDays = 14
): Promise<PersonalizationSnapshot | null> {
  const pool = getDbPool();
  const result = await pool.query<{
    helpful_rate: number;
    low_value_rate: number;
    avg_latency_ms: number;
    fallback_rate: number;
    recommendation_acceptance_rate: number;
    module_focus: string[];
    window_days: number;
  }>(
    `select
      helpful_rate,
      low_value_rate,
      avg_latency_ms,
      fallback_rate,
      recommendation_acceptance_rate,
      module_focus,
      window_days
    from user_feature_snapshots
    where user_id = $1 and intent = $2 and window_days = $3
    order by computed_at desc
    limit 1`,
    [userId, intent, windowDays]
  );

  const row = result.rows[0];
  if (!row) return null;

  return {
    helpfulRate: clampPct(Number(row.helpful_rate || 0)),
    lowValueRate: clampPct(Number(row.low_value_rate || 0)),
    avgLatencyMs: Math.max(0, Number(row.avg_latency_ms || 0)),
    fallbackRate: clampPct(Number(row.fallback_rate || 0)),
    recommendationAcceptanceRate: clampPct(Number(row.recommendation_acceptance_rate || 0)),
    moduleFocus: Array.isArray(row.module_focus) ? row.module_focus : [],
    windowDays: Number(row.window_days || windowDays),
  };
}

export async function persistRecommendationEvent(input: RecommendationEventInput): Promise<string | null> {
  try {
    const pool = getDbPool();
    const result = await pool.query<{ id: string }>(
      `insert into recommendation_events
        (user_id, intent, source, recommendation_text, strategy, modules, metadata)
      values ($1, $2, 'chat', $3, $4, $5::text[], $6::jsonb)
      returning id`,
      [
        input.userId,
        input.intent,
        input.recommendationText,
        input.strategy,
        input.modules,
        JSON.stringify(input.metadata || {}),
      ]
    );
    return result.rows[0]?.id ?? null;
  } catch (error) {
    console.warn("persistRecommendationEvent failed", error);
    return null;
  }
}

export async function updateLatestRecommendationOutcome(params: {
  userId: string;
  intent: string;
  outcome: "accepted" | "replaced" | "skipped";
  reason?: string | null;
}) {
  const pool = getDbPool();
  await pool.query(
    `update recommendation_events
      set outcome = $3,
          outcome_reason = $4,
          updated_at = now()
      where id = (
        select id
        from recommendation_events
        where user_id = $1 and intent = $2 and outcome = 'unknown'
        order by created_at desc
        limit 1
      )`,
    [params.userId, params.intent, params.outcome, params.reason || null]
  );
}

export async function aggregatePersonalizationSnapshots(windowDays = 14, intent = "nutrition") {
  const pool = getDbPool();
  const result = await pool.query<{
    user_id: string;
    helpful_rate: number;
    low_value_rate: number;
    avg_latency_ms: number;
    fallback_rate: number;
    recommendation_acceptance_rate: number;
    module_focus: string[];
    stats: Record<string, unknown>;
  }>(
    `with feedback as (
      select
        user_id,
        intent,
        count(*)::int as feedback_total,
        count(*) filter (where feedback = 'up')::int as feedback_up,
        count(*) filter (where feedback = 'down')::int as feedback_down,
        count(*) filter (where feedback = 'down' and coalesce(reason, '') in ('not_helpful', 'too_generic'))::int as low_value_down
      from chat_feedback_events
      where created_at >= now() - ($1 || ' days')::interval
        and intent = $2
      group by user_id, intent
    ),
    quality as (
      select
        user_id,
        intent,
        avg(coalesce(latency_ms, 0))::int as avg_latency_ms,
        avg(case when coalesce(fallback_count, 0) > 0 then 1 else 0 end)::numeric as fallback_rate,
        count(*)::int as quality_total
      from chat_quality_events
      where created_at >= now() - ($1 || ' days')::interval
        and intent = $2
      group by user_id, intent
    ),
    rec as (
      select
        user_id,
        intent,
        count(*)::int as rec_total,
        count(*) filter (where outcome = 'accepted')::int as rec_accepted
      from recommendation_events
      where created_at >= now() - ($1 || ' days')::interval
        and intent = $2
      group by user_id, intent
    ),
    module_rank as (
      select
        user_id,
        intent,
        modules_item as module,
        count(*) as use_count,
        row_number() over (partition by user_id, intent order by count(*) desc, modules_item asc) as rn
      from recommendation_events,
        lateral unnest(coalesce(modules, '{}')) as modules_item
      where created_at >= now() - ($1 || ' days')::interval
        and intent = $2
      group by user_id, intent, modules_item
    ),
    module_focus as (
      select
        user_id,
        intent,
        array_agg(module order by use_count desc, module asc) as module_focus
      from module_rank
      where rn <= 3
      group by user_id, intent
    ),
    universe as (
      select user_id, intent from feedback
      union
      select user_id, intent from quality
      union
      select user_id, intent from rec
    )
    select
      u.user_id,
      coalesce(f.feedback_up::numeric / nullif(f.feedback_total, 0), 0)::numeric as helpful_rate,
      coalesce(f.low_value_down::numeric / nullif(f.feedback_total, 0), 0)::numeric as low_value_rate,
      coalesce(q.avg_latency_ms, 0)::int as avg_latency_ms,
      coalesce(q.fallback_rate, 0)::numeric as fallback_rate,
      coalesce(r.rec_accepted::numeric / nullif(r.rec_total, 0), 0)::numeric as recommendation_acceptance_rate,
      coalesce(m.module_focus, '{}') as module_focus,
      jsonb_build_object(
        'feedback_total', coalesce(f.feedback_total, 0),
        'quality_total', coalesce(q.quality_total, 0),
        'recommendation_total', coalesce(r.rec_total, 0)
      ) as stats
    from universe u
    left join feedback f on f.user_id = u.user_id and f.intent = u.intent
    left join quality q on q.user_id = u.user_id and q.intent = u.intent
    left join rec r on r.user_id = u.user_id and r.intent = u.intent
    left join module_focus m on m.user_id = u.user_id and m.intent = u.intent`,
    [windowDays, intent]
  );

  let updated = 0;
  for (const row of result.rows) {
    await pool.query(
      `insert into user_feature_snapshots
        (user_id, intent, window_days, helpful_rate, low_value_rate, avg_latency_ms, fallback_rate, recommendation_acceptance_rate, module_focus, stats, computed_at, updated_at)
      values ($1, $2, $3, $4, $5, $6, $7, $8, $9::text[], $10::jsonb, now(), now())
      on conflict (user_id, intent, window_days)
      do update set
        helpful_rate = excluded.helpful_rate,
        low_value_rate = excluded.low_value_rate,
        avg_latency_ms = excluded.avg_latency_ms,
        fallback_rate = excluded.fallback_rate,
        recommendation_acceptance_rate = excluded.recommendation_acceptance_rate,
        module_focus = excluded.module_focus,
        stats = excluded.stats,
        computed_at = now(),
        updated_at = now()`,
      [
        row.user_id,
        intent,
        windowDays,
        row.helpful_rate,
        row.low_value_rate,
        row.avg_latency_ms,
        row.fallback_rate,
        row.recommendation_acceptance_rate,
        row.module_focus,
        JSON.stringify(row.stats || {}),
      ]
    );
    updated += 1;
  }

  return { updated, windowDays, intent };
}
