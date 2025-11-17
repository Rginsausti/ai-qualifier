"use client";

import { useMemo, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { MessageCircleHeart, Timer, Utensils } from "lucide-react";

type DemoStep = {
  id: number;
  questionKey: string;
  helperKey: string;
  optionsKey: string;
};

const steps: DemoStep[] = [
  {
    id: 1,
    questionKey: "coachDemo.steps.energy.question",
    helperKey: "coachDemo.steps.energy.helper",
    optionsKey: "coachDemo.steps.energy.options",
  },
  {
    id: 2,
    questionKey: "coachDemo.steps.pantry.question",
    helperKey: "coachDemo.steps.pantry.helper",
    optionsKey: "coachDemo.steps.pantry.options",
  },
  {
    id: 3,
    questionKey: "coachDemo.steps.mood.question",
    helperKey: "coachDemo.steps.mood.helper",
    optionsKey: "coachDemo.steps.mood.options",
  },
];

export function PersonalCoachDemo() {
  const { t } = useTranslation();
  const [stepIndex, setStepIndex] = useState(0);
  const [responses, setResponses] = useState<string[]>([]);
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const currentStep = steps[stepIndex] ?? steps[0];

  const conversation = useMemo(() => {
    return steps.slice(0, stepIndex + 1).map((step, index) => ({
      question: t(step.questionKey),
      answer: responses[index],
    }));
  }, [responses, stepIndex, t]);

  function handleSuggestionClick(value: string) {
    const nextResponses = [...responses];
    nextResponses[stepIndex] = value;
    setResponses(nextResponses);
    if (stepIndex < steps.length - 1) {
      setStepIndex(stepIndex + 1);
    }
  }

  function resetDemo() {
    setResponses([]);
    setStepIndex(0);
    setEmail("");
    setSubmitted(false);
  }

  const isFinished = stepIndex === steps.length - 1 && Boolean(responses[stepIndex]);

  const ingredientChoice = responses[1];
  const energyChoice = responses[0];
  const moodChoice = responses[2];

  const ingredientLabel = ingredientChoice ?? t("coachDemo.summaryFallbackIngredient");
  const energyLabel = energyChoice ?? t("coachDemo.summaryFallbackEnergy");
  const moodLabel = moodChoice ?? t("coachDemo.summaryFallbackMood");

  function handleSubscribe(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!email.trim()) return;
    setSubmitted(true);
  }

  const currentOptions = (t(currentStep.optionsKey, { returnObjects: true }) as string[]) ?? [];

  return (
    <div className="rounded-3xl border border-white/40 bg-white/80 p-6 shadow-xl shadow-emerald-100">
      <div className="flex items-center gap-3 text-xs uppercase tracking-[0.4em] text-slate-500">
        <MessageCircleHeart className="h-4 w-4" />
        {t("coachDemo.badge")}
      </div>
      <h3 className="mt-3 text-2xl font-semibold text-slate-900">
        {t("coachDemo.title")}
      </h3>
      <div className="mt-6 space-y-4">
        {conversation.map((exchange, index) => (
          <div key={index} className="rounded-2xl bg-slate-50/80 p-4 shadow-inner">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">
              {t("coachDemo.speaker")}
            </p>
            <p className="mt-1 text-sm text-slate-700">{exchange.question}</p>
            {exchange.answer && (
              <div className="mt-3 rounded-2xl bg-slate-900 px-4 py-2 text-sm font-medium text-white">
                {exchange.answer}
              </div>
            )}
          </div>
        ))}
      </div>
      <div className="mt-6 rounded-2xl border border-dashed border-slate-200 p-4">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">
          {t("coachDemo.yourTurn")}
        </p>
        <p className="mt-1 text-base font-semibold text-slate-900">{t(currentStep.questionKey)}</p>
        <p className="text-sm text-slate-500">{t(currentStep.helperKey)}</p>
        <div className="mt-4 flex flex-wrap gap-3">
          {currentOptions.map((suggestion) => (
            <button
              key={suggestion}
              className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-900"
              onClick={() => handleSuggestionClick(suggestion)}
            >
              {suggestion}
            </button>
          ))}
        </div>
      </div>
      <div className="mt-6 flex flex-wrap items-center gap-3 text-sm text-slate-600">
        <span className="inline-flex items-center gap-2"><Timer className="h-4 w-4" /> {t("coachDemo.timer")}</span>
        <span className="inline-flex items-center gap-2"><Utensils className="h-4 w-4" /> {t("coachDemo.recipe")}</span>
        <button onClick={resetDemo} className="ml-auto text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">
          {t("coachDemo.reset")}
        </button>
      </div>
      {isFinished && (
        <div className="mt-4 space-y-4 rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4 text-sm text-emerald-900">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-emerald-600">
              {t("coachDemo.summaryTitle")}
            </p>
            <p className="mt-2 text-base font-semibold">
              {t("coachDemo.summaryIntro", {
                ingredient: ingredientLabel,
                energy: energyLabel,
              })}
            </p>
            <p className="text-sm text-emerald-800">
              {t("coachDemo.summaryMood", { mood: moodLabel })}
            </p>
          </div>
          {!submitted ? (
            <div className="space-y-3">
              <p>{t("coachDemo.summaryMissing")}</p>
              <form className="flex flex-col gap-3 sm:flex-row" onSubmit={handleSubscribe}>
                <label className="flex-1 text-sm font-medium text-slate-700">
                  {t("coachDemo.emailLabel")}
                  <input
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder={t("coachDemo.emailPlaceholder")}
                    className="mt-1 w-full rounded-full border border-slate-200 bg-white px-4 py-2 text-slate-900 focus:border-emerald-500 focus:outline-none"
                    required
                  />
                </label>
                <button
                  type="submit"
                  className="rounded-full bg-slate-900 px-6 py-2 text-sm font-semibold text-white shadow-lg shadow-slate-900/20 hover:-translate-y-0.5"
                >
                  {t("coachDemo.subscribeCta")}
                </button>
              </form>
            </div>
          ) : (
            <p className="text-emerald-700">{t("coachDemo.subscribedThanks")}</p>
          )}
          <div className="flex flex-col gap-2 rounded-2xl bg-white/80 p-3 text-slate-700 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm">{t("coachDemo.planInvite")}</p>
            <button className="inline-flex items-center justify-center rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-900">
              {t("coachDemo.planCta")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
