"use server";

import { getSupabaseServiceClient } from "@/lib/supabase/server-client";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { startOfDay } from "date-fns";
import { toZonedTime, fromZonedTime } from "date-fns-tz";

const localeTimezoneMap: Record<string, string> = {
    "es-ar": "America/Argentina/Buenos_Aires",
    "es": "Europe/Madrid",
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

function getStartOfTodayIso(timezone: string) {
    try {
        const now = new Date();
        const zonedNow = toZonedTime(now, timezone);
        const zonedStart = startOfDay(zonedNow);
        const utcStart = fromZonedTime(zonedStart, timezone);
        return utcStart.toISOString();
    } catch (error) {
        console.error("getStartOfTodayIso: fallback to UTC", error);
        const fallback = new Date();
        fallback.setUTCHours(0, 0, 0, 0);
        return fallback.toISOString();
    }
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
    const startTime = getStartOfTodayIso(timezone);
    
    // Get Nutrition
    const { data: nutritionData, error: nutritionError } = await supabase
        .from("nutrition_logs")
        .select("calories, protein, carbs, fats, created_at")
        .eq("user_id", userId)
        .gte("created_at", startTime);

    if (nutritionError) console.error("getDailyStats: Nutrition Error", nutritionError);

    // Get Water
    const { data: waterData, error: waterError } = await supabase
        .from("water_logs")
        .select("amount_ml, created_at")
        .eq("user_id", userId)
        .gte("created_at", startTime);

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
    const since = getStartOfTodayIso(timezone);

    const { data, error } = await supabase
        .from("quick_logs")
        .select("energy,hunger,craving,created_at")
        .eq("user_id", userId)
        .gte("created_at", since)
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
    const since = getStartOfTodayIso(timezone);

    const { data, error } = await supabase
        .from("nutrition_logs")
        .select("id,name,calories,protein,carbs,fats,meal_type,created_at")
        .eq("user_id", userId)
        .gte("created_at", since)
        .order("created_at", { ascending: true });

    if (error) {
        console.error("getTodayNutritionLogs: error", error);
        return [];
    }

    return data || [];
}

export async function analyzeFoodFromText(text: string) {
    if (!process.env.GROQ_API_KEY) {
        console.error("analyzeFoodFromText: Missing GROQ_API_KEY");
        throw new Error("Missing API Key");
    }

    const models = ["llama-3.3-70b-versatile", "llama-3.1-8b-instant"];

    for (const model of models) {
        try {
            const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${process.env.GROQ_API_KEY}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    model: model,
                    messages: [
                        {
                            role: "system",
                            content: `Eres un nutricionista experto. Analiza el texto del usuario y determina si describe comida/bebida con calorías o una toma de agua/hidratación.
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
                            - Usa la mejor estimación posible cuando falte información.`
                        },
                        {
                            role: "user",
                            content: text
                        }
                    ],
                    temperature: 0.3,
                    max_tokens: 500,
                }),
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.warn(`analyzeFoodFromText: Model ${model} failed with ${response.status}: ${errorText}`);
                // If it's the last model, throw to exit
                if (model === models[models.length - 1]) {
                     return null;
                }
                continue; // Try next model
            }

            const data = await response.json();
            const content = data.choices[0].message.content;
            if (!content) continue;

            let jsonContent = content.trim();
            if (jsonContent.startsWith("```")) {
                jsonContent = jsonContent
                    .replace(/```json\n?/g, "")
                    .replace(/```\n?/g, "")
                    .trim();
            }

            try {
                return JSON.parse(jsonContent);
            } catch (parseError) {
                console.error(`analyzeFoodFromText: JSON parse error for ${model}`, parseError);
                continue;
            }

        } catch (error) {
            console.error(`analyzeFoodFromText: Exception with ${model}:`, error);
             if (model === models[models.length - 1]) {
                 return null;
            }
        }
    }
    return null;
}
