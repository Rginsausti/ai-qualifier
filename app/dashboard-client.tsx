"use client";

import { LanguageSwitcher } from "@/components/language-switcher";
import { MissionHighlights } from "@/components/mission-highlights";
import { QuickLogPanel } from "@/components/quick-log";
import { CoachSection } from "@/components/coach-section";
import { MultimodalInput } from "@/components/logging/MultimodalInput";
import NearbyProductFinder from "@/components/product-search/NearbyProductFinder";
import { useTranslation } from "react-i18next";
import { useRouter } from "next/navigation";
import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import type { KeyboardEvent } from "react";
import Image from "next/image";
import { logWater, logNutrition, analyzeFoodFromText } from "@/lib/actions";
import { usePushNotifications } from "@/lib/hooks/usePushNotifications";
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
  X,
  type LucideIcon,
} from "lucide-react";

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

type QuickLogSnapshot = {
  energy: "high" | "medium" | "low" | null;
  hunger: number | null;
  craving: "sweet" | "savory" | "fresh" | null;
};

const normalizeEnergy = (value: string | null | undefined): QuickLogSnapshot["energy"] => {
  return value === "high" || value === "medium" || value === "low" ? value : null;
};

const normalizeCraving = (value: string | null | undefined): QuickLogSnapshot["craving"] => {
  return value === "sweet" || value === "savory" || value === "fresh" ? value : null;
};

const normalizeHunger = (value: number | null | undefined): number => {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return 3;
  }
  return Math.min(5, Math.max(1, Math.round(value)));
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

type DailyPlanContent = {
  morning: { title: string; detail: string };
  lunch: { title: string; detail: string };
  dinner: { title: string; detail: string };
  tip: string;
};

type SectionSeparatorProps = {
  src: string;
  height?: number;
  className?: string;
  maxHeight?: number;
  fit?: "cover" | "contain";
};

const SectionSeparator = ({
  src,
  height = 120,
  className = "",
  maxHeight,
  fit = "cover",
}: SectionSeparatorProps) => {
  const appliedStyle = maxHeight
    ? { maxHeight, height: maxHeight }
    : undefined;
  const heightClass = maxHeight ? "h-full" : "h-auto";

  return (
    <div
      className={`relative left-1/2 right-1/2 w-screen -translate-x-1/2 ${className}`}
      style={appliedStyle}
    >
      <Image
        src={src}
        alt=""
        width={1920}
        height={height}
        sizes="100vw"
        className={`pointer-events-none ${heightClass} w-full select-none ${fit === "contain" ? "object-contain" : "object-cover"}`}
        style={appliedStyle}
        aria-hidden="true"
      />
    </div>
  );
};

type InstallGuideModalProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle: string;
  steps: string[];
  closeLabel: string;
};

const InstallGuideModal = ({ open, onClose, title, subtitle, steps, closeLabel }: InstallGuideModalProps) => {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 px-4 py-10"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-md rounded-3xl border border-white/70 bg-white/95 p-6 text-slate-900 shadow-2xl">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-emerald-600">iOS</p>
          <h3 className="text-2xl font-semibold">{title}</h3>
          <p className="text-sm text-slate-500">{subtitle}</p>
        </div>
        <ol className="mt-6 space-y-3 text-sm text-slate-700">
          {steps.map((step, index) => (
            <li key={index} className="flex items-start gap-3 rounded-2xl bg-slate-50/80 px-4 py-3">
              <span className="mt-0.5 inline-flex h-6 w-6 items-center justify-center rounded-full bg-emerald-100 text-xs font-semibold text-emerald-700">
                {index + 1}
              </span>
              <p>{step}</p>
            </li>
          ))}
        </ol>
        <button
          onClick={onClose}
          className="mt-6 inline-flex w-full items-center justify-center rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-slate-900/20"
        >
          {closeLabel}
        </button>
      </div>
    </div>
  );
};

