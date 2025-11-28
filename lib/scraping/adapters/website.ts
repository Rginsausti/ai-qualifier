import axios from "axios";
import type { SourceAdapter, StoreSource, ScrapeContext, Product } from "../types";
import { parseHtmlWithGroq } from "../groq-parser";

async function fetchHtml(url: string): Promise<string> {
    const resp = await axios.get(url, {
        timeout: 20000,
        headers: {
            "User-Agent": "EatAppScraper/1.0",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        },
    });
    return typeof resp.data === "string" ? resp.data : JSON.stringify(resp.data);
}

export const websiteSourceAdapter: SourceAdapter = {
    type: "website",
    async scrape(source: StoreSource, _query: string, context?: ScrapeContext): Promise<Product[]> {
        const url = source.source_identifier || context?.storeWebsite;
        if (!url) {
            console.warn("[Website Adapter] Missing URL for store", source.store_id);
            return [];
        }

        try {
            const html = await fetchHtml(url);
            const products = await parseHtmlWithGroq(html);
            return products;
        } catch (err) {
            console.error("[Website Adapter] Error fetching or parsing", err);
            return [];
        }
    },
};
