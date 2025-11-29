import { groq } from "@ai-sdk/groq";
import { streamText } from "ai";
import {
  getUserProfile,
  getRecentQuickLogs,
  getTodayNutritionLogs,
  getDailyStats,
  logNutrition,
  logWater,
  analyzeFoodFromText,
} from "@/lib/actions";
import { getPantryItems } from "@/lib/user-activities";
import { getMarketContext } from "@/lib/market-prices";
import { randomUUID } from "crypto";

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

// Allow streaming responses up to 30 seconds
export const maxDuration = 30;

type IncomingMessage = {
  role?: "user" | "assistant";
  content?: string;
};

const jsonResponse = (body: Record<string, unknown>, status = 400) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

export async function POST(req: Request) {
  const payload = await req.json();
  const locale = typeof payload?.locale === "string" ? payload.locale : undefined;
  const userId = typeof payload?.userId === "string" ? payload.userId : undefined;
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

  if (sanitizedMessages.length === 0) {
    return jsonResponse({ error: "Missing chat messages" });
  }

  // 1. Memory System: Fetch User Profile & Recent Logs
  // Instead of generic RAG, we inject the specific user context ("Memory")
  const [userProfile, recentLogs, todaysMealsRaw, dailyStats, pantryItems] = await Promise.all([
    getUserProfile(userId),
    getRecentQuickLogs(userId),
    getTodayNutritionLogs(userId, locale),
    userId ? getDailyStats(userId, locale) : Promise.resolve(null),
    getPantryItems(),
  ]);

  // 2. Construct System Prompt with Memory
  const userLocale = userProfile?.locale || locale || 'es';
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

  const autoActionNote = ingestionResult.autoActionNote;
  const marketMemory = getMarketContext(userLocale);
  const pantrySection = pantryItems.length
    ? pantryItems
        .slice(0, 15)
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
  const formattedLogs = recentLogs.map((log: QuickLog) => 
    `- [${new Date(log.created_at).toLocaleDateString(userLocale)}] Energy: ${log.energy}, Hunger: ${log.hunger}/5, Craving: ${log.craving}, Note: "${log.notes}"`
  ).join("\n");

  const totals = todaysMeals.reduce((acc: Record<string, number>, meal: MealLog) => ({
    calories: acc.calories + (meal.calories || 0),
    protein: acc.protein + (meal.protein || 0),
    carbs: acc.carbs + (meal.carbs || 0),
    fats: acc.fats + (meal.fats || 0),
  }), { calories: 0, protein: 0, carbs: 0, fats: 0 });

  const formattedMeals = todaysMeals.map((meal: MealLog) => {
    const time = new Date(meal.created_at).toLocaleTimeString(userLocale, { hour: "2-digit", minute: "2-digit" });
    return `- ${time} · ${meal.name || "Registro"} (${meal.calories || 0} kcal | P${meal.protein || 0}g, C${meal.carbs || 0}g, G${meal.fats || 0}g)`;
  }).join("\n");

  const mealsSection = todaysMeals.length
    ? `${formattedMeals}\nTotal last 24h: ${totals.calories} kcal · P${totals.protein}g · C${totals.carbs}g · F${totals.fats}g`
    : "No meals logged in the last 24 hours.";

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
    Profile: ${userProfile ? JSON.stringify(userProfile, null, 2) : "No specific profile found."}
    
    RECENT CHECK-INS (Last 3):
    ${formattedLogs || "No recent logs."}

    TODAY'S INTAKE (last 24h):
    ${mealsSection}

    HYDRATION (last 24h):
    ${hydrationSection}

    PANTRY SNAPSHOT:
    ${pantrySection}
    
    ${marketMemory}
    ${automationContext}
  `;

  const privateHint = hint
    ? `
      PRIVATE MOVEMENT NOTE:
      ${hint}
      Use this note purely as context. Never repeat it verbatim or mention that it was supplied privately.
    `
    : "";

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

      ${sharedMemory}
    `
    : `
      You are Alma, a practical and direct AI Nutrition Coach.
      
      YOUR GOAL:
      - Provide immediate, actionable advice for healthy eating.
      - Minimize fluff and small talk. Get straight to the point.
      - Your responses must be short and easy to read on a mobile screen.
      
      ${sharedMemory}
      
      INSTRUCTIONS:
      - Reply in the user's language (${userLocale}).
      - Use the User Memory to personalize answers (e.g., respect lactose intolerance).
      - CRITICAL: Check the "RECENT CHECK-INS" for any health notes (e.g., "sick", "flu", "stomach pain") or cravings. If the user mentions being sick, prioritize comfort foods suitable for their condition.
      - Use the MARKET MEMORY to give realistic budget advice. NEVER hallucinate prices.
      - Be extremely concise. Use bullet points for options.
      - Avoid long explanations unless explicitly asked.
      - Ask MAX ONE follow-up question, and ONLY if critical to give a recommendation. Otherwise, do not ask anything.
      - If the user asks "what to eat", give 2-3 concrete options immediately based on their profile.
      - Do NOT provide medical diagnoses.
    `;

  // 3. Call Groq (Llama 3)
  if (!process.env.GROQ_API_KEY) {
    return new Response("Missing GROQ_API_KEY", { status: 500 });
  }

  try {
    const result = await streamText({
      model: groq("llama-3.3-70b-versatile"),
      system: systemPrompt,
      messages: sanitizedMessages,
    });

    return result.toTextStreamResponse();
  } catch (error) {
    console.error("Error calling Groq:", error);
    return jsonResponse({ error: "Error processing request" }, 500);
  }
}
