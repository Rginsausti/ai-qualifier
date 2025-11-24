import { StoreConfig } from '../headless-scraper';

/**
 * Jumbo/Vea/Disco Adapter (Grupo Cencosud)
 * Platform: Custom e-commerce (migrating to modern stack)
 * Challenges: Cloudflare protection, store-specific pricing
 */

/**
 * Gets Jumbo-specific scraping configuration
 * @param brand - JUMBO, VEA, or DISCO
 * @param storeId - Store identifier
 */
export function getJumboConfig(
    brand: 'JUMBO' | 'VEA' | 'DISCO',
    storeId?: string
): StoreConfig {
    const baseUrls = {
        'JUMBO': 'https://www.jumbo.com.ar',
        'VEA': 'https://www.vea.com.ar',
        'DISCO': 'https://www.disco.com.ar',
    };

    return {
        brand,
        searchUrlTemplate: '/search?q={query}',
        cookies: storeId ? {
            'selectedStore': storeId,
            'storeCode': storeId,
        } : undefined,
        waitSelector: '.product-card, .shelf-item, [data-testid="product"]',
        scrollBehavior: true, // Modern SPA with lazy loading
        additionalWait: 4000, // Extra wait for Cloudflare + React
    };
}

/**
 * Provides parsing hints for Groq (Jumbo/Vea/Disco)
 */
export const JUMBO_PARSING_HINTS = `
Estructura HTML de Jumbo/Vea/Disco:
- Productos en cards con clase "product-card" o "shelf-item"
- Precio: buscar clase con "price", "valor", o data-testid="price"
- Descuentos: etiqueta "antes" seguida del precio regular
- Claims: badges o tags con "Sin TACC", "Orgánico", etc.
- Imágenes: img con src que contiene "jumboargentina" o similar
- Formato precios: "$X,XXX.XX" o "$X.XXX,XX"
`;

/**
 * Validates if a URL belongs to Cencosud brands
 */
export function isCencosudUrl(url: string): boolean {
    return (
        url.includes('jumbo.com.ar') ||
        url.includes('vea.com.ar') ||
        url.includes('disco.com.ar')
    );
}

/**
 * Determines which Cencosud brand from URL
 */
export function detectCencosudBrand(
    url: string
): 'JUMBO' | 'VEA' | 'DISCO' | undefined {
    if (url.includes('jumbo')) return 'JUMBO';
    if (url.includes('vea')) return 'VEA';
    if (url.includes('disco')) return 'DISCO';
    return undefined;
}

/**
 * Maps OSM store to Cencosud store ID
 * This is a simplified version - production would need actual IDs
 */
export function getCencosudStoreId(
    brand: string,
    osmName: string
): string | undefined {
    // Extract numeric ID if present in name
    const match = osmName.match(/\d+/);
    return match ? match[0] : undefined;
}
