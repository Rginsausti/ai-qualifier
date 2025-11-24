"use server";

import { getSupabaseServiceClient } from "@/lib/supabase/server-client";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";

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

    console.log(`logWater: Logging ${amount}ml for user ${user.id}`);

    const { error } = await supabase.from("water_logs").insert({
        user_id: user.id,
        amount_ml: amount,
    });

    if (error) {
        console.error("Error logging water:", error);
        return { success: false, error: error.message };
    }

    console.log("logWater: Success");
    return { success: true };
}

export async function getDailyStats(userId: string) {
    const supabase = await createClient();

    // Debug: Log the time we are querying for
    const now = new Date();
    // Rolling 24h window to ensure we see data if timezone logic is tricky
    // This is a temporary fix to verify data persistence.
    // Ideally we want "Start of Local Day", but we don't know user's offset easily here.
    // We'll query for the last 24 hours.
    const startTime = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();

    console.log(`getDailyStats: Querying for user ${userId} since ${startTime}`);

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

    console.log(`getDailyStats: Found ${waterData?.length || 0} water logs`);

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

export async function analyzeFoodFromText(text: string) {
    if (!process.env.GROQ_API_KEY) {
        console.error("analyzeFoodFromText: Missing GROQ_API_KEY");
        throw new Error("Missing API Key");
    }

    console.log("analyzeFoodFromText: Sending to Groq:", text);

    try {
        const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${process.env.GROQ_API_KEY}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                model: "llama-3.3-70b-versatile", // Updated to active model
                messages: [
                    {
                        role: "system",
                        content: `Eres un nutricionista experto. Analiza el texto del usuario y extrae información nutricional.
                        Responde SOLO con JSON válido, sin markdown ni explicaciones.
                        Formato:
                        {
                            "name": "nombre del alimento",
                            "calories": número_de_calorías,
                            "protein": gramos_de_proteína,
                            "carbs": gramos_de_carbohidratos,
                            "fats": gramos_de_grasas
                        }
                        
                        Ejemplos:
                        - "3 huevos duros" = {"name": "3 huevos duros", "calories": 234, "protein": 19, "carbs": 2, "fats": 16}
                        - "taza de café" = {"name": "café negro", "calories": 2, "protein": 0, "carbs": 0, "fats": 0}
                        
                        Si no puedes determinar la información, usa estimaciones razonables.`
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
            console.error("analyzeFoodFromText: Groq API Error:", response.status, errorText);
            return null;
        }

        const data = await response.json();
        console.log("analyzeFoodFromText: Full response:", JSON.stringify(data, null, 2));

        const content = data.choices[0].message.content;
        console.log("analyzeFoodFromText: Content:", content);

        // Try to parse JSON, handling markdown code blocks
        let jsonContent = content.trim();

        // Remove markdown code blocks if present
        if (jsonContent.startsWith("```")) {
            jsonContent = jsonContent.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
        }

        const parsed = JSON.parse(jsonContent);
        console.log("analyzeFoodFromText: Parsed successfully:", parsed);

        return parsed;
    } catch (error) {
        console.error("analyzeFoodFromText: Exception:", error);
        if (error instanceof Error) {
            console.error("analyzeFoodFromText: Error message:", error.message);
            console.error("analyzeFoodFromText: Error stack:", error.stack);
        }
        return null;
    }
}
