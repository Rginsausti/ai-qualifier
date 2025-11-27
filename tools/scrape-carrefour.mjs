import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import axios from 'axios';
import Groq from 'groq-sdk';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

async function scrapeWithHeadlessX(url, waitSelector) {
    const endpoint = process.env.HEADLESSX_API_URL;
    console.log('Scraping via HeadlessX:', url);
    const response = await axios.post(endpoint, {
        url,
        stealthMode: true,
        behaviorSimulation: true,
        wait: { selector: waitSelector, timeout: 30000 },
        scroll: { count: 3, delay: 1000 }
    }, {
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${process.env.HEADLESSX_AUTH_TOKEN}`
        },
        timeout: 120000
    });

    return response.data.html;
}

function cleanHtml(html) {
    return html
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
        .replace(/<svg\b[^<]*(?:(?!<\/svg>)<[^<]*)*<\/svg>/gi, '')
        .replace(/<!--[\s\S]*?-->/g, '')
        .replace(/\s{2,}/g, ' ');
}

async function parseProducts(html) {
    const systemPrompt = `Eres un motor de extracción de datos JSON para productos alimenticios. Salida: Array JSON válido de objetos Product. Campos: product_name, brand, price_current (number), price_regular (number), unit, quantity, image_url, product_url, nutritional_claims (string[]). Sin markdown.`;

    const completion = await groq.chat.completions.create({
        messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: `HTML: ${cleanHtml(html).substring(0, 15000)}` }
        ],
        model: 'llama-3.3-70b-versatile',
        temperature: 0,
        response_format: { type: 'json_object' }
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) return [];
    const json = JSON.parse(content);
    const products = json.products || json.data || (Array.isArray(json) ? json : []);
    return products.map((p) => ({
        product_name: p.product_name,
        brand: p.brand,
        price_current: p.price_current,
        product_url: p.product_url
    }));
}

async function main() {
    const query = process.argv[2] ?? 'pollo';
    const outputPath = process.argv[3];
    const url = `https://www.carrefour.com.ar/${encodeURIComponent(query)}`;
    const html = await scrapeWithHeadlessX(url, '.vtex-search-result-3-x-gallery');
    console.log('HTML length:', html?.length ?? 0);
    if (outputPath) {
        const fs = await import('node:fs/promises');
        await fs.writeFile(outputPath, html, 'utf8');
        console.log('HTML guardado en', outputPath);
    }
    const products = await parseProducts(html);
    console.log('Products length:', products.length);
    console.log(products.slice(0, 5));
}

main().catch((error) => {
    console.error('Error:', error);
    process.exit(1);
});
