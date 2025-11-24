"use server";

/**
 * Configuration for store-specific scraping
 */
export type StoreConfig = {
    brand: string;
    searchUrlTemplate: string; // {query} placeholder
    cookies?: Record<string, string>; // Store selection cookies
    waitSelector?: string; // CSS selector to wait for
    scrollBehavior?: boolean; // Enable scroll simulation
    additionalWait?: number; // Extra wait time in ms
};

/**
 * HeadlessX API request payload
 */
type HeadlessXRequest = {
    url: string;
    stealthMode: boolean;
    behaviorSimulation: boolean;
    wait?: string | number;
    cookies?: Array<{ name: string; value: string; domain: string }>;
    userAgent?: string;
    viewport?: { width: number; height: number };
};

/**
 * Scrapes a store's search results using HeadlessX
 * @param storeUrl - Full URL to scrape
 * @param searchQuery - Product search term
 * @param storeConfig - Store-specific configuration
 * @returns Rendered HTML content
 */
export async function scrapeStoreProducts(
    storeUrl: string,
    searchQuery: string,
    storeConfig: StoreConfig
): Promise<string> {
    try {
        const headlessxUrl = process.env.HEADLESSX_API_URL || 'http://localhost:3100';

        // Build search URL
        const searchUrl = storeConfig.searchUrlTemplate.replace('{query}', encodeURIComponent(searchQuery));
        const fullUrl = `${storeUrl}${searchUrl}`;

        console.log(`[HeadlessX] Scraping ${storeConfig.brand}: ${fullUrl}`);

        // Prepare cookies if any
        const cookies = storeConfig.cookies
            ? Object.entries(storeConfig.cookies).map(([name, value]) => ({
                name,
                value,
                domain: new URL(storeUrl).hostname,
            }))
            : [];

        // Build HeadlessX request
        const payload: HeadlessXRequest = {
            url: fullUrl,
            stealthMode: true, // CRITICAL for WAF evasion
            behaviorSimulation: storeConfig.scrollBehavior ?? true,
            wait: storeConfig.waitSelector || 5000, // Wait for selector or 5 seconds
            cookies: cookies.length > 0 ? cookies : undefined,
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            viewport: { width: 1920, height: 1080 },
        };

        // Call HeadlessX API
        const response = await fetch(`${headlessxUrl}/api/render`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
            signal: AbortSignal.timeout(60000), // 60 second timeout
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`[HeadlessX] Error ${response.status}:`, errorText);
            throw new Error(`HeadlessX failed: ${response.status}`);
        }

        const result = await response.json();
        const html = result.html || result.content || '';

        console.log(`[HeadlessX] Success: ${html.length} characters`);

        // Optional: Additional wait for JS-heavy sites
        if (storeConfig.additionalWait) {
            await new Promise(resolve => setTimeout(resolve, storeConfig.additionalWait));
        }

        return html;
    } catch (error) {
        console.error('[HeadlessX] Scraping error:', error);
        throw error;
    }
}

/**
 * Tests HeadlessX connectivity
 * @returns true if HeadlessX is reachable
 */
export async function testHeadlessXConnection(): Promise<boolean> {
    try {
        const headlessxUrl = process.env.HEADLESSX_API_URL || 'http://localhost:3100';
        const response = await fetch(`${headlessxUrl}/health`, {
            signal: AbortSignal.timeout(5000),
        });
        return response.ok;
    } catch (error) {
        console.error('[HeadlessX] Connection test failed:', error);
        return false;
    }
}
