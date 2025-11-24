"use server";

import Groq from "groq-sdk";
import * as cheerio from "cheerio";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

/**
 * Structured product data extracted from HTML
 */
export type ProductData = {
    product_name: string;
    brand?: string;
    price_current: number;
    price_regular?: number;
    unit?: string;
    quantity?: number;
    nutritional_claims?: string[];
    nutrition_info?: {
        calories?: number;
        protein?: number;
        carbs?: number;
        fats?: number;
        sodium?: number;
    };
    image_url?: string;
    product_url?: string;
};

/**
 * Context for product extraction
 */
export type ProductContext = {
    storeBrand: string;
    searchQuery: string;
    baseUrl: string;
};

/**
 * Cleans HTML by removing noise and irrelevant tags
 * @param html - Raw HTML content
 * @returns Cleaned text content
 */
function cleanHtml(html: string): string {
    const $ = cheerio.load(html);

    // Remove scripts, styles, and other noise
    $('script').remove();
    $('style').remove();
    $('svg').remove();
    $('img').remove();
    $('footer').remove();
    $('nav').remove();
    $('header').remove();
    $('.advertisement').remove();
    $('[class*="banner"]').remove();

    // Get text content
    let text = $('body').text();

    // Clean whitespace
    text = text.replace(/\s+/g, ' ').trim();

    // Limit length to avoid token limits (keep first 15000 chars)
    return text.substring(0, 15000);
}

/**
 * Extracts structured product data from HTML using Groq LLM
 * @param htmlContent - Raw HTML from scraper
 * @param productContext - Additional context
 * @returns Array of structured product data
 */
export async function parseProductsWithGroq(
    htmlContent: string,
    productContext: ProductContext
): Promise<ProductData[]> {
    try {
        console.log(`[Groq] Parsing HTML for ${productContext.storeBrand}`);

        // Clean HTML to reduce tokens
        const cleanedText = cleanHtml(htmlContent);

        if (cleanedText.length < 100) {
            console.warn('[Groq] HTML too short after cleaning');
            return [];
        }

        // Build system prompt
        const systemPrompt = `Eres un motor de extracción de datos JSON especializado en productos alimenticios de supermercados argentinos.

Tu ÚNICA tarea es analizar el texto HTML y extraer información de productos en un array JSON válido.

REGLAS ESTRICTAS:
1. Responde SOLO con un array JSON, sin markdown, sin explicaciones, sin texto adicional
2. Cada producto debe tener al menos: product_name y price_current
3. Los precios deben ser números (ej: 1250.50, no "$1,250.50")
4. Si encuentras "antes $X ahora $Y", price_regular es X y price_current es Y
5. Detecta claims nutricionales como: "Sin TACC", "Alto en Proteínas", "Bajo Sodio", "Sin Azúcar", "Orgánico"
6. Si no encuentras productos, devuelve un array vacío []

Esquema JSON:
{
  "product_name": string,
  "brand": string?,
  "price_current": number,
  "price_regular": number?,
  "unit": string? (kg, g, L, ml, units),
  "quantity": number?,
  "nutritional_claims": string[]?,
  "nutrition_info": { calories?, protein?, carbs?, fats?, sodium? }?,
  "image_url": string?,
  "product_url": string?
}`;

        const userPrompt = `Contexto:
Supermercado: ${productContext.storeBrand}
Búsqueda: "${productContext.searchQuery}"
URL Base: ${productContext.baseUrl}

HTML Text:
${cleanedText}

Extrae todos los productos encontrados. Responde SOLO con el array JSON.`;

        // Call Groq API
        const completion = await groq.chat.completions.create({
            model: "llama-3.3-70b-versatile",
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: userPrompt },
            ],
            temperature: 0.1, // Low temperature for deterministic extraction
            max_tokens: 4000,
        });

        const responseText = completion.choices[0]?.message?.content || '';

        console.log(`[Groq] Raw response:`, responseText.substring(0, 200));

        // Parse JSON (handle markdown code blocks if present)
        let jsonText = responseText.trim();

        // Remove markdown code blocks
        if (jsonText.startsWith('```')) {
            jsonText = jsonText
                .replace(/```json\n?/g, '')
                .replace(/```\n?/g, '')
                .trim();
        }

        // Parse and validate
        const products: ProductData[] = JSON.parse(jsonText);

        if (!Array.isArray(products)) {
            console.error('[Groq] Response is not an array');
            return [];
        }

        // Validate and clean products
        const validProducts = products.filter(p => {
            if (!p.product_name || typeof p.price_current !== 'number') {
                return false;
            }
            // Ensure price is positive
            if (p.price_current <= 0) return false;
            return true;
        });

        console.log(`[Groq] Extracted ${validProducts.length} valid products`);

        return validProducts;
    } catch (error) {
        console.error('[Groq] Parsing error:', error);

        // If JSON parsing failed, try to extract with regex
        if (error instanceof SyntaxError) {
            console.log('[Groq] Attempting regex fallback...');
            return []; // Could implement regex fallback here
        }

        return [];
    }
}

/**
 * Validates and sanitizes product data before storage
 */
export function validateProduct(product: ProductData): ProductData {
    return {
        product_name: product.product_name.trim().substring(0, 255),
        brand: product.brand?.trim().substring(0, 100),
        price_current: Math.round(product.price_current * 100) / 100,
        price_regular: product.price_regular
            ? Math.round(product.price_regular * 100) / 100
            : undefined,
        unit: product.unit?.toLowerCase(),
        quantity: product.quantity ? Math.abs(product.quantity) : undefined,
        nutritional_claims: product.nutritional_claims?.slice(0, 10), // Max 10 claims
        nutrition_info: product.nutrition_info,
        image_url: product.image_url?.substring(0, 500),
        product_url: product.product_url?.substring(0, 500),
    };
}
