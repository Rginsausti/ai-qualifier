"use client";

import { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { X, Plus, Pencil, Trash2, Package } from "lucide-react";
import { addPantryItem, updatePantryItem, deletePantryItem, getPantryItems, PantryItem } from "@/lib/user-activities";

type PantryModalProps = {
    isOpen: boolean;
    onClose: () => void;
    onUpdate?: () => void;
};

const CATEGORIES = ['protein', 'carbs', 'vegetables', 'fruits', 'snacks', 'beverages'] as const;
const UNITS = ['kg', 'g', 'L', 'ml', 'units'] as const;

export function PantryModal({ isOpen, onClose, onUpdate }: PantryModalProps) {
    const { t } = useTranslation();
    const [items, setItems] = useState<PantryItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [editingItem, setEditingItem] = useState<PantryItem | null>(null);
    type PantryCategoryValue = PantryItem['category'] | '';
    type PantryUnitValue = PantryItem['unit'] | '';

    const [formData, setFormData] = useState({
        item_name: '',
        category: '' as PantryCategoryValue,
        quantity: '',
        unit: 'units' as PantryUnitValue,
        expiry_date: '',
        notes: '',
    });
    const [quickAddText, setQuickAddText] = useState('');
    const [quickAddStatus, setQuickAddStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
    const [quickAddMessage, setQuickAddMessage] = useState<string | null>(null);
    const [isRecordingQuickAdd, setIsRecordingQuickAdd] = useState(false);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const chunksRef = useRef<Blob[]>([]);

    useEffect(() => {
        if (isOpen) {
            loadItems();
        }
    }, [isOpen]);

    useEffect(() => {
        return () => {
            if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
                mediaRecorderRef.current.stop();
            }
        };
    }, []);

    const handleQuickAddTranscription = async (audioBlob: Blob) => {
        setQuickAddStatus("loading");
        setQuickAddMessage(t('modals.pantry.quickAdd.transcribing', 'Transcribiendo...'));
        try {
            const formData = new FormData();
            formData.append("file", audioBlob);
            const response = await fetch("/api/ai/transcribe", {
                method: "POST",
                body: formData,
            });
            if (!response.ok) throw new Error("Transcription failed");
            const data = await response.json();
            setQuickAddText((prev) => (prev ? `${prev}\n${data.text}` : data.text));
            setQuickAddStatus("idle");
            setQuickAddMessage(null);
        } catch (error) {
            console.error('Failed to transcribe pantry audio:', error);
            setQuickAddStatus("error");
            setQuickAddMessage(t('modals.pantry.quickAdd.error', 'No pude transcribir el audio.'));
        }
    };

    const stopQuickAddRecording = () => {
        if (!mediaRecorderRef.current) return;
        if (mediaRecorderRef.current.state !== "inactive") {
            mediaRecorderRef.current.stop();
        }
        setIsRecordingQuickAdd(false);
    };

    const startQuickAddRecording = async () => {
        if (isRecordingQuickAdd) return;
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const recorder = new MediaRecorder(stream);
            mediaRecorderRef.current = recorder;
            chunksRef.current = [];
            recorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    chunksRef.current.push(event.data);
                }
            };
            recorder.onstop = () => {
                const blob = new Blob(chunksRef.current, { type: "audio/webm" });
                stream.getTracks().forEach((track) => track.stop());
                handleQuickAddTranscription(blob);
            };
            recorder.start();
            setIsRecordingQuickAdd(true);
            setQuickAddMessage(t('modals.pantry.quickAdd.recording', 'Escuchando...'));
        } catch (error) {
            console.error('Unable to access microphone', error);
            setQuickAddStatus("error");
            setQuickAddMessage(t('modals.pantry.quickAdd.error', 'No pude usar el micrófono.'));
        }
    };

    const handleToggleRecording = () => {
        if (isRecordingQuickAdd) {
            stopQuickAddRecording();
        } else {
            startQuickAddRecording();
        }
    };

    const loadItems = async () => {
        setIsLoading(true);
        const data = await getPantryItems();
        setItems(data);
        setIsLoading(false);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        try {
            if (editingItem) {
                await updatePantryItem(editingItem.id!, {
                    item_name: formData.item_name,
                    category: formData.category || undefined,
                    quantity: formData.quantity ? parseFloat(formData.quantity) : undefined,
                    unit: formData.unit || undefined,
                    expiry_date: formData.expiry_date || undefined,
                    notes: formData.notes || undefined,
                });
            } else {
                await addPantryItem({
                    item_name: formData.item_name,
                    category: formData.category || undefined,
                    quantity: formData.quantity ? parseFloat(formData.quantity) : undefined,
                    unit: formData.unit || undefined,
                    expiry_date: formData.expiry_date || undefined,
                    notes: formData.notes || undefined,
                });
            }

            resetForm();
            await loadItems();
            onUpdate?.();
        } catch (error) {
            console.error('Failed to save pantry item:', error);
        }
    };

    const handleQuickAdd = async () => {
        const candidates = quickAddText
            .split(/[\n,;]+/)
            .map((entry) => entry.trim())
            .filter(Boolean);
        if (candidates.length === 0) {
            setQuickAddStatus("error");
            setQuickAddMessage(t('modals.pantry.quickAdd.empty', 'Necesito al menos un producto.'));
            return;
        }
        setQuickAddStatus("loading");
        setQuickAddMessage(null);
        try {
            for (const name of candidates) {
                await addPantryItem({
                    item_name: name,
                    unit: 'units',
                });
            }
            setQuickAddText('');
            setQuickAddStatus("success");
            setQuickAddMessage(t('modals.pantry.quickAdd.success', {
                count: candidates.length,
                defaultValue: `Agregué ${candidates.length} productos.`,
            }));
            await loadItems();
            onUpdate?.();
        } catch (error) {
            console.error('Failed to add pantry items:', error);
            setQuickAddStatus("error");
            setQuickAddMessage(t('modals.pantry.quickAdd.error', 'No pude guardar la lista.'));
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm(t('modals.pantry.confirmDelete', '¿Eliminar este ítem?'))) return;

        await deletePantryItem(id);
        await loadItems();
        onUpdate?.();
    };

    const handleEdit = (item: PantryItem) => {
        setEditingItem(item);
        setFormData({
            item_name: item.item_name,
            category: item.category || '',
            quantity: item.quantity?.toString() || '',
            unit: item.unit || 'units',
            expiry_date: item.expiry_date || '',
            notes: item.notes || '',
        });
        setShowForm(true);
    };

    const resetForm = () => {
        setFormData({
            item_name: '',
            category: '',
            quantity: '',
            unit: 'units',
            expiry_date: '',
            notes: '',
        });
        setShowForm(false);
        setEditingItem(null);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
            <div
                className="relative w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-3xl border border-white/60 bg-white/95 p-8 shadow-2xl backdrop-blur-sm"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="mb-6 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Package className="h-6 w-6 text-emerald-600" />
                        <h2 className="text-2xl font-semibold text-slate-900">
                            {t('modals.pantry.title', 'Mi despensa')}
                        </h2>
                    </div>
                    <button
                        onClick={onClose}
                        className="rounded-full p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-900"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <section className="mb-6 rounded-2xl border border-dashed border-emerald-200 bg-emerald-50/40 p-4">
                    <p className="text-xs uppercase tracking-[0.3em] text-emerald-600">
                        {t('modals.pantry.quickAdd.title', 'Registro rápido')}
                    </p>
                    <p className="mt-1 text-sm text-emerald-800">
                        {t('modals.pantry.quickAdd.subtitle', 'Dictá o escribí los productos que tenés. Separalos por comas o saltos de línea.')}
                    </p>
                    <textarea
                        value={quickAddText}
                        onChange={(e) => setQuickAddText(e.target.value)}
                        placeholder={t('modals.pantry.quickAdd.placeholder', 'Ej: avena, tofu firme, manzanas verdes')}
                        className="mt-3 min-h-[96px] w-full rounded-2xl border border-emerald-200 bg-white/80 p-3 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                    />
                    {quickAddMessage && (
                        <p className={`mt-2 text-xs ${quickAddStatus === 'error' ? 'text-rose-600' : 'text-emerald-700'}`}>
                            {quickAddMessage}
                        </p>
                    )}
                    <div className="mt-4 flex flex-wrap gap-3">
                        <button
                            type="button"
                            onClick={handleToggleRecording}
                            className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition ${isRecordingQuickAdd ? 'border-rose-200 bg-rose-50 text-rose-700' : 'border-emerald-200 bg-white text-emerald-700 hover:border-emerald-400'}`}
                        >
                            {isRecordingQuickAdd ? t('modals.pantry.quickAdd.stop', 'Detener dictado') : t('modals.pantry.quickAdd.voice', 'Dictar lista')}
                        </button>
                        <button
                            type="button"
                            onClick={handleQuickAdd}
                            disabled={quickAddStatus === 'loading'}
                            className="inline-flex items-center gap-2 rounded-full bg-emerald-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-60"
                        >
                            {quickAddStatus === 'loading'
                                ? t('modals.pantry.quickAdd.saving', 'Guardando...')
                                : t('modals.pantry.quickAdd.cta', 'Guardar en despensa')}
                        </button>
                    </div>
                </section>

                {/* Add Item Button */}
                {!showForm && (
                    <button
                        onClick={() => setShowForm(true)}
                        className="mb-6 w-full rounded-2xl border-2 border-dashed border-emerald-300 bg-emerald-50/50 p-4 text-emerald-700 transition hover:bg-emerald-100"
                    >
                        <div className="flex items-center justify-center gap-2">
                            <Plus className="h-5 w-5" />
                            <span className="font-semibold">{t('modals.pantry.addItem', 'Agregar ítem')}</span>
                        </div>
                    </button>
                )}

                {/* Form */}
                {showForm && (
                    <form onSubmit={handleSubmit} className="mb-6 space-y-4 rounded-2xl border border-emerald-200 bg-emerald-50/30 p-6">
                        <div className="grid gap-4 sm:grid-cols-2">
                            <div className="sm:col-span-2">
                                <label className="mb-2 block text-sm font-medium text-slate-700">
                                    {t('modals.pantry.itemName', 'Nombre del ítem')} *
                                </label>
                                <input
                                    type="text"
                                    required
                                    value={formData.item_name}
                                    onChange={(e) => setFormData({ ...formData, item_name: e.target.value })}
                                    className="w-full rounded-xl border border-slate-200 p-3 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                                />
                            </div>

                            <div>
                                <label className="mb-2 block text-sm font-medium text-slate-700">
                                    {t('modals.pantry.category', 'Categoría')}
                                </label>
                                <select
                                    value={formData.category}
                                    onChange={(e) => setFormData({ ...formData, category: e.target.value as PantryCategoryValue })}
                                    className="w-full rounded-xl border border-slate-200 p-3 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                                >
                                    <option value="">{t('modals.pantry.selectCategory', 'Seleccionar...')}</option>
                                    {CATEGORIES.map(cat => (
                                        <option key={cat} value={cat}>
                                            {t(`modals.pantry.categories.${cat}`, cat)}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="mb-2 block text-sm font-medium text-slate-700">
                                    {t('modals.pantry.expiryDate', 'Fecha de vencimiento')}
                                </label>
                                <input
                                    type="date"
                                    value={formData.expiry_date}
                                    onChange={(e) => setFormData({ ...formData, expiry_date: e.target.value })}
                                    className="w-full rounded-xl border border-slate-200 p-3 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                                />
                            </div>

                            <div>
                                <label className="mb-2 block text-sm font-medium text-slate-700">
                                    {t('modals.pantry.quantity', 'Cantidad')}
                                </label>
                                <input
                                    type="number"
                                    step="0.01"
                                    value={formData.quantity}
                                    onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                                    className="w-full rounded-xl border border-slate-200 p-3 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                                />
                            </div>

                            <div>
                                <label className="mb-2 block text-sm font-medium text-slate-700">
                                    {t('modals.pantry.unit', 'Unidad')}
                                </label>
                                <select
                                    value={formData.unit}
                                    onChange={(e) => setFormData({ ...formData, unit: e.target.value as PantryUnitValue })}
                                    className="w-full rounded-xl border border-slate-200 p-3 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                                >
                                    {UNITS.map(unit => (
                                        <option key={unit} value={unit}>{unit}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div className="flex gap-3">
                            <button
                                type="button"
                                onClick={resetForm}
                                className="flex-1 rounded-full border border-slate-300 px-6 py-2 font-semibold text-slate-700 transition hover:bg-slate-50"
                            >
                                {t('modals.pantry.cancel', 'Cancelar')}
                            </button>
                            <button
                                type="submit"
                                className="flex-1 rounded-full bg-emerald-600 px-6 py-2 font-semibold text-white transition hover:bg-emerald-700"
                            >
                                {editingItem
                                    ? t('modals.pantry.update', 'Actualizar')
                                    : t('modals.pantry.add', 'Agregar')
                                }
                            </button>
                        </div>
                    </form>
                )}

                {/* Items List */}
                <div className="space-y-3">
                    {isLoading ? (
                        <p className="text-center text-slate-500">{t('modals.pantry.loading', 'Cargando...')}</p>
                    ) : items.length === 0 ? (
                        <p className="text-center text-slate-500">{t('modals.pantry.empty', 'No hay ítems en la despensa')}</p>
                    ) : (
                        items.map((item) => (
                            <div key={item.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                                <div className="flex items-start justify-between">
                                    <div className="flex-1">
                                        <h3 className="font-semibold text-slate-900">{item.item_name}</h3>
                                        <div className="mt-1 flex flex-wrap gap-2 text-xs text-slate-600">
                                            {item.category && (
                                                <span className="rounded-full bg-emerald-100 px-2 py-1">
                                                    {t(`modals.pantry.categories.${item.category}`, item.category)}
                                                </span>
                                            )}
                                            {item.quantity && (
                                                <span>{item.quantity} {item.unit}</span>
                                            )}
                                            {item.expiry_date && (
                                                <span className="text-amber-600">
                                                    {t('modals.pantry.expires', 'Vence')}: {new Date(item.expiry_date).toLocaleDateString()}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => handleEdit(item)}
                                            className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-900"
                                        >
                                            <Pencil className="h-4 w-4" />
                                        </button>
                                        <button
                                            onClick={() => handleDelete(item.id!)}
                                            className="rounded-lg p-2 text-slate-400 transition hover:bg-red-100 hover:text-red-600"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}
