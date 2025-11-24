"use client";
// Force rebuild

import Image from "next/image";
import { LanguageSwitcher } from "@/components/language-switcher";
import { MissionHighlights } from "@/components/mission-highlights";
import { QuickLogPanel } from "@/components/quick-log";
import { CoachSection } from "@/components/coach-section";
import { MultimodalInput } from "@/components/logging/MultimodalInput";
import { useTranslation } from "react-i18next";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { analyzeFoodFromText, logNutrition, logWater } from "@/lib/actions";
import {
    ArrowRight,
    BellRing,
    Droplet,
    Droplets,
    Flame,
    HeartPulse,
    Leaf,
    MapPin,
    MessageCircle,
    Moon,
    Sparkles,
    Timer,
    TrendingUp,
    Utensils,
    Zap,
    type LucideIcon,
} from "lucide-react";

type MacroCard = {
    labelKey: string;
    detailKey: string;
    value: number;
    goal: number;
    unit: string;
    icon: LucideIcon;
    accent: string;
    barColor: string;
};

type DailyStats = {
    nutrition: {
        calories: number;
        protein: number;
        carbs: number;
        fats: number;
    };
    water: number;
    goals: {
        calories: number;
        protein: number;
        carbs: number;
        fats: number;
        water: number;
    };
};

type DailyPlanContent = {
    morning: { title: string; detail: string };
    lunch: { title: string; detail: string };
    dinner: { title: string; detail: string };
    tip: string;
};

const actionPlan = [
    {
        titleKey: "dashboard.plan.morning.title",
        detailKey: "dashboard.plan.morning.detail",
        tagKey: "dashboard.plan.morning.tag",
        time: "08:30",
        icon: Flame,
        accent: "bg-emerald-50 text-emerald-700",
    },
    {
        titleKey: "dashboard.plan.lunch.title",
        detailKey: "dashboard.plan.lunch.detail",
        tagKey: "dashboard.plan.lunch.tag",
        time: "13:00",
        icon: HeartPulse,
        accent: "bg-amber-50 text-amber-700",
    },
    {
        titleKey: "dashboard.plan.checkin.title",
        detailKey: "dashboard.plan.checkin.detail",
        tagKey: "dashboard.plan.checkin.tag",
        time: "21:15",
        icon: Moon,
        accent: "bg-slate-900 text-white",
    },
];

const neighborSpots = [
    {
        nameKey: "dashboard.neighborhood.greenMood.name",
        detailKey: "dashboard.neighborhood.greenMood.detail",
        distance: "200 m",
    },
    {
        nameKey: "dashboard.neighborhood.huerta.name",
        detailKey: "dashboard.neighborhood.huerta.detail",
        distance: "450 m",
    },
];

const mindfulMoments = [
    {
        labelKey: "dashboard.mindful.energy",
        value: "media",
        icon: Zap,
    },
    {
        labelKey: "dashboard.mindful.hunger",
        value: "dulce",
        icon: Droplets,
    },
    {
        labelKey: "dashboard.mindful.mood",
        value: "curiosa",
        icon: Sparkles,
    },
];

const quickWins = [
    {
        labelKey: "dashboard.quickwins.voice",
        detailKey: "dashboard.quickwins.voiceDetail",
        icon: Timer,
    },
    {
        labelKey: "dashboard.quickwins.pantryscan",
        detailKey: "dashboard.quickwins.pantryscanDetail",
        icon: TrendingUp,
    },
    {
        labelKey: "dashboard.quickwins.walk",
        detailKey: "dashboard.quickwins.walkDetail",
        icon: MapPin,
    },
];

