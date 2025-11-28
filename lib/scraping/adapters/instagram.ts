import axios from "axios";
import { SourceAdapter, Product, ScrapeContext, StoreSource } from "../types";

const INSTAGRAM_FIELDS = [
    "id",
    "caption",
    "permalink",
    "media_url",
    "media_type",
    "timestamp"
].join(",");

const PRICE_REGEX = /(\$|ars|usd|\bprecio\b)[^0-9]*(\d{2,5}(?:[.,]\d{2})?)/i;

const CLAIM_KEYWORDS = [
    { match: /sin\s+tacc|gluten\s*free/gi, label: "Sin TACC" },
    { match: /vegano|plant\s+based|origen\s+vegetal/gi, label: "Vegano" },
    { match: /sin\s+az(u|ú)car/gi, label: "Sin azúcar" },
    { match: /alto\s+en\s+prote(í|i)na/gi, label: "Alto en proteínas" },
];

function resolveAccessToken(source: StoreSource): string | undefined {
    const token = typeof source.config?.accessToken === "string"
        ? (source.config.accessToken as string)
        : process.env.INSTAGRAM_ACCESS_TOKEN;
    return token || undefined;
}

function resolveAccountId(source: StoreSource): string | undefined {
    if (typeof source.config?.businessAccountId === "string" && source.config.businessAccountId) {
        return source.config.businessAccountId as string;
    }
    if (typeof source.config?.userId === "string" && source.config.userId) {
        return source.config.userId as string;
    }
    if (source.source_identifier) {
        return source.source_identifier;
    }
    return undefined;
}

function extractPrice(caption: string | null | undefined): number | null {
    if (!caption) return null;
    const match = caption.match(PRICE_REGEX);
    if (!match) return null;
    const raw = match[2].replace(/\./g, "").replace(/,/, ".");
    const value = Number.parseFloat(raw);
    return Number.isFinite(value) ? value : null;
}

function extractClaims(caption: string | null | undefined): string[] {
    if (!caption) return [];
    const claims = new Set<string>();
    for (const keyword of CLAIM_KEYWORDS) {
        if (keyword.match.test(caption)) {
            claims.add(keyword.label);
        }
    }
    return Array.from(claims.values());
}

function normalize(text?: string): string {
    return (text ?? "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim();
}

function matchesQuery(caption: string | null | undefined, query: string): boolean {
    if (!query) return true;
    const normalizedCaption = normalize(caption || "");
    const tokens = normalize(query).split(/\s+/).filter(Boolean);
    return tokens.length === 0 || tokens.some((token) => normalizedCaption.includes(token));
}

function buildProductName(caption: string | null | undefined, fallback: string): string {
    if (!caption) return fallback;
    const firstLine = caption.trim().split(/\r?\n/)[0]?.trim();
    if (!firstLine) return fallback;
    return firstLine.length > 80 ? `${firstLine.slice(0, 77)}...` : firstLine;
}

export const instagramSourceAdapter: SourceAdapter = {
    type: "instagram",
    async scrape(source: StoreSource, query: string, context?: ScrapeContext): Promise<Product[]> {
        const accessToken = resolveAccessToken(source);
        const accountId = resolveAccountId(source);

        if (!accessToken || !accountId) {
            console.warn("[Instagram Adapter] Missing access token or account id for source", source.id);
            return [];
        }

        const limit = typeof source.config?.limit === "number" ? Number(source.config.limit) : 25;
        const url = `https://graph.instagram.com/${accountId}/media`;

        try {
            const response = await axios.get(url, {
                params: {
                    fields: INSTAGRAM_FIELDS,
                    access_token: accessToken,
                    limit: Math.min(Math.max(limit, 5), 50)
                },
                timeout: 20000,
                headers: {
                    "User-Agent": "EatAppScraper/1.0"
                }
            });

            const posts: Array<Record<string, any>> = Array.isArray(response.data?.data)
                ? response.data.data
                : [];

            const products: Product[] = [];
            const fallbackName = context?.storeName ?? "Producto del local";

            for (const post of posts) {
                const caption = typeof post.caption === "string" ? post.caption : "";
                if (!matchesQuery(caption, query)) continue;

                const price = extractPrice(caption);
                if (!price) continue;

                const product: Product = {
                    product_name: buildProductName(caption, fallbackName),
                    brand: context?.storeBrand ?? context?.storeName ?? null,
                    price_current: price,
                    price_regular: null,
                    unit: null,
                    quantity: null,
                    image_url: typeof post.media_url === "string" ? post.media_url : null,
                    product_url: typeof post.permalink === "string" ? post.permalink : null,
                    nutritional_claims: extractClaims(caption),
                };

                products.push(product);
            }

            return products;
        } catch (error) {
            console.error("[Instagram Adapter] Failed to fetch posts", error);
            return [];
        }
    }
};
