import { StoreConfig } from '../headless-scraper';

/**
 * Carrefour Argentina Adapter
 * Platform: VTEX IO (React-based e-commerce)
 * Challenges: Heavy JavaScript, lazy loading, geolocation-based pricing
 */

/**
 * Gets Carrefour-specific scraping configuration
 * @param storeId - VTEX store ID
 * @param postalCode - User postal code for pricing
 */
export function getCarrefourConfig(
    storeId?: string,
    postalCode?: string
): StoreConfig {
    // VTEX segment cookie structure
    const vtexSegment = storeId && postalCode ? JSON.stringify({
        campaigns: null,
        channel: "1",
        priceTables: null,
        regionId: storeId,
        utm_campaign: null,
        utm_source: null,
        utmi_campaign: null,
        currencyCode: "ARS",
        currencySymbol: "$",
        countryCode: "ARG",
        postalCode: postalCode,
    }) : undefined;

    return {
        brand: 'CARREFOUR',
        searchUrlTemplate: '/{query}?_q={query}&map=ft',
        cookies: vtexSegment ? {
            'vtex_segment': vtexSegment,
        } : undefined,
        waitSelector: '.vtex-search-result-3-x-gallery, .vtex-product-summary',
        scrollBehavior: true, // CRITICAL: Infinite scroll for lazy loading
        additionalWait: 3000, // Allow React hydration
    };
}

/**
 * Extracts Carrefour store ID from address
 * This would need a mapping table or API call in production
 */
export function findCarrefourStoreId(
    latitude: number,
    longitude: number
): string | undefined {
    // Placeholder - in production, call Carrefour's store locator API
    // or maintain a static mapping table
    return undefined;
}

/**
 * Provides parsing hints for Groq (Carrefour-specific)
 */
export const CARREFOUR_PARSING_HINTS = `
Estructura HTML de Carrefour (VTEX):
- Productos en divs con clase "vtex-product-summary"
- Precio actual: span con "sellingPrice" o "bestPrice"
- Precio regular: span con "listPrice" (si hay descuento)
- Claims nutricionales: buscar badges con "Sin TACC", "Orgánico", etc.
- Imágenes: img dentro de .vtex-product-summary-2-x-imageContainer
- URLs: Buscar <a> con href que contenga "/p"
`;

/**
 * Validates if a URL belongs to Carrefour
 */
export function isCarrefourUrl(url: string): boolean {
    return url.includes('carrefour.com.ar');
}

/**
 * Postal code lookup from coordinates (simplified)
 */
export function getPostalCodeFromCoords(
    lat: number,
    lon: number
): string {
    // Simplified - in production use reverse geocoding API
    // Buenos Aires center
    if (lat > -35 && lat < -34 && lon > -59 && lon < -58) {
        return '1000'; // CABA generic
    }
    return '0000'; // Default
}
