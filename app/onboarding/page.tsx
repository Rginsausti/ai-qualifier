"use client";

import Image from "next/image";
// import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { useState, useMemo } from "react";
import { ArrowLeft, ArrowRight, Check, Loader2 } from "lucide-react";
import { LanguageSwitcher } from "@/components/language-switcher";
import { saveOnboardingData } from "@/lib/actions";
import { getSupabaseClient } from "@/lib/supabase/client";
import welcomeHero from "@/public/images/image.jpg";
import goalHero from "@/public/images/onboarding.jpg";
import biometricsHero from "@/public/images/onboarding-biometrics.jpg";
import objectivesHero from "@/public/images/onboarding-objectives.jpg";
import "./onboarding.css";

type Goal = "lose" | "gain" | "healthy";
type UnitSystem = "metric" | "imperial";
type Allergen = "milk" | "eggs" | "peanuts" | "treeNuts" | "soy" | "wheat" | "fish" | "shellfish" | "sesame";
type Intolerance = "gluten" | "lactose" | "fructose";
type Lifestyle = "vegetarian" | "vegan" | "pescatarian" | "keto" | "paleo" | "lowCarb" | "highProtein" | "lowFat" | "sugarDetox";
type Therapeutic = "diabetes" | "renal" | "lowFodmap" | "cardiovascular" | "bariatric" | "cysticFibrosis" | "gestational";
type Cultural = "halal" | "kosher" | "hindu" | "buddhist" | "rastafari";

const STEPS = 7;
const FOOD_EXAMPLES = [
  { key: "apple", calories: 95 },
  { key: "chiaPudding", calories: 180 },
  { key: "avocadoToast", calories: 320 },
] as const;

function GoldenStepLabel({ label }: { label: string }) {
  return (
    <div className="golden-text-container">
      <h1 className="golden-text">
        {label}
        <span aria-hidden="true" className="golden-text-shadow">
          {label}
        </span>
      </h1>
    </div>
  );
}