export default function DashboardClient({ 
  dailyPlan, 
  streak = 0,
  dailyStats,
  initialQuickLog,
}: { 
  dailyPlan?: DailyPlanContent; 
  streak?: number;
  dailyStats?: DailyStats | null;
  initialQuickLog?: { energy: string | null; hunger: number | null; craving: string | null } | null;
}) {
  const hydratedEnergy = normalizeEnergy(initialQuickLog?.energy ?? null);
  const hydratedCraving = normalizeCraving(initialQuickLog?.craving ?? null);
  const hydratedHunger = normalizeHunger(initialQuickLog?.hunger ?? null);
  const { t } = useTranslation();
  const router = useRouter();
  const [notes, setNotes] = useState("");
  const [isMultimodalOpen, setIsMultimodalOpen] = useState(false);
  const [multimodalMode, setMultimodalMode] = useState<"voice" | "multi">("multi");
  const [energyLevel, setEnergyLevel] = useState<"high" | "medium" | "low" | null>(hydratedEnergy);
  const [hungerLevel, setHungerLevel] = useState(hydratedHunger);
  const [cravingType, setCravingType] = useState<"sweet" | "savory" | "fresh" | null>(hydratedCraving);
  const [stats, setStats] = useState<DailyStats | null>(dailyStats || null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [foodNote, setFoodNote] = useState("");
  const [foodNoteStatus, setFoodNoteStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [foodNoteError, setFoodNoteError] = useState<string | null>(null);
  const [isFoodNoteDialogOpen, setIsFoodNoteDialogOpen] = useState(false);
  const [showInstallGuide, setShowInstallGuide] = useState(false);
  const planSectionRef = useRef<HTMLElement | null>(null);
  const quickLogSectionRef = useRef<HTMLElement | null>(null);
  const foodNoteResetTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const foodNoteTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const scrollToQuickLog = useCallback(() => {
    if (!quickLogSectionRef.current) return;
    quickLogSectionRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    quickLogSectionRef.current.focus?.({ preventScroll: true });
  }, []);
  const {
    isSupported: pushSupported,
    isEnabled: pushEnabled,
    isLoading: pushLoading,
    error: pushError,
    supportKnown: pushSupportKnown,
    requiresPwaInstall,
    enablePush,
    disablePush,
  } = usePushNotifications();

  const handleNotificationsToggle = async () => {
    if (pushEnabled) {
      await disablePush();
      return;
    }

    await enablePush();
  };

  const locale = t("dashboard.locale", { defaultValue: "es-AR" });
  const today = new Date();
  const formattedDate = new Intl.DateTimeFormat(locale, {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(today);

  // Update stats if prop changes (e.g. revalidation)
  useEffect(() => {
    if (dailyStats) setStats(dailyStats);
  }, [dailyStats]);

  useEffect(() => {
    return () => {
      if (foodNoteResetTimeout.current) {
        clearTimeout(foodNoteResetTimeout.current);
        foodNoteResetTimeout.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!isFoodNoteDialogOpen) return;
    const focusTimeout = setTimeout(() => {
      foodNoteTextareaRef.current?.focus();
    }, 50);
    return () => clearTimeout(focusTimeout);
  }, [isFoodNoteDialogOpen]);

  const getCopy = useCallback(
    (key: string, fallback: string) => t(key, { defaultValue: fallback }),
    [t]
  );

  const heroTarget = stats?.goals.calories || 2000;
  const heroCurrent = stats?.nutrition.calories || 0;
  const heroProgress = Math.min(heroCurrent / heroTarget, 1);

  const hydrationGoal = stats?.goals.water || 2000;
  const hydrationCurrent = stats?.water || 0;
  const hydrationGlasses = 8;
  const hydrationDone = Math.min(Math.floor((hydrationCurrent / hydrationGoal) * hydrationGlasses), hydrationGlasses);
  const streakDays = streak;

  const hungerBand: "low" | "medium" | "high" = useMemo(() => {
    if (hungerLevel <= 2) return "low";
    if (hungerLevel >= 4) return "high";
    return "medium";
  }, [hungerLevel]);

  const energyLabel = energyLevel
    ? t(`dashboard.quicklog.energy.options.${energyLevel}`)
    : getCopy("dashboard.hero.dynamic.energyFallback", "estable");
  const cravingLabel = cravingType
    ? t(`dashboard.quicklog.craving.options.${cravingType}`)
    : getCopy("dashboard.hero.dynamic.cravingFallback", "neutro");
  const hungerLabel = t(`dashboard.quicklog.hunger.scale.${hungerBand}`);
  const moodVariant = energyLevel === "high"
    ? "bright"
    : energyLevel === "low"
      ? "soft"
      : hungerBand === "high"
        ? "focused"
        : "curious";
  const moodLabel = t(`dashboard.mindful.moodStates.${moodVariant}`, {
    defaultValue: getCopy("dashboard.mindful.defaultMood", "curiosa"),
  });

  const heroCopy = !energyLevel && !cravingType
    ? {
        title: getCopy("dashboard.hero.title", "Tu día está en equilibrio"),
        description: getCopy(
          "dashboard.hero.description",
          "Tu ingesta acompaña tu ritmo hormonal. Seguimos de cerca tus antojos y recordatorios para mantener la energía estable."
        ),
      }
    : {
        title: t("dashboard.hero.dynamic.title", {
          energy: energyLabel.toLowerCase(),
          craving: cravingLabel.toLowerCase(),
        }),
        description: t("dashboard.hero.dynamic.description", {
          hunger: hungerLabel.toLowerCase(),
          craving: cravingLabel.toLowerCase(),
        }),
      };

  const emptyMindfulValue = getCopy("dashboard.mindful.emptyValue", "Pendiente");
  const mindfulMoments = [
    {
      label: getCopy("dashboard.mindful.energy", "Energía"),
      value: energyLevel ? energyLabel : emptyMindfulValue,
      icon: Zap,
    },
    {
      label: getCopy("dashboard.mindful.hunger", "Antojo"),
      value: cravingType ? cravingLabel : emptyMindfulValue,
      icon: Droplets,
    },
    {
      label: getCopy("dashboard.mindful.mood", "Ánimo"),
      value: energyLevel || cravingType ? moodLabel : emptyMindfulValue,
      icon: Sparkles,
    },
  ];

  const macroCards: MacroCard[] = [
    {
      labelKey: "dashboard.macros.protein.label",
      detailKey: "dashboard.macros.protein.detail",
      value: stats?.nutrition.protein || 0,
      goal: stats?.goals.protein || 110,
      unit: "g",
      icon: Utensils,
      accent: "from-emerald-200/80 to-emerald-100/40",
      barColor: "bg-emerald-500",
    },
    {
      labelKey: "dashboard.macros.carbs.label",
      detailKey: "dashboard.macros.carbs.detail",
      value: stats?.nutrition.carbs || 0,
      goal: stats?.goals.carbs || 220,
      unit: "g",
      icon: Flame,
      accent: "from-amber-200/80 to-orange-100/40",
      barColor: "bg-amber-500",
    },
    {
      labelKey: "dashboard.macros.fats.label",
      detailKey: "dashboard.macros.fats.detail",
      value: stats?.nutrition.fats || 0,
      goal: stats?.goals.fats || 65,
      unit: "g",
      icon: Leaf,
      accent: "from-lime-200/80 to-green-100/40",
      barColor: "bg-lime-600",
    },
  ];

  const handleAddWater = async () => {
    const amount = 250; // 1 glass
    // Optimistic update
    setStats(prev => prev ? ({
      ...prev,
      water: prev.water + amount
    }) : null);

    await logWater(amount);
    router.refresh();
  };

  const handleFoodAnalysis = async (text: string): Promise<boolean> => {
    setIsProcessing(true);
    try {
      const analysis = await analyzeFoodFromText(text);
      if (!analysis) {
        setNotes(prev => prev ? prev + "\n" + text : text);
        return false;
      }

      const rawType = typeof analysis.type === "string" ? analysis.type.toLowerCase() : undefined;
      const waterCandidate = analysis.water_ml ?? analysis.waterMl ?? analysis.water;
      const numericWater = typeof waterCandidate === "number" ? waterCandidate : Number(waterCandidate);
      const waterAmount = Number.isFinite(numericWater) ? Math.max(0, Math.round(numericWater)) : 0;
      const isWater = rawType === "water" || (!rawType && waterAmount > 0);

      if (isWater) {
        if (waterAmount > 0) {
          const result = await logWater(waterAmount);
          if (result?.success) {
            setStats(prev => prev ? ({
              ...prev,
              water: prev.water + waterAmount
            }) : prev);

            setNotes(prev => prev ? `${prev}\n[Agua registrada: ${waterAmount}ml]` : `[Agua registrada: ${waterAmount}ml]`);
            return true;
          }

          console.error("handleFoodAnalysis: failed to log water", result?.error);
          setNotes(prev => prev ? prev + "\n" + text : text);
          return false;
        }

        setNotes(prev => prev ? prev + "\n" + text : text);
        return false;
      }

      const result = await logNutrition({
        name: analysis.name,
        calories: analysis.calories ?? 0,
        protein: analysis.protein ?? 0,
        carbs: analysis.carbs ?? 0,
        fats: analysis.fats ?? 0,
      });

      if (!result?.success) {
        console.error("handleFoodAnalysis: failed to log nutrition", result?.error);
        setNotes(prev => prev ? prev + "\n" + text : text);
        return false;
      }

      // Optimistic update
      setStats(prev => prev ? ({
        ...prev,
        nutrition: {
          calories: prev.nutrition.calories + (analysis.calories ?? 0),
          protein: prev.nutrition.protein + (analysis.protein ?? 0),
          carbs: prev.nutrition.carbs + (analysis.carbs ?? 0),
          fats: prev.nutrition.fats + (analysis.fats ?? 0),
        }
      }) : null);

      const caloriesLogged = analysis.calories ?? 0;
      const entryLabel = analysis.name ?? "Registro";
      setNotes(prev => prev ? prev + `\n[Registrado: ${entryLabel} - ${caloriesLogged}kcal]` : `[Registrado: ${entryLabel} - ${caloriesLogged}kcal]`);
      return true;
    } catch (error) {
      console.error("Error analyzing food:", error);
      setNotes(prev => prev ? prev + "\n" + text : text);
      return false;
    } finally {
      setIsProcessing(false);
      router.refresh();
    }
  };

  const handleFoodNoteSubmit = async () => {
    const trimmed = foodNote.trim();
    if (!trimmed) {
      setFoodNoteError(getCopy("dashboard.hero.note.empty", "Necesito una nota para registrar."));
      setFoodNoteStatus("error");
      return;
    }

    setFoodNoteError(null);
    setFoodNoteStatus("loading");
    const logged = await handleFoodAnalysis(trimmed);

    if (logged) {
      setFoodNote("");
      setFoodNoteStatus("success");
      if (foodNoteResetTimeout.current) {
        clearTimeout(foodNoteResetTimeout.current);
      }
      foodNoteResetTimeout.current = setTimeout(() => {
        setFoodNoteStatus("idle");
        foodNoteResetTimeout.current = null;
      }, 2500);
      setIsFoodNoteDialogOpen(false);
      return;
    }

    setFoodNoteStatus("error");
    setFoodNoteError(getCopy("dashboard.hero.note.error", "No pude registrar la nota. Probá otra vez."));
  };

  const handleFoodNoteKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
      event.preventDefault();
      handleFoodNoteSubmit();
    }
  };


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
          <div className="flex items-start gap-4">
            <Image
              src="/images/girl-avatar.png"
              alt={getCopy("dashboard.hero.avatarAlt", "Ilustración de Alma sonriendo")}
              width={170}
              height={200}
              className="pointer-events-none w-28 -rotate-3 drop-shadow-2xl sm:w-32 md:w-36 lg:w-40"
              priority
            />
            <div className="space-y-2">
              <p className="text-xs uppercase tracking-[0.4em] text-slate-500">
                {getCopy("dashboard.header.badge", "Panel diario")}
              </p>
              <h1 className="text-4xl font-semibold tracking-tight text-slate-900">
                {getCopy("dashboard.header.title", "Hola Alma")}
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
            <button
              onClick={handleNotificationsToggle}
              disabled={pushLoading}
              className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium shadow-sm shadow-white/40 transition ${
                pushEnabled
                  ? "border-emerald-600 bg-emerald-600 text-white hover:bg-emerald-500"
                  : "border-slate-200 bg-white/80 text-slate-700 hover:border-slate-400"
              } disabled:cursor-not-allowed disabled:opacity-70`}
            >
              <BellRing className="h-4 w-4" />
              {pushLoading
                ? getCopy("dashboard.header.alerts.loading", "Sincronizando…")
                : pushEnabled
                  ? getCopy("dashboard.header.alerts.enabled", "Recordatorios activos")
                  : getCopy("dashboard.header.alerts.label", "Notificaciones suaves")}
            </button>
            <div className="flex w-full justify-center sm:w-auto sm:justify-end">
              <LanguageSwitcher
                variant="minimal"
                className="w-full max-w-xl rounded-3xl border border-white/70 bg-white/90 px-3 py-2 shadow-sm shadow-white/60"
              />
            </div>
          </div>
          {pushError && (
            <p className="text-xs font-medium text-rose-500">
              {pushError}
            </p>
          )}
          {pushSupportKnown && !pushSupported && (
            <p className="text-xs text-slate-500">
              {getCopy("dashboard.header.alerts.unsupported", "Tu navegador actual no soporta notificaciones push.")}
            </p>
          )}
          {requiresPwaInstall && pushSupportKnown && pushSupported && !pushEnabled && (
            <div className="flex w-full flex-col gap-3 text-xs text-slate-500 sm:flex-row sm:items-center">
              <p className="sm:flex-1">
                {getCopy(
                  "dashboard.header.alerts.installHint",
                  "En iOS agregá Alma a tu pantalla de inicio para habilitar los avisos."
                )}
              </p>
              <button
                type="button"
                onClick={() => setShowInstallGuide(true)}
                className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-slate-300/70 bg-white/80 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.3em] text-slate-700 shadow-sm transition hover:border-slate-900"
              >
                {getCopy(
                  "dashboard.header.alerts.installCta",
                  "Agregar a pantalla de inicio"
                )}
              </button>
            </div>
          )}
        </header>

        <section
          ref={planSectionRef}
          tabIndex={-1}
          className="grid gap-6 lg:grid-cols-[minmax(0,_3fr)_minmax(0,_2fr)]"
        >
          <article className="relative overflow-hidden rounded-3xl border border-white/60 bg-white/80 p-8 shadow-xl shadow-emerald-100">
            <div className="flex flex-col gap-8 lg:flex-row lg:items-center">
              <div className="space-y-5">
                <span className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-1 text-xs font-semibold uppercase tracking-[0.4em] text-white">
                  <Sparkles className="h-3.5 w-3.5" />
                  {getCopy("dashboard.hero.badge", "Energía calibrada")}
                </span>
                <h2 className="text-3xl font-semibold text-slate-900">
                  {heroCopy.title}
                </h2>
                <p className="text-base text-slate-600">
                  {heroCopy.description}
                </p>
                <div className="flex flex-wrap gap-4 text-sm text-slate-500">
                  {mindfulMoments.map((moment) => (
                    <button
                      type="button"
                      key={moment.label}
                      onClick={scrollToQuickLog}
                      className="inline-flex items-center gap-2 rounded-full bg-emerald-50/80 px-3 py-1 text-slate-700 transition hover:bg-emerald-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500 cursor-pointer"
                    >
                      <moment.icon className="h-4 w-4 text-emerald-600" />
                      {moment.label} · {moment.value}
                    </button>
                  ))}
                </div>
                <div className="flex flex-wrap gap-3">
                  <div className="flex flex-col gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setIsFoodNoteDialogOpen(true);
                        setFoodNoteError(null);
                      }}
                      className="inline-flex min-h-[48px] items-center gap-2 rounded-full bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-slate-900/30 transition hover:-translate-y-0.5"
                    >
                      {getCopy("dashboard.hero.note.label", "Registrar ingesta por nota")}
                      <ArrowRight className="h-4 w-4" />
                    </button>
                    {foodNoteStatus === "success" && (
                      <span className="text-xs font-semibold text-emerald-600" aria-live="polite">
                        {getCopy("dashboard.hero.note.success", "Guardado")}
                      </span>
                    )}
                  </div>
                  <button 
                    type="button"
                    onClick={() => {
                      setMultimodalMode("voice");
                      setIsMultimodalOpen(true);
                    }}
                    className="inline-flex min-h-[48px] items-center gap-2 self-start rounded-full border border-slate-300/80 bg-white/60 px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-slate-900"
                  >
                    {getCopy("dashboard.hero.secondaryCta", "Registrar audio")}
                  </button>
                </div>
              </div>
              <div className="flex flex-1 flex-col items-center gap-8">
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
                    {isProcessing ? (
                      <div className="mt-2 h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-emerald-500" />
                    ) : (
                      <p className="mt-2 text-4xl font-semibold text-slate-900">{heroCurrent}</p>
                    )}
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

                <div className="w-full max-w-xl space-y-6">
                  <div className="grid gap-6 md:grid-cols-3">
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
                  </div>

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
                            className={`h-12 rounded-2xl border border-white/40 ${
                              index < hydrationDone
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

        <SectionSeparator src="/images/separador_trimmed_1.png" height={200} className="mt-12" />

        <section ref={quickLogSectionRef} className="mt-10 focus:outline-none" tabIndex={-1}>
          <QuickLogPanel 
            notes={notes}
            onNotesChange={setNotes}
            onVoiceClick={() => {
              setMultimodalMode("voice");
              setIsMultimodalOpen(true);
            }}
            energy={energyLevel}
            onEnergyChange={setEnergyLevel}
            hunger={hungerLevel}
            onHungerChange={setHungerLevel}
            craving={cravingType}
            onCravingChange={setCravingType}
          />
        </section>

        <SectionSeparator src="/images/separador_trimmed_2.png" height={200} className="mt-12" />

        {isFoodNoteDialogOpen && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 px-4 py-10"
            role="dialog"
            aria-modal="true"
          >
            <div className="w-full max-w-lg rounded-3xl border border-white/80 bg-white/95 p-6 shadow-2xl" role="document">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">
                    {getCopy("dashboard.hero.note.label", "Registrar ingesta por nota")}
                  </p>
                  <p className="mt-1 text-sm text-slate-500">
                    {getCopy("dashboard.hero.note.helper", "Describe lo que comiste y Alma lo suma automáticamente. Atajo: Ctrl/⌘+Enter.")}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setIsFoodNoteDialogOpen(false);
                    setFoodNoteError(null);
                    if (foodNoteStatus === "error") {
                      setFoodNoteStatus("idle");
                    }
                  }}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 text-slate-600 transition hover:border-slate-900"
                  aria-label={getCopy("dashboard.hero.note.close", "Cerrar")}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <textarea
                ref={foodNoteTextareaRef}
                rows={4}
                value={foodNote}
                onChange={(event) => {
                  setFoodNote(event.target.value);
                  if (foodNoteError) setFoodNoteError(null);
                  if (foodNoteStatus === "error") {
                    setFoodNoteStatus("idle");
                  }
                }}
                onKeyDown={handleFoodNoteKeyDown}
                placeholder={getCopy("dashboard.hero.note.placeholder", "Ej: dos tostadas con palta y huevo poché")}
                aria-label={getCopy("dashboard.hero.note.label", "Registrar ingesta por nota")}
                aria-invalid={foodNoteError ? "true" : "false"}
                className="mt-6 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-900 focus:ring-1 focus:ring-slate-900"
                disabled={foodNoteStatus === "loading"}
              />
              {foodNoteError && (
                <p className="mt-2 text-xs font-medium text-rose-500" aria-live="assertive">
                  {foodNoteError}
                </p>
              )}
              <div className="mt-4 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={handleFoodNoteSubmit}
                  disabled={foodNoteStatus === "loading" || !foodNote.trim()}
                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-slate-900/30 transition hover:-translate-y-0.5 disabled:translate-y-0 disabled:opacity-50"
                >
                  {foodNoteStatus === "loading" ? (
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" aria-hidden="true" />
                  ) : (
                    <>
                      {getCopy("dashboard.hero.note.cta", "Registrar nota")}
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsFoodNoteDialogOpen(false);
                    setFoodNoteError(null);
                    if (foodNoteStatus === "error") {
                      setFoodNoteStatus("idle");
                    }
                  }}
                  className="inline-flex min-w-[120px] items-center justify-center rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-900"
                >
                  {getCopy("dashboard.hero.note.close", "Cancelar")}
                </button>
              </div>
            </div>
          </div>
        )}

        <MultimodalInput
          isOpen={isMultimodalOpen}
          mode={multimodalMode}
          onClose={() => {
            setIsMultimodalOpen(false);
            setMultimodalMode("multi");
          }}
          onConfirm={async (result) => {
            if (result.calories) {
              // Direct log if we have calories (e.g. from mock or future photo analysis)
              await logNutrition({
                name: result.name,
                calories: result.calories,
              });
              setStats(prev => prev ? ({
                ...prev,
                nutrition: {
                  ...prev.nutrition,
                  calories: prev.nutrition.calories + (result.calories || 0),
                }
              }) : null);
              setNotes(prev => prev ? prev + `\n[Registrado: ${result.name} - ${result.calories}kcal]` : `[Registrado: ${result.name} - ${result.calories}kcal]`);
              router.refresh();
            } else if (result.text) {
              handleFoodAnalysis(result.text);
            }
          }}
        />

        <section className="mt-10">
          <MissionHighlights />
        </section>

        <SectionSeparator src="/images/separador_trimmed_3.png" height={200} className="mt-12" />

        <section className="mt-10">
          <CoachSection />
        </section>

        <SectionSeparator src="/images/separador_trimmed_4.png" height={200} className="mt-12" />

        <section className="mt-10">
          <div className="rounded-3xl border border-white/60 bg-white/80 p-8 shadow-lg shadow-emerald-100">
            <NearbyProductFinder />
          </div>
        </section>
        <section className="mt-10">
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

        <SectionSeparator
          src="/images/separador_transparent_3.png"
          height={220}
          className="mt-12"
          fit="cover"
          maxHeight={220}
        />

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
      <InstallGuideModal
        open={showInstallGuide}
        onClose={() => setShowInstallGuide(false)}
        title={getCopy("dashboard.header.alerts.installGuide.title", "Agregar Alma a tu pantalla de inicio")}
        subtitle={getCopy(
          "dashboard.header.alerts.installGuide.subtitle",
          "Así habilitás las notificaciones en iOS."
        )}
        steps={[
          getCopy(
            "dashboard.header.alerts.installGuide.stepShare",
            "Tocá el ícono Compartir en Safari."
          ),
          getCopy(
            "dashboard.header.alerts.installGuide.stepAdd",
            "Elegí 'Agregar a pantalla de inicio'."
          ),
          getCopy(
            "dashboard.header.alerts.installGuide.stepConfirm",
            "Confirmá con 'Agregar'. Volvé a abrir la app desde el ícono nuevo."
          ),
        ]}
        closeLabel={getCopy("dashboard.header.alerts.installGuide.close", "Listo")}
      />
    </div>
  );
}
