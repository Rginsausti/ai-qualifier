"use server";

import { getSupabaseServiceClient } from "@/lib/supabase/server-client";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { addDays, startOfDay } from "date-fns";
import { toZonedTime, fromZonedTime } from "date-fns-tz";
import { createGroq } from '@ai-sdk/groq';
import { createHuggingFace } from '@ai-sdk/huggingface';
import { generateText } from 'ai';

const localeTimezoneMap: Record<string, string> = {
    "es-ar": "America/Argentina/Buenos_Aires",
    "es": "America/Argentina/Buenos_Aires",
    "pt-br": "America/Sao_Paulo",
    "pt": "America/Sao_Paulo",
    "en-us": "America/New_York",
    "en": "America/Los_Angeles",
    "fr-fr": "Europe/Paris",
    "fr": "Europe/Paris",
    "it-it": "Europe/Rome",
    "it": "Europe/Rome",
    "de-de": "Europe/Berlin",
    "de": "Europe/Berlin",
    "ja-jp": "Asia/Tokyo",
    "ja": "Asia/Tokyo"
};

function resolveTimezone(locale?: string) {
    if (!locale) return "UTC";
    const normalized = locale.toLowerCase();
    const base = normalized.split("-")[0];
    return localeTimezoneMap[normalized] || localeTimezoneMap[base] || "UTC";
}

function getTodayRangeIso(timezone: string) {
    try {
        const now = new Date();
        const zonedNow = toZonedTime(now, timezone);
        const zonedStart = startOfDay(zonedNow);
        const zonedEnd = addDays(zonedStart, 1);
        const utcStart = fromZonedTime(zonedStart, timezone);
        const utcEnd = fromZonedTime(zonedEnd, timezone);
        return {
            startIso: utcStart.toISOString(),
            endIso: utcEnd.toISOString(),
        };
    } catch (error) {
        console.error("getTodayRangeIso: fallback to UTC", error);
        const start = new Date();
        start.setUTCHours(0, 0, 0, 0);
        const end = new Date(start);
        end.setUTCDate(end.getUTCDate() + 1);
        return {
            startIso: start.toISOString(),
            endIso: end.toISOString(),
        };
    }
}

function getRangeIsoForDays(timezone: string, days: number, offsetDays = 0) {
    try {
        const now = new Date();
        const zonedNow = toZonedTime(now, timezone);
        const zonedStartToday = startOfDay(zonedNow);
        const periodEnd = addDays(zonedStartToday, 1 - offsetDays);
        const periodStart = addDays(periodEnd, -days);
        const utcStart = fromZonedTime(periodStart, timezone);
        const utcEnd = fromZonedTime(periodEnd, timezone);
        return {
            startIso: utcStart.toISOString(),
            endIso: utcEnd.toISOString(),
        };
    } catch (error) {
        console.error("getRangeIsoForDays: fallback to UTC", error);
        const end = new Date();
        end.setUTCHours(0, 0, 0, 0);
        end.setUTCDate(end.getUTCDate() + 1 - offsetDays);
        const start = new Date(end);
        start.setUTCDate(start.getUTCDate() - days);
        return {
            startIso: start.toISOString(),
            endIso: end.toISOString(),
        };
    }
}

type PeriodProgressSummary = {
    periodDays: number;
    adherenceDays: number;
    nutritionGoalDays: number;
    hydrationGoalDays: number;
    avgCalories: number;
    avgWater: number;
    completionRate: number;
};

type ProgressInsight = {
    current: PeriodProgressSummary;
    previous: PeriodProgressSummary;
    trend: {
        adherenceDelta: number;
        caloriesDelta: number;
        hydrationDelta: number;
    };
};

type ProgressInsights = {
    week: ProgressInsight;
    month: ProgressInsight;
    halfyear: ProgressInsight;
};

type DayAggregate = {
    calories: number;
    water: number;
    adherence: boolean;
};

const roundMetric = (value: number) => Math.round(value * 10) / 10;

