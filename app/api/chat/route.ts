import { groq } from "@ai-sdk/groq";
import { createHuggingFace } from "@ai-sdk/huggingface";
import { streamText } from "ai";
import {
  getUserProfile,
  getRecentQuickLogs,
  getTodayNutritionLogs,
  getDailyStats,
  logNutrition,
  logWater,
  analyzeFoodFromText,
  resetTodayIntake,
  deleteLatestTodayNutritionLog,
} from "@/lib/actions";
import { getPantryItems } from "@/lib/user-activities";
import { findMarketPriceMatches, getMarketContext } from "@/lib/market-prices";
import { formatKnowledgeContext, retrieveKnowledge } from "@/lib/kb/retrieval";
import { randomUUID } from "crypto";
import { tryUpstashLimit } from "@/lib/upstash/ratelimit";
import { createClient } from "@/lib/supabase/server";

type QuickLog = {
  created_at: string;
  energy: string | null;
  hunger: number;
  craving: string | null;
  notes: string | null;
};

type MealLog = {
  id?: string | number;
  created_at: string;
  name: string | null;
  calories: number | null;
  protein: number | null;
  carbs: number | null;
  fats: number | null;
  meal_type?: string | null;
};

type LoggedMealCandidate = {
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
  meal_type?: string;
};

type PendingIngestionPayload = {
  id: string;
  candidate: LoggedMealCandidate;
  duplicate: {
    name: string | null;
    calories: number | null;
    created_at?: string | null;
  };
};

type HandleIngestionResult =
  | { type: "early-response"; response: Response }
  | { type: "continue"; autoActionNote?: string; newMeal?: MealLog; waterDelta?: number };

const PENDING_MARKER_REGEX = /<!--PENDING_INGESTION:([A-Za-z0-9_-]+)-->+/g;
const RESOLVED_MARKER_REGEX = /<!--PENDING_RESOLVED:([A-Za-z0-9_-]+)-->+/g;
const AUTO_MOVEMENT_TRIGGER = "__AUTO_MOVEMENT__";

const normalizeMealName = (value?: string | null) =>
  (value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const areMealsSimilar = (existing: MealLog, candidate: LoggedMealCandidate) => {
  const existingName = normalizeMealName(existing.name);
  const candidateName = normalizeMealName(candidate.name);
  if (!existingName || !candidateName) return false;

  const nameMatch =
    existingName === candidateName ||
    existingName.includes(candidateName) ||
    candidateName.includes(existingName);

  if (!nameMatch) return false;

  const existingCalories = existing.calories || 0;
  const diff = Math.abs(existingCalories - candidate.calories);
  const tolerance = Math.max(30, candidate.calories * 0.2);
  return diff <= tolerance;
};

const toBase64Url = (value: string) =>
  Buffer.from(value)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");

const fromBase64Url = (value: string) => {
  const padLength = (4 - (value.length % 4)) % 4;
  const padded = value.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat(padLength);
  return Buffer.from(padded, "base64").toString("utf8");
};

const encodePendingMarker = (payload: PendingIngestionPayload) =>
  `<!--PENDING_INGESTION:${toBase64Url(JSON.stringify(payload))}-->`;

const encodeResolvedMarker = (id: string) => `<!--PENDING_RESOLVED:${id}-->`;

const decodePendingMarker = (token: string): PendingIngestionPayload | null => {
  try {
    const raw = fromBase64Url(token);
    const parsed = JSON.parse(raw);
    if (!parsed?.id || !parsed?.candidate) return null;
    return parsed;
  } catch {
    return null;
  }
};

const extractPendingIngestion = (messages: Required<IncomingMessage>[]) => {
  const resolved = new Set<string>();

  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const message = messages[i];
    if (message.role !== "assistant") continue;

    const resolvedMatches = message.content.matchAll(RESOLVED_MARKER_REGEX);
    for (const match of resolvedMatches) {
      if (match[1]) {
        resolved.add(match[1]);
      }
    }

    const pendingMatches = message.content.matchAll(PENDING_MARKER_REGEX);
    for (const match of pendingMatches) {
      const payload = match[1] ? decodePendingMarker(match[1]) : null;
      if (payload && !resolved.has(payload.id)) {
        return payload;
      }
    }
  }

  return null;
};

const decisionKeywords = {
  new: ["nueva", "nuevo", "otra", "otro", "sumala", "sumalo", "agregala", "agregalo", "registrala", "registralo", "cargala", "cargalo"],
  same: ["misma", "mismo", "ya estaba", "ya lo registre", "ya la registre", "ya lo cargue", "ya la cargue", "era esa", "esa misma", "esa misma ingesta"],
};

const normalizeText = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

const detectPendingDecision = (text?: string | null): "new" | "same" | null => {
  if (!text) return null;
  const normalized = normalizeText(text);
  const hasNew = decisionKeywords.new.some((keyword) => normalized.includes(keyword));
  if (hasNew) return "new";
  const hasSame = decisionKeywords.same.some((keyword) => normalized.includes(keyword));
  if (hasSame) return "same";
  return null;
};

type IntakeCommand = "reset_day" | "delete_latest";

const includesAny = (value: string, keywords: string[]) =>
  keywords.some((keyword) => value.includes(keyword));

