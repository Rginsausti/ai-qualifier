import { NextRequest, NextResponse } from 'next/server';
import { getDbPool } from '@/lib/db/pool';
import { assertAdminRequest } from '@/lib/auth/admin';

const DEFAULT_INTENT = 'nutrition';
const DEFAULT_DAYS = 14;
const DEFAULT_LIMIT_USERS = 10;

const clampInt = (value: string | null, min: number, max: number, fallback: number) => {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, parsed));
};

const normalizeIntent = (value: string | null) => {
  if (!value) return DEFAULT_INTENT;
  const cleaned = value.trim().toLowerCase();
  return cleaned || DEFAULT_INTENT;
};

type TotalsRow = {
  recommendations: number;
  accepted: number;
  skipped: number;
  replaced: number;
  unknown: number;
};

type ReasonRow = {
  reason: string;
  count: number;
};

type ModuleRow = {
  module: string;
  count: number;
};

type UserRow = {
  userId: string;
  recommendations: number;
  accepted: number;
  latestAt: Date | string | null;
};

export async function GET(request: NextRequest) {
  const auth = await assertAdminRequest(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const intent = normalizeIntent(request.nextUrl.searchParams.get('intent'));
  const days = clampInt(request.nextUrl.searchParams.get('days'), 1, 90, DEFAULT_DAYS);
  const limitUsers = clampInt(
    request.nextUrl.searchParams.get('limitUsers'),
    1,
    50,
    DEFAULT_LIMIT_USERS
  );

  try {
    const pool = getDbPool();
    const [totalsResult, reasonsResult, modulesResult, usersResult] = await Promise.all([
      pool.query<TotalsRow>(
        `select
          count(*)::int as recommendations,
          count(*) filter (where outcome = 'accepted')::int as accepted,
          count(*) filter (where outcome = 'skipped')::int as skipped,
          count(*) filter (where outcome = 'replaced')::int as replaced,
          count(*) filter (where outcome = 'unknown')::int as unknown
        from recommendation_events
        where intent = $1
          and created_at >= now() - ($2 || ' days')::interval`,
        [intent, days]
      ),
      pool.query<ReasonRow>(
        `select
          coalesce(nullif(trim(outcome_reason), ''), 'unknown') as reason,
          count(*)::int as count
        from recommendation_events
        where intent = $1
          and created_at >= now() - ($2 || ' days')::interval
        group by 1
        order by count desc, reason asc
        limit 10`,
        [intent, days]
      ),
      pool.query<ModuleRow>(
        `select
          modules_item as module,
          count(*)::int as count
        from recommendation_events,
          lateral unnest(coalesce(modules, '{}')) as modules_item
        where intent = $1
          and created_at >= now() - ($2 || ' days')::interval
        group by modules_item
        order by count desc, module asc
        limit 10`,
        [intent, days]
      ),
      pool.query<UserRow>(
        `select
          user_id as "userId",
          count(*)::int as recommendations,
          count(*) filter (where outcome = 'accepted')::int as accepted,
          max(created_at) as "latestAt"
        from recommendation_events
        where intent = $1
          and created_at >= now() - ($2 || ' days')::interval
        group by user_id
        order by recommendations desc, "latestAt" desc
        limit $3`,
        [intent, days, limitUsers]
      ),
    ]);

    const totals = totalsResult.rows[0] || {
      recommendations: 0,
      accepted: 0,
      skipped: 0,
      replaced: 0,
      unknown: 0,
    };
    const recommendations = Number(totals.recommendations || 0);
    const accepted = Number(totals.accepted || 0);

    return NextResponse.json({
      success: true,
      window: { intent, days },
      totals: {
        recommendations,
        accepted,
        skipped: Number(totals.skipped || 0),
        replaced: Number(totals.replaced || 0),
        unknown: Number(totals.unknown || 0),
        acceptanceRate: recommendations > 0 ? accepted / recommendations : 0,
      },
      reasonsTop: reasonsResult.rows.map((row) => ({ reason: row.reason, count: Number(row.count || 0) })),
      modulesTop: modulesResult.rows.map((row) => ({ module: row.module, count: Number(row.count || 0) })),
      usersTop: usersResult.rows.map((row) => ({
        userId: row.userId,
        recommendations: Number(row.recommendations || 0),
        accepted: Number(row.accepted || 0),
        acceptanceRate:
          Number(row.recommendations || 0) > 0
            ? Number(row.accepted || 0) / Number(row.recommendations || 0)
            : 0,
        latestAt: row.latestAt ? new Date(row.latestAt).toISOString() : null,
      })),
    });
  } catch (error) {
    console.error('recommendation-analytics failed', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
