"use client";

import { useTranslation } from "react-i18next";

interface CalorieProgressRingProps {
  current: number;
  target: number;
}

export function CalorieProgressRing({ current, target }: CalorieProgressRingProps) {
  const { t } = useTranslation();
  const progress = Math.min(current / target, 1);
  
  // SVG Configuration
  const size = 224; // w-56 = 14rem = 224px
  const strokeWidth = 24; // Thickness of the ring
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - progress * circumference;

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      {/* SVG Ring */}
      <svg className="absolute inset-0 -rotate-90 transform" width={size} height={size}>
        {/* Background Circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="#e2e8f0" // slate-200
          strokeWidth={strokeWidth}
          fill="transparent"
        />
        {/* Progress Circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="#0f766e" // teal-700 (matching original conic gradient start)
          strokeWidth={strokeWidth}
          fill="transparent"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-1000 ease-out"
        />
      </svg>

      {/* Inner Content */}
      <div className="absolute inset-4 rounded-full bg-white shadow-inner shadow-slate-200" />
      <div className="absolute inset-10 flex flex-col items-center justify-center rounded-full bg-gradient-to-b from-white via-white to-emerald-50 text-center z-10">
        <p className="text-xs uppercase tracking-[0.4em] text-slate-400">
          {t("dashboard.hero.calories", "Calorías")}
        </p>
        <p className="mt-2 text-4xl font-semibold text-slate-900">{current}</p>
        <p className="text-sm text-slate-500">
          {t("dashboard.hero.goal", "de")} {target}
        </p>
        <span className="mt-3 rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
          {Math.round(progress * 100)}% {t("dashboard.hero.ready", "completado")}
        </span>
      </div>
    </div>
  );
}