const detectIntakeCommand = (text?: string | null): IntakeCommand | null => {
  if (!text) return null;
  const normalized = normalizeText(text);

  const hasDeleteVerb = includesAny(normalized, ["borra", "borrar", "elimina", "eliminar", "quita", "quitar", "limpia", "limpiar", "reset", "reinicia", "reiniciar"]);
  const mentionsDailyTotals = includesAny(normalized, ["tablero", "conteo", "macros", "macro", "calorias", "caloria", "registro", "registros", "ingesta", "ingestas", "hoy", "dia", "diario", "cero"]);
  const isResetDay = hasDeleteVerb && mentionsDailyTotals && includesAny(normalized, ["todo", "todos", "cero", "reset", "reinicia", "tablero", "hoy", "dia"]);

  if (isResetDay) {
    return "reset_day";
  }

  const wantsLatest = hasDeleteVerb && includesAny(normalized, ["ultimo", "ultima", "reciente", "equivoque", "equivocado", "equivocada"]);
  if (wantsLatest) {
    return "delete_latest";
  }

  return null;
};

const PRICE_INTENT_KEYWORDS = [
  "precio",
  "precios",
  "cuanto cuesta",
  "cuesta",
  "sale",
  "presupuesto",
  "barato",
  "barata",
  "econ",
  "ars",
  "$",
];

const hasPriceIntent = (text?: string | null) => {
  if (!text) return false;
  const normalized = normalizeText(text);
  return PRICE_INTENT_KEYWORDS.some((keyword) => normalized.includes(keyword));
};

const buildNoVerifiedPriceMessage = () =>
  "No tengo un precio verificado para ese producto en este momento. Si querés, te recomiendo opciones similares por perfil nutricional sin inventar precios, o podés pedirme precios solo de productos con referencia en mi lista actual.";

const formatTimeForLocale = (dateIso?: string | null, locale = "es") => {
  if (!dateIso) return "";
  try {
    return new Date(dateIso).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
};

const formatMacros = (candidate: LoggedMealCandidate) => {
  const parts = [] as string[];
  if (candidate.protein) parts.push(`P${candidate.protein}g`);
  if (candidate.carbs) parts.push(`C${candidate.carbs}g`);
  if (candidate.fats) parts.push(`G${candidate.fats}g`);
  return parts.join(" · ");
};

const respondWithText = (text: string, status = 200) =>
  new Response(text, {
    status,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });

const buildPendingQuestionMessage = (
  payload: PendingIngestionPayload,
  locale: string,
  reminder = false,
) => {
  const duplicateName = payload.duplicate.name || "ese registro";
  const duplicateCalories = payload.duplicate.calories ?? 0;
  const duplicateTime = formatTimeForLocale(payload.duplicate.created_at, locale);
  const marker = encodePendingMarker(payload);

  const intro = reminder
    ? "Necesito saber si registrar la nueva ingesta para evitar duplicados."
    : "Detecté que esta comida ya parece estar registrada.";

  const timeCopy = duplicateTime ? ` a las ${duplicateTime}` : "";
  return `${intro} Ya tenés ${duplicateName} (${duplicateCalories} kcal${timeCopy}). Decime "misma" si era ese registro o "nueva" para cargar otra porción. También podés describirla de nuevo.
${marker}`;
};

const buildPendingResolutionMessage = (
  payload: PendingIngestionPayload,
  action: "logged" | "skipped",
  extra?: string,
) => {
  const summary = action === "logged"
    ? `Listo, registré "${payload.candidate.name}" (+${payload.candidate.calories} kcal${formatMacros(payload.candidate) ? ` | ${formatMacros(payload.candidate)}` : ""}).`
    : "Perfecto, no dupliqué ese registro.";
  const detail = extra ? ` ${extra}` : "";
  return `${summary}${detail}\n${encodeResolvedMarker(payload.id)}`;
};

const sanitizeNumber = (value: unknown) => {
  if (typeof value === "number" && Number.isFinite(value)) return Math.max(0, Math.round(value * 100) / 100);
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, Math.round(parsed * 100) / 100) : 0;
};

const sanitizeWaterAmount = (analysis: Record<string, unknown>) => {
  const candidates = [
    analysis.water_ml,
    analysis.waterMl,
    analysis.water,
    analysis.amount_ml,
    analysis.amount,
  ];

  for (const candidate of candidates) {
    const value = sanitizeNumber(candidate);
    if (value > 0) {
      return Math.round(value);
    }
  }

  return 0;
};

const toMealCandidate = (analysis: Record<string, unknown>): LoggedMealCandidate => ({
  name: typeof analysis.name === "string" && analysis.name.trim().length > 0 ? analysis.name.trim() : "Registro",
  calories: sanitizeNumber(analysis.calories),
  protein: sanitizeNumber(analysis.protein),
  carbs: sanitizeNumber(analysis.carbs),
  fats: sanitizeNumber(analysis.fats),
  meal_type: typeof analysis.mealType === "string" ? analysis.mealType : undefined,
});

