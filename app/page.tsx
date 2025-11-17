"use client";

import { LanguageSwitcher } from "@/components/language-switcher";
import { PersonalCoachDemo } from "@/components/personal-coach-demo";
import { useTranslation } from "react-i18next";
import {
  ArrowRight,
  BellRing,
  Brain,
  Flame,
  Leaf,
  MapPin,
  NotebookPen,
  MessageCircleHeart,
  Refrigerator,
  ShoppingBasket,
  Timer,
  Smile,
  Sparkles,
  TrendingUp,
  Utensils,
  type LucideIcon,
} from "lucide-react";

type Feature = {
  titleKey: string;
  descriptionKey: string;
  icon: LucideIcon;
  accent: string;
};

const features: Feature[] = [
  {
    titleKey: "features.routines.title",
    descriptionKey: "features.routines.description",
    icon: Flame,
    accent: "from-rose-200 to-orange-100",
  },
  {
    titleKey: "features.pantry.title",
    descriptionKey: "features.pantry.description",
    icon: Refrigerator,
    accent: "from-emerald-200 to-lime-100",
  },
  {
    titleKey: "features.neighborhood.title",
    descriptionKey: "features.neighborhood.description",
    icon: MapPin,
    accent: "from-sky-200 to-indigo-100",
  },
];

const heroBullets = [
  "hero.bullets.care",
  "hero.bullets.places",
  "hero.bullets.alerts",
];

const previewCards = [
  {
    labelKey: "hero.previewCards.suggestion.label",
    titleKey: "hero.previewCards.suggestion.title",
    detailKey: "hero.previewCards.suggestion.detail",
    tone: "bg-white/90",
  },
  {
    labelKey: "hero.previewCards.places.label",
    titleKey: "hero.previewCards.places.title",
    detailKey: "hero.previewCards.places.detail",
    tone: "bg-emerald-50/80",
  },
  {
    labelKey: "hero.previewCards.streak.label",
    titleKey: "hero.previewCards.streak.title",
    detailKey: "hero.previewCards.streak.detail",
    tone: "bg-amber-50/90",
  },
];

const rituals = [
  {
    titleKey: "ritualSection.steps.one.title",
    detailKey: "ritualSection.steps.one.detail",
  },
  {
    titleKey: "ritualSection.steps.two.title",
    detailKey: "ritualSection.steps.two.detail",
  },
  {
    titleKey: "ritualSection.steps.three.title",
    detailKey: "ritualSection.steps.three.detail",
  },
];

const livePanels = [
  {
    titleKey: "livePanelSection.pantry.title",
    statKey: "livePanelSection.pantry.stat",
    detailKey: "livePanelSection.pantry.detail",
    badgeKey: "livePanelSection.pantry.badge",
    icon: Refrigerator,
  },
  {
    titleKey: "livePanelSection.mood.title",
    statKey: "livePanelSection.mood.stat",
    detailKey: "livePanelSection.mood.detail",
    badgeKey: "livePanelSection.mood.badge",
    icon: Smile,
  },
  {
    titleKey: "livePanelSection.places.title",
    statKey: "livePanelSection.places.stat",
    detailKey: "livePanelSection.places.detail",
    badgeKey: "livePanelSection.places.badge",
    icon: MapPin,
  },
];

const missions = [
  {
    titleKey: "missionsSection.items.ayurveda.title",
    descriptionKey: "missionsSection.items.ayurveda.description",
    icon: Leaf,
    pointsKey: "missionsSection.items.ayurveda.points",
    statusKey: "missionsSection.items.ayurveda.status",
  },
  {
    titleKey: "missionsSection.items.pantry.title",
    descriptionKey: "missionsSection.items.pantry.description",
    icon: ShoppingBasket,
    pointsKey: "missionsSection.items.pantry.points",
    statusKey: "missionsSection.items.pantry.status",
  },
  {
    titleKey: "missionsSection.items.explorer.title",
    descriptionKey: "missionsSection.items.explorer.description",
    icon: MapPin,
    pointsKey: "missionsSection.items.explorer.points",
    statusKey: "missionsSection.items.explorer.status",
  },
];

