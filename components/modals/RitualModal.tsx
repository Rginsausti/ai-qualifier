"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { X, Check, Clock } from "lucide-react";
import { logRitual } from "@/lib/user-activities";

type RitualType = 'morning' | 'lunch' | 'snack' | 'dinner' | 'bedtime';

type RitualModalProps = {
    isOpen: boolean;
    onClose: () => void;
    onComplete?: () => void;
    dailyPlan?: {
        morning?: { title: string; detail: string };
        lunch?: { title: string; detail: string };
        dinner?: { title: string; detail: string };
    };
};

export function RitualModal({ isOpen, onClose, onComplete, dailyPlan }: RitualModalProps) {
    const { t } = useTranslation();
    const [selectedRitual, setSelectedRitual] = useState<RitualType | null>(null);
    const [notes, setNotes] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    const rituals: Array<{ type: RitualType; icon: typeof Clock; time: string }> = [
        { type: 'morning', icon: Clock, time: '08:30' },
        { type: 'lunch', icon: Clock, time: '13:00' },
        { type: 'snack', icon: Clock, time: '16:00' },
        { type: 'dinner', icon: Clock, time: '20:00' },
        { type: 'bedtime', icon: Clock, time: '22:00' },
    ];

    const handleComplete = async () => {
        if (!selectedRitual) return;

        setIsSubmitting(true);
        try {
            const { success } = await logRitual(selectedRitual, notes);
            if (success) {
                onComplete?.();
                setSelectedRitual(null);
                setNotes("");
                onClose();
            }
        } catch (error) {
            console.error('Failed to log ritual:', error);
        } finally {
            setIsSubmitting(false);
        }
    };

    const getRitualTitle = (type: RitualType): string => {
        if (dailyPlan) {
            if (type === 'morning' && dailyPlan.morning) return dailyPlan.morning.title;
            if (type === 'lunch' && dailyPlan.lunch) return dailyPlan.lunch.title;
            if (type === 'dinner' && dailyPlan.dinner) return dailyPlan.dinner.title;
        }
        return t(`modals.ritual.types.${type}`, type);
    };

    const getRitualDetail = (type: RitualType): string => {
        if (dailyPlan) {
            if (type === 'morning' && dailyPlan.morning) return dailyPlan.morning.detail;
            if (type === 'lunch' && dailyPlan.lunch) return dailyPlan.lunch.detail;
            if (type === 'dinner' && dailyPlan.dinner) return dailyPlan.dinner.detail;
        }
        return t(`modals.ritual.details.${type}`, '');
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
            <div
                className="relative w-full max-w-2xl rounded-3xl border border-white/60 bg-white/95 p-8 shadow-2xl backdrop-blur-sm"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="mb-6 flex items-center justify-between">
                    <h2 className="text-2xl font-semibold text-slate-900">
                        {t('modals.ritual.title', 'Rituales del día')}
                    </h2>
                    <button
                        onClick={onClose}
                        className="rounded-full p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-900"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <div className="space-y-3">
                    {rituals.map((ritual) => {
                        const isSelected = selectedRitual === ritual.type;
                        return (
                            <button
                                key={ritual.type}
                                onClick={() => setSelectedRitual(ritual.type)}
                                className={`w-full rounded-2xl border p-4 text-left transition ${isSelected
                                        ? 'border-emerald-500 bg-emerald-50'
                                        : 'border-slate-200 bg-white hover:border-emerald-300'
                                    }`}
                            >
                                <div className="flex items-center justify-between">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-3">
                                            <ritual.icon className="h-5 w-5 text-emerald-600" />
                                            <div>
                                                <h3 className="font-semibold text-slate-900">
                                                    {getRitualTitle(ritual.type)}
                                                </h3>
                                                <p className="text-sm text-slate-600">
                                                    {getRitualDetail(ritual.type)}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                    <span className="text-sm font-medium text-slate-500">
                                        {ritual.time}
                                    </span>
                                </div>
                            </button>
                        );
                    })}
                </div>

                {selectedRitual && (
                    <div className="mt-6">
                        <label className="mb-2 block text-sm font-medium text-slate-700">
                            {t('modals.ritual.notes', 'Notas (opcional)')}
                        </label>
                        <textarea
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            placeholder={t('modals.ritual.notesPlaceholder', '¿Cómo te sientes? ¿Algo especial?')}
                            className="w-full rounded-xl border border-slate-200 p-3 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                            rows={3}
                        />
                    </div>
                )}

                <div className="mt-6 flex gap-3">
                    <button
                        onClick={onClose}
                        className="flex-1 rounded-full border border-slate-300 px-6 py-3 font-semibold text-slate-700 transition hover:bg-slate-50"
                    >
                        {t('modals.ritual.cancel', 'Cancelar')}
                    </button>
                    <button
                        onClick={handleComplete}
                        disabled={!selectedRitual || isSubmitting}
                        className="flex-1 inline-flex items-center justify-center gap-2 rounded-full bg-emerald-600 px-6 py-3 font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <Check className="h-5 w-5" />
                        {isSubmitting
                            ? t('modals.ritual.completing', 'Completando...')
                            : t('modals.ritual.complete', 'Completar ritual')
                        }
                    </button>
                </div>
            </div>
        </div>
    );
}
