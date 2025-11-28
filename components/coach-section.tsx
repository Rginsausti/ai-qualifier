"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useRouter } from "next/navigation";
import { HeartHandshake, ListChecks, MessageSquareHeart, PlayCircle, Sparkles, Wand2 } from "lucide-react";

const bulletIcons = {
  care: HeartHandshake,
  time: MessageSquareHeart,
  result: Sparkles,
};

type CravingSwapAlternative = {
  name: string;
  description: string;
  swapReason: string;
  prep: string;
};

type CravingSwapResponse = {
  alternatives: CravingSwapAlternative[];
  reassurance?: string;
};

export function CoachSection() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const bullets = ["care", "time", "result"] as const;
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [treats, setTreats] = useState("");
  const [cravingType, setCravingType] = useState("sweet");
  const [intensity, setIntensity] = useState("medium");
  const [timeOfDay, setTimeOfDay] = useState("afternoon");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CravingSwapResponse | null>(null);
  const formRef = useRef<HTMLDivElement | null>(null);
  const normalizedLang = (i18n.language || "es").split("-")[0];

  const youtubeLanguageHints: Record<string, string> = {
    es: "en español",
    en: "in english",
    pt: "em português",
    fr: "en français",
    it: "in italiano",
    de: "auf deutsch",
    ja: "日本語で",
  };

  const recipeKeywordByLang: Record<string, string> = {
    es: "receta",
    en: "recipe",
    pt: "receita",
    fr: "recette",
    it: "ricetta",
    de: "rezept",
    ja: "レシピ",
  };

  useEffect(() => {
    if (isFormOpen && formRef.current) {
      formRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [isFormOpen]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!treats.trim()) {
      setError(t("coachSection.form.errorRequired", { defaultValue: "Contame qué comida chatarra te tienta." }));
      return;
    }

    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch("/api/coach/craving-swap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          treats: treats.trim(),
          cravingType,
          intensity,
          timeOfDay,
          locale: t("dashboard.locale", { defaultValue: "es-AR" }),
        }),
      });

      if (!response.ok) {
        const message = await response.text();
        throw new Error(message || "AI request failed");
      }

      const data = (await response.json()) as CravingSwapResponse;
      const normalized: CravingSwapResponse = {
        alternatives: Array.isArray(data.alternatives) ? data.alternatives : [],
        reassurance: data.reassurance,
      };
      setResult(normalized);
    } catch (submissionError) {
      if (submissionError instanceof Error) {
        setError(submissionError.message);
      } else {
        setError("Algo falló, volvé a intentar.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const goToStepByStepChat = (alternative: CravingSwapAlternative) => {
    const prompt = t("coachSection.form.stepByStepPrompt", {
      recipe: alternative.name,
      plan: alternative.prep,
      summary: alternative.description,
      defaultValue: `Necesito que me guíes paso a paso para preparar ${alternative.name}. Usa este mini plan como base: ${alternative.prep}. Confirmá conmigo antes de avanzar a cada paso.`
    });

    const params = new URLSearchParams({ prefill: prompt });
    router.push(`/chat?${params.toString()}`);
  };

  const buildYoutubeLink = (alternative: CravingSwapAlternative) => {
    const languageKey = normalizedLang as keyof typeof youtubeLanguageHints;
    const suffix = youtubeLanguageHints[languageKey] || youtubeLanguageHints.es;
    const recipeKeyword = recipeKeywordByLang[languageKey] || recipeKeywordByLang.es;
    const query = `${recipeKeyword} ${alternative.name} ${suffix}`.trim();
    return `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
  };

  return (
    <section className="relative overflow-hidden rounded-3xl border border-white/60 bg-gradient-to-br from-white via-white to-slate-50 p-8 shadow-xl shadow-emerald-100">
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
          type="button"
          onClick={() => {
            setIsFormOpen(true);
            requestAnimationFrame(() => formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
          }}
          className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-slate-900/20 transition hover:-translate-y-0.5"
        >
          <Wand2 className="h-4 w-4" />
          {t("coachSection.cta")}
        </button>
      </div>

      {isFormOpen && (
        <div ref={formRef} className="mt-8 rounded-3xl border border-emerald-100 bg-white/80 p-6 shadow-inner shadow-white">
          <div className="mb-4">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-emerald-600">
              {t("coachSection.form.badge", { defaultValue: "Swap de antojos" })}
            </p>
            <h3 className="mt-2 text-2xl font-semibold text-slate-900">
              {t("coachSection.form.title", { defaultValue: "Contame qué craving querés desactivar" })}
            </h3>
            <p className="text-sm text-slate-600">
              {t("coachSection.form.description", { defaultValue: "Vamos a usar tu perfil y objetivos para sugerirte algo rico pero alineado a tu plan." })}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <label className="block text-sm font-semibold text-slate-900">
              {t("coachSection.form.treats", { defaultValue: "¿Qué comida chatarra te llama?" })}
              <textarea
                value={treats}
                onChange={(event) => setTreats(event.target.value)}
                rows={3}
                className="mt-2 w-full rounded-2xl border border-slate-200 bg-white/90 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-900"
                placeholder={t("coachSection.form.placeholder", { defaultValue: "Ej: papas fritas, helado de dulce de leche, medialunas" }) || undefined}
              />
            </label>

            <div className="grid gap-4 md:grid-cols-3">
              <label className="flex flex-col gap-2 text-sm font-semibold text-slate-900">
                {t("coachSection.form.type.label", { defaultValue: "Tipo de craving" })}
                <select
                  value={cravingType}
                  onChange={(event) => setCravingType(event.target.value)}
                  className="rounded-2xl border border-slate-200 bg-white/90 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-900"
                >
                  <option value="sweet">{t("coachSection.form.type.sweet", { defaultValue: "Dulce" })}</option>
                  <option value="savory">{t("coachSection.form.type.savory", { defaultValue: "Salado" })}</option>
                  <option value="crunchy">{t("coachSection.form.type.crunchy", { defaultValue: "Crocante" })}</option>
                  <option value="fried">{t("coachSection.form.type.fried", { defaultValue: "Frito" })}</option>
                </select>
              </label>

              <label className="flex flex-col gap-2 text-sm font-semibold text-slate-900">
                {t("coachSection.form.intensity.label", { defaultValue: "Intensidad" })}
                <select
                  value={intensity}
                  onChange={(event) => setIntensity(event.target.value)}
                  className="rounded-2xl border border-slate-200 bg-white/90 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-900"
                >
                  <option value="light">{t("coachSection.form.intensity.light", { defaultValue: "Tranqui" })}</option>
                  <option value="medium">{t("coachSection.form.intensity.medium", { defaultValue: "Moderado" })}</option>
                  <option value="heavy">{t("coachSection.form.intensity.heavy", { defaultValue: "Muy fuerte" })}</option>
                </select>
              </label>

              <label className="flex flex-col gap-2 text-sm font-semibold text-slate-900">
                {t("coachSection.form.time.label", { defaultValue: "Momento del día" })}
                <select
                  value={timeOfDay}
                  onChange={(event) => setTimeOfDay(event.target.value)}
                  className="rounded-2xl border border-slate-200 bg-white/90 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-900"
                >
                  <option value="morning">{t("coachSection.form.time.morning", { defaultValue: "Mañana" })}</option>
                  <option value="afternoon">{t("coachSection.form.time.afternoon", { defaultValue: "Tarde" })}</option>
                  <option value="evening">{t("coachSection.form.time.evening", { defaultValue: "Noche" })}</option>
                </select>
              </label>
            </div>

            {error && (
              <p className="text-sm font-semibold text-rose-500">{error}</p>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-emerald-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-600/30 transition hover:bg-emerald-500 disabled:opacity-60"
            >
              {isLoading && <span className="h-3 w-3 animate-ping rounded-full bg-white" />}
              {t("coachSection.form.submit", { defaultValue: "Calcular swaps" })}
            </button>
          </form>

          {result && result.alternatives?.length > 0 && (
            <div className="mt-6 space-y-4">
              {result.alternatives.map((alternative, index) => (
                <article
                  key={`${alternative.name}-${index}`}
                  className="rounded-3xl border border-slate-100 bg-slate-50/70 p-5"
                >
                  <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
                    {t("coachSection.form.swapLabel", { defaultValue: "Alternativa" })} #{index + 1}
                  </p>
                  <h4 className="mt-2 text-xl font-semibold text-slate-900">{alternative.name}</h4>
                  <p className="mt-2 text-sm text-slate-600">{alternative.description}</p>
                  <p className="mt-3 text-sm font-semibold text-slate-900">
                    {t("coachSection.form.reason", { defaultValue: "¿Por qué funciona?" })}
                  </p>
                  <p className="text-sm text-slate-600">{alternative.swapReason}</p>
                  <p className="mt-3 text-sm font-semibold text-slate-900">
                    {t("coachSection.form.prep", { defaultValue: "Mini plan" })}
                  </p>
                  <p className="text-sm text-slate-600">{alternative.prep}</p>
                  <div className="mt-4 flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={() => goToStepByStepChat(alternative)}
                      className="inline-flex items-center gap-2 rounded-full border border-slate-900/20 bg-slate-900/90 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-slate-900"
                    >
                      <ListChecks className="h-4 w-4" />
                      {t("coachSection.form.stepByStepCta", { defaultValue: "Seguir paso a paso" })}
                    </button>
                    <a
                      href={buildYoutubeLink(alternative)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-900 shadow-sm transition hover:border-slate-900/40"
                    >
                      <PlayCircle className="h-4 w-4" />
                      {t("coachSection.form.videoCta", { defaultValue: "Abrir tutorial" })}
                    </a>
                  </div>
                </article>
              ))}

              {result.reassurance && (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 px-4 py-3 text-sm text-emerald-900">
                  {result.reassurance}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
