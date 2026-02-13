"use client";

import { ArrowLeft, Send, Sparkles, ThumbsDown, ThumbsUp } from "lucide-react";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "next/navigation";
import { getSupabaseClient } from "@/lib/supabase/client";
import { loadStoredLocation } from "@/lib/location-storage";

const AUTO_MOVEMENT_TRIGGER = "__AUTO_MOVEMENT__";

type Message = {
    id: string;
    role: "user" | "assistant";
    content: string;
    hidden?: boolean;
    created_at?: string;
};

type FeedbackValue = "up" | "down";

type FeedbackState = {
    value: FeedbackValue;
    status: "saving" | "saved" | "error";
};

const CHAT_HISTORY_PREFIX = "alma-chat-history-v1";

const getLocalDayKey = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
};

const buildHistoryStorageKey = (userId: string | null, intent: string) =>
    `${CHAT_HISTORY_PREFIX}:${userId || "guest"}:${intent}:${getLocalDayKey()}`;

const parseStoredMessages = (raw: string | null): Message[] => {
    if (!raw) return [];
    try {
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return [];
        return parsed
            .filter((item): item is Message =>
                typeof item === "object"
                && item !== null
                && (item.role === "user" || item.role === "assistant")
                && typeof item.content === "string"
                && typeof item.id === "string"
            )
            .map((item) => ({
                id: item.id,
                role: item.role,
                content: item.content,
                hidden: Boolean(item.hidden),
                created_at: typeof item.created_at === "string" ? item.created_at : undefined,
            }));
    } catch {
        return [];
    }
};