const aggregatePeriodProgress = (params: {
    timezone: string;
    periodDays: number;
    quickLogs: Array<{ created_at: string }>;
    nutritionLogs: Array<{ created_at: string; calories: number | null }>;
    waterLogs: Array<{ created_at: string; amount_ml: number | null }>;
    calorieGoal: number;
    waterGoal: number;
}): PeriodProgressSummary => {
    const {
        timezone,
        periodDays,
        quickLogs,
        nutritionLogs,
        waterLogs,
        calorieGoal,
        waterGoal,
    } = params;

    const dayMap = new Map<string, DayAggregate>();

    const ensureDay = (isoDate: string) => {
        if (!dayMap.has(isoDate)) {
            dayMap.set(isoDate, { calories: 0, water: 0, adherence: false });
        }
        return dayMap.get(isoDate)!;
    };

    const formatter = new Intl.DateTimeFormat("en-CA", {
        timeZone: timezone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    });

    const toLocalDate = (value: string) => {
        const parts = formatter.formatToParts(new Date(value));
        const year = parts.find((part) => part.type === "year")?.value;
        const month = parts.find((part) => part.type === "month")?.value;
        const day = parts.find((part) => part.type === "day")?.value;
        if (!year || !month || !day) return "";
        return `${year}-${month}-${day}`;
    };

    quickLogs.forEach((log) => {
        const key = toLocalDate(log.created_at);
        const day = ensureDay(key);
        day.adherence = true;
    });

    nutritionLogs.forEach((log) => {
        const key = toLocalDate(log.created_at);
        const day = ensureDay(key);
        day.calories += Number(log.calories || 0);
    });

    waterLogs.forEach((log) => {
        const key = toLocalDate(log.created_at);
        const day = ensureDay(key);
        day.water += Number(log.amount_ml || 0);
    });

    const allDays = Array.from(dayMap.values());
    const adherenceDays = allDays.filter((day) => day.adherence).length;
    const hydrationGoalDays = allDays.filter((day) => day.water >= waterGoal).length;
    const nutritionGoalDays = allDays.filter((day) => {
        if (day.calories <= 0) return false;
        return day.calories >= calorieGoal * 0.85 && day.calories <= calorieGoal * 1.15;
    }).length;

    const caloriesTotal = allDays.reduce((acc, day) => acc + day.calories, 0);
    const waterTotal = allDays.reduce((acc, day) => acc + day.water, 0);

    return {
        periodDays,
        adherenceDays,
        nutritionGoalDays,
        hydrationGoalDays,
        avgCalories: roundMetric(caloriesTotal / periodDays),
        avgWater: roundMetric(waterTotal / periodDays),
        completionRate: roundMetric((adherenceDays / periodDays) * 100),
    };
};

