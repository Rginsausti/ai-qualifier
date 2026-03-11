"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type AdminIntent = "nutrition" | "movement";

type AnalyticsPayload = {
  window: {
    intent: string;
    days: number;
  };
  totals: {
    recommendations: number;
    accepted: number;
    skipped: number;
    replaced: number;
    unknown: number;
    acceptanceRate: number;
  };
  reasonsTop: Array<{ reason: string; count: number }>;
  modulesTop: Array<{ module: string; count: number }>;
  usersTop: Array<{
    userId: string;
    recommendations: number;
    accepted: number;
    acceptanceRate: number;
    latestAt: string | null;
  }>;
};

const clampNumber = (value: number, min: number, max: number) => {
  if (!Number.isFinite(value)) {
    return min;
  }

  return Math.max(min, Math.min(max, value));
};

const percentFormatter = new Intl.NumberFormat("en-US", {
  style: "percent",
  maximumFractionDigits: 1,
});

const integerFormatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 0,
});

const dateTimeFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

type LoadState = "idle" | "loading" | "success" | "error";

export function AdminAnalyticsClient() {
  const [intent, setIntent] = useState<AdminIntent>("nutrition");
  const [days, setDays] = useState<number>(14);
  const [limitUsers, setLimitUsers] = useState<number>(10);
  const [state, setState] = useState<LoadState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<AnalyticsPayload | null>(null);

  const requestUrl = useMemo(() => {
    const params = new URLSearchParams({
      intent,
      days: String(clampNumber(days, 1, 90)),
      limitUsers: String(clampNumber(limitUsers, 1, 50)),
    });

    return `/api/admin/recommendation-analytics?${params.toString()}`;
  }, [days, intent, limitUsers]);

  const loadAnalytics = useCallback(async () => {
    setState("loading");
    setError(null);

    try {
      const response = await fetch(requestUrl, { method: "GET" });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "Failed to load analytics");
      }

      const payload = (await response.json()) as AnalyticsPayload;
      setData(payload);
      setState("success");
    } catch (fetchError) {
      setState("error");
      setError(fetchError instanceof Error ? fetchError.message : "Unexpected error");
    }
  }, [requestUrl]);

  useEffect(() => {
    void loadAnalytics();
  }, [loadAnalytics]);

  return (
    <main className="min-h-screen bg-[#f6f3ec] px-4 py-8 sm:px-8 sm:py-10">
      <section className="mx-auto max-w-6xl space-y-6">
        <header className="rounded-3xl border border-white/60 bg-white/90 p-6 shadow-xl shadow-emerald-100 sm:p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.35em] text-emerald-700">Admin</p>
          <h1 className="mt-3 text-3xl font-semibold text-slate-900 sm:text-4xl">Recommendation analytics</h1>
          <p className="mt-2 text-sm text-slate-600">
            Review recommendation outcomes and user behavior across recent activity windows.
          </p>

          <div className="mt-6 grid gap-3 md:grid-cols-4">
            <label className="flex flex-col text-sm font-medium text-slate-700">
              Intent
              <select
                value={intent}
                onChange={(event) => setIntent(event.target.value as AdminIntent)}
                className="mt-1 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-slate-900 outline-none transition focus:border-emerald-500"
              >
                <option value="nutrition">nutrition</option>
                <option value="movement">movement</option>
              </select>
            </label>

            <label className="flex flex-col text-sm font-medium text-slate-700">
              Days
              <input
                type="number"
                min={1}
                max={90}
                value={days}
                onChange={(event) => setDays(clampNumber(Number(event.target.value), 1, 90))}
                className="mt-1 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-slate-900 outline-none transition focus:border-emerald-500"
              />
            </label>

            <label className="flex flex-col text-sm font-medium text-slate-700">
              Limit users
              <input
                type="number"
                min={1}
                max={50}
                value={limitUsers}
                onChange={(event) => setLimitUsers(clampNumber(Number(event.target.value), 1, 50))}
                className="mt-1 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-slate-900 outline-none transition focus:border-emerald-500"
              />
            </label>

            <div className="flex items-end">
              <button
                type="button"
                onClick={() => void loadAnalytics()}
                disabled={state === "loading"}
                className="inline-flex min-h-11 w-full items-center justify-center rounded-full bg-slate-900 px-5 py-2 text-sm font-semibold text-white transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {state === "loading" ? "Refreshing..." : "Refresh"}
              </button>
            </div>
          </div>
        </header>

        {state === "error" && (
          <div className="rounded-3xl border border-rose-200 bg-rose-50 px-5 py-4 text-sm text-rose-900">
            <p className="font-semibold">Could not load analytics</p>
            <p className="mt-1">{error ?? "Unknown error"}</p>
          </div>
        )}

        {state === "loading" && !data && (
          <div className="rounded-3xl border border-slate-200 bg-white/90 px-5 py-4 text-sm text-slate-700">
            Loading analytics...
          </div>
        )}

        {data && (
          <div className="space-y-6">
            <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
              <KpiCard label="Recommendations" value={integerFormatter.format(data.totals.recommendations)} />
              <KpiCard label="Accepted" value={integerFormatter.format(data.totals.accepted)} />
              <KpiCard label="Skipped" value={integerFormatter.format(data.totals.skipped)} />
              <KpiCard label="Replaced" value={integerFormatter.format(data.totals.replaced)} />
              <KpiCard label="Unknown" value={integerFormatter.format(data.totals.unknown)} />
              <KpiCard label="Acceptance rate" value={percentFormatter.format(data.totals.acceptanceRate)} />
            </section>

            <section className="grid gap-6 lg:grid-cols-2">
              <SimpleTopList title="Top reasons" firstLabel="Reason" secondLabel="Count" rows={data.reasonsTop} />
              <SimpleTopList title="Top modules" firstLabel="Module" secondLabel="Count" rows={data.modulesTop} />
            </section>

            <section className="overflow-hidden rounded-3xl border border-white/70 bg-white/95 shadow-lg shadow-slate-200/40">
              <div className="border-b border-slate-100 px-5 py-4">
                <h2 className="text-lg font-semibold text-slate-900">Top users</h2>
                <p className="text-sm text-slate-600">Sorted by recommendation volume within the selected window.</p>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-4 py-3">User ID</th>
                      <th className="px-4 py-3">Recommendations</th>
                      <th className="px-4 py-3">Accepted</th>
                      <th className="px-4 py-3">Acceptance rate</th>
                      <th className="px-4 py-3">Latest at</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.usersTop.length === 0 && (
                      <tr>
                        <td className="px-4 py-6 text-center text-slate-500" colSpan={5}>
                          No user rows for this filter.
                        </td>
                      </tr>
                    )}
                    {data.usersTop.map((row) => (
                      <tr key={row.userId} className="border-t border-slate-100 text-slate-700">
                        <td className="max-w-[220px] truncate px-4 py-3 font-mono text-xs text-slate-800">{row.userId}</td>
                        <td className="px-4 py-3">{integerFormatter.format(row.recommendations)}</td>
                        <td className="px-4 py-3">{integerFormatter.format(row.accepted)}</td>
                        <td className="px-4 py-3">{percentFormatter.format(row.acceptanceRate)}</td>
                        <td className="px-4 py-3 text-slate-500">
                          {row.latestAt ? dateTimeFormatter.format(new Date(row.latestAt)) : "-"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        )}
      </section>
    </main>
  );
}

function KpiCard({ label, value }: { label: string; value: string }) {
  return (
    <article className="rounded-3xl border border-white/70 bg-white/95 p-4 shadow-md shadow-slate-200/40">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-slate-900">{value}</p>
    </article>
  );
}

function SimpleTopList({
  title,
  firstLabel,
  secondLabel,
  rows,
}: {
  title: string;
  firstLabel: string;
  secondLabel: string;
  rows: Array<{ count: number; reason?: string; module?: string }>;
}) {
  return (
    <section className="overflow-hidden rounded-3xl border border-white/70 bg-white/95 shadow-lg shadow-slate-200/40">
      <div className="border-b border-slate-100 px-5 py-4">
        <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
      </div>
      <ul>
        {rows.length === 0 && <li className="px-5 py-4 text-sm text-slate-500">No data for this filter.</li>}
        {rows.map((row) => {
          const key = row.reason ?? row.module ?? "unknown";
          const label = row.reason ?? row.module ?? "unknown";

          return (
            <li key={key} className="flex items-center justify-between border-t border-slate-100 px-5 py-3 text-sm">
              <span className="text-slate-600">
                <span className="mr-2 text-xs uppercase tracking-wide text-slate-400">{firstLabel}:</span>
                {label}
              </span>
              <span className="font-semibold text-slate-800">
                <span className="mr-2 text-xs uppercase tracking-wide text-slate-400">{secondLabel}:</span>
                {integerFormatter.format(row.count)}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
