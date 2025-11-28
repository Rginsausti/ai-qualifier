"use client";

import { Camera, CheckCircle2, Loader2, Mic, ScanBarcode, Type, X, StopCircle } from "lucide-react";
import { useState, useRef, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";

interface MultimodalInputProps {
    isOpen: boolean;
    mode?: "voice" | "multi";
    onClose: () => void;
    onConfirm?: (data: { name: string; calories?: number; text?: string }) => void;
}

export function MultimodalInput({ isOpen, mode = "multi", onClose, onConfirm }: MultimodalInputProps) {
    const { t } = useTranslation();
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [isRecording, setIsRecording] = useState(false);
    const [result, setResult] = useState<{ name: string; calories?: number; text?: string } | null>(null);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const chunksRef = useRef<Blob[]>([]);
    const hasAutoStartedRef = useRef(false);

    const startRecording = useCallback(async () => {
        if (isRecording) return;
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const mediaRecorder = new MediaRecorder(stream);
            mediaRecorderRef.current = mediaRecorder;
            chunksRef.current = [];

            mediaRecorder.ondataavailable = (e) => {
                if (e.data.size > 0) chunksRef.current.push(e.data);
            };

            mediaRecorder.onstop = async () => {
                const audioBlob = new Blob(chunksRef.current, { type: "audio/webm" });
                handleAnalyzeAudio(audioBlob);
                stream.getTracks().forEach(track => track.stop());
            };

            mediaRecorder.start();
            setIsRecording(true);
        } catch (err) {
            console.error("Error accessing microphone:", err);
            alert("No se pudo acceder al micrófono");
        }
    }, [isRecording]);

    const stopRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
        }
    };

    const handleAnalyzeAudio = async (audioBlob: Blob) => {
        setIsAnalyzing(true);
        setResult(null);

        try {
            const formData = new FormData();
            formData.append("file", audioBlob);

            const response = await fetch("/api/ai/transcribe", {
                method: "POST",
                body: formData,
            });

            if (!response.ok) throw new Error("Transcription failed");

            const data = await response.json();
            setResult({
                name: "Nota de voz",
                text: data.text,
            });
        } catch (error) {
            console.error("Error analyzing audio:", error);
            setResult({ name: "Error", text: "No se pudo transcribir el audio." });
        } finally {
            setIsAnalyzing(false);
        }
    };

    const handleAnalyze = (type: string) => {
        if (type === "voice") {
            startRecording();
            return;
        }
        
        setIsAnalyzing(true);
        setResult(null);

        // Simulate AI Analysis for other types
        setTimeout(() => {
            setIsAnalyzing(false);
            setResult({
                name: "Avocado Toast & Poached Egg",
                calories: 450,
            });
        }, 2000);
    };

    const handleClose = () => {
        if (isRecording) {
            stopRecording();
        }
        setResult(null);
        setIsAnalyzing(false);
        hasAutoStartedRef.current = false;
        onClose();
    };

    const handleConfirm = () => {
        if (result && onConfirm) {
            onConfirm(result);
        }
        handleClose();
    };

    const options = [
        {
            id: "photo",
            label: t("logging.options.photo", "Foto"),
            icon: Camera,
            color: "bg-blue-100 text-blue-700",
            onClick: () => handleAnalyze("photo"),
        },
        {
            id: "voice",
            label: t("logging.options.voice", "Voz"),
            icon: Mic,
            color: "bg-rose-100 text-rose-700",
            onClick: () => handleAnalyze("voice"),
        },
        {
            id: "scan",
            label: t("logging.options.scan", "Escanear"),
            icon: ScanBarcode,
            color: "bg-amber-100 text-amber-700",
            onClick: () => handleAnalyze("scan"),
        },
        {
            id: "text",
            label: t("logging.options.text", "Texto"),
            icon: Type,
            color: "bg-emerald-100 text-emerald-700",
            onClick: () => handleAnalyze("text"),
        },
    ];

    useEffect(() => {
        if (!isOpen) {
            hasAutoStartedRef.current = false;
            return;
        }

        if (mode === "voice" && !hasAutoStartedRef.current) {
            hasAutoStartedRef.current = true;
            startRecording();
        }
    }, [isOpen, mode, startRecording]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center p-4">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity"
                onClick={handleClose}
            />

            {/* Modal Content */}
            <div className="relative w-full max-w-md transform overflow-hidden rounded-3xl bg-white p-6 shadow-2xl transition-all animate-in slide-in-from-bottom-10 fade-in duration-300">
                <div className="flex items-center justify-between mb-6">
                    <h3 className="text-xl font-semibold text-slate-900">
                        {result ? t("logging.result.title", "¡Alimento detectado!") : t("logging.title", "Registrar alimento")}
                    </h3>
                    <button
                        onClick={handleClose}
                        className="rounded-full p-2 hover:bg-slate-100 transition-colors"
                    >
                        <X className="h-5 w-5 text-slate-500" />
                    </button>
                </div>

                {isAnalyzing ? (
                    <div className="flex flex-col items-center justify-center py-12">
                        <Loader2 className="h-12 w-12 animate-spin text-emerald-600" />
                        <p className="mt-4 text-sm font-medium text-slate-600 animate-pulse">
                            {t("logging.analyzing", "Analizando con IA...")}
                        </p>
                    </div>
                ) : isRecording ? (
                    <div className="flex flex-col items-center justify-center py-12">
                        <div className="relative flex h-20 w-20 items-center justify-center">
                            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-400 opacity-75"></span>
                            <button 
                                onClick={stopRecording}
                                className="relative inline-flex h-16 w-16 items-center justify-center rounded-full bg-rose-500 text-white transition hover:bg-rose-600"
                            >
                                <StopCircle className="h-8 w-8" />
                            </button>
                        </div>
                        <p className="mt-6 text-sm font-medium text-slate-600">
                            {t("logging.recording", "Escuchando... Toca para terminar")}
                        </p>
                    </div>
                ) : result ? (
                    <div className="space-y-6">
                        <div className="rounded-2xl bg-emerald-50 p-6 text-center">
                            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                                <CheckCircle2 className="h-8 w-8" />
                            </div>
                            <h4 className="text-lg font-bold text-slate-900">{result.name}</h4>
                            {result.calories && <p className="text-emerald-700 font-medium">{result.calories} kcal</p>}
                            {result.text && <p className="mt-2 text-sm text-slate-600 italic">&quot;{result.text}&quot;</p>}
                        </div>
                        <div className="flex gap-3">
                            <button
                                onClick={handleConfirm}
                                className="flex-1 rounded-full bg-slate-900 py-3 text-sm font-semibold text-white shadow-lg shadow-slate-900/20 transition hover:bg-slate-800"
                            >
                                {t("logging.confirm", "Confirmar")}
                            </button>
                            <button
                                onClick={() => {
                                    setResult(null);
                                    if (mode === "voice") {
                                        startRecording();
                                    }
                                }}
                                className="flex-1 rounded-full border border-slate-200 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-900"
                            >
                                {t("logging.retry", "Intentar de nuevo")}
                            </button>
                        </div>
                    </div>
                ) : mode === "voice" ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                        <Mic className="h-12 w-12 text-emerald-600" />
                        <p className="mt-4 text-sm font-medium text-slate-600">
                            {t("logging.voice.preparing", "Activando micrófono...")}
                        </p>
                        <p className="text-xs text-slate-400">
                            {t("logging.voice.helper", "Aceptá el permiso para empezar a grabar.")}
                        </p>
                    </div>
                ) : (
                    <div className="grid grid-cols-2 gap-4">
                        {options.map((option) => (
                            <button
                                key={option.id}
                                onClick={option.onClick}
                                className="flex flex-col items-center justify-center rounded-2xl border border-slate-100 bg-slate-50/50 p-6 transition-all hover:bg-slate-100 hover:scale-[1.02] active:scale-95"
                            >
                                <div className={`mb-3 inline-flex h-14 w-14 items-center justify-center rounded-full ${option.color}`}>
                                    <option.icon className="h-7 w-7" />
                                </div>
                                <span className="text-sm font-semibold text-slate-700">
                                    {option.label}
                                </span>
                            </button>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