const sortMessagesChronologically = (items: Message[]) => {
    if (items.length <= 1) return items;

    return [...items].sort((a, b) => {
        const aTime = a.created_at ? Date.parse(a.created_at) : Number.NaN;
        const bTime = b.created_at ? Date.parse(b.created_at) : Number.NaN;
        const aHasTime = Number.isFinite(aTime);
        const bHasTime = Number.isFinite(bTime);

        if (aHasTime && bHasTime && aTime !== bTime) {
            return aTime - bTime;
        }

        if (aHasTime && !bHasTime) return -1;
        if (!aHasTime && bHasTime) return 1;

        return a.id.localeCompare(b.id);
    });
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
    const [feedbackByMessageId, setFeedbackByMessageId] = useState<Record<string, FeedbackState>>({});
    const hintSentRef = useRef(false);
    const prefillSentRef = useRef(false);
    const intent = searchParams.get("intent") || "nutrition";
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const historyLoadedRef = useRef(false);

    useEffect(() => {
        const supabase = getSupabaseClient();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        supabase.auth.getUser().then((response: any) => {
            setUserId(response.data.user?.id ?? null);
        });

        // 1. Try to load stored location (ONLY if manual)
        const stored = loadStoredLocation();
        if (stored && stored.source === "manual") {
            setLocation({ lat: stored.lat, lon: stored.lon });
        }

        // 2. Fallback to browser geolocation (if not manually set)
        if (navigator.geolocation && (!stored || stored.source !== "manual")) {
            const watchId = navigator.geolocation.watchPosition(
                (position) => {
                    setLocation({
                        lat: position.coords.latitude,
                        lon: position.coords.longitude,
                    });
                    // Stop watching if we get good accuracy
                    if (position.coords.accuracy < 100) {
                        navigator.geolocation.clearWatch(watchId);
                    }
                },
                (error) => {
                    console.error("Error getting location:", error);
                }
            );

            // Cleanup watch on unmount
            return () => navigator.geolocation.clearWatch(watchId);
        }
    }, []);

    useEffect(() => {
        historyLoadedRef.current = false;
    }, [intent, userId]);

    useEffect(() => {
        if (historyLoadedRef.current) return;
        if (messages.length > 0 || isLoading) return;

        const loadHistory = async () => {
            if (userId) {
                try {
                    const response = await fetch(`/api/chat/history?intent=${encodeURIComponent(intent)}&locale=${encodeURIComponent(i18n.language)}`);
                    if (response.ok) {
                        const payload = await response.json();
                        const persistedMessages = sortMessagesChronologically(
                            parseStoredMessages(JSON.stringify(payload?.messages || []))
                        );
                        if (persistedMessages.length > 0) {
                            setMessages(persistedMessages);
                            await loadFeedbackForMessages(persistedMessages);
                            historyLoadedRef.current = true;
                            return;
                        }
                    }
                } catch (error) {
                    console.warn("Unable to load server chat history", error);
                }
            }

            const storageKey = buildHistoryStorageKey(userId, intent);
            const localMessages = parseStoredMessages(window.localStorage.getItem(storageKey));
            if (localMessages.length > 0) {
                setMessages(localMessages);
                await loadFeedbackForMessages(localMessages);
            }
            historyLoadedRef.current = true;
        };

        loadHistory();
    }, [i18n.language, intent, isLoading, messages.length, userId]);

    useEffect(() => {
        const storageKey = buildHistoryStorageKey(userId, intent);
        if (messages.length === 0) return;
        window.localStorage.setItem(storageKey, JSON.stringify(messages));
    }, [intent, messages, userId]);

    const persistMessages = useCallback(async (entries: Message[]) => {
        if (!userId || entries.length === 0) return;

        try {
            await fetch("/api/chat/history", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    intent,
                    messages: entries.map((entry) => ({
                        id: entry.id,
                        role: entry.role,
                        content: entry.content,
                        hidden: Boolean(entry.hidden),
                    })),
                }),
            });
        } catch (persistError) {
            console.warn("Unable to persist chat history", persistError);
        }
    }, [intent, userId]);

    async function loadFeedbackForMessages(messagesToMap: Message[]) {
        if (!userId) return;
        const ids = messagesToMap
            .filter((message) => message.role === "assistant")
            .map((message) => message.id)
            .filter(Boolean);

        if (ids.length === 0) return;

        try {
            const params = new URLSearchParams({
                intent,
                ids: ids.join(","),
            });
            const response = await fetch(`/api/chat/feedback?${params.toString()}`);
            if (!response.ok) return;
            const payload = await response.json();
            const feedbackMap = payload?.feedback && typeof payload.feedback === "object"
                ? payload.feedback as Record<string, FeedbackValue>
                : {};

            setFeedbackByMessageId((prev) => {
                const next = { ...prev };
                Object.entries(feedbackMap).forEach(([id, value]) => {
                    if (value === "up" || value === "down") {
                        next[id] = { value, status: "saved" };
                    }
                });
                return next;
            });
        } catch (error) {
            console.warn("Unable to load chat feedback", error);
        }
    }

    const submitFeedback = useCallback(async (message: Message, value: FeedbackValue) => {
        if (message.role !== "assistant" || !userId) return;

        setFeedbackByMessageId((prev) => ({
            ...prev,
            [message.id]: { value, status: "saving" },
        }));

        try {
            const response = await fetch("/api/chat/feedback", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    intent,
                    clientMessageId: message.id,
                    assistantExcerpt: message.content.replace(/<!--[\s\S]*?-->/g, "").slice(0, 1000),
                    feedback: value,
                    reason: value === "down" ? "not_helpful" : "helpful",
                    metadata: {
                        locale: i18n.language,
                    },
                }),
            });

            if (!response.ok) {
                throw new Error("Feedback request failed");
            }

            setFeedbackByMessageId((prev) => ({
                ...prev,
                [message.id]: { value, status: "saved" },
            }));
        } catch (error) {
            console.error("Unable to submit feedback", error);
            setFeedbackByMessageId((prev) => ({
                ...prev,
                [message.id]: { value, status: "error" },
            }));
        }
    }, [i18n.language, intent, userId]);

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
            let assistantContent = "";

            setMessages((prev) => [...prev, assistantMessage]);

            const decoder = new TextDecoder();
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                const text = decoder.decode(value, { stream: true });
                assistantContent += text;

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

            const visibleAssistantContent = assistantContent.replace(/<!--[\s\S]*?-->/g, "").trim();
            if (!visibleAssistantContent) {
                setMessages((prev) => {
                    const last = prev[prev.length - 1];
                    if (last && last.role === "assistant") {
                        return prev.slice(0, -1);
                    }
                    return prev;
                });
                setError(t("chat.connectionError"));
                return;
            }

            if (assistantContent.trim()) {
                await persistMessages([
                    userMessage,
                    { ...assistantMessage, content: assistantContent },
                ]);
            }
        } catch (err) {
            console.error("Chat error:", err);
            setError(t("chat.connectionError"));
            // Remove the empty assistant message if it exists
            setMessages((prev) => {
                const last = prev[prev.length - 1];
                if (last && last.role === "assistant" && !last.content) {
                    return prev.slice(0, -1);
                }
                return prev;
            });
        } finally {
            setIsLoading(false);
        }
    }, [i18n.language, intent, isLoading, location, messages, persistMessages, t, userId]);

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

                    {messages.filter((m) => !m.hidden).map((m) => {
                        const feedback = feedbackByMessageId[m.id];
                        return (
                            <div
                                key={m.id}
                                className={`flex ${m.role === "user" ? "justify-end" : "justify-start"
                                    }`}
                            >
                                <div className="max-w-[85%]">
                                    <div
                                        className={`relative rounded-2xl px-5 py-3 text-sm leading-relaxed shadow-sm ${m.role === "user"
                                            ? "bg-slate-900 text-white"
                                            : "bg-white text-slate-800 border border-slate-100"
                                            }`}
                                    >
                                        <ReactMarkdown>{m.content.replace(/<!--[\s\S]*?-->/g, "")}</ReactMarkdown>
                                    </div>
                                    {m.role === "assistant" && userId ? (
                                        <div className="mt-2 flex items-center gap-2 px-1 text-xs text-slate-500">
                                            <button
                                                type="button"
                                                onClick={() => submitFeedback(m, "up")}
                                                className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 transition ${feedback?.value === "up" ? "border-emerald-500 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-white hover:bg-slate-50"}`}
                                            >
                                                <ThumbsUp className="h-3.5 w-3.5" />
                                                {t("chat.feedback.helpful")}
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => submitFeedback(m, "down")}
                                                className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 transition ${feedback?.value === "down" ? "border-rose-500 bg-rose-50 text-rose-700" : "border-slate-200 bg-white hover:bg-slate-50"}`}
                                            >
                                                <ThumbsDown className="h-3.5 w-3.5" />
                                                {t("chat.feedback.notHelpful")}
                                            </button>
                                            {feedback?.status === "saved" ? (
                                                <span>{t("chat.feedback.saved")}</span>
                                            ) : null}
                                            {feedback?.status === "error" ? (
                                                <span className="text-rose-600">{t("chat.feedback.error")}</span>
                                            ) : null}
                                        </div>
                                    ) : null}
                                </div>
                            </div>
                        );
                    })}

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

