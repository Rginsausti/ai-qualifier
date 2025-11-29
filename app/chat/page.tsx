"use client";

import { ArrowLeft, Send, Sparkles } from "lucide-react";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "next/navigation";
import { getSupabaseClient } from "@/lib/supabase/client";

const AUTO_MOVEMENT_TRIGGER = "__AUTO_MOVEMENT__";

type Message = {
    id: string;
    role: "user" | "assistant";
    content: string;
    hidden?: boolean;
};

function ChatPageContent() {
    const { t, i18n } = useTranslation();
    const searchParams = useSearchParams();
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [userId, setUserId] = useState<string | null>(null);
    const [location, setLocation] = useState<{ lat: number; lon: number } | null>(null);
    const hintParam = searchParams.get("hint");
    const prefillParam = searchParams.get("prefill");
    const [prefillToSend, setPrefillToSend] = useState<string | null>(null);
    const hintSentRef = useRef(false);
    const prefillSentRef = useRef(false);
    const intent = searchParams.get("intent") || "nutrition";
    const messagesEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const supabase = getSupabaseClient();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        supabase.auth.getUser().then((response: any) => {
            setUserId(response.data.user?.id ?? null);
        });

        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    setLocation({
                        lat: position.coords.latitude,
                        lon: position.coords.longitude,
                    });
                },
                (error) => {
                    console.error("Error getting location:", error);
                }
            );
        }
    }, []);

    const sendMessage = useCallback(async (content: string, options?: { hidden?: boolean; hint?: string; includeHiddenHistory?: boolean }) => {
        if (!content.trim() || isLoading) return;

        const trimmed = content.trim();
        const userMessage: Message = {
            id: Date.now().toString(),
            role: "user",
            content: trimmed,
            hidden: options?.hidden ?? false,
        };

        const nextMessages = [...messages, userMessage];
        setMessages(nextMessages);
        const baseHistory = options?.includeHiddenHistory ? messages : messages.filter((msg) => !msg.hidden);
        const conversation = [...baseHistory, userMessage];
        setIsLoading(true);
        setError(null);

        try {
            const response = await fetch("/api/chat", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    messages: conversation.map(({ role, content: msgContent }) => ({ role, content: msgContent })),
                    locale: i18n.language,
                    userId,
                    location,
                    intent,
                    hint: options?.hint,
                }),
            });

            if (!response.ok) throw new Error("Failed to fetch response");

            const reader = response.body?.getReader();
            if (!reader) throw new Error("No reader available");

            const assistantMessage: Message = {
                id: (Date.now() + 1).toString(),
                role: "assistant",
                content: "",
            };

            setMessages((prev) => [...prev, assistantMessage]);

            const decoder = new TextDecoder();
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                const text = decoder.decode(value, { stream: true });

                setMessages((prev) => {
                    const newMessages = [...prev];
                    const lastMsgIndex = newMessages.length - 1;
                    const lastMsg = newMessages[lastMsgIndex];

                    if (lastMsg && lastMsg.role === "assistant") {
                        newMessages[lastMsgIndex] = {
                            ...lastMsg,
                            content: lastMsg.content + text,
                        };
                    }
                    return newMessages;
                });
            }
        } catch (err) {
            console.error("Chat error:", err);
            setError("Error al conectar con el chat.");
        } finally {
            setIsLoading(false);
        }
    }, [i18n.language, intent, isLoading, location, messages, userId]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim()) return;
        const message = input;
        setInput("");
        await sendMessage(message);
    };

    useEffect(() => {
        if (!hintParam || hintSentRef.current) return;
        if (messages.length > 0 || isLoading) return;
        hintSentRef.current = true;
        sendMessage(AUTO_MOVEMENT_TRIGGER, {
            hidden: true,
            hint: hintParam,
            includeHiddenHistory: true,
        });
    }, [hintParam, messages.length, isLoading, sendMessage]);

    useEffect(() => {
        if (!prefillParam || prefillSentRef.current) return;
        if (messages.length > 0) return;
        setPrefillToSend(prefillParam);
    }, [prefillParam, messages.length]);

    useEffect(() => {
        if (!prefillToSend || prefillSentRef.current) return;
        if (messages.length > 0 || isLoading || hintParam) return;
        prefillSentRef.current = true;
        sendMessage(prefillToSend);
        setPrefillToSend(null);
    }, [prefillToSend, messages.length, isLoading, hintParam, sendMessage]);

    // Auto-scroll to bottom
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    return (
        <div className="flex h-[100dvh] flex-col bg-[#f6f3ec]">
            {/* Header */}
            <header className="flex items-center justify-between border-b border-slate-200 bg-white/80 px-6 py-4 backdrop-blur-md">
                <Link
                    href="/"
                    className="flex items-center gap-2 rounded-full p-2 text-slate-600 transition hover:bg-slate-100"
                >
                    <ArrowLeft className="h-5 w-5" />
                    <span className="text-sm font-medium">{t("chat.back")}</span>
                </Link>
                <div className="flex flex-col items-center">
                    <h1 className="text-lg font-semibold text-slate-900">{t("chat.title")}</h1>
                    <div className="flex items-center gap-1.5">
                        <span className="relative flex h-2 w-2">
                            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
                            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500"></span>
                        </span>
                        <span className="text-xs text-slate-500">{t("chat.online")}</span>
                    </div>
                </div>
                <div className="w-10" /> {/* Spacer for alignment */}
            </header>

            {/* Chat Area */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6">
                <div className="mx-auto max-w-2xl space-y-6">
                    {messages.length === 0 && (
                        <div className="mt-20 flex flex-col items-center text-center">
                            <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                                <Sparkles className="h-10 w-10" />
                            </div>
                            <h2 className="text-2xl font-semibold text-slate-900">
                                {t("chat.welcome.title")}
                            </h2>
                            <p className="mt-2 max-w-md text-slate-600">
                                {t("chat.welcome.description")}
                            </p>
                        </div>
                    )}

                    {messages.filter((m) => !m.hidden).map((m) => (
                        <div
                            key={m.id}
                            className={`flex ${m.role === "user" ? "justify-end" : "justify-start"
                                }`}
                        >
                            <div
                                className={`relative max-w-[85%] rounded-2xl px-5 py-3 text-sm leading-relaxed shadow-sm ${m.role === "user"
                                    ? "bg-slate-900 text-white"
                                    : "bg-white text-slate-800 border border-slate-100"
                                    }`}
                            >
                                <ReactMarkdown>{m.content}</ReactMarkdown>
                            </div>
                        </div>
                    ))}

                    {isLoading && (
                        <div className="flex justify-start">
                            <div className="flex items-center gap-2 rounded-2xl bg-white px-4 py-3 shadow-sm">
                                <div className="h-2 w-2 animate-bounce rounded-full bg-slate-400 [animation-delay:-0.3s]"></div>
                                <div className="h-2 w-2 animate-bounce rounded-full bg-slate-400 [animation-delay:-0.15s]"></div>
                                <div className="h-2 w-2 animate-bounce rounded-full bg-slate-400"></div>
                            </div>
                        </div>
                    )}

                    {error && (
                        <div className="flex justify-center">
                            <div className="rounded-lg bg-red-50 p-4 text-red-800">
                                <p className="text-sm font-medium">Error: {error}</p>
                            </div>
                        </div>
                    )}
                    <div ref={messagesEndRef} />
                </div>
            </div>

            {/* Input Area */}
            <div className="border-t border-slate-200 bg-white p-4 pb-8 sm:p-6">
                <form onSubmit={handleSubmit} className="mx-auto flex max-w-2xl items-center gap-3">
                    <input
                        className="flex-1 rounded-full border border-slate-200 bg-slate-50 px-6 py-4 text-sm text-slate-900 outline-none transition focus:border-slate-900 focus:ring-1 focus:ring-slate-900"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder={t('chat.inputPlaceholder')}
                        autoFocus
                    />
                    <button
                        type="submit"
                        disabled={isLoading || !input.trim()}
                        className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-900 text-white shadow-lg transition hover:bg-slate-800 disabled:opacity-50 disabled:hover:bg-slate-900"
                    >
                        <Send className="h-5 w-5" />
                    </button>
                </form>
            </div>
        </div>
    );
}

export default function ChatPage() {
    return (
        <Suspense
            fallback={(
                <div className="flex h-[100dvh] items-center justify-center bg-[#f6f3ec] text-slate-500">
                    Loading chat…
                </div>
            )}
        >
            <ChatPageContent />
        </Suspense>
    );
}

