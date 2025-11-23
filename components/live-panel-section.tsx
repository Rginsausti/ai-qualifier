"use client";

import { useTranslation } from "react-i18next";
import { Leaf, Radar, Sparkles, Utensils } from "lucide-react";

const cardIcons = {
  pantry: Utensils,
  mood: Sparkles,
  places: Radar,
};

export function LivePanelSection() {
  const { t } = useTranslation();
  const cards = ["pantry", "mood", "places"] as const;

  return (
    <section className="rounded-3xl border border-white/60 bg-white/80 p-8 shadow-xl shadow-emerald-100">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-emerald-100 px-4 py-1 text-xs font-semibold uppercase tracking-[0.4em] text-emerald-700">
            {t("livePanelSection.badge")}
          </div>
          <h2 className="mt-4 text-3xl font-semibold text-slate-900">
            {t("livePanelSection.title")}
          </h2>
        </div>
        <button className="inline-flex items-center gap-2 rounded-full border border-slate-200/80 px-5 py-2 text-sm font-semibold text-slate-900 transition hover:border-slate-900">
          <Leaf className="h-4 w-4" />
          {t("livePanelSection.cta")}
        </button>
      </div>
      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        {cards.map((key) => {
          const Icon = cardIcons[key];
          return (
            <article
              key={key}
              className="rounded-3xl border border-white/60 bg-gradient-to-br from-white via-white to-slate-50 p-6 shadow-inner shadow-white"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">
                    {t(`livePanelSection.${key}.badge`)}
                  </p>
                  <h3 className="mt-2 text-xl font-semibold text-slate-900">
                    {t(`livePanelSection.${key}.title`)}
                  </h3>
                </div>
                <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-900 text-white">
                  <Icon className="h-5 w-5" />
                </div>
              </div>
              <p className="mt-4 text-4xl font-semibold text-slate-900">
                {t(`livePanelSection.${key}.stat`)}
              </p>
              <p className="mt-2 text-sm text-slate-600">
                {t(`livePanelSection.${key}.detail`)}
              </p>
            </article>
          );
        })}
      </div>
    </section>
  );
}
