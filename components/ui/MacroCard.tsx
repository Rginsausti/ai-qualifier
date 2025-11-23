"use client";

import { type LucideIcon } from "lucide-react";

interface MacroCardProps {
    label: string;
    detail: string;
    value: number;
    goal: number;
    unit: string;
    icon: LucideIcon;
    accent: string;
    barColor: string;
}

export function MacroCard({
    label,
    detail,
    value,
    goal,
    unit,
    icon: Icon,
    accent,
    barColor,
}: MacroCardProps) {
    const progress = Math.min(value / goal, 1);

    return (
        <article className="rounded-3xl border border-white/60 bg-white/80 p-5 shadow-inner shadow-white">
            <div
                className={`inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br ${accent}`}
            >
                <Icon className="h-5 w-5 text-slate-900" />
            </div>
            <p className="mt-4 text-xs uppercase tracking-[0.4em] text-slate-400">
                {detail}
            </p>
            <h3 className="text-2xl font-semibold text-slate-900">
                {value}
                {unit}
            </h3>
            <p className="text-sm text-slate-500">
                {label} · {goal}
                {unit}
            </p>
            <div className="mt-4 h-2 rounded-full bg-slate-100">
                <div
                    className={`h-full rounded-full ${barColor}`}
                    style={{ width: `${progress * 100}%` }}
                />
            </div>
        </article>
    );
}
