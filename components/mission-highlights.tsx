"use client";

import { useTranslation } from "react-i18next";
import {
  ClipboardCheck,
  Compass,
  Leaf,
  type LucideIcon,
} from "lucide-react";

type MissionCard = {
  key: "ayurveda" | "pantry" | "explorer";
  icon: LucideIcon;
  accent: string;
  gradient: string;
  current: number;
  total: number;
};

const missions: MissionCard[] = [
  {
    key: "ayurveda",
    icon: Leaf,
    accent: "text-amber-800",
  gradient: "from-amber-100/80 to-orange-50",
    current: 2,
    total: 5,
  },
  {
    key: "pantry",
    icon: ClipboardCheck,
    accent: "text-emerald-800",
  gradient: "from-emerald-100/80 to-lime-50",
    current: 4,
    total: 6,
  },
  {
    key: "explorer",
    icon: Compass,
    accent: "text-slate-800",
  gradient: "from-slate-100/80 to-slate-50",
    current: 1,
    total: 3,
  },
];

export function MissionHighlights() {
  const { t } = useTranslation();

  return (
    <section className="relative overflow-hidden rounded-3xl border border-white/60 bg-white/80 p-6 shadow-xl shadow-emerald-100">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.4em] text-slate-400">
            {t("dashboard.missions.badge")}
          </p>
          <h3 className="mt-2 text-2xl font-semibold text-slate-900">
            {t("dashboard.missions.title")}
          </h3>
          <p className="text-sm text-slate-500">
            {t("dashboard.missions.subtitle")}
          </p>
        </div>
        <button className="inline-flex items-center justify-center rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-slate-700 transition hover:border-slate-900">
          {t("dashboard.missions.cta")}
        </button>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-3">
        {missions.map((mission) => {
          const completion = mission.current / mission.total;
          return (
            <article
              key={mission.key}
              className="rounded-3xl border border-white/50 bg-white/80 p-4 shadow-lg shadow-white"
            >
              <div
                className={`inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br ${mission.gradient} ${mission.accent}`}
              >
                <mission.icon className="h-6 w-6" />
              </div>
              <p className="mt-4 text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">
                {t(`dashboard.missions.items.${mission.key}.badge`)}
              </p>
              <h4 className="mt-2 text-xl font-semibold text-slate-900">
                {t(`dashboard.missions.items.${mission.key}.title`)}
              </h4>
              <p className="text-sm text-slate-600">
                {t(`dashboard.missions.items.${mission.key}.detail`)}
              </p>
              <div className="mt-4 flex items-center gap-3">
                <div className="flex-1">
                  <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
                    <span>
                      {t(`dashboard.missions.items.${mission.key}.progressLabel`, {
                        current: mission.current,
                        total: mission.total,
                      })}
                    </span>
                    <span>
                      {Math.round(completion * 100)}%
                    </span>
                  </div>
                  <div className="mt-1 h-2 rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-slate-900"
                      style={{ width: `${completion * 100}%` }}
                    />
                  </div>
                </div>
              </div>
              <div className="mt-4 flex items-center justify-between text-xs font-semibold text-slate-500">
                <span>
                  {t(`dashboard.missions.items.${mission.key}.reward`)}
                </span>
                <span className="rounded-full bg-slate-900 px-3 py-1 text-[11px] uppercase tracking-[0.3em] text-white">
                  {t(`dashboard.missions.items.${mission.key}.status`)}
                </span>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
