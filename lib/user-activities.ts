"use server";

import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Represents a daily ritual/habit completion
 */
export type DailyRitual = {
    id?: string;
    user_id?: string;
    ritual_type: 'morning' | 'lunch' | 'snack' | 'dinner' | 'bedtime';
    completed_at?: string;
    notes?: string;
    created_at?: string;
};

/**
 * Represents a pantry inventory item
 */
export type PantryItem = {
    id?: string;
    user_id?: string;
    item_name: string;
    category?: 'protein' | 'carbs' | 'vegetables' | 'fruits' | 'snacks' | 'beverages';
    quantity?: number;
    unit?: 'kg' | 'g' | 'L' | 'ml' | 'units';
    expiry_date?: string;
    notes?: string;
    created_at?: string;
    updated_at?: string;
};

/**
 * Represents a mindful moment/mood check-in
 */
export type MindfulMoment = {
    id?: string;
    user_id?: string;
    moment_type: 'energy' | 'hunger' | 'mood' | 'stress';
    value: string;
    notes?: string;
    location_lat?: number;
    location_lng?: number;
    created_at?: string;
};

/**
 * Represents a physical activity session
 */
export type PhysicalActivity = {
    id?: string;
    user_id?: string;
    activity_type: 'walk' | 'run' | 'yoga' | 'gym' | 'other';
    duration_minutes?: number;
    distance_km?: number;
    notes?: string;
    created_at?: string;
};

// ============================================================================
// Daily Rituals Actions
// ============================================================================

export async function logRitual(
    ritualType: DailyRitual['ritual_type'],
    notes?: string
): Promise<{ success: boolean; error?: string }> {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return { success: false, error: 'User not authenticated' };
        }

        const { error } = await supabase
            .from('daily_rituals')
            .insert({
                user_id: user.id,
                ritual_type: ritualType,
                notes: notes || null,
            });

        if (error) {
            console.error('Error logging ritual:', error);
            return { success: false, error: error.message };
        }

        return { success: true };
    } catch (error) {
        console.error('Failed to log ritual:', error);
        return { success: false, error: 'Failed to log ritual' };
    }
}

export async function getTodayRituals(): Promise<DailyRitual[]> {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) return [];

        const cookieStore = await cookies();
        const timezone = cookieStore.get("user_timezone")?.value || "UTC";

        const now = new Date();
        const { toZonedTime } = require('date-fns-tz');

        const zonedNow = toZonedTime(now, timezone);
        const startOfDay = new Date(zonedNow);
        startOfDay.setHours(0, 0, 0, 0);

        const { data, error } = await supabase
            .from('daily_rituals')
            .select('*')
            .eq('user_id', user.id)
            .gte('completed_at', startOfDay.toISOString())
            .order('completed_at', { ascending: false });

        if (error) {
            console.error('Error fetching rituals:', error);
            return [];
        }

        return data || [];
    } catch (error) {
        console.error('Failed to get today rituals:', error);
        return [];
    }
}

// Pantry Management
export async function addPantryItem(
    item: Omit<PantryItem, 'id' | 'user_id' | 'created_at' | 'updated_at'>
): Promise<{ success: boolean; id?: string; error?: string }> {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) return { success: false, error: 'User not authenticated' };

        const { data, error } = await supabase
            .from('pantry_items')
            .insert({ user_id: user.id, ...item })
            .select('id')
            .single();

        if (error) {
            console.error('Error adding pantry item:', error);
            return { success: false, error: error.message };
        }

        return { success: true, id: data.id };
    } catch (error) {
        console.error('Failed to add pantry item:', error);
        return { success: false, error: 'Failed to add item' };
    }
}