async function handleIngestionFlow(params: {
  messages: Required<IncomingMessage>[];
  todaysMeals: MealLog[];
  userLocale: string;
}): Promise<HandleIngestionResult> {
  const { messages, todaysMeals, userLocale } = params;
  const lastUserMessage = [...messages].reverse().find((message) => message.role === "user");
  const intakeCommand = detectIntakeCommand(lastUserMessage?.content);

  if (intakeCommand === "reset_day") {
    const resetResult = await resetTodayIntake(userLocale);
    if (!resetResult.success) {
      return {
        type: "early-response",
        response: respondWithText(`No pude reiniciar tu tablero de hoy (${resetResult.error ?? "motivo desconocido"}).`),
      };
    }

    const deletedMeals = resetResult.deletedMeals ?? 0;
    const deletedWaterLogs = resetResult.deletedWaterLogs ?? 0;
    const resetMessage = deletedMeals + deletedWaterLogs > 0
      ? `Listo, reinicié tu tablero de hoy. Eliminé ${deletedMeals} registro${deletedMeals === 1 ? "" : "s"} de comida y ${deletedWaterLogs} registro${deletedWaterLogs === 1 ? "" : "s"} de agua.`
      : "Tu tablero de hoy ya estaba en cero.";
    return { type: "early-response", response: respondWithText(resetMessage) };
  }

  if (intakeCommand === "delete_latest") {
    const deleteResult = await deleteLatestTodayNutritionLog(userLocale);
    if (!deleteResult.success) {
      return {
        type: "early-response",
        response: respondWithText(`Intenté borrar el último registro, pero falló (${deleteResult.error ?? "motivo desconocido"}).`),
      };
    }

    if (!deleteResult.deleted) {
      return {
        type: "early-response",
        response: respondWithText("No encontré registros de comida de hoy para borrar."),
      };
    }

    const deletedName = deleteResult.deletedName || "el último registro";
    return {
      type: "early-response",
      response: respondWithText(`Listo, borré "${deletedName}" de tu registro de hoy.`),
    };
  }

  const pending = extractPendingIngestion(messages);

  if (pending) {
    const decision = detectPendingDecision(lastUserMessage?.content);

    if (!decision) {
      const reminder = buildPendingQuestionMessage(pending, userLocale, true);
      return { type: "early-response", response: respondWithText(reminder) };
    }

    if (decision === "same") {
      const resolvedMessage = buildPendingResolutionMessage(pending, "skipped");
      return { type: "early-response", response: respondWithText(resolvedMessage) };
    }

    const logResult = await logNutrition({
      name: pending.candidate.name,
      calories: pending.candidate.calories,
      protein: pending.candidate.protein,
      carbs: pending.candidate.carbs,
      fats: pending.candidate.fats,
      mealType: pending.candidate.meal_type,
    });

    if (!logResult?.success) {
      const retryMessage = `${buildPendingQuestionMessage(pending, userLocale, true)}\nNo pude registrarlo todavía (${logResult?.error ?? "motivo desconocido"}). Intentemos nuevamente.`;
      return { type: "early-response", response: respondWithText(retryMessage) };
    }

    const loggedMessage = buildPendingResolutionMessage(pending, "logged");
    return { type: "early-response", response: respondWithText(loggedMessage) };
  }

  if (!lastUserMessage) {
    return { type: "continue" };
  }

  let analysis: Record<string, unknown> | null = null;
  try {
    analysis = await analyzeFoodFromText(lastUserMessage.content);
  } catch (error) {
    console.error("handleIngestionFlow: analyzeFoodFromText failed", error);
  }

  if (!analysis) {
    return { type: "continue" };
  }

  // Check intent: if it's a consultation (recipe, question), do not log it.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if ((analysis as any).intent === "consult") {
    return { type: "continue" };
  }

  const type = typeof analysis.type === "string" ? analysis.type.toLowerCase() : undefined;
  const waterAmount = sanitizeWaterAmount(analysis);
  const isWater = type === "water" || (!type && waterAmount > 0);

  if (isWater) {
    if (waterAmount <= 0) {
      return { type: "continue" };
    }

    const logResult = await logWater(waterAmount);
    if (!logResult?.success) {
      return {
        type: "continue",
        autoActionNote: `Intenté registrar ${waterAmount} ml de agua pero falló (${logResult?.error ?? "motivo desconocido"}).`,
      };
    }

    const glasses = Math.max(1, Math.round(waterAmount / 250));
    return {
      type: "continue",
      autoActionNote: `Registré ${waterAmount} ml de agua (~${glasses} vaso${glasses > 1 ? "s" : ""}).`,
      waterDelta: waterAmount,
    };
  }

  if (type && type !== "food") {
    return { type: "continue" };
  }

  const candidate = toMealCandidate(analysis);
  if (!candidate.calories && !candidate.protein && !candidate.carbs && !candidate.fats) {
    return { type: "continue" };
  }

  const duplicate = todaysMeals.find((meal) => areMealsSimilar(meal, candidate));
  if (duplicate) {
    const payload: PendingIngestionPayload = {
      id: randomUUID(),
      candidate,
      duplicate: {
        name: duplicate.name,
        calories: duplicate.calories,
        created_at: duplicate.created_at,
      },
    };
    const question = buildPendingQuestionMessage(payload, userLocale);
    return { type: "early-response", response: respondWithText(question) };
  }

  const logResult = await logNutrition({
    name: candidate.name,
    calories: candidate.calories,
    protein: candidate.protein,
    carbs: candidate.carbs,
    fats: candidate.fats,
    mealType: candidate.meal_type,
  });

  if (!logResult?.success) {
    return {
      type: "continue",
      autoActionNote: `Intenté registrar "${candidate.name}" pero falló (${logResult?.error ?? "motivo desconocido"}).`,
    };
  }

  const newMeal: MealLog = {
    id: `temp-${randomUUID()}`,
    name: candidate.name,
    calories: candidate.calories,
    protein: candidate.protein,
    carbs: candidate.carbs,
    fats: candidate.fats,
    meal_type: candidate.meal_type || "snack",
    created_at: new Date().toISOString(),
  };

  return {
    type: "continue",
    autoActionNote: `Registré automáticamente "${candidate.name}" (+${candidate.calories} kcal${formatMacros(candidate) ? ` | ${formatMacros(candidate)}` : ""}).`,
    newMeal,
  };
}