export default function OnboardingPage() {
  const { t } = useTranslation();
  const [currentStep, setCurrentStep] = useState(1);
  
  // Step 2: Goal
  const [selectedGoals, setSelectedGoals] = useState<Set<Goal>>(new Set());
  
  // Step 3: Biometrics
  const [unitSystem, setUnitSystem] = useState<UnitSystem>("metric");
  const [weight, setWeight] = useState(70);
  const [height, setHeight] = useState(170);
  
  // Step 4: Allergens
  const [allergens, setAllergens] = useState<Set<Allergen>>(new Set());
  const [intolerances, setIntolerances] = useState<Set<Intolerance>>(new Set());
  
  // Step 5: Lifestyle
  const [lifestyle, setLifestyle] = useState<Lifestyle | null>(null);
  
  // Step 6: Additional Restrictions
  const [therapeutic, setTherapeutic] = useState<Set<Therapeutic>>(new Set());
  const [cultural, setCultural] = useState<Set<Cultural>>(new Set());
  const [otherRestrictions, setOtherRestrictions] = useState("");
  
  // Step 7: Result
  const [isCalculating, setIsCalculating] = useState(false);
  const [calculatedCalories, setCalculatedCalories] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const router = useRouter();

  const handleFinish = async () => {
    setIsSaving(true);
    try {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      
      await saveOnboardingData({
        goals: Array.from(selectedGoals),
        weight,
        height,
        unitSystem,
        allergens: Array.from(allergens),
        intolerances: Array.from(intolerances),
        lifestyle,
        therapeutic: Array.from(therapeutic),
        cultural: Array.from(cultural),
        otherRestrictions,
        calculatedCalories
      }, user?.id);
      
      router.push("/");
    } catch (error) {
      console.error("Error saving profile:", error);
      // Navigate anyway
      router.push("/");
    } finally {
      setIsSaving(false);
    }
  };

  const weightLabel = unitSystem === "metric" ? "kg" : "lb";
  const heightLabel = unitSystem === "metric" ? "cm" : "ft";
  const weightRange = unitSystem === "metric" ? [30, 200] : [66, 440];
  const heightRange = unitSystem === "metric" ? [120, 220] : [4, 7.2];

  const canProceed = useMemo(() => {
    switch (currentStep) {
      case 1:
        return true;
      case 2:
        return selectedGoals.size > 0;
      case 3:
        return weight > 0 && height > 0;
      case 4:
      case 5:
      case 6:
        return true;
      case 7:
        return calculatedCalories > 0;
      default:
        return false;
    }
  }, [currentStep, selectedGoals, weight, height, calculatedCalories]);

  const toggleFromSet = <T,>(set: Set<T>, value: T) => {
    const newSet = new Set(set);
    if (newSet.has(value)) {
      newSet.delete(value);
    } else {
      newSet.add(value);
    }
    return newSet;
  };

  const handleNext = () => {
    if (currentStep === 6 && !isCalculating) {
      // Calculate calories before going to step 7
      setIsCalculating(true);
      setTimeout(() => {
        const baseCalories = unitSystem === "metric" 
          ? Math.round((10 * weight) + (6.25 * height) + 200)
          : Math.round((4.536 * weight) + (15.875 * height * 30.48) + 200);
        
        let adjusted = baseCalories;
        const wantsLose = selectedGoals.has("lose");
        const wantsGain = selectedGoals.has("gain");
        if (wantsLose && !wantsGain) adjusted -= 500;
        if (wantsGain && !wantsLose) adjusted += 500;
        
        setCalculatedCalories(adjusted);
        setIsCalculating(false);
        setCurrentStep(7);
      }, 2000);
    } else if (currentStep < STEPS) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const goalOptions: { value: Goal; labelKey: string; descKey: string }[] = [
    { value: "lose", labelKey: "onboarding.goal.options.lose.label", descKey: "onboarding.goal.options.lose.description" },
    { value: "gain", labelKey: "onboarding.goal.options.gain.label", descKey: "onboarding.goal.options.gain.description" },
    { value: "healthy", labelKey: "onboarding.goal.options.healthy.label", descKey: "onboarding.goal.options.healthy.description" },
  ];

  const allergenOptions: { value: Allergen; labelKey: string }[] = [
    { value: "milk", labelKey: "onboarding.restrictions.allergens.milk" },
    { value: "eggs", labelKey: "onboarding.restrictions.allergens.eggs" },
    { value: "peanuts", labelKey: "onboarding.restrictions.allergens.peanuts" },
    { value: "treeNuts", labelKey: "onboarding.restrictions.allergens.treeNuts" },
    { value: "soy", labelKey: "onboarding.restrictions.allergens.soy" },
    { value: "wheat", labelKey: "onboarding.restrictions.allergens.wheat" },
    { value: "fish", labelKey: "onboarding.restrictions.allergens.fish" },
    { value: "shellfish", labelKey: "onboarding.restrictions.allergens.shellfish" },
    { value: "sesame", labelKey: "onboarding.restrictions.allergens.sesame" },
  ];

  const intoleranceOptions: { value: Intolerance; labelKey: string }[] = [
    { value: "gluten", labelKey: "onboarding.restrictions.intolerances.gluten" },
    { value: "lactose", labelKey: "onboarding.restrictions.intolerances.lactose" },
    { value: "fructose", labelKey: "onboarding.restrictions.intolerances.fructose" },
  ];

  const lifestyleOptions: { value: Lifestyle; labelKey: string; descKey: string }[] = [
    { value: "vegetarian", labelKey: "onboarding.restrictions.lifestyle.vegetarian.label", descKey: "onboarding.restrictions.lifestyle.vegetarian.description" },
    { value: "vegan", labelKey: "onboarding.restrictions.lifestyle.vegan.label", descKey: "onboarding.restrictions.lifestyle.vegan.description" },
    { value: "pescatarian", labelKey: "onboarding.restrictions.lifestyle.pescatarian.label", descKey: "onboarding.restrictions.lifestyle.pescatarian.description" },
    { value: "keto", labelKey: "onboarding.restrictions.lifestyle.keto.label", descKey: "onboarding.restrictions.lifestyle.keto.description" },
    { value: "paleo", labelKey: "onboarding.restrictions.lifestyle.paleo.label", descKey: "onboarding.restrictions.lifestyle.paleo.description" },
    { value: "lowCarb", labelKey: "onboarding.restrictions.lifestyle.lowCarb.label", descKey: "onboarding.restrictions.lifestyle.lowCarb.description" },
  ];

  const therapeuticOptions: { value: Therapeutic; labelKey: string }[] = [
    { value: "diabetes", labelKey: "onboarding.restrictions.additional.therapeutic.diabetes" },
    { value: "renal", labelKey: "onboarding.restrictions.additional.therapeutic.renal" },
    { value: "lowFodmap", labelKey: "onboarding.restrictions.additional.therapeutic.lowFodmap" },
    { value: "cardiovascular", labelKey: "onboarding.restrictions.additional.therapeutic.cardiovascular" },
  ];

  const culturalOptions: { value: Cultural; labelKey: string }[] = [
    { value: "halal", labelKey: "onboarding.restrictions.additional.cultural.halal" },
    { value: "kosher", labelKey: "onboarding.restrictions.additional.cultural.kosher" },
    { value: "hindu", labelKey: "onboarding.restrictions.additional.cultural.hindu" },
    { value: "buddhist", labelKey: "onboarding.restrictions.additional.cultural.buddhist" },
  ];

  const restrictionsSummary = useMemo(() => {
    const parts: string[] = [];
    if (allergens.size > 0) parts.push(`${allergens.size} ${t("onboarding.restrictions.summary.allergens")}`);
    if (intolerances.size > 0) parts.push(`${intolerances.size} ${t("onboarding.restrictions.summary.intolerances")}`);
  if (lifestyle) parts.push(t(`onboarding.restrictions.lifestyle.${lifestyle}.label`));
    if (therapeutic.size > 0) parts.push(`${therapeutic.size} ${t("onboarding.restrictions.summary.therapeutic")}`);
    if (cultural.size > 0) parts.push(`${cultural.size} ${t("onboarding.restrictions.summary.cultural")}`);
    if (otherRestrictions.trim()) parts.push(t("onboarding.restrictions.summary.other"));
    return parts.join(" · ");
  }, [allergens, intolerances, lifestyle, therapeutic, cultural, otherRestrictions, t]);

  const goalSummary = useMemo(() => {
    if (selectedGoals.size === 0) return "";
    return Array.from(selectedGoals)
      .map((goal) => t(`onboarding.goal.options.${goal}.label`).toLowerCase())
      .join(", ");
  }, [selectedGoals, t]);

  const foodExamples = useMemo(() => {
    if (calculatedCalories <= 0) return [];
    return FOOD_EXAMPLES.map((item) => {
      const percent = Math.min(100, (item.calories / calculatedCalories) * 100);
      const unitsOfTwenty = Math.max(1, Math.round((percent / 100) * 20));
      return {
        ...item,
        label: t(`onboarding.result.examples.${item.key}`),
        percent,
        unitsOfTwenty,
      };
    });
  }, [calculatedCalories, t]);

  return (
    <div className="relative min-h-screen bg-[#f6f3ec] text-slate-900">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-32 left-16 h-72 w-72 rounded-full bg-emerald-200/40 blur-[140px]" />
        <div className="absolute bottom-0 right-0 h-[420px] w-[420px] rounded-full bg-amber-100/40 blur-[160px]" />
      </div>

      <main className="relative z-10 mx-auto max-w-4xl px-6 py-16 sm:px-10">
        {/* Progress indicator */}
        {currentStep > 1 && (
          <div className="mb-10 flex flex-col items-center gap-4 text-center">
            <GoldenStepLabel label={t("onboarding.stepCounter", { current: currentStep, total: STEPS }) as string} />
            <div className="flex w-full max-w-sm justify-center gap-2">
              {Array.from({ length: STEPS - 1 }).map((_, i) => (
                <div
                  key={i}
                  className={`h-1.5 flex-1 rounded-full transition ${
                    i + 2 <= currentStep ? "bg-slate-900" : "bg-slate-200"
                  }`}
                />
              ))}
            </div>
          </div>
        )}

        {/* Step 1: Welcome */}
        {currentStep === 1 && (
          <div className="flex flex-col items-center gap-10 text-center">
            <div className="flex w-full justify-center">
              <LanguageSwitcher variant="minimal" className="w-full max-w-2xl" />
            </div>
            <div className="relative aspect-[4/3] w-full max-w-md overflow-hidden rounded-3xl border border-white/60 bg-white/80 shadow-2xl">
              <Image
                src={welcomeHero}
                alt={t("onboarding.visuals.welcomeAlt")}
                fill
                sizes="(max-width: 768px) 100vw, 448px"
                className="object-cover"
                priority
              />
            </div>
            <div className="space-y-6">
              <div className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-1 text-xs font-semibold uppercase tracking-[0.4em] text-white">
                <span>{t("onboarding.welcome.badge")}</span>
              </div>
              <h1 className="text-5xl font-semibold tracking-tight text-slate-900 sm:text-6xl">
                {t("onboarding.welcome.title")}
              </h1>
              <p className="mx-auto max-w-xl text-lg leading-relaxed text-slate-600">
                {t("onboarding.welcome.description")}
              </p>
              <button
                onClick={handleNext}
                className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-8 py-4 text-base font-semibold text-white shadow-lg shadow-slate-900/20 transition hover:-translate-y-0.5"
              >
                {t("onboarding.welcome.cta")}
                <ArrowRight className="h-5 w-5" />
              </button>
            </div>
            <p className="text-sm text-slate-400">{t("onboarding.progressHint")}</p>
          </div>
        )}

        {/* Step 2: Goal */}
        {currentStep === 2 && (
          <div className="space-y-10">
            {/* Language Switcher Row */}
            <div className="flex w-full justify-center">
              <LanguageSwitcher variant="minimal" className="w-full max-w-2xl" />
            </div>

            <div className="mx-auto w-full max-w-2xl">
              <div className="relative aspect-[4/3] w-full overflow-hidden rounded-3xl border border-white/60 bg-white/80 shadow-2xl">
                <Image
                  src={goalHero}
                  alt={t("onboarding.visuals.goalAlt")}
                  fill
                  sizes="(max-width: 768px) 100vw, 640px"
                  className="object-cover"
                />
              </div>
            </div>

            <div className="space-y-6 text-center">
              <p className="text-xs uppercase tracking-[0.4em] text-slate-500">{t("onboarding.goal.stepLabel")}</p>

              <h2 className="text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
                {t("onboarding.goal.title")}
              </h2>
              
              <p className="mx-auto max-w-2xl text-base leading-relaxed text-slate-600">
                {t("onboarding.goal.description")}
              </p>
            </div>
            <div className="grid gap-6 md:grid-cols-3">
              {goalOptions.map((option) => (
                <button
                  key={option.value}
                  onClick={() => setSelectedGoals(toggleFromSet(selectedGoals, option.value))}
                  className={`group relative overflow-hidden rounded-3xl border p-8 text-left transition ${
                    selectedGoals.has(option.value)
                      ? "border-slate-900 bg-slate-50 shadow-xl"
                      : "border-white/60 bg-white/80 hover:border-slate-300"
                  }`}
                >
                  {selectedGoals.has(option.value) && (
                    <div className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full bg-slate-900 text-white">
                      <Check className="h-5 w-5" />
                    </div>
                  )}
                  <div className="space-y-3">
                    <h3 className="text-xl font-semibold text-slate-900">{t(option.labelKey)}</h3>
                    <p className="text-sm leading-relaxed text-slate-600">{t(option.descKey)}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 3: Biometrics */}
        {currentStep === 3 && (
          <div className="space-y-10">
            <div className="mx-auto w-full max-w-3xl">
              <div className="relative aspect-[4/3] w-full overflow-hidden rounded-3xl border border-white/60 bg-white/80 shadow-2xl">
                <Image
                  src={biometricsHero}
                  alt={t("onboarding.visuals.biometricsAlt")}
                  fill
                  sizes="(max-width: 768px) 100vw, 768px"
                  className="object-cover"
                />
              </div>
            </div>

            <div className="space-y-6 text-center">
              <p className="text-xs uppercase tracking-[0.4em] text-slate-500">
                {t("onboarding.biometric.stepLabel")}
              </p>

              <h2 className="text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
                {t("onboarding.biometric.title")}
              </h2>
              <p className="text-base text-slate-600">{t("onboarding.biometric.description")}</p>
            </div>
            <div className="mx-auto max-w-md space-y-8 rounded-3xl border border-white/60 bg-white/80 p-8 shadow-xl">
              <div className="flex justify-center">
                <button
                  onClick={() => setUnitSystem(unitSystem === "metric" ? "imperial" : "metric")}
                  className="inline-flex items-center gap-3 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-900"
                >
                  <span className={unitSystem === "metric" ? "text-slate-900" : "text-slate-400"}>
                    {t("onboarding.unitToggle.metric")}
                  </span>
                  <span className="text-slate-300">|</span>
                  <span className={unitSystem === "imperial" ? "text-slate-900" : "text-slate-400"}>
                    {t("onboarding.unitToggle.imperial")}
                  </span>
                </button>
              </div>
              <div className="space-y-6">
                <div className="space-y-3">
                  <label className="text-sm font-semibold text-slate-700">
                    {t("onboarding.biometric.weightLabel")}
                  </label>
                  <div className="flex items-center gap-4">
                    <input
                      type="range"
                      min={weightRange[0]}
                      max={weightRange[1]}
                      value={weight}
                      onChange={(e) => setWeight(Number(e.target.value))}
                      className="h-2 w-full flex-1 appearance-none rounded-full bg-slate-200 outline-none [&::-webkit-slider-thumb]:h-6 [&::-webkit-slider-thumb]:w-6 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-slate-900"
                    />
                    <span className="min-w-[80px] text-right text-2xl font-semibold text-slate-900">
                      {weight} {weightLabel}
                    </span>
                  </div>
                </div>
                <div className="space-y-3">
                  <label className="text-sm font-semibold text-slate-700">
                    {t("onboarding.biometric.heightLabel")}
                  </label>
                  <div className="flex items-center gap-4">
                    <input
                      type="range"
                      min={heightRange[0]}
                      max={heightRange[1]}
                      step={unitSystem === "imperial" ? 0.1 : 1}
                      value={height}
                      onChange={(e) => setHeight(Number(e.target.value))}
                      className="h-2 w-full flex-1 appearance-none rounded-full bg-slate-200 outline-none [&::-webkit-slider-thumb]:h-6 [&::-webkit-slider-thumb]:w-6 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-slate-900"
                    />
                    <span className="min-w-[80px] text-right text-2xl font-semibold text-slate-900">
                      {unitSystem === "imperial" ? height.toFixed(1) : height} {heightLabel}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Step 4: Allergens & Intolerances */}
        {currentStep === 4 && (
          <div className="space-y-10">
            <div className="space-y-6 text-center">
              <p className="text-xs uppercase tracking-[0.4em] text-slate-500">
                {t("onboarding.restrictions.allergens.stepLabel")}
              </p>
              <h2 className="text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
                {t("onboarding.restrictions.allergens.title")}
              </h2>
              <p className="text-base text-slate-600">{t("onboarding.restrictions.allergens.description")}</p>
            </div>
            <div className="space-y-8">
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-slate-900">{t("onboarding.restrictions.allergens.subtitle")}</h3>
                <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
                  {allergenOptions.map((option) => (
                    <button
                      key={option.value}
                      onClick={() => setAllergens(toggleFromSet(allergens, option.value))}
                      className={`rounded-2xl border px-4 py-3 text-left text-sm font-medium transition ${
                        allergens.has(option.value)
                          ? "border-slate-900 bg-slate-900 text-white"
                          : "border-slate-200 bg-white text-slate-700 hover:border-slate-400"
                      }`}
                    >
                      {t(option.labelKey)}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-slate-900">{t("onboarding.restrictions.intolerances.subtitle")}</h3>
                <div className="grid gap-3 sm:grid-cols-3">
                  {intoleranceOptions.map((option) => (
                    <button
                      key={option.value}
                      onClick={() => setIntolerances(toggleFromSet(intolerances, option.value))}
                      className={`rounded-2xl border px-4 py-3 text-sm font-medium transition ${
                        intolerances.has(option.value)
                          ? "border-emerald-600 bg-emerald-600 text-white"
                          : "border-slate-200 bg-white text-slate-700 hover:border-slate-400"
                      }`}
                    >
                      {t(option.labelKey)}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Step 5: Lifestyle */}
        {currentStep === 5 && (
          <div className="space-y-10">
            <div className="space-y-6 text-center">
              <p className="text-xs uppercase tracking-[0.4em] text-slate-500">
                {t("onboarding.restrictions.lifestyle.stepLabel")}
              </p>
              <h2 className="text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
                {t("onboarding.restrictions.lifestyle.title")}
              </h2>
              <p className="text-base text-slate-600">{t("onboarding.restrictions.lifestyle.description")}</p>
            </div>
            <div className="grid gap-6 md:grid-cols-2">
              {lifestyleOptions.map((option) => (
                <button
                  key={option.value}
                  onClick={() => setLifestyle(option.value)}
                  className={`group relative overflow-hidden rounded-3xl border p-6 text-left transition ${
                    lifestyle === option.value
                      ? "border-[#5e7cae] bg-[#edf1f8] shadow-xl"
                      : "border-white/60 bg-white/80 hover:border-slate-300"
                  }`}
                >
                  {lifestyle === option.value && (
                    <div className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full bg-slate-900 text-white shadow-lg">
                      <Check className="h-5 w-5" />
                    </div>
                  )}
                  <div className="relative space-y-2">
                    <h3 className="text-xl font-semibold text-slate-900">{t(option.labelKey)}</h3>
                    <p className="text-sm leading-relaxed text-slate-600">{t(option.descKey)}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 6: Additional Restrictions */}
        {currentStep === 6 && (
          <div className="space-y-10">
            <div className="space-y-6 text-center">
              <p className="text-xs uppercase tracking-[0.4em] text-slate-500">
                {t("onboarding.restrictions.additional.stepLabel")}
              </p>
              <h2 className="text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
                {t("onboarding.restrictions.additional.title")}
              </h2>
              <p className="text-base text-slate-600">{t("onboarding.restrictions.additional.description")}</p>
            </div>
            <div className="space-y-8">
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-slate-900">{t("onboarding.restrictions.additional.therapeutic.subtitle")}</h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  {therapeuticOptions.map((option) => (
                    <button
                      key={option.value}
                      onClick={() => setTherapeutic(toggleFromSet(therapeutic, option.value))}
                      className={`rounded-2xl border px-4 py-3 text-left text-sm font-medium transition ${
                        therapeutic.has(option.value)
                          ? "border-[#5e7cae] bg-[#5e7cae] text-white"
                          : "border-slate-200 bg-white/80 text-slate-700 hover:border-slate-400"
                      }`}
                    >
                      {t(option.labelKey)}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-slate-900">{t("onboarding.restrictions.additional.cultural.subtitle")}</h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  {culturalOptions.map((option) => (
                    <button
                      key={option.value}
                      onClick={() => setCultural(toggleFromSet(cultural, option.value))}
                      className={`rounded-2xl border px-4 py-3 text-left text-sm font-medium transition ${
                        cultural.has(option.value)
                          ? "border-[#dbbe4b] bg-[#fdf6d7] text-slate-900"
                          : "border-slate-200 bg-white/80 text-slate-700 hover:border-slate-400"
                      }`}
                    >
                      {t(option.labelKey)}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-slate-900">{t("onboarding.restrictions.additional.other.label")}</h3>
                <textarea
                  value={otherRestrictions}
                  onChange={(e) => setOtherRestrictions(e.target.value)}
                  placeholder={t("onboarding.restrictions.additional.other.placeholder")}
                  rows={3}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-900"
                />
              </div>
            </div>
          </div>
        )}

        {/* Step 7: Result */}
        {currentStep === 7 && (
          <div className="flex flex-col items-center gap-10 text-center">
            {isCalculating ? (
              <div className="flex flex-col items-center gap-6">
                <div className="h-16 w-16 animate-spin rounded-full border-4 border-slate-200 border-t-slate-900" />
                <p className="text-lg text-slate-600">{t("onboarding.result.loading")}</p>
              </div>
            ) : (
              <>
                <div className="inline-flex items-center gap-2 rounded-full bg-emerald-600 px-4 py-1 text-xs font-semibold uppercase tracking-[0.4em] text-white">
                  <Check className="h-4 w-4" />
                  <span>{t("onboarding.result.readyBadge")}</span>
                </div>
                <div className="w-full max-w-2xl">
                  <div className="relative aspect-[4/3] w-full overflow-hidden rounded-3xl border border-white/60 bg-white/80 shadow-2xl">
                    <Image
                      src={objectivesHero}
                      alt={t("onboarding.visuals.resultAlt")}
                      fill
                      sizes="(max-width: 768px) 100vw, 640px"
                      className="object-cover"
                    />
                  </div>
                </div>
                <div className="space-y-6">
                  <h2 className="text-5xl font-semibold tracking-tight text-slate-900 sm:text-6xl">
                    {t("onboarding.result.title")}
                  </h2>
                  <p className="mx-auto max-w-xl text-lg leading-relaxed text-slate-600">
                    {t("onboarding.result.description", {
                      goals: goalSummary,
                    })}
                  </p>
                </div>
                <div className="w-full max-w-md space-y-6 rounded-3xl border border-white/60 bg-white/80 p-8 shadow-2xl">
                  <p className="text-xs uppercase tracking-[0.4em] text-slate-500">
                    {t("onboarding.result.subtitle")}
                  </p>
                  <div className="relative">
                    <div className="text-7xl font-semibold tracking-tight text-slate-900">
                      {calculatedCalories.toLocaleString()}
                    </div>
                    <span className="mt-2 block text-lg text-slate-500">kcal</span>
                  </div>
                  {restrictionsSummary && (
                    <div className="rounded-2xl bg-slate-50 p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">
                        {t("onboarding.restrictions.summary.title")}
                      </p>
                      <p className="mt-2 text-sm text-slate-600">{restrictionsSummary}</p>
                    </div>
                  )}
                  {foodExamples.length > 0 && (
                    <div className="space-y-4 rounded-2xl border border-white/60 bg-white/90 p-4 text-left">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">
                          {t("onboarding.result.examplesTitle")}
                        </p>
                        <p className="mt-1 text-sm text-slate-500">
                          {t("onboarding.result.examplesIntro")}
                        </p>
                      </div>
                      <ul className="space-y-3">
                        {foodExamples.map((example) => (
                          <li
                            key={example.key}
                            className="flex items-center justify-between rounded-2xl bg-slate-50/80 px-4 py-3"
                          >
                            <div>
                              <p className="text-sm font-semibold text-slate-900">{example.label}</p>
                              <p className="text-xs text-slate-500">
                                {t("onboarding.result.examples.baseTwenty", { units: example.unitsOfTwenty })}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="text-base font-semibold text-slate-900">{example.calories} kcal</p>
                              <p className="text-xs font-medium text-emerald-600">
                                {t("onboarding.result.examples.percentOfGoal", { percent: Math.round(example.percent) })}
                              </p>
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  <p className="text-sm text-slate-500">{t("onboarding.result.adjustmentNote")}</p>
                </div>
                <div className="flex w-full max-w-xl flex-col gap-4 sm:flex-row">
                  <button
                    onClick={handleFinish}
                    disabled={isSaving}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-slate-900 px-8 py-4 text-base font-semibold text-white shadow-lg shadow-slate-900/20 transition hover:-translate-y-0.5 disabled:opacity-70 sm:flex-1"
                  >
                    {isSaving ? <Loader2 className="h-5 w-5 animate-spin" /> : t("onboarding.result.homeCta")}
                    {!isSaving && <ArrowRight className="h-5 w-5" />}
                  </button>
                  <button
                    onClick={() => {
                      setCurrentStep(1);
                      setSelectedGoals(new Set());
                      setWeight(70);
                      setHeight(170);
                      setAllergens(new Set());
                      setIntolerances(new Set());
                      setLifestyle(null);
                      setTherapeutic(new Set());
                      setCultural(new Set());
                      setOtherRestrictions("");
                      setCalculatedCalories(0);
                    }}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-slate-300/80 bg-white px-8 py-4 text-base font-semibold text-slate-700 transition hover:border-slate-900 sm:flex-1"
                  >
                    {t("onboarding.result.restart")}
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* Navigation */}
        {currentStep > 1 && currentStep < 7 && (
          <div className="mt-16 flex items-center justify-between">
            <button
              onClick={handleBack}
              className="inline-flex items-center gap-2 rounded-full border border-slate-300/80 bg-white px-6 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-900"
            >
              <ArrowLeft className="h-4 w-4" />
              {t("onboarding.back")}
            </button>
            <button
              onClick={handleNext}
              disabled={!canProceed}
              className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-slate-900/20 transition hover:-translate-y-0.5 disabled:opacity-50 disabled:hover:translate-y-0"
            >
              {t("onboarding.next")}
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
