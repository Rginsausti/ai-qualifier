import { createClient } from "@/lib/supabase/server";
import type { StoreSource } from "./types";

type SourceStatus = 'completed' | 'failed' | 'skipped';

export async function getActiveSourcesForStore(storeId: string): Promise<StoreSource[]> {
    if (!storeId) return [];
    const supabase = await createClient();
    const { data, error } = await supabase
        .from("store_sources")
        .select("id, store_id, source_type, source_identifier, config, active, priority")
        .eq("store_id", storeId)
        .eq("active", true)
        .order("priority", { ascending: true });

    if (error || !data) {
        if (error) {
            console.error("[Scraping] getActiveSourcesForStore error", error.message);
        }
        return [];
    }

    return data as StoreSource[];
}

export async function getSourcesGroupedByStore(storeIds: string[]): Promise<Map<string, StoreSource[]>> {
    const map = new Map<string, StoreSource[]>();
    if (!storeIds.length) return map;

    const supabase = await createClient();
    const { data, error } = await supabase
        .from("store_sources")
        .select("id, store_id, source_type, source_identifier, config, active, priority")
        .in("store_id", storeIds)
        .eq("active", true)
        .order("priority", { ascending: true });

    if (error || !data) {
        if (error) {
            console.error("[Scraping] getSourcesGroupedByStore error", error.message);
        }
        return map;
    }

    for (const row of data as StoreSource[]) {
        const bucket = map.get(row.store_id) ?? [];
        bucket.push(row);
        map.set(row.store_id, bucket);
    }

    return map;
}

export async function setSourceStatus(
    sourceId: string,
    status: SourceStatus,
    errorMessage?: string | null
): Promise<void> {
    try {
        const supabase = await createClient();
        await supabase
            .from("store_sources")
            .update({
                last_run_at: new Date().toISOString(),
                last_status: status,
                last_error: errorMessage ?? null,
            })
            .eq("id", sourceId);
    } catch (error) {
        console.error("[Scraping] setSourceStatus error", error);
    }
}