const insights = [
  {
    titleKey: "insightsSection.cards.engine.title",
    detailKey: "insightsSection.cards.engine.detail",
    icon: Brain,
  },
  {
    titleKey: "insightsSection.cards.journal.title",
    detailKey: "insightsSection.cards.journal.detail",
    icon: NotebookPen,
  },
  {
    titleKey: "insightsSection.cards.energy.title",
    detailKey: "insightsSection.cards.energy.detail",
    icon: TrendingUp,
  },
  {
    titleKey: "insightsSection.cards.recipes.title",
    detailKey: "insightsSection.cards.recipes.detail",
    icon: Utensils,
  },
];

const futureItems = [
  { textKey: "futureSection.items.insight", icon: Leaf },
  { textKey: "futureSection.items.missions", icon: Sparkles },
  { textKey: "futureSection.items.map", icon: MapPin },
];

export default function Home() {
  const { t } = useTranslation();

  return (
    <div className="relative min-h-screen bg-[#f7f5f0] text-slate-900">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-24 left-1/2 h-80 w-80 -translate-x-1/2 rounded-full bg-emerald-200/40 blur-[120px]" />
        <div className="absolute bottom-0 right-0 h-64 w-64 translate-x-16 translate-y-16 rounded-full bg-amber-100/60 blur-[120px]" />
      </div>

      <main className="relative z-10 mx-auto flex max-w-6xl flex-col gap-16 px-6 pb-20 pt-16 sm:px-10 lg:px-12">
        <section className="rounded-3xl border border-white/60 bg-white/70 p-8 shadow-xl shadow-emerald-100 backdrop-blur">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <div className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-1 text-sm text-white">
              <Sparkles className="h-4 w-4" />
              <span>{t("hero.betaPill")}</span>
            </div>
            <LanguageSwitcher />
          </div>
          <div className="grid gap-8 lg:grid-cols-[minmax(0,_3fr)_minmax(0,_2fr)]">
            <div className="space-y-6">
              <h1 className="text-4xl font-semibold tracking-tight text-slate-900 sm:text-5xl lg:text-6xl">
                {t("hero.title")}
              </h1>
              <p className="text-lg leading-relaxed text-slate-600">
                {t("hero.description")}
              </p>
              <div className="flex flex-wrap gap-4">
                <button className="group inline-flex items-center gap-2 rounded-full bg-slate-900 px-6 py-3 text-base font-medium text-white shadow-lg shadow-slate-900/20 transition hover:-translate-y-0.5">
                  {t("hero.primaryCta")}
                  <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
                </button>
                <button className="inline-flex items-center gap-2 rounded-full border border-slate-300/80 bg-white px-6 py-3 text-base font-medium text-slate-700 transition hover:border-slate-900">
                  {t("hero.secondaryCta")}
                </button>
              </div>
              <div className="flex flex-wrap gap-6 text-sm text-slate-500">
                {heroBullets.map((bullet) => (
                  <span key={bullet}>✓ {t(bullet)}</span>
                ))}
              </div>
            </div>
            <div className="grid gap-4 rounded-2xl bg-slate-50/80 p-4">
              {previewCards.map((card) => (
                <div
                  key={card.labelKey}
                  className={`rounded-2xl ${card.tone} p-4 shadow-inner shadow-slate-200`}
                >
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
                    {t(card.labelKey)}
                  </p>
                  <h3 className="mt-2 text-lg font-semibold text-slate-900">
                    {t(card.titleKey)}
                  </h3>
                  <p className="text-sm text-slate-600">{t(card.detailKey)}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-3">
          {features.map((feature) => (
            <article
              key={feature.titleKey}
              className="rounded-3xl border border-white/40 bg-white/70 p-6 shadow-md shadow-emerald-50 backdrop-blur"
            >
              <div className={`mb-4 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br ${feature.accent}`}>
                <feature.icon className="h-6 w-6 text-slate-900" />
              </div>
              <h3 className="text-xl font-semibold text-slate-900">{t(feature.titleKey)}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">
                {t(feature.descriptionKey)}
              </p>
            </article>
          ))}
        </section>

        <section className="grid gap-6 lg:grid-cols-[minmax(0,_6fr)_minmax(0,_5fr)]">
          <PersonalCoachDemo />
          <div className="rounded-3xl border border-white/40 bg-white/70 p-6 shadow-lg shadow-emerald-100">
            <p className="text-xs uppercase tracking-[0.4em] text-slate-500">{t("coachSection.badge")}</p>
            <h2 className="mt-3 text-3xl font-semibold text-slate-900">
              {t("coachSection.title")}
            </h2>
            <p className="mt-3 text-base text-slate-600">
              {t("coachSection.description")}
            </p>
            <ul className="mt-5 space-y-3 text-sm text-slate-600">
              <li className="flex items-center gap-2">
                <MessageCircleHeart className="h-4 w-4 text-emerald-500" /> {t("coachSection.bullets.care")}
              </li>
              <li className="flex items-center gap-2">
                <Timer className="h-4 w-4 text-emerald-500" /> {t("coachSection.bullets.time")}
              </li>
              <li className="flex items-center gap-2">
                <Utensils className="h-4 w-4 text-emerald-500" /> {t("coachSection.bullets.result")}
              </li>
            </ul>
            <button className="mt-6 inline-flex items-center gap-2 rounded-full border border-slate-300/80 px-6 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-900">
              {t("coachSection.cta")}
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </section>

        <section className="rounded-3xl border border-white/40 bg-white/80 p-8 shadow-lg shadow-emerald-100 backdrop-blur">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.4em] text-slate-500">{t("livePanelSection.badge")}</p>
              <h2 className="mt-3 text-3xl font-semibold text-slate-900">
                {t("livePanelSection.title")}
              </h2>
            </div>
            <button className="inline-flex items-center gap-2 rounded-full border border-slate-300/80 px-5 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-900">
              {t("livePanelSection.cta")}
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
          <div className="mt-8 grid gap-6 md:grid-cols-3">
            {livePanels.map((panel) => (
              <article
                key={panel.titleKey}
                className="rounded-3xl border border-slate-100 bg-slate-50/80 p-5 shadow-inner shadow-white"
              >
                <div className="flex items-center gap-3">
                  <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-slate-900">
                    <panel.icon className="h-5 w-5" />
                  </div>
                  <div className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">
                    {t(panel.badgeKey)}
                  </div>
                </div>
                <h3 className="mt-4 text-2xl font-semibold text-slate-900">{t(panel.titleKey)}</h3>
                <p className="text-sm text-slate-500">{t(panel.statKey)}</p>
                <p className="mt-3 text-base text-slate-600">{t(panel.detailKey)}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="rounded-3xl border border-white/40 bg-white/80 p-8 shadow-lg shadow-emerald-100 backdrop-blur">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.4em] text-slate-500">{t("ritualSection.badge")}</p>
              <h2 className="mt-3 text-3xl font-semibold text-slate-900">
                {t("ritualSection.title")}
              </h2>
            </div>
            <div className="flex items-center gap-3 rounded-full bg-slate-100 px-5 py-2 text-sm font-medium text-slate-600">
              <BellRing className="h-4 w-4" />
              {t("ritualSection.reminder")}
            </div>
          </div>
          <div className="mt-8 grid gap-6 md:grid-cols-3">
            {rituals.map((ritual, index) => (
              <div key={ritual.titleKey} className="space-y-3">
                <div className="flex items-center gap-3 text-sm font-semibold text-slate-400">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-900 text-white">
                    {index + 1}
                  </span>
                  <span className="uppercase tracking-[0.2em]">
                    {t("general.stepLabel")} {index + 1}
                  </span>
                </div>
                <h3 className="text-xl font-semibold text-slate-900">{t(ritual.titleKey)}</h3>
                <p className="text-sm text-slate-600">{t(ritual.detailKey)}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-3xl border border-white/30 bg-gradient-to-br from-emerald-600 via-emerald-500 to-teal-500 p-8 text-white shadow-emerald-300">
          <div className="grid gap-8 lg:grid-cols-2">
            <div className="space-y-4">
              <p className="text-xs uppercase tracking-[0.4em] text-white/70">{t("futureSection.badge")}</p>
              <h2 className="text-3xl font-semibold">
                {t("futureSection.title")}
              </h2>
              <p className="text-base text-white/80">
                {t("futureSection.description")}
              </p>
            </div>
            <ul className="space-y-4 text-base text-white">
              {futureItems.map((item) => (
                <li key={item.textKey} className="flex items-center gap-3">
                  <item.icon className="h-5 w-5" /> {t(item.textKey)}
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="rounded-3xl border border-white/60 bg-white/90 p-8 shadow-xl shadow-emerald-100">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.4em] text-slate-500">{t("missionsSection.badge")}</p>
              <h2 className="mt-3 text-3xl font-semibold text-slate-900">
                {t("missionsSection.title")}
              </h2>
            </div>
            <div className="rounded-full bg-slate-100 px-5 py-2 text-sm font-semibold text-slate-700">
              {t("missionsSection.streakInfo")}
            </div>
          </div>
          <div className="mt-8 grid gap-6 md:grid-cols-3">
            {missions.map((mission) => (
              <article
                key={mission.titleKey}
                className="rounded-3xl border border-white/60 bg-gradient-to-br from-slate-50 to-white p-6 shadow-md shadow-white/40"
              >
                <div className="flex items-center justify-between text-sm uppercase tracking-[0.3em] text-slate-400">
                  <span>{t(mission.statusKey)}</span>
                  <span>{t(mission.pointsKey)}</span>
                </div>
                <div className="mt-4 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-900 text-white">
                  <mission.icon className="h-6 w-6" />
                </div>
                <h3 className="mt-4 text-xl font-semibold text-slate-900">{t(mission.titleKey)}</h3>
                <p className="mt-2 text-sm text-slate-600">{t(mission.descriptionKey)}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="rounded-3xl border border-white/50 bg-white/80 p-8 shadow-lg shadow-slate-200">
          <div className="grid gap-8 lg:grid-cols-2">
            <div>
              <p className="text-xs uppercase tracking-[0.4em] text-slate-500">{t("insightsSection.badge")}</p>
              <h2 className="mt-3 text-3xl font-semibold text-slate-900">
                {t("insightsSection.title")}
              </h2>
              <p className="mt-3 text-base text-slate-600">
                {t("insightsSection.description")}
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {insights.map((insight) => (
                <article
                  key={insight.titleKey}
                  className="rounded-2xl border border-slate-100 bg-slate-50/80 p-4 shadow-inner shadow-white"
                >
                  <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-full bg-white text-slate-900">
                    <insight.icon className="h-5 w-5" />
                  </div>
                  <h3 className="text-lg font-semibold text-slate-900">{t(insight.titleKey)}</h3>
                  <p className="text-sm text-slate-600">{t(insight.detailKey)}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-slate-900/10 bg-slate-900 text-white p-8 shadow-2xl shadow-slate-900/40">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-3">
              <p className="text-xs uppercase tracking-[0.4em] text-white/60">{t("closingSection.badge")}</p>
              <h2 className="text-3xl font-semibold">{t("closingSection.title")}</h2>
              <p className="text-base text-white/80">
                {t("closingSection.description")}
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <button className="inline-flex items-center justify-center rounded-full bg-white px-6 py-3 text-base font-semibold text-slate-900 shadow-lg shadow-white/30 transition hover:-translate-y-0.5">
                {t("closingSection.primaryCta")}
              </button>
              <button className="rounded-full border border-white/40 px-6 py-3 text-base font-semibold text-white transition hover:bg-white/10">
                {t("closingSection.secondaryCta")}
              </button>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