export async function updatePantryItem(
    id: string,
    updates: Partial<Omit<PantryItem, 'id' | 'user_id' | 'created_at'>>
): Promise<{ success: boolean; error?: string }> {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) return { success: false, error: 'User not authenticated' };

        const { error } = await supabase
            .from('pantry_items')
            .update({ ...updates, updated_at: new Date().toISOString() })
            .eq('id', id)
            .eq('user_id', user.id);

        if (error) {
            console.error('Error updating pantry item:', error);
            return { success: false, error: error.message };
        }

        return { success: true };
    } catch (error) {
        console.error('Failed to update pantry item:', error);
        return { success: false, error: 'Failed to update item' };
    }
}

export async function deletePantryItem(id: string): Promise<{ success: boolean; error?: string }> {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) return { success: false, error: 'User not authenticated' };

        const { error } = await supabase
            .from('pantry_items')
            .delete()
            .eq('id', id)
            .eq('user_id', user.id);

        if (error) {
            console.error('Error deleting pantry item:', error);
            return { success: false, error: error.message };
        }

        return { success: true };
    } catch (error) {
        console.error('Failed to delete pantry item:', error);
        return { success: false, error: 'Failed to delete item' };
    }
}

export async function getPantryItems(category?: PantryItem['category']): Promise<PantryItem[]> {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) return [];

        let query = supabase.from('pantry_items').select('*').eq('user_id', user.id).order('item_name');

        if (category) query = query.eq('category', category);

        const { data, error } = await query;

        if (error) {
            console.error('Error fetching pantry items:', error);
            return [];
        }

        return data || [];
    } catch (error) {
        console.error('Failed to get pantry items:', error);
        return [];
    }
}

// Mindful Moments
export async function logMindfulMoment(
    momentType: MindfulMoment['moment_type'],
    value: string,
    notes?: string
): Promise<{ success: boolean; error?: string }> {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) return { success: false, error: 'User not authenticated' };

        const { error } = await supabase
            .from('mindful_moments')
            .insert({ user_id: user.id, moment_type: momentType, value, notes: notes || null });

        if (error) {
            console.error('Error logging mindful moment:', error);
            return { success: false, error: error.message };
        }

        return { success: true };
    } catch (error) {
        console.error('Failed to log mindful moment:', error);
        return { success: false, error: 'Failed to log moment' };
    }
}

export async function getTodayMindfulMoments(): Promise<MindfulMoment[]> {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) return [];

        const cookieStore = await cookies();
        const timezone = cookieStore.get("user_timezone")?.value || "UTC";
        const now = new Date();
        const { toZonedTime } = require('date-fns-tz');
        const zonedNow = toZonedTime(now, timezone);
        const startOfDay = new Date(zonedNow);
        startOfDay.setHours(0, 0, 0, 0);

        const { data, error } = await supabase
            .from('mindful_moments')
            .select('*')
            .eq('user_id', user.id)
            .gte('created_at', startOfDay.toISOString())
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error fetching mindful moments:', error);
            return [];
        }

        return data || [];
    } catch (error) {
        console.error('Failed to get mindful moments:', error);
        return [];
    }
}

// Physical Activity
export async function logPhysicalActivity(
    activity: Omit<PhysicalActivity, 'id' | 'user_id' | 'created_at'>
): Promise<{ success: boolean; id?: string; error?: string }> {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) return { success: false, error: 'User not authenticated' };

        const { data, error } = await supabase
            .from('physical_activities')
            .insert({ user_id: user.id, ...activity })
            .select('id')
            .single();

        if (error) {
            console.error('Error logging activity:', error);
            return { success: false, error: error.message };
        }

        return { success: true, id: data.id };
    } catch (error) {
        console.error('Failed to log activity:', error);
        return { success: false, error: 'Failed to log activity' };
    }
}

export async function getRecentActivities(days: number = 7): Promise<PhysicalActivity[]> {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) return [];

        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);

        const { data, error } = await supabase
            .from('physical_activities')
            .select('*')
            .eq('user_id', user.id)
            .gte('created_at', startDate.toISOString())
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error fetching activities:', error);
            return [];
        }

        return data || [];
    } catch (error) {
        console.error('Failed to get activities:', error);
        return [];
    }
}
