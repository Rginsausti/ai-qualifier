"use server";

import { getSupabaseServiceClient } from "@/lib/supabase/server-client";
import { cookies } from "next/headers";

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