export const runtime = "nodejs";
// Allow streaming responses up to 30 seconds
export const maxDuration = 30;

type IncomingMessage = {
  role?: "user" | "assistant";
  content?: string;
};

type FeedbackEvent = {
  feedback: "up" | "down";
  reason: string | null;
  created_at: string;
};

const jsonResponse = (body: Record<string, unknown>, status = 400) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

type ProviderFailureKind = "rate_limit" | "quota" | "auth" | "timeout" | "upstream" | "unknown";

const readErrorMessage = (error: unknown): string => {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  if (error && typeof error === "object") {
    const record = error as Record<string, unknown>;
    const direct = typeof record.message === "string" ? record.message : "";
    if (direct) return direct;

    const cause = record.cause;
    if (cause) return readErrorMessage(cause);
  }
  return "unknown provider error";
};

const classifyProviderFailure = (error: unknown): ProviderFailureKind => {
  const message = readErrorMessage(error).toLowerCase();
  if (!message) return "unknown";

  if (
    message.includes("quota") ||
    message.includes("insufficient") ||
    message.includes("credit") ||
    message.includes("billing")
  ) {
    return "quota";
  }

  if (
    message.includes("rate limit") ||
    message.includes("too many requests") ||
    message.includes("status: 429") ||
    message.includes("status 429") ||
    message.includes(" 429 ")
  ) {
    return "rate_limit";
  }

  if (
    message.includes("unauthorized") ||
    message.includes("forbidden") ||
    message.includes("invalid api key") ||
    message.includes("status: 401") ||
    message.includes("status 401") ||
    message.includes("status: 403") ||
    message.includes("status 403")
  ) {
    return "auth";
  }

  if (
    message.includes("timeout") ||
    message.includes("timed out") ||
    message.includes("aborted") ||
    message.includes("deadline")
  ) {
    return "timeout";
  }

  if (
    message.includes("service unavailable") ||
    message.includes("bad gateway") ||
    message.includes("gateway") ||
    message.includes("status: 502") ||
    message.includes("status 502") ||
    message.includes("status: 503") ||
    message.includes("status 503")
  ) {
    return "upstream";
  }

  return "unknown";
};

const extractUsageCounter = (usage: unknown, keys: string[]) => {
  if (!usage || typeof usage !== "object") return undefined;
  const record = usage as Record<string, unknown>;
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
  }
  return undefined;
};

const CHAT_RATE_PER_MIN = Number(process.env.AI_RATE_LIMIT_PER_MINUTE || "60");
const chatRateWindowMs = 60_000;
const chatRateMap = new Map<string, { count: number; resetAt: number }>();
const MAX_HISTORY_MESSAGES = Number(process.env.CHAT_MAX_HISTORY_MESSAGES || "10");
const MAX_KB_CONTEXT_CHARS = Number(process.env.CHAT_KB_MAX_CHARS || "1800");
const MAX_PANTRY_ITEMS_IN_PROMPT = Number(process.env.CHAT_MAX_PANTRY_ITEMS || "10");
const MAX_RECENT_MEALS_IN_PROMPT = Number(process.env.CHAT_MAX_RECENT_MEALS || "6");
const MAX_RECENT_LOGS_IN_PROMPT = Number(process.env.CHAT_MAX_RECENT_LOGS || "3");

const COMPLEX_QUERY_HINTS = [
  "plan",
  "semana",
  "menu",
  "objetivo",
  "objetivos",
  "sintoma",
  "alerg",
  "intoler",
  "presupuesto",
  "macro",
  "rutina",
  "estrategia",
  "protocolo",
];

const checkLocalRate = (ip: string | null) => {
  if (!ip) return true;
  const now = Date.now();
  const state = chatRateMap.get(ip);
  if (!state || state.resetAt <= now) {
    chatRateMap.set(ip, { count: 1, resetAt: now + chatRateWindowMs });
    return true;
  }
  if (state.count >= CHAT_RATE_PER_MIN) return false;
  state.count += 1;
  return true;
};

const toStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
};

