"use client";

import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { MessageCircleHeart } from "lucide-react";

type CoachSession = {
  id: number;
  energy: string;
  pantry: string;
  mood: string;
  locale: string | null;
  created_at: string;
};

function formatRelative(timestamp: string, locale: string) {
  const createdAt = new Date(timestamp);
  if (Number.isNaN(createdAt.getTime())) {
    return "";
  }

  const diffMs = createdAt.getTime() - Date.now();
  const rtf = new Intl.RelativeTimeFormat(locale || "es", { numeric: "auto" });

  const divisions: Array<[Intl.RelativeTimeFormatUnit, number]> = [
    ["day", 86_400_000],
    ["hour", 3_600_000],
    ["minute", 60_000],
  ];

  for (const [unit, ms] of divisions) {
    const delta = Math.round(diffMs / ms);
    if (Math.abs(delta) >= 1 || unit === "minute") {
      return rtf.format(delta, unit);
    }
  }

  return "";
}

export function RecentCoachSessions() {
  const { t, i18n } = useTranslation();
  const [sessions, setSessions] = useState<CoachSession[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [infoMessage, setInfoMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadSessions() {
      try {
        setStatus("loading");
        const response = await fetch("/api/coach-sessions?limit=4", {
          method: "GET",
          headers: { "Content-Type": "application/json" },
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error("Failed to fetch coach sessions");
        }

        const payload = await response.json();
        if (active) {
          setSessions(payload.sessions ?? []);
          setInfoMessage(payload.message ?? null);
          setStatus("ready");
        }
      } catch (error) {
        console.error("Coach sessions fetch error", error);
        if (active) {
          setStatus("error");
        }
      }
    }

    loadSessions();

    return () => {
      active = false;
    };
  }, []);

  return (
    <section className="rounded-3xl border border-white/70 bg-white/80 p-6 shadow-lg shadow-emerald-100">
      <div className="flex items-center gap-3 text-xs uppercase tracking-[0.4em] text-slate-500">
        <MessageCircleHeart className="h-4 w-4" />
        {t("recentSessions.badge")}
      </div>
      <div className="mt-4 flex flex-wrap items-end justify-between gap-3">
        <h3 className="text-2xl font-semibold text-slate-900">
          {t("recentSessions.title")}
        </h3>
        <p className="text-sm text-slate-500">
          {status === "loading" && t("recentSessions.loading")}
          {status === "ready" && !!sessions.length && t("recentSessions.liveFeed")}
          {status === "error" && t("recentSessions.error")}
        </p>
      </div>
      <div className="mt-6 space-y-4">
        {status === "ready" && infoMessage && (
          <p className="rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            {infoMessage}
          </p>
        )}
        {status === "ready" && sessions.length === 0 && (
          <p className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 px-4 py-3 text-sm text-slate-600">
            {t("recentSessions.empty")}
          </p>
        )}
        {status === "error" && (
          <p className="rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {t("recentSessions.error")}
          </p>
        )}
        {sessions.map((session) => (
          <article
            key={session.id}
            className="flex flex-col gap-2 rounded-2xl border border-slate-100 bg-white/80 px-4 py-3 text-sm text-slate-700 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">
                {session.locale || t("recentSessions.localeUnknown")}
              </p>
              <p className="text-base font-semibold text-slate-900">
                {session.energy} · {session.pantry}
              </p>
              <p className="text-sm text-emerald-700">
                {t("recentSessions.moodLabel", { mood: session.mood })}
              </p>
            </div>
            <div className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">
              {formatRelative(session.created_at, i18n.language) ||
                t("recentSessions.relativeFallback")}
            </div>
          </article>
        ))}
        {status === "loading" && (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, index) => (
              <div
                key={index}
                className="h-16 animate-pulse rounded-2xl bg-slate-100/80"
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