async function buildProgressInsight(params: {
    userId: string;
    timezone: string;
    calorieGoal: number;
    waterGoal: number;
    periodDays: number;
}): Promise<ProgressInsight> {
    const { userId, timezone, calorieGoal, waterGoal, periodDays } = params;
    const supabase = getSupabaseServiceClient();
    const currentRange = getRangeIsoForDays(timezone, periodDays, 0);
    const previousRange = getRangeIsoForDays(timezone, periodDays, periodDays);

    const [quickLogsCurrent, quickLogsPrevious, nutritionCurrent, nutritionPrevious, waterCurrent, waterPrevious] = await Promise.all([
        supabase
            .from("quick_logs")
            .select("created_at")
            .eq("user_id", userId)
            .gte("created_at", currentRange.startIso)
            .lt("created_at", currentRange.endIso),
        supabase
            .from("quick_logs")
            .select("created_at")
            .eq("user_id", userId)
            .gte("created_at", previousRange.startIso)
            .lt("created_at", previousRange.endIso),
        supabase
            .from("nutrition_logs")
            .select("created_at, calories")
            .eq("user_id", userId)
            .gte("created_at", currentRange.startIso)
            .lt("created_at", currentRange.endIso),
        supabase
            .from("nutrition_logs")
            .select("created_at, calories")
            .eq("user_id", userId)
            .gte("created_at", previousRange.startIso)
            .lt("created_at", previousRange.endIso),
        supabase
            .from("water_logs")
            .select("created_at, amount_ml")
            .eq("user_id", userId)
            .gte("created_at", currentRange.startIso)
            .lt("created_at", currentRange.endIso),
        supabase
            .from("water_logs")
            .select("created_at, amount_ml")
            .eq("user_id", userId)
            .gte("created_at", previousRange.startIso)
            .lt("created_at", previousRange.endIso),
    ]);

    const current = aggregatePeriodProgress({
        timezone,
        periodDays,
        quickLogs: quickLogsCurrent.data || [],
        nutritionLogs: nutritionCurrent.data || [],
        waterLogs: waterCurrent.data || [],
        calorieGoal,
        waterGoal,
    });

    const previous = aggregatePeriodProgress({
        timezone,
        periodDays,
        quickLogs: quickLogsPrevious.data || [],
        nutritionLogs: nutritionPrevious.data || [],
        waterLogs: waterPrevious.data || [],
        calorieGoal,
        waterGoal,
    });

    return {
        current,
        previous,
        trend: {
            adherenceDelta: current.adherenceDays - previous.adherenceDays,
            caloriesDelta: roundMetric(current.avgCalories - previous.avgCalories),
            hydrationDelta: current.hydrationGoalDays - previous.hydrationGoalDays,
        },
    };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function saveOnboardingData(data: any, userId?: string) {
    const supabase = getSupabaseServiceClient();

    try {
        // 1. Save to Cookie (for immediate "Memory" access without login)
        const cookieStore = await cookies();
        cookieStore.set("user_profile_temp", JSON.stringify(data), { path: "/", maxAge: 60 * 60 * 24 * 30 }); // 30 days

        // 2. Save to Supabase if userId is provided
        if (userId) {
            const { error } = await supabase
                .from("user_profiles")
                .upsert({
                    user_id: userId,
                    goals: Array.from(data.goals || []),
                    weight: data.weight,
                    height: data.height,
                    unit_system: data.unitSystem,
                    allergens: Array.from(data.allergens || []),
                    intolerances: Array.from(data.intolerances || []),
                    lifestyle: data.lifestyle,
                    therapeutic: Array.from(data.therapeutic || []),
                    cultural: Array.from(data.cultural || []),
                    other_restrictions: data.otherRestrictions,
                    calculated_calories: data.calculatedCalories,
                    updated_at: new Date().toISOString(),
                }, { onConflict: "user_id" });

            if (error) {
                console.error("Supabase DB save error:", error);
                // Don't fail the whole request, cookie is enough for now
            }
        }

        return { success: true };
    } catch (error) {
        console.error("Failed to save onboarding data:", error);
        return { success: false, error: "Failed to save data" };
    }
}

export async function getUserProfile(userId?: string) {
    const cookieStore = await cookies();
    const profileCookie = cookieStore.get("user_profile_temp");
    
    // 1. Try Cookie First (Fastest)
    if (profileCookie) {
        try {
            return JSON.parse(profileCookie.value);
        } catch {
            // ignore error
        }
    }

    // 2. Try DB if userId provided and cookie missing
    if (userId) {
        const supabase = getSupabaseServiceClient();
        const { data, error } = await supabase
            .from("user_profiles")
            .select("*")
            .eq("user_id", userId)
            .single();
            
        if (!error && data) {
            return data;
        }
    }

    return null;
}

export async function saveQuickLog(data: {
    energy: string | null;
    hunger: number;
    craving: string | null;
    notes: string;
}) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return { success: false, error: "Unauthorized" };
    }

    const { error } = await supabase.from("quick_logs").insert({
        user_id: user.id,
        energy: data.energy,
        hunger: data.hunger,
        craving: data.craving,
        notes: data.notes,
    });

    if (error) {
        console.error("Error saving quick log:", error);
        return { success: false, error: error.message };
    }

    return { success: true };
}

export async function getRecentQuickLogs(userId: string, limit = 3) {
    const supabase = getSupabaseServiceClient();
    
    const { data } = await supabase
        .from("quick_logs")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(limit);
        
    return data || [];
}

