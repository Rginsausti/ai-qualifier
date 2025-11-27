import { StoreAdapter } from '../types';
import { scrapeWithHeadlessX } from '../headless-scraper';
import { parseHtmlWithGroq } from '../groq-parser';

export const cotoAdapter: StoreAdapter = {
    brand: 'COTO',
    scrape: async (query: string) => {
        const url = `https://www.cotodigital3.com.ar/sitios/cdigi/buscar?q=${encodeURIComponent(query)}`;
        const html = await scrapeWithHeadlessX({
            url,
            waitSelector: '.product-item, .producto, table.products'
        });
        return parseHtmlWithGroq(html);
    }
};
