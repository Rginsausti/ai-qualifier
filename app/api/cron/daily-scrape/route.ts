import { createClient } from '@/lib/supabase/server';
import { searchNearbyProducts } from '@/lib/scraping/orchestrator';

export async function GET(request: Request) {
    // Verify secret to prevent unauthorized access
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return new Response('Unauthorized', { status: 401 });
    }

    const supabase = await createClient();
    
    // 1. Get active stores
    const { data: stores } = await supabase
        .from('nearby_stores')
        .select('*')
        .eq('scraping_enabled', true);

    if (!stores || stores.length === 0) {
        return new Response('No active stores found', { status: 200 });
    }

    // 2. Define daily keywords to scrape
    const keywords = ['pollo', 'carne', 'leche', 'huevos', 'pan', 'arroz', 'fideos', 'aceite', 'cafe', 'yerba'];

    // 3. Trigger scraping for each store/keyword combination
    // Note: In a real production environment, this should be queued (e.g., BullMQ, Inngest)
    // For now, we'll just trigger a few and return.
    
    const results = [];
    
    // We'll pick a random keyword to keep it light for this demo cron
    const randomKeyword = keywords[Math.floor(Math.random() * keywords.length)];

    // Use the orchestrator to scrape and save to DB
    // We use a dummy location (Buenos Aires center) as a reference point for "nearby" logic if needed,
    // but the orchestrator handles the store selection.
    // Actually, searchNearbyProducts takes lat/lon.
    // We should iterate over known store locations or just pick a central point.
    
    // Let's use a central point in Buenos Aires for now: -34.6037, -58.3816
    const lat = -34.6037;
    const lon = -58.3816;

    console.log(`[Cron] Starting daily scrape for keyword: ${randomKeyword}`);

    try {
        const result = await searchNearbyProducts(
            lat,
            lon,
            randomKeyword,
            true, // Force refresh (scrape new data)
            5,    // Max stores
            []    // No intolerances for general scraping
        );
        results.push(result);
    } catch (error) {
        console.error(`[Cron] Error scraping ${randomKeyword}:`, error);
    }

    return new Response(JSON.stringify({ 
        success: true, 
        message: `Scraped ${randomKeyword}`,
        results 
    }), { 
        headers: { 'Content-Type': 'application/json' } 
    });
}