export async function calculateStreak(userId: string) {
    const supabase = getSupabaseServiceClient();
    
    // Fetch dates of all logs
    const { data } = await supabase
        .from("quick_logs")
        .select("created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

    if (!data || data.length === 0) return 0;

    const uniqueDates = Array.from(new Set(data.map(log => 
        new Date(log.created_at).toISOString().split('T')[0]
    )));

    let streak = 0;
    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

    // Check if streak is active (logged today or yesterday)
    if (!uniqueDates.includes(today) && !uniqueDates.includes(yesterday)) {
        return 0;
    }

    const currentDate = new Date();
    // If not logged today, start checking from yesterday
    if (!uniqueDates.includes(today)) {
        currentDate.setDate(currentDate.getDate() - 1);
    }

    while (true) {
        const dateStr = currentDate.toISOString().split('T')[0];
        if (uniqueDates.includes(dateStr)) {
            streak++;
            currentDate.setDate(currentDate.getDate() - 1);
        } else {
            break;
        }
    }

    return streak;
}

export async function logNutrition(data: {
    name: string;
    calories: number;
    protein?: number;
    carbs?: number;
    fats?: number;
    mealType?: string;
}) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return { success: false, error: "Unauthorized" };
    }

    const { error } = await supabase.from("nutrition_logs").insert({
        user_id: user.id,
        name: data.name,
        calories: data.calories,
        protein: data.protein || 0,
        carbs: data.carbs || 0,
        fats: data.fats || 0,
        meal_type: data.mealType || 'snack',
    });

    if (error) {
        console.error("Error logging nutrition:", error);
        return { success: false, error: error.message };
    }

    return { success: true };
}

export async function logWater(amount: number) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        console.error("logWater: Unauthorized");
        return { success: false, error: "Unauthorized" };
    }

    const { error } = await supabase.from("water_logs").insert({
        user_id: user.id,
        amount_ml: amount,
    });

    if (error) {
        console.error("Error logging water:", error);
        return { success: false, error: error.message };
    }

    return { success: true };
}

export async function getDailyStats(userId: string, locale?: string) {
    const supabase = getSupabaseServiceClient();
    const timezone = resolveTimezone(locale);
    const { startIso, endIso } = getTodayRangeIso(timezone);
    
    // Get Nutrition
    const { data: nutritionData, error: nutritionError } = await supabase
        .from("nutrition_logs")
        .select("calories, protein, carbs, fats, created_at")
        .eq("user_id", userId)
        .gte("created_at", startIso)
        .lt("created_at", endIso);

    if (nutritionError) console.error("getDailyStats: Nutrition Error", nutritionError);

    // Get Water
    const { data: waterData, error: waterError } = await supabase
        .from("water_logs")
        .select("amount_ml, created_at")
        .eq("user_id", userId)
        .gte("created_at", startIso)
        .lt("created_at", endIso);

    if (waterError) console.error("getDailyStats: Water Error", waterError);
    
    // Get Goals
    const { data: profile } = await supabase
        .from("user_profiles")
        .select("calculated_calories, protein_goal, carbs_goal, fats_goal, water_goal_ml")
        .eq("user_id", userId)
        .single();

    const nutrition = (nutritionData || []).reduce((acc, curr) => ({
        calories: acc.calories + curr.calories,
        protein: acc.protein + curr.protein,
        carbs: acc.carbs + curr.carbs,
        fats: acc.fats + curr.fats,
    }), { calories: 0, protein: 0, carbs: 0, fats: 0 });

    const water = (waterData || []).reduce((acc, curr) => acc + curr.amount_ml, 0);

    return {
        nutrition,
        water,
        goals: {
            calories: profile?.calculated_calories || 2000,
            protein: profile?.protein_goal || 110,
            carbs: profile?.carbs_goal || 220,
            fats: profile?.fats_goal || 65,
            water: profile?.water_goal_ml || 2000,
        }
    };
}

