import { StoreConfig } from '../headless-scraper';

/**
 * Coto Digital Adapter
 * Platform: Legacy ASP.NET
 * Challenges: Session-based store selection, table-based HTML
 */

/**
 * Gets Coto-specific scraping configuration
 * @param storeId - Optional Coto store ID for selection
 */
export function getCotoConfig(storeId?: string): StoreConfig {
    return {
        brand: 'COTO',
        searchUrlTemplate: '/Home/BusquedaProductos?Ntt={query}',
        cookies: storeId ? {
            'CotoStore': storeId, // Store selection cookie
        } : undefined,
        waitSelector: '.product-item, .producto, table.products',
        scrollBehavior: false, // Legacy site, no infinite scroll
        additionalWait: 2000, // Allow time for legacy JS
    };
}

/**
 * Normalizes Coto store ID from OSM name
 * Example: "Coto Sucursal 45" → "045"
 */
export function extractCotoStoreId(storeName: string): string | undefined {
    const match = storeName.match(/sucursal\s*(\d+)/i);
    if (match) {
        return match[1].padStart(3, '0');
    }
    return undefined;
}

/**
 * Provides parsing hints for Groq (Coto-specific)
 */
export const COTO_PARSING_HINTS = `
Estructura HTML de Coto Digital:
- Productos en tablas <table class="products">
- Precios en formato: "$X.XXX,XX"
- Claims nutricionales raramente presentes
- Marca suele estar en el nombre del producto
- Imágenes con src="/Uploads/Products/..."
`;

/**
 * Validates if a URL belongs to Coto
 */
export function isCotoUrl(url: string): boolean {
    return url.includes('cotodigital') || url.includes('coto.com.ar');
}