const buildFeedbackMemory = (events: FeedbackEvent[]) => {
  if (!events.length) {
    return "No prior feedback signals for this user in this intent.";
  }

  const positive = events.filter((event) => event.feedback === "up").length;
  const negativeEvents = events.filter((event) => event.feedback === "down");
  const negative = negativeEvents.length;
  const total = events.length;
  const helpfulRate = total > 0 ? Math.round((positive / total) * 100) : 0;

  const reasonCounts = new Map<string, number>();
  negativeEvents.forEach((event) => {
    const normalized = (event.reason || "not_helpful").toLowerCase().trim();
    const current = reasonCounts.get(normalized) || 0;
    reasonCounts.set(normalized, current + 1);
  });

  const topReasons = Array.from(reasonCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([reason, count]) => `${reason} (${count})`)
    .join(", ");

  return `Helpful rate: ${helpfulRate}% (${positive}/${total}). Negative feedback events: ${negative}. Top issues: ${topReasons || "none"}.`;
};

const buildSafetyGuardrails = (profile: unknown): string => {
  const profileRecord = (profile && typeof profile === "object") ? (profile as Record<string, unknown>) : {};
  const allergens = toStringArray(profileRecord.allergens);
  const intolerances = toStringArray(profileRecord.intolerances);
  const therapeutic = toStringArray(profileRecord.therapeutic);
  const restrictions = [
    ...allergens.map((item) => `allergen:${item}`),
    ...intolerances.map((item) => `intolerance:${item}`),
    ...therapeutic.map((item) => `therapeutic:${item}`),
  ];

  const restrictionLine = restrictions.length
    ? restrictions.join(", ")
    : "none declared";

  return `
      SAFETY GUARDRAILS (NON-NEGOTIABLE):
      - Never suggest foods that conflict with declared restrictions: ${restrictionLine}.
      - If user asks for advice that conflicts with restrictions, refuse briefly and offer 2 safer alternatives.
      - Do not provide medical diagnosis or treatment plans. Recommend licensed professional support for clinical decisions.
      - If user reports severe symptoms, medication interactions, pregnancy/lactation concerns, or chronic disease flare-up, prioritize safety and advise medical consultation.
      - Do not prescribe extreme protocols (e.g. very-low-carb/keto) for therapeutic conditions without explicit clinician supervision.
  `;
};

const isComplexChatRequest = (text?: string | null, intent?: string) => {
  if (intent === "movement") return true;
  if (!text) return false;
  const normalized = normalizeText(text);
  if (normalized.length > 220) return true;
  return COMPLEX_QUERY_HINTS.some((hint) => normalized.includes(hint));
};

const trimMessagesForModel = (messages: Required<IncomingMessage>[]) => {
  if (messages.length <= MAX_HISTORY_MESSAGES) {
    return messages;
  }

  const lastUserIndex = [...messages].reverse().findIndex((message) => message.role === "user");
  const realLastUserIndex = lastUserIndex >= 0 ? messages.length - 1 - lastUserIndex : messages.length - 1;
  const start = Math.max(0, realLastUserIndex - (MAX_HISTORY_MESSAGES - 1));
  return messages.slice(start);
};

const buildCompactProfile = (profile: unknown) => {
  if (!profile || typeof profile !== "object") {
    return "No specific profile found.";
  }

  const record = profile as Record<string, unknown>;
  const compact = {
    locale: record.locale ?? null,
    goal: record.goal ?? null,
    conditions: toStringArray(record.conditions),
    allergens: toStringArray(record.allergens),
    intolerances: toStringArray(record.intolerances),
    therapeutic: toStringArray(record.therapeutic),
    dietary_style: record.dietary_style ?? null,
  };

  return JSON.stringify(compact, null, 2);
};

