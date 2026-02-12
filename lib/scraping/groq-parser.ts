import Groq from 'groq-sdk';
import { Product } from './types';

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const normalizeQuery = (value: string) =>
    value
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim();

const isProduceQuery = (query?: string) => {
    if (!query) return false;
    const normalized = normalizeQuery(query);
    return ['fruta', 'frutas', 'verdura', 'verduras', 'vegetal', 'hortaliza', 'produce', 'fruit', 'vegetable'].some((term) =>
        normalized.includes(term)
    );
};

export async function parseHtmlWithGroq(htmlContent: string, query?: string): Promise<Product[]> {
    if (!htmlContent || htmlContent.length < 500) return [];

    const cleanedHtml = htmlContent
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
        .replace(/<svg\b[^<]*(?:(?!<\/svg>)<[^<]*)*<\/svg>/gi, '')
        .replace(/<!--[\s\S]*?-->/g, '')
        .replace(/\s{2,}/g, ' ');

    const produceGuard = isProduceQuery(query)
        ? 'La consulta es de frutas/verduras frescas. Excluye tés, infusiones, golosinas, snacks, bebidas saborizadas y cualquier producto que no sea alimento fresco.'
        : '';

    const systemPrompt = `
        Eres un motor de extracción de datos JSON para productos alimenticios.
        Salida: Array JSON válido de objetos Product.
        Campos: product_name, brand, price_current (number), price_regular (number), unit, quantity, image_url, product_url, nutritional_claims (string[]).
        ${produceGuard}
        Sin markdown.
    `;

    try {
        const chatCompletion = await groq.chat.completions.create({
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: `QUERY: ${query || 'general'}\nHTML: ${cleanedHtml.substring(0, 15000)}` } // Limit context to avoid excessive tokens
            ],
            model: "llama-3.3-70b-versatile",
            temperature: 0,
            response_format: { type: "json_object" },
        });

        const content = chatCompletion.choices[0]?.message?.content;
        if (!content) return [];

        const json = JSON.parse(content);
        const products = json.products || json.data || (Array.isArray(json) ? json : []);

        return products.map((p: Product) => ({
            product_name: String(p.product_name || ''),
            brand: p.brand ? String(p.brand) : null,
            price_current: parseFloat(String(p.price_current).replace(/[^0-9.]/g, '')),
            price_regular: p.price_regular ? parseFloat(String(p.price_regular).replace(/[^0-9.]/g, '')) : null,
            unit: p.unit ? String(p.unit) : null,
            quantity: p.quantity ? parseFloat(String(p.quantity).replace(/[^0-9.]/g, '')) : null,
            image_url: p.image_url ? String(p.image_url) : null,
            product_url: p.product_url ? String(p.product_url) : null,
            nutritional_claims: Array.isArray(p.nutritional_claims) ? p.nutritional_claims : [],
        }));
    } catch (error) {
        console.error(`[Groq] Error: ${(error as Error).message}`);
        return [];
    }
}