export async function getTodayQuickLog(userId: string, locale?: string) {
    const supabase = getSupabaseServiceClient();
    const timezone = resolveTimezone(locale);
    const { startIso, endIso } = getTodayRangeIso(timezone);

    const { data, error } = await supabase
        .from("quick_logs")
        .select("energy,hunger,craving,created_at")
        .eq("user_id", userId)
        .gte("created_at", startIso)
        .lt("created_at", endIso)
        .order("created_at", { ascending: false })
        .limit(1);

    if (error) {
        console.error("getTodayQuickLog: error", error);
        return null;
    }

    return data && data.length > 0 ? data[0] : null;
}

export async function getTodayNutritionLogs(userId: string, locale?: string) {
    const supabase = getSupabaseServiceClient();
    const timezone = resolveTimezone(locale);
    const { startIso, endIso } = getTodayRangeIso(timezone);

    const { data, error } = await supabase
        .from("nutrition_logs")
        .select("id,name,calories,protein,carbs,fats,meal_type,created_at")
        .eq("user_id", userId)
        .gte("created_at", startIso)
        .lt("created_at", endIso)
        .order("created_at", { ascending: true });

    if (error) {
        console.error("getTodayNutritionLogs: error", error);
        return [];
    }

    return data || [];
}

export async function getProgressInsights(userId: string, locale?: string): Promise<ProgressInsights> {
    const supabase = getSupabaseServiceClient();
    const timezone = resolveTimezone(locale);
    const { data: profile } = await supabase
        .from("user_profiles")
        .select("calculated_calories, water_goal_ml")
        .eq("user_id", userId)
        .single();

    const calorieGoal = profile?.calculated_calories || 2000;
    const waterGoal = profile?.water_goal_ml || 2000;

    const [week, month, halfyear] = await Promise.all([
        buildProgressInsight({ userId, timezone, calorieGoal, waterGoal, periodDays: 7 }),
        buildProgressInsight({ userId, timezone, calorieGoal, waterGoal, periodDays: 30 }),
        buildProgressInsight({ userId, timezone, calorieGoal, waterGoal, periodDays: 180 }),
    ]);

    return { week, month, halfyear };
}

async function resolveUserLocale(userId: string, locale?: string) {
    const supabase = getSupabaseServiceClient();
    const { data } = await supabase
        .from("user_profiles")
        .select("locale")
        .eq("user_id", userId)
        .single();

    return (typeof data?.locale === "string" && data.locale.trim())
        ? data.locale
        : locale;
}

export async function resetTodayIntake(locale?: string) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return { success: false, error: "Unauthorized" };
    }

    const effectiveLocale = await resolveUserLocale(user.id, locale);
    const timezone = resolveTimezone(effectiveLocale);
    const { startIso, endIso } = getTodayRangeIso(timezone);

    const { data: deletedMeals, error: mealDeleteError } = await supabase
        .from("nutrition_logs")
        .delete()
        .eq("user_id", user.id)
        .gte("created_at", startIso)
        .lt("created_at", endIso)
        .select("id");

    if (mealDeleteError) {
        return { success: false, error: mealDeleteError.message };
    }

    const { data: deletedWaterLogs, error: waterDeleteError } = await supabase
        .from("water_logs")
        .delete()
        .eq("user_id", user.id)
        .gte("created_at", startIso)
        .lt("created_at", endIso)
        .select("id");

    if (waterDeleteError) {
        return { success: false, error: waterDeleteError.message };
    }

    return {
        success: true,
        deletedMeals: deletedMeals?.length || 0,
        deletedWaterLogs: deletedWaterLogs?.length || 0,
    };
}

export async function deleteLatestTodayNutritionLog(locale?: string) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return { success: false, error: "Unauthorized" };
    }

    const effectiveLocale = await resolveUserLocale(user.id, locale);
    const timezone = resolveTimezone(effectiveLocale);
    const { startIso, endIso } = getTodayRangeIso(timezone);

    const { data: latestLog, error: selectError } = await supabase
        .from("nutrition_logs")
        .select("id,name,created_at")
        .eq("user_id", user.id)
        .gte("created_at", startIso)
        .lt("created_at", endIso)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

    if (selectError) {
        return { success: false, error: selectError.message };
    }

    if (!latestLog) {
        return { success: true, deleted: false };
    }

    const { data: deletedRows, error: deleteError } = await supabase
        .from("nutrition_logs")
        .delete()
        .eq("id", latestLog.id)
        .eq("user_id", user.id)
        .select("id")
        .limit(1);

    if (deleteError) {
        return { success: false, error: deleteError.message };
    }

    if (!deletedRows || deletedRows.length === 0) {
        return { success: false, error: "No se pudo confirmar el borrado del registro." };
    }

    return {
        success: true,
        deleted: true,
        deletedName: latestLog.name,
        deletedAt: latestLog.created_at,
    };
}

