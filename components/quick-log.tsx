"use client";

import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Activity,
  Cookie,
  IceCream2,
  Salad,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { saveQuickLog } from "@/lib/actions";

const energyOptions: Array<{
  value: "high" | "medium" | "low";
  icon: LucideIcon;
  accent: string;
}> = [
  {
    value: "high",
    icon: Sparkles,
    accent: "from-amber-200/80 to-pink-100/70",
  },
  {
    value: "medium",
    icon: Activity,
    accent: "from-emerald-200/80 to-lime-100/70",
  },
  {
    value: "low",
    icon: Salad,
    accent: "from-slate-200/80 to-slate-100/70",
  },
];

const cravingOptions: Array<{
  value: "sweet" | "savory" | "fresh";
  icon: LucideIcon;
}> = [
  { value: "sweet", icon: IceCream2 },
  { value: "savory", icon: Cookie },
  { value: "fresh", icon: Salad },
];

export function QuickLogPanel({
  notes,
  onNotesChange,
  onVoiceClick,
  energy,
  onEnergyChange,
  hunger,
  onHungerChange,
  craving,
  onCravingChange,
}: {
  notes: string;
  onNotesChange: (notes: string) => void;
  onVoiceClick: () => void;
  energy: "high" | "medium" | "low" | null;
  onEnergyChange: (value: "high" | "medium" | "low" | null) => void;
  hunger: number;
  onHungerChange: (value: number) => void;
  craving: "sweet" | "savory" | "fresh" | null;
  onCravingChange: (value: "sweet" | "savory" | "fresh" | null) => void;
}) {
  const { t } = useTranslation();
  const [isSaving, setIsSaving] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);

  const hungerLevel: "low" | "medium" | "high" = useMemo(() => {
    if (hunger <= 2) return "low";
    if (hunger >= 4) return "high";
    return "medium";
  }, [hunger]);

  const summary = useMemo(() => {
    if (!energy || !craving) {
      return t("dashboard.quicklog.summary.empty");
    }

    const energyLabel = t(`dashboard.quicklog.energy.options.${energy}`);
    const hungerLabel = t(`dashboard.quicklog.hunger.scale.${hungerLevel}`);
    const recommendation = t(
      `dashboard.quicklog.recommendations.${craving}`
    );

    return t("dashboard.quicklog.summary.detail", {
      energy: energyLabel.toLowerCase(),
      hunger: hungerLabel.toLowerCase(),
      recommendation,
    });
  }, [craving, energy, hungerLevel, t]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const result = await saveQuickLog({
        energy,
        hunger,
        craving,
        notes,
      });

      if (result.success) {
        setLastSavedAt(new Date());
      }
    } catch (error) {
      console.error("Failed to save log:", error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section className="relative overflow-hidden rounded-3xl border border-white/60 bg-white/80 p-6 shadow-lg shadow-emerald-100">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.4em] text-slate-400">
            {t("dashboard.quicklog.badge")}
          </p>
          <h3 className="mt-2 text-2xl font-semibold text-slate-900">
            {t("dashboard.quicklog.title")}
          </h3>
          <p className="text-sm text-slate-500">
            {t("dashboard.quicklog.description")}
          </p>
        </div>
        {lastSavedAt && (
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-emerald-600">
            {t("dashboard.quicklog.saved")} · {lastSavedAt.toLocaleTimeString()}
          </p>
        )}
      </div>

      <div className="mt-6 space-y-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">
            {t("dashboard.quicklog.energy.label")}
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            {energyOptions.map((option) => (
              <button
                key={option.value}
                onClick={() => onEnergyChange(option.value)}
                className={`group relative flex flex-col rounded-2xl border p-4 text-left transition ${
                  energy === option.value
                    ? "border-slate-900 bg-slate-900 text-white"
                    : "border-slate-100 bg-white/80 text-slate-700 hover:border-slate-400"
                }`}
              >
                <span
                  className={`inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br ${option.accent} text-slate-900`}
                >
                  <option.icon className="h-5 w-5" />
                </span>
                <span className="mt-3 text-sm font-semibold">
                  {t(`dashboard.quicklog.energy.options.${option.value}`)}
                </span>
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">
              {t("dashboard.quicklog.hunger.label")}
            </p>
            <span className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">
              {t(`dashboard.quicklog.hunger.scale.${hungerLevel}`)}
            </span>
          </div>
          <p className="text-sm text-slate-500">
            {t("dashboard.quicklog.hunger.helper")}
          </p>
          <div className="mt-4 flex items-center gap-4">
            <input
              type="range"
              min={1}
              max={5}
              step={1}
              value={hunger}
              onChange={(event) => onHungerChange(Number(event.target.value))}
              className="h-2 flex-1 appearance-none rounded-full bg-slate-200 outline-none [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-slate-900"
            />
            <span className="text-2xl font-semibold text-slate-900">{hunger}</span>
          </div>
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">
            {t("dashboard.quicklog.craving.label")}
          </p>
          <div className="mt-3 flex flex-wrap gap-3">
            {cravingOptions.map((option) => (
              <button
                key={option.value}
                onClick={() => onCravingChange(option.value)}
                className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition ${
                  craving === option.value
                    ? "border-emerald-600 bg-emerald-600 text-white"
                    : "border-slate-200 bg-white text-slate-700 hover:border-slate-400"
                }`}
              >
                <option.icon className="h-4 w-4" />
                {t(`dashboard.quicklog.craving.options.${option.value}`)}
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">
              {t("dashboard.quicklog.notes.label")}
            </label>
            <button
              type="button"
              onClick={onVoiceClick}
              className="text-xs font-semibold uppercase tracking-[0.3em] text-emerald-600 hover:text-emerald-700"
            >
              {t("dashboard.quicklog.notes.voice", "Grabar nota")}
            </button>
          </div>
          <textarea
            value={notes}
            onChange={(event) => onNotesChange(event.target.value)}
            placeholder={t("dashboard.quicklog.notes.placeholder") ?? ""}
            rows={3}
            className="mt-2 w-full rounded-2xl border border-slate-200 bg-white/90 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-900"
          />
        </div>

        <div className="rounded-2xl bg-slate-50/70 p-4 text-sm text-slate-700">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">
            {t("dashboard.quicklog.summary.title")}
          </p>
          <p className="mt-2 text-base font-semibold text-slate-900">{summary}</p>
          {notes.trim() && (
            <p className="mt-2 text-xs uppercase tracking-[0.3em] text-slate-400">
              {t("dashboard.quicklog.summary.note")}: <span className="text-slate-700 normal-case tracking-normal">{notes}</span>
            </p>
          )}
        </div>
      </div>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <button
          type="button"
          disabled={isSaving}
          onClick={handleSave}
          className="inline-flex items-center justify-center gap-2 rounded-full bg-slate-900 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-slate-900/20 transition hover:-translate-y-0.5 disabled:opacity-60 disabled:hover:translate-y-0"
        >
          {isSaving && <span className="h-3 w-3 animate-pulse rounded-full bg-white" />}
          {t("dashboard.quicklog.cta")}
        </button>
        <button
          type="button"
          onClick={() => {
            onEnergyChange(null);
            onHungerChange(3);
            onCravingChange(null);
            onNotesChange("");
          }}
          className="inline-flex items-center justify-center rounded-full border border-slate-200 px-6 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-900"
        >
          {t("dashboard.quicklog.reset")}
        </button>
      </div>
    </section>
  );
}