export async function POST(req: Request) {
  const forwarded = req.headers.get("x-forwarded-for") || null;
  const ip = forwarded ? forwarded.split(",")[0].trim() : req.headers.get("x-real-ip");
  const llmStartedAt = Date.now();

  try {
    const upstashResult = await tryUpstashLimit(`chat:${ip ?? "unknown"}`);
    if (!upstashResult.success) {
      return jsonResponse({ error: "Rate limit exceeded" }, 429);
    }
  } catch (error) {
    const allowed = checkLocalRate(ip);
    if (!allowed) {
      return jsonResponse({ error: "Rate limit exceeded" }, 429);
    }
    console.warn("chat rate limit fallback", error);
  }

  const payload = await req.json();
  const requestedUserId = typeof payload?.userId === "string" ? payload.userId : undefined;
  let authenticatedUserId: string | undefined;

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    authenticatedUserId = user?.id;
  } catch (error) {
    console.warn("chat auth lookup failed", error);
  }

  if (requestedUserId && requestedUserId !== authenticatedUserId) {
    return jsonResponse({ error: "Unauthorized user context" }, 401);
  }

  const locale = typeof payload?.locale === "string" ? payload.locale : undefined;
  const userId = authenticatedUserId;
  const intent = typeof payload?.intent === "string" ? payload.intent : "nutrition";
  const hint = typeof payload?.hint === "string" ? payload.hint.trim() : "";
  const rawMessages: IncomingMessage[] = Array.isArray(payload?.messages) ? payload.messages : [];




  const sanitizedMessages = rawMessages
    .filter((message): message is Required<IncomingMessage> =>
      Boolean(message?.content && message.content.trim() && message?.role)
    )
    .map((message) => ({
      role: message.role,
      content: message.content.trim(),
    }));

  const lastUserMessage = [...sanitizedMessages].reverse().find((message) => message.role === "user");
  const trimmedMessages = trimMessagesForModel(sanitizedMessages);
  const complexRequest = isComplexChatRequest(lastUserMessage?.content, intent);

  if (sanitizedMessages.length === 0) {
    return jsonResponse({ error: "Missing chat messages" });
  }

  // 1. Memory System: Fetch User Profile & Recent Logs
  // Instead of generic RAG, we inject the specific user context ("Memory")
  const userProfile = await getUserProfile(userId);
  const userLocale = userProfile?.locale || locale || "es";

  const [recentLogs, todaysMealsRaw, dailyStats, pantryItems] = await Promise.all([
    userId ? getRecentQuickLogs(userId) : Promise.resolve([]),
    userId ? getTodayNutritionLogs(userId, userLocale) : Promise.resolve([]),
    userId ? getDailyStats(userId, userLocale) : Promise.resolve(null),
    getPantryItems(),
  ]);

  const feedbackMemory = userId
    ? await (async () => {
        try {
          const supabase = await createClient();
          const { data, error } = await supabase
            .from("chat_feedback_events")
            .select("feedback,reason,created_at")
            .eq("user_id", userId)
            .eq("intent", intent)
            .order("created_at", { ascending: false })
            .limit(25);

          if (error || !data) {
            return "No feedback memory available (query error).";
          }

          return buildFeedbackMemory(data as FeedbackEvent[]);
        } catch (error) {
          console.warn("chat feedback memory load failed", error);
          return "No feedback memory available (runtime error).";
        }
      })()
    : "No feedback memory available for anonymous user.";

  // 2. Construct System Prompt with Memory
  const todaysMeals: MealLog[] = todaysMealsRaw.map((meal) => ({
    id: typeof meal.id === "number" || typeof meal.id === "string" ? meal.id : undefined,
    created_at: meal.created_at,
    name: meal.name,
    calories: meal.calories,
    protein: meal.protein,
    carbs: meal.carbs,
    fats: meal.fats,
    meal_type: meal.meal_type,
  }));

  const ingestionResult = await handleIngestionFlow({
    messages: sanitizedMessages,
    todaysMeals,
    userLocale,
  });

  if (ingestionResult.type === "early-response") {
    return ingestionResult.response;
  }

  if (ingestionResult.newMeal) {
    todaysMeals.push(ingestionResult.newMeal);
  }

  let knowledgeContext = "Knowledge Base: sin consulta reciente.";

  if (lastUserMessage?.content) {
    try {
      const kbLimit = complexRequest ? 6 : 3;
      const snippets = await retrieveKnowledge({
        query: lastUserMessage.content,
        language: userLocale,
        limit: kbLimit,
      });
      knowledgeContext = formatKnowledgeContext(snippets, { maxChars: MAX_KB_CONTEXT_CHARS });
    } catch (error) {
      console.error("KB retrieval failed", error);
      knowledgeContext = "Knowledge Base: no disponible (error).";
    }
  }

  const autoActionNote = ingestionResult.autoActionNote;
  const marketMemory = getMarketContext(userLocale);
  const userAskedPrice = hasPriceIntent(lastUserMessage?.content);
  const marketPriceMatches = lastUserMessage?.content
    ? findMarketPriceMatches(lastUserMessage.content, userLocale)
    : [];

  if (userAskedPrice && marketPriceMatches.length === 0) {
    return respondWithText(buildNoVerifiedPriceMessage());
  }

  const verifiedPriceContext = marketPriceMatches.length > 0
    ? marketPriceMatches
        .map((match) => `- ${match.item}: ${match.range} ARS (${match.category})`)
        .join("\n")
    : "No verified item-level price match for this user query.";

  const pantrySection = pantryItems.length
    ? pantryItems
        .slice(0, MAX_PANTRY_ITEMS_IN_PROMPT)
        .map((item) => {
          const quantity = item.quantity ? `${item.quantity} ${item.unit || ""}`.trim() : "";
          const expiry = item.expiry_date
            ? new Date(item.expiry_date).toLocaleDateString(userLocale)
            : "";
          const detail = [quantity, expiry, item.notes?.trim()].filter(Boolean).join(" · ");
          return `- ${item.item_name}${detail ? ` (${detail})` : ""}`;
        })
        .join("\n")
    : "Sin registros de despensa activos.";

  // Format logs for better LLM readability
  const formattedLogs = recentLogs
    .slice(0, MAX_RECENT_LOGS_IN_PROMPT)
    .map((log: QuickLog) =>
    `- [${new Date(log.created_at).toLocaleDateString(userLocale)}] Energy: ${log.energy}, Hunger: ${log.hunger}/5, Craving: ${log.craving}, Note: "${log.notes}"`
    )
    .join("\n");

  const totals = todaysMeals.reduce((acc: Record<string, number>, meal: MealLog) => ({
    calories: acc.calories + (meal.calories || 0),
    protein: acc.protein + (meal.protein || 0),
    carbs: acc.carbs + (meal.carbs || 0),
    fats: acc.fats + (meal.fats || 0),
  }), { calories: 0, protein: 0, carbs: 0, fats: 0 });

  const mealsForPrompt = todaysMeals.slice(-MAX_RECENT_MEALS_IN_PROMPT);
  const formattedMeals = mealsForPrompt.map((meal: MealLog) => {
    const time = new Date(meal.created_at).toLocaleTimeString(userLocale, { hour: "2-digit", minute: "2-digit" });
    return `- ${time} · ${meal.name || "Registro"} (${meal.calories || 0} kcal | P${meal.protein || 0}g, C${meal.carbs || 0}g, G${meal.fats || 0}g)`;
  }).join("\n");
  const omittedMeals = Math.max(0, todaysMeals.length - mealsForPrompt.length);

  const mealsSection = todaysMeals.length
    ? `${formattedMeals}${omittedMeals > 0 ? `\n(+${omittedMeals} registros más)` : ""}\nTotal de hoy: ${totals.calories} kcal · P${totals.protein}g · C${totals.carbs}g · F${totals.fats}g`
    : "No hay comidas registradas hoy.";

  const profileSummary = buildCompactProfile(userProfile);

  const waterDelta = ingestionResult.waterDelta ?? 0;
  const waterGoal = dailyStats?.goals.water ?? 2000;
  const waterBase = dailyStats?.water ?? 0;
  const adjustedWater = waterBase + waterDelta;
  const glassesApprox = adjustedWater > 0 ? Math.max(1, Math.round(adjustedWater / 250)) : 0;
  const hydrationSection = dailyStats
    ? `Tomaste ${adjustedWater} ml (~${glassesApprox} vasos de 250 ml). Meta diaria: ${waterGoal} ml.`
    : waterDelta > 0
      ? `Registraste ${waterDelta} ml de agua recién. Meta sugerida: ${waterGoal} ml.`
      : "Sin datos de hidratación hoy.";

  const automationContext = autoActionNote
    ? `
    AUTO ACTION:
    ${autoActionNote}
    Confírmale al usuario esta actualización antes de continuar con tu respuesta.
    `
    : "";

  const sharedMemory = `
    USER MEMORY (CONTEXT):
    Profile: ${profileSummary}
    
    RECENT CHECK-INS (Last 3):
    ${formattedLogs || "No recent logs."}

    TODAY'S INTAKE:
    ${mealsSection}

    HYDRATION (today):
    ${hydrationSection}

    PANTRY SNAPSHOT:
    ${pantrySection}
    
    ${marketMemory}
    VERIFIED PRICE MATCHES FOR THIS QUERY:
    ${verifiedPriceContext}

    QUALITY FEEDBACK MEMORY:
    ${feedbackMemory}

    ${knowledgeContext}
    ${automationContext}
  `;

  const privateHint = hint
    ? `
      PRIVATE MOVEMENT NOTE:
      ${hint}
      Use this note purely as context. Never repeat it verbatim or mention that it was supplied privately.
    `
    : "";

  const safetyGuardrails = buildSafetyGuardrails(userProfile);

  const systemPrompt = intent === "movement"
    ? `
      You are Alma Move Coach, a gentle mobility guide for people in larger bodies.
      - Focus on low-impact, joint-friendly routines (slow walks, mobility drills, chair stretches).
      - Prioritize safety: emphasize warm-ups, posture cues, breathing, and pain signals.
      - Celebrate consistency over intensity. Offer pacing tips and rest intervals.
      - Keep answers concise (max 4 sentences or bullet points) and encouraging.
      - Never mention weight loss or calories unless the user brings it up first.
      - If equipment is required, always offer a bodyweight or at-home alternative.
      - Suggest grounding rituals (breath, music, scenery) for mindful walks.
      - Ask at most one clarifying question only when essential for a safe plan.
      - Respond in ${userLocale}.
      ${hint ? `
        If the latest user message equals "${AUTO_MOVEMENT_TRIGGER}", interpret it as an automatic request and lean on the PRIVATE NOTE to personalize the answer.
        ` : ""}
      ${privateHint}
      ${safetyGuardrails}

      ${sharedMemory}
    `
    : `
      You are Alma, a practical and direct AI Nutrition Coach.
      
      YOUR GOAL:
      - Provide immediate, actionable advice for healthy eating.
      - Minimize fluff and small talk. Get straight to the point.
      - Your responses must be short and easy to read on a mobile screen.
      
      ${sharedMemory}
      ${safetyGuardrails}
      
      INSTRUCTIONS:
      - Reply in the user's language (${userLocale}).
      - Use the User Memory to personalize answers (e.g., respect lactose intolerance).
      - CRITICAL: Check the "RECENT CHECK-INS" for any health notes (e.g., "sick", "flu", "stomach pain") or cravings. If the user mentions being sick, prioritize comfort foods suitable for their condition.
      - Use the MARKET MEMORY to give realistic budget advice. NEVER hallucinate prices.
      - HARD PRICE POLICY:
        - If the user did NOT explicitly ask for price/budget, do NOT mention money, currency, ARS, "$", or estimated price ranges.
        - If the user asked for prices, mention ONLY values listed under "VERIFIED PRICE MATCHES FOR THIS QUERY".
        - If there are no verified matches, say you do not have a verified price and continue without inventing numbers.
      - QUALITY ADAPTATION POLICY:
        - Use "QUALITY FEEDBACK MEMORY" to avoid repeating patterns that previously got negative feedback.
        - If top issues include "not_helpful" or "too_generic", be more concrete and action-oriented.
        - If top issues include "false_info" or "invented_data", be conservative and explicit about uncertainty.
      - EVIDENCE CONTRACT:
        - Every recommendation must include a short "por qué" grounded in memory or Knowledge Base context.
        - If evidence is weak or missing, say it explicitly and provide a safer fallback option.
      - Be extremely concise. Use bullet points for options.
      - Avoid long explanations unless explicitly asked.
      - Ask MAX ONE follow-up question, and ONLY if critical to give a recommendation. Otherwise, do not ask anything.
      - If the user asks "what to eat", give 2-3 concrete options immediately based on their profile.
      - Do NOT provide medical diagnoses.
    `;

  const modelCandidates = [];

  if (process.env.GROQ_API_KEY) {
    if (complexRequest) {
      modelCandidates.push({ provider: "groq", model: groq("llama-3.3-70b-versatile"), name: "llama-3.3-70b-versatile" });
      modelCandidates.push({ provider: "groq", model: groq("llama-3.1-8b-instant"), name: "llama-3.1-8b-instant" });
    } else {
      modelCandidates.push({ provider: "groq", model: groq("llama-3.1-8b-instant"), name: "llama-3.1-8b-instant" });
      modelCandidates.push({ provider: "groq", model: groq("llama-3.3-70b-versatile"), name: "llama-3.3-70b-versatile" });
    }
  }

  if (process.env.HUGGINGFACE_API_KEY) {
    const huggingface = createHuggingFace({
      apiKey: process.env.HUGGINGFACE_API_KEY,
    });
    modelCandidates.push({ provider: "huggingface", model: huggingface("meta-llama/Meta-Llama-3-8B-Instruct"), name: "meta-llama/Meta-Llama-3-8B-Instruct" });
  }

  if (modelCandidates.length === 0) {
    return new Response("No available LLM providers (missing API keys)", { status: 500 });
  }

    let lastError;
    const blockedProviders = new Set<string>();
    const failureSummary: Array<{
      provider: string;
      model: string;
      kind: ProviderFailureKind;
      message: string;
    }> = [];

    for (const [attemptIndex, candidate] of modelCandidates.entries()) {
        if (blockedProviders.has(candidate.provider)) {
            continue;
        }

        try {
            const result = await streamText({
                model: candidate.model,
                system: systemPrompt,
                messages: trimmedMessages,
                onFinish: ({ usage, finishReason }) => {
                  const promptTokens = extractUsageCounter(usage, ["promptTokens", "inputTokens"]);
                  const completionTokens = extractUsageCounter(usage, ["completionTokens", "outputTokens"]);
                  const totalTokens = extractUsageCounter(usage, ["totalTokens"]);

                  console.info("[chat/llm] usage", {
                    provider: candidate.provider,
                    model: candidate.name,
                    finish_reason: finishReason,
                    prompt_tokens: promptTokens ?? null,
                    completion_tokens: completionTokens ?? null,
                    total_tokens: totalTokens ?? null,
                  });
                },
            });

            console.info("[chat/llm] success", {
              provider: candidate.provider,
              model: candidate.name,
              attempt: attemptIndex + 1,
              fallback_count: failureSummary.length,
              latency_ms: Date.now() - llmStartedAt,
            });

            return result.toTextStreamResponse();
        } catch (error) {
            const kind = classifyProviderFailure(error);
            const message = readErrorMessage(error);
            console.error(`Error calling ${candidate.provider} with model ${candidate.name}:`, error);
            lastError = error;

            failureSummary.push({
              provider: candidate.provider,
              model: candidate.name,
              kind,
              message,
            });

            if (kind === "auth" || kind === "quota" || kind === "rate_limit") {
              blockedProviders.add(candidate.provider);
            }

            continue;
        }
    }
    
    // If all failed
    console.error("All models failed:", {
      lastError,
      failures: failureSummary,
      latency_ms: Date.now() - llmStartedAt,
    });

    const hasOnlyRateOrQuota =
      failureSummary.length > 0
      && failureSummary.every((failure) => failure.kind === "rate_limit" || failure.kind === "quota");

    if (hasOnlyRateOrQuota) {
      return jsonResponse({ error: "Service busy, please try again." }, 429);
    }

    const hasUpstreamUnavailable = failureSummary.some(
      (failure) => failure.kind === "timeout" || failure.kind === "upstream"
    );

    if (hasUpstreamUnavailable) {
      return jsonResponse({ error: "AI providers temporarily unavailable, please retry shortly." }, 503);
    }

    const hasOnlyAuthFailures =
      failureSummary.length > 0
      && failureSummary.every((failure) => failure.kind === "auth");

    if (hasOnlyAuthFailures) {
      return jsonResponse({ error: "AI provider configuration error." }, 500);
    }

    return jsonResponse({ error: "Service busy, please try again." }, 500);
}
// Force rebuild
