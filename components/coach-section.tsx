"use client";

import { useTranslation } from "react-i18next";
import { HeartHandshake, MessageSquareHeart, Sparkles } from "lucide-react";

const bulletIcons = {
  care: HeartHandshake,
  time: MessageSquareHeart,
  result: Sparkles,
};

export function CoachSection({ onCtaClick }: { onCtaClick?: () => void }) {
  const { t } = useTranslation();

  const bullets = ["care", "time", "result"] as const;

  return (
    <section className="rounded-3xl border border-white/60 bg-gradient-to-br from-white via-white to-slate-50 p-8 shadow-xl shadow-emerald-100">
      <div className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-1 text-xs font-semibold uppercase tracking-[0.4em] text-white">
        {t("coachSection.badge")}
      </div>
      <div className="mt-4 space-y-4">
        <h2 className="text-4xl font-semibold text-slate-900">
          {t("coachSection.title")}
        </h2>
        <p className="text-base text-slate-600">
          {t("coachSection.description")}
        </p>
      </div>
      <div className="mt-8 grid gap-4 md:grid-cols-3">
        {bullets.map((key) => {
          const Icon = bulletIcons[key];
          return (
            <article
              key={key}
              className="rounded-3xl border border-white/60 bg-white/80 p-5 shadow-inner shadow-white"
            >
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-900/90 text-white">
                <Icon className="h-5 w-5" />
              </div>
              <h3 className="mt-4 text-base font-semibold text-slate-900">
                {t(`coachSection.bullets.${key}`)}
              </h3>
            </article>
          );
        })}
      </div>
      <div className="mt-8 flex flex-wrap gap-3">
        <button
          onClick={onCtaClick}
          className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-slate-900/20 transition hover:-translate-y-0.5"
        >
          {t("coachSection.cta")}
        </button>
      </div>
    </section>
  );
}