export default function DashboardClient({
    dailyPlan,
    streak = 0,
    dailyStats
}: {
    dailyPlan?: DailyPlanContent;
    streak?: number;
    dailyStats?: DailyStats | null;
}) {
    const { t } = useTranslation();
    const router = useRouter();
    const [notes, setNotes] = useState("");
    const [isMultimodalOpen, setIsMultimodalOpen] = useState(false);
    const locale = t("dashboard.locale", { defaultValue: "es-AR" });
    const today = new Date();
    const formattedDate = new Intl.DateTimeFormat(locale, {
        weekday: "long",
        day: "numeric",
        month: "long",
    }).format(today);

    // Automatic Timezone Detection
    useEffect(() => {
        const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        document.cookie = `user_timezone=${timezone}; path=/; max-age=31536000`;
    }, []);

    const heroTarget = dailyStats?.goals.calories || 2100;
    const heroCurrent = dailyStats?.nutrition.calories || 0;
    const heroProgress = Math.min(heroCurrent / heroTarget, 1);

    const hydrationGoal = dailyStats?.goals.water || 2000;
    const hydrationCurrent = dailyStats?.water || 0;
    const hydrationGlasses = 8;
    const hydrationDone = Math.min(Math.floor((hydrationCurrent / hydrationGoal) * hydrationGlasses), hydrationGlasses);
    const streakDays = streak;

    const macroCards: MacroCard[] = [
        {
            labelKey: "dashboard.macros.protein.label",
            detailKey: "dashboard.macros.protein.detail",
            value: dailyStats?.nutrition.protein || 0,
            goal: dailyStats?.goals.protein || 110,
            unit: "g",
            icon: Utensils,
            accent: "from-emerald-200/80 to-emerald-100/40",
            barColor: "bg-emerald-500",
        },
        {
            labelKey: "dashboard.macros.carbs.label",
            detailKey: "dashboard.macros.carbs.detail",
            value: dailyStats?.nutrition.carbs || 0,
            goal: dailyStats?.goals.carbs || 220,
            unit: "g",
            icon: Flame,
            accent: "from-amber-200/80 to-orange-100/40",
            barColor: "bg-amber-500",
        },
        {
            labelKey: "dashboard.macros.fats.label",
            detailKey: "dashboard.macros.fats.detail",
            value: dailyStats?.nutrition.fats || 0,
            goal: dailyStats?.goals.fats || 65,
            unit: "g",
            icon: Leaf,
            accent: "from-lime-200/80 to-green-100/40",
            barColor: "bg-lime-600",
        },
    ];

    const handleAddWater = async () => {
        const amount = 250; // 1 glass
        await logWater(amount);
        router.refresh();
    };

    const getCopy = (key: string, fallback: string) =>
        t(key, { defaultValue: fallback });

    const currentPlan = dailyPlan ? [
        {
            titleKey: dailyPlan.morning.title,
            detailKey: dailyPlan.morning.detail,
            tagKey: "dashboard.plan.morning.tag",
            time: "08:30",
            icon: Flame,
            accent: "bg-emerald-50 text-emerald-700",
            isDynamic: true
        },
        {
            titleKey: dailyPlan.lunch.title,
            detailKey: dailyPlan.lunch.detail,
            tagKey: "dashboard.plan.lunch.tag",
            time: "13:00",
            icon: HeartPulse,
            accent: "bg-amber-50 text-amber-700",
            isDynamic: true
        },
        {
            titleKey: dailyPlan.dinner.title,
            detailKey: dailyPlan.dinner.detail,
            tagKey: "dashboard.plan.dinner.tag",
            time: "20:00",
            icon: Utensils,
            accent: "bg-slate-900 text-white",
            isDynamic: true
        },
    ] : actionPlan;

    return (
        <div className="relative min-h-screen bg-[#f6f3ec] text-slate-900">
            <div className="pointer-events-none absolute inset-0 overflow-hidden">
                <div className="absolute -top-32 left-16 h-72 w-72 rounded-full bg-emerald-200/40 blur-[140px]" />
                <div className="absolute bottom-0 right-0 h-[420px] w-[420px] rounded-full bg-amber-100/40 blur-[160px]" />
            </div>

            <main className="relative z-10 mx-auto max-w-6xl px-6 py-12 sm:px-10">
                <header className="mb-10 flex flex-wrap items-center justify-between gap-6">
                    <div className="flex items-center gap-0">
                        <div className="relative h-44 w-44 -ml-6">
                            <Image
                                src="/images/girl-avatar.png"
                                alt="Alma Avatar"
                                fill
                                className="object-contain drop-shadow-xl"
                                priority
                            />
                        </div>
                        <div className="space-y-2">
                            <p className="text-xs uppercase tracking-[0.4em] text-slate-500">
                                {getCopy("dashboard.header.badge", "Panel diario")}
                            </p>
                            <h1 className="text-4xl font-semibold tracking-tight text-slate-900">
                                {getCopy("dashboard.header.title", "Hola, soy Alma")}
                            </h1>
                            <p className="capitalize text-sm text-slate-500">{formattedDate}</p>
                        </div>
                    </div>
                    <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center">
                        <button
                            onClick={() => router.push("/chat")}
                            className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow-lg shadow-slate-900/20 transition hover:bg-slate-800"
                        >
                            <MessageCircle className="h-4 w-4" />
                            Chat
                        </button>
                        <button className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/80 px-4 py-2 text-sm font-medium text-slate-700 shadow-sm shadow-white/40 transition hover:border-slate-400">
                            <BellRing className="h-4 w-4" />
                            {getCopy("dashboard.header.alerts", "Notificaciones suaves")}
                        </button>
                        <div className="flex w-full justify-center sm:w-auto sm:justify-end">
                            <LanguageSwitcher
                                variant="minimal"
                                className="w-full max-w-xl rounded-3xl border border-white/70 bg-white/90 px-3 py-2 shadow-sm shadow-white/60"
                            />
                        </div>
                    </div>
                </header>

                <section className="grid gap-6 lg:grid-cols-[minmax(0,_3fr)_minmax(0,_2fr)]">
                    <article className="relative overflow-hidden rounded-3xl border border-white/60 bg-white/80 p-8 shadow-xl shadow-emerald-100">
                        <div className="flex flex-col gap-8 lg:flex-row lg:items-center">
                            <div className="space-y-4">
                                <span className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-1 text-xs font-semibold uppercase tracking-[0.4em] text-white">
                                    <Sparkles className="h-3.5 w-3.5" />
                                    {getCopy("dashboard.hero.badge", "Energía calibrada")}
                                </span>
                                <h2 className="text-3xl font-semibold text-slate-900">
                                    {getCopy(
                                        "dashboard.hero.title",
                                        "Tu día está en equilibrio"
                                    )}
                                </h2>
                                <p className="text-base text-slate-600">
                                    {getCopy(
                                        "dashboard.hero.description",
                                        "Tu ingesta acompaña tu ritmo hormonal. Seguimos de cerca tus antojos y recordatorios para mantener la energía estable."
                                    )}
                                </p>
                                <div className="flex flex-wrap gap-4 text-sm text-slate-500">
                                    {mindfulMoments.map((moment) => (
                                        <span
                                            key={moment.labelKey}
                                            className="inline-flex items-center gap-2 rounded-full bg-emerald-50/80 px-3 py-1"
                                        >
                                            <moment.icon className="h-4 w-4 text-emerald-600" />
                                            {getCopy(moment.labelKey, "Registro")} · {moment.value}
                                        </span>
                                    ))}
                                </div>
                                <div className="flex flex-wrap gap-3">
                                    <button className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-slate-900/30 transition hover:-translate-y-0.5">
                                        {getCopy("dashboard.hero.primaryCta", "Ver ritual de hoy")}
                                        <ArrowRight className="h-4 w-4" />
                                    </button>
                                    <button
                                        onClick={() => setIsMultimodalOpen(true)}
                                        className="inline-flex items-center gap-2 rounded-full border border-slate-300/80 bg-white/60 px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-slate-900"
                                    >
                                        {getCopy("dashboard.hero.secondaryCta", "Registrar audio")}
                                    </button>
                                </div>
                            </div>
                            <div className="flex flex-1 items-center justify-center">
                                <div className="relative h-56 w-56">
                                    <div
                                        className="absolute inset-0 rounded-full"
                                        style={{
                                            background: `conic-gradient(#0f766e ${heroProgress * 360}deg, rgba(15,23,42,0.08) ${heroProgress * 360}deg)`,
                                        }}
                                    />
                                    <div className="absolute inset-4 rounded-full bg-white shadow-inner shadow-slate-200" />
                                    <div className="absolute inset-10 flex flex-col items-center justify-center rounded-full bg-gradient-to-b from-white via-white to-emerald-50 text-center">
                                        <p className="text-xs uppercase tracking-[0.4em] text-slate-400">
                                            {getCopy("dashboard.hero.calories", "Calorías")}
                                        </p>
                                        <p className="mt-2 text-4xl font-semibold text-slate-900">{heroCurrent}</p>
                                        <p className="text-sm text-slate-500">
                                            {getCopy("dashboard.hero.goal", "de")}
                                            {" "}
                                            {heroTarget}
                                        </p>
                                        <span className="mt-3 rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
                                            {Math.round(heroProgress * 100)}% {getCopy("dashboard.hero.ready", "completado")}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </article>

                    <div className="space-y-6">
                        {currentPlan.map((item) => (
                            <article
                                key={item.titleKey}
                                className="rounded-3xl border border-white/60 bg-white/80 p-6 shadow-lg shadow-emerald-100"
                            >
                                <div className="flex items-center justify-between">
                                    <div className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.3em] ${item.accent}`}>
                                        <item.icon className="h-4 w-4" />
                                        {getCopy(item.tagKey, "Ritual")}
                                    </div>
                                    <span className="text-sm font-semibold text-slate-500">{item.time}</span>
                                </div>
                                <h3 className="mt-4 text-xl font-semibold text-slate-900">
                                    {'isDynamic' in item && item.isDynamic ? item.titleKey : getCopy(item.titleKey, "Título del plan")}
                                </h3>
                                <p className="text-sm text-slate-600">
                                    {'isDynamic' in item && item.isDynamic ? item.detailKey : getCopy(item.detailKey, "Descripción breve")}
                                </p>
                            </article>
                        ))}
                    </div>
                </section>

                <div className="my-6 -mx-6 flex justify-center sm:-mx-10">
                    <Image
                        src="/images/separador_trimmed_1.png"
                        alt="Separator"
                        width={1000}
                        height={100}
                        className="h-auto w-full object-cover"
                    />
                </div>

                <section className="mt-10">
                    <QuickLogPanel
                        notes={notes}
                        onNotesChange={setNotes}
                        onVoiceClick={() => setIsMultimodalOpen(true)}
                    />
                </section>

                <section className="mt-10">
                    <MissionHighlights />
                </section>

                <section className="mt-10">
                    <CoachSection onCtaClick={() => router.push("/chat")} />
                </section>

                <div className="my-6 -mx-6 flex justify-center sm:-mx-10">
                    <Image
                        src="/images/separador_trimmed_4.png"
                        alt="Separator"
                        width={1000}
                        height={100}
                        className="h-auto w-full object-cover"
                    />
                </div>

                <section className="mt-10 grid gap-6 md:grid-cols-3">
                    {macroCards.map((card) => {
                        const progress = Math.min(card.value / card.goal, 1);
                        return (
                            <article
                                key={card.labelKey}
                                className="rounded-3xl border border-white/60 bg-white/80 p-5 shadow-inner shadow-white"
                            >
                                <div className={`inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br ${card.accent}`}>
                                    <card.icon className="h-5 w-5 text-slate-900" />
                                </div>
                                <p className="mt-4 text-xs uppercase tracking-[0.4em] text-slate-400">
                                    {getCopy(card.detailKey, "Meta diaria")}
                                </p>
                                <h3 className="text-2xl font-semibold text-slate-900">
                                    {card.value}
                                    {card.unit}
                                </h3>
                                <p className="text-sm text-slate-500">
                                    {getCopy(card.labelKey, "Macronutriente")} · {card.goal}
                                    {card.unit}
                                </p>
                                <div className="mt-4 h-2 rounded-full bg-slate-100">
                                    <div
                                        className={`h-full rounded-full ${card.barColor}`}
                                        style={{ width: `${progress * 100}%` }}
                                    />
                                </div>
                            </article>
                        );
                    })}
                </section>

                <section className="mt-10 grid gap-6 lg:grid-cols-[minmax(0,_3fr)_minmax(0,_2fr)]">
                    <article className="rounded-3xl border border-white/60 bg-gradient-to-br from-emerald-600 via-emerald-500 to-teal-500 p-6 text-white shadow-emerald-300">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-xs uppercase tracking-[0.4em] text-white/70">
                                    {getCopy("dashboard.water.badge", "Hidratación")}
                                </p>
                                <h3 className="mt-2 text-3xl font-semibold">
                                    {getCopy("dashboard.water.title", "Agua del día")}
                                </h3>
                            </div>
                            <Droplet className="h-8 w-8" />
                        </div>
                        <p className="mt-2 text-sm text-white/80">
                            {getCopy(
                                "dashboard.water.detail",
                                "Registra vasos reales para evitar inflamación vespertina."
                            )}
                        </p>
                        <div className="mt-6 flex flex-wrap items-end gap-6">
                            <div>
                                <p className="text-4xl font-semibold">{hydrationCurrent} ml</p>
                                <p className="text-sm text-white/70">
                                    {getCopy("dashboard.water.goal", "Meta")}: {hydrationGoal} ml
                                </p>
                            </div>
                            <div className="grid flex-1 grid-cols-8 gap-2">
                                {Array.from({ length: hydrationGlasses }).map((_, index) => (
                                    <span
                                        key={index}
                                        className={`h-12 rounded-2xl border border-white/40 ${index < hydrationDone
                                            ? "bg-white/90"
                                            : "bg-white/10"
                                            }`}
                                    />
                                ))}
                            </div>
                        </div>
                        <button
                            onClick={handleAddWater}
                            className="mt-6 inline-flex items-center gap-2 rounded-full bg-white/10 px-5 py-2 text-sm font-semibold text-white transition hover:bg-white/20"
                        >
                            {getCopy("dashboard.water.cta", "Sumar un vaso")}
                        </button>
                    </article>

                    <article className="rounded-3xl border border-white/60 bg-white/80 p-6 shadow-lg shadow-emerald-100">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-xs uppercase tracking-[0.4em] text-slate-400">
                                    {getCopy("dashboard.streak.badge", "Racha mindful")}
                                </p>
                                <h3 className="mt-2 text-3xl font-semibold text-slate-900">
                                    {getCopy("dashboard.streak.title", "Días en sintonía")}
                                </h3>
                            </div>
                            <Sparkles className="h-8 w-8 text-amber-500" />
                        </div>
                        <p className="mt-3 text-sm text-slate-600">
                            {getCopy(
                                "dashboard.streak.detail",
                                "Combinaste check-ins, agua y un plato vegetal cada día."
                            )}
                        </p>
                        <div className="mt-6 flex items-center gap-6">
                            <div className="text-center">
                                <p className="text-5xl font-semibold text-slate-900">{streakDays}</p>
                                <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
                                    {getCopy("dashboard.streak.days", "días")}
                                </p>
                            </div>
                            <div className="flex-1 space-y-2">
                                <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
                                    <span>{getCopy("dashboard.streak.next", "Próxima meta")}</span>
                                    <span>21</span>
                                </div>
                                <div className="h-2 rounded-full bg-slate-100">
                                    <div
                                        className="h-full rounded-full bg-slate-900"
                                        style={{ width: `${(streakDays / 21) * 100}%` }}
                                    />
                                </div>
                            </div>
                        </div>
                        <button className="mt-6 inline-flex items-center gap-2 rounded-full border border-slate-300/80 px-5 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-900">
                            {getCopy("dashboard.streak.cta", "Ver premios activos")}
                        </button>
                    </article>
                </section>

                <div className="my-6 -mx-6 flex justify-center sm:-mx-10">
                    <Image
                        src="/images/separador_trimmed_3.png"
                        alt="Separator"
                        width={1000}
                        height={100}
                        className="h-auto w-full object-cover"
                    />
                </div>

                <section className="mt-10 grid gap-6 lg:grid-cols-[minmax(0,_3fr)_minmax(0,_2fr)]">
                    <article className="rounded-3xl border border-white/60 bg-white/80 p-6 shadow-lg shadow-emerald-100">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-xs uppercase tracking-[0.4em] text-slate-400">
                                    {getCopy("dashboard.quickwins.badge", "Atajos")}
                                </p>
                                <h3 className="mt-2 text-2xl font-semibold text-slate-900">
                                    {getCopy("dashboard.quickwins.title", "Acciones rápidas")}
                                </h3>
                            </div>
                            <Zap className="h-6 w-6 text-emerald-500" />
                        </div>
                        <div className="mt-6 grid gap-4 md:grid-cols-3">
                            {quickWins.map((item) => (
                                <div
                                    key={item.labelKey}
                                    className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4"
                                >
                                    <div className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white text-slate-900 shadow">
                                        <item.icon className="h-5 w-5" />
                                    </div>
                                    <p className="mt-3 text-sm font-semibold text-slate-900">
                                        {getCopy(item.labelKey, "Acción")}
                                    </p>
                                    <p className="text-xs text-slate-500">
                                        {getCopy(item.detailKey, "Detalle breve")}
                                    </p>
                                </div>
                            ))}
                        </div>
                    </article>

                    <article className="rounded-3xl border border-white/60 bg-white/80 p-6 shadow-lg shadow-emerald-100">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-xs uppercase tracking-[0.4em] text-slate-400">
                                    {getCopy("dashboard.neighborhood.badge", "Cerca tuyo")}
                                </p>
                                <h3 className="mt-2 text-2xl font-semibold text-slate-900">
                                    {getCopy("dashboard.neighborhood.title", "Vecindario mindful")}
                                </h3>
                            </div>
                            <MapPin className="h-6 w-6 text-rose-500" />
                        </div>
                        <div className="mt-6 space-y-4">
                            {neighborSpots.map((spot) => (
                                <div
                                    key={spot.nameKey}
                                    className="flex items-center justify-between rounded-2xl border border-slate-100 bg-white/80 px-4 py-3"
                                >
                                    <div>
                                        <p className="text-sm font-semibold text-slate-900">
                                            {getCopy(spot.nameKey, "Local saludable")}
                                        </p>
                                        <p className="text-xs text-slate-500">
                                            {getCopy(spot.detailKey, "Detalle del local")}
                                        </p>
                                    </div>
                                    <span className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">
                                        {spot.distance}
                                    </span>
                                </div>
                            ))}
                        </div>
                        <button className="mt-6 inline-flex items-center gap-2 rounded-full border border-slate-300/80 px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-slate-700 transition hover:border-slate-900">
                            {getCopy("dashboard.neighborhood.cta", "Ver mapa completo")}
                        </button>
                    </article>
                </section>
            </main>

            <MultimodalInput
                isOpen={isMultimodalOpen}
                onClose={() => setIsMultimodalOpen(false)}
                onConfirm={async (result) => {
                    console.log("Audio result:", result);

                    if (result.text) {
                        console.log("Analyzing food from text:", result.text);
                        const analysis = await analyzeFoodFromText(result.text);
                        console.log("Analysis result:", analysis);

                        if (analysis) {
                            await logNutrition({
                                name: analysis.name,
                                calories: analysis.calories,
                                protein: analysis.protein,
                                carbs: analysis.carbs,
                                fats: analysis.fats,
                            });

                            router.refresh();
                        }
                    }

                    setIsMultimodalOpen(false);
                }}
            />
        </div>
    );
}
