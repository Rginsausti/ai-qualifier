import { createClient } from "@/lib/supabase/server";
import type { NearbyStore } from "./osm-discovery";

// Crea fuentes por defecto (website) para cada tienda que tenga website_url
export async function ensureDefaultSourcesForStores(stores: NearbyStore[]): Promise<void> {
    if (!stores.length) return;

    try {
        const supabase = await createClient();
        const storeIds = stores.map((s) => s.id).filter((id): id is string => Boolean(id));
        if (!storeIds.length) return;

        // Cargar fuentes existentes para no duplicar
        const { data: existing, error } = await supabase
            .from("store_sources")
            .select("store_id, source_type, source_identifier")
            .in("store_id", storeIds);

        if (error) {
            console.error("[AutoSources] Error loading existing sources", error.message);
            return;
        }

        const existingKey = new Set(
            (existing ?? []).map((row) => `${row.store_id}|${row.source_type}|${row.source_identifier ?? ""}`)
        );

        const inserts: any[] = [];

        for (const store of stores) {
            if (!store.id || !store.website_url) continue;

            const key = `${store.id}|website|${store.website_url}`;
            if (existingKey.has(key)) continue;

            inserts.push({
                store_id: store.id,
                source_type: "website",
                source_identifier: store.website_url,
                active: true,
                priority: 10,
                config: {},
            });
        }

        if (!inserts.length) return;

        const { error: insertError } = await supabase.from("store_sources").insert(inserts);
        if (insertError) {
            console.error("[AutoSources] Error inserting default sources", insertError.message);
        } else {
            console.log(`[AutoSources] Created ${inserts.length} default website sources`);
        }
    } catch (err) {
        console.error("[AutoSources] Unexpected error", err);
    }
}
