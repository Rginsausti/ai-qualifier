import { StoreAdapter } from '../types';
import { scrapeWithHeadlessX } from '../headless-scraper';
import { parseHtmlWithGroq } from '../groq-parser';

const createCencosudAdapter = (brand: string, domain: string): StoreAdapter => ({
    brand,
    scrape: async (query: string) => {
        const url = `https://www.${domain}/buscar?q=${encodeURIComponent(query)}`;
        const html = await scrapeWithHeadlessX({
            url,
            waitSelector: '.product-card, .shelf-item'
        });
        return parseHtmlWithGroq(html);
    }
});

export const jumboAdapter = createCencosudAdapter('JUMBO', 'jumbo.com.ar');
export const veaAdapter = createCencosudAdapter('VEA', 'vea.com.ar');
export const discoAdapter = createCencosudAdapter('DISCO', 'disco.com.ar');