export async function analyzeFoodFromText(text: string) {
    const candidates = [];
    
    console.log("analyzeFoodFromText: Checking keys...");
    console.log("GROQ_API_KEY present:", !!process.env.GROQ_API_KEY);
    console.log("HUGGINGFACE_API_KEY present:", !!process.env.HUGGINGFACE_API_KEY);

    if (process.env.GROQ_API_KEY) {
        const groq = createGroq({ apiKey: process.env.GROQ_API_KEY });
        candidates.push({ model: groq('llama-3.3-70b-versatile'), name: 'groq-70b' });
        candidates.push({ model: groq('llama-3.1-8b-instant'), name: 'groq-8b' });
    }
    
    if (process.env.HUGGINGFACE_API_KEY) {
        const huggingface = createHuggingFace({ apiKey: process.env.HUGGINGFACE_API_KEY });
        candidates.push({ model: huggingface('meta-llama/Meta-Llama-3-8B-Instruct'), name: 'hf-llama-3-8b' });
    }

    console.log(`analyzeFoodFromText: Candidates found: ${candidates.length}`);

    if (candidates.length === 0) {
        console.error("analyzeFoodFromText: No available LLM providers (missing API keys)");
        throw new Error("No available LLM providers");
    }

    const systemPrompt = `Eres un nutricionista experto. Analiza el texto del usuario y determina si describe comida/bebida con calorías o una toma de agua/hidratación.
    Responde SOLO con JSON válido, sin markdown ni explicaciones.
    Formato:
    {
        "type": "food" | "water",
        "intent": "log" | "consult",
        "name": "nombre del alimento o bebida",
        "calories": numero_de_calorias,
        "protein": gramos_de_proteina,
        "carbs": gramos_de_carbohidratos,
        "fats": gramos_de_grasas,
        "water_ml": mililitros_de_agua
    }
    Reglas:
    - "intent": "log" si el usuario dice que COMIÓ, BEBIÓ o está registrando algo (ej: "comí una manzana", "registra 2 vasos de agua").
    - "intent": "consult" si el usuario PREGUNTA qué cocinar, pide recetas, o menciona ingredientes sin indicar consumo (ej: "tengo manzanas, qué hago?", "receta de tarta", "que puedo cocinar con carne?").
    - Si el texto se refiere a agua (vasos, botellas, litros, etc.), establece type="water", fija macros y calorías en 0 e infiere water_ml (1 vaso estándar = 250 ml, 1 botella pequeña = 500 ml, 1 litro = 1000 ml).
    - Si describe comida o bebidas con calorías, establece type="food" y calcula macros/calorías (water_ml = 0).
    - Si mezcla ambos, prioriza el elemento principal del mensaje.
    - Usa la mejor estimación posible cuando falte información.`;

    for (const candidate of candidates) {
        try {
            const { text: resultText } = await generateText({
                model: candidate.model,
                system: systemPrompt,
                messages: [{ role: 'user', content: text }],
                temperature: 0.3,
            });

            if (!resultText) continue;

            let jsonContent = resultText.trim();
            if (jsonContent.startsWith("```")) {
                jsonContent = jsonContent
                    .replace(/```json\n?/g, "")
                    .replace(/```\n?/g, "")
                    .trim();
            }

            try {
                return JSON.parse(jsonContent);
            } catch (parseError) {
                console.error(`analyzeFoodFromText: JSON parse error for ${candidate.name}`, parseError);
                continue;
            }

        } catch (error) {
            console.warn(`analyzeFoodFromText: ${candidate.name} failed`, error);
            continue;
        }
    }
    return null;
}
