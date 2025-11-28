"use client";

import { useTranslation } from "react-i18next";
import { AlarmClock, HandHeart, Sparkles } from "lucide-react";

const stepIcons = {
  one: Sparkles,
  two: HandHeart,
  three: AlarmClock,
};

export function RitualSection() {
  const { t } = useTranslation();
  const steps = ["one", "two", "three"] as const;

  return (
    <section className="relative overflow-hidden rounded-3xl border border-white/60 bg-gradient-to-br from-white via-white to-emerald-50 p-8 shadow-xl shadow-emerald-100">
      <div className="inline-flex items-center gap-2 rounded-full bg-emerald-100 px-4 py-1 text-xs font-semibold uppercase tracking-[0.4em] text-emerald-700">
        {t("ritualSection.badge")}
      </div>
      <div className="mt-4 space-y-4">
        <h2 className="text-4xl font-semibold text-slate-900">
          {t("ritualSection.title")}
        </h2>
        <p className="text-base text-slate-600">
          {t("ritualSection.reminder")}
        </p>
      </div>
      <div className="mt-8 grid gap-6 md:grid-cols-3">
        {steps.map((key, index) => {
          const Icon = stepIcons[key];
          return (
            <article
              key={key}
              className="rounded-3xl border border-white/60 bg-white/80 p-6 shadow-inner shadow-white"
            >
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-900 text-white">
                <Icon className="h-5 w-5" />
              </div>
              <p className="mt-4 text-xs font-semibold uppercase tracking-[0.4em] text-slate-400">
                {t("general.stepLabel")} {index + 1}
              </p>
              <h3 className="mt-2 text-xl font-semibold text-slate-900">
                {t(`ritualSection.steps.${key}.title`)}
              </h3>
              <p className="text-sm text-slate-600">
                {t(`ritualSection.steps.${key}.detail`)}
              </p>
            </article>
          );
        })}
      </div>
    </section>
  );
}
