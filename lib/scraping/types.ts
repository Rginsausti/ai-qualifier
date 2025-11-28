export interface Product {
    product_name: string;
    brand: string | null;
    price_current: number;
    price_regular: number | null;
    unit: string | null;
    quantity: number | null;
    image_url: string | null;
    product_url: string | null;
    nutritional_claims?: string[] | null;
    nutrition_info?: Record<string, any> | null;
}

export interface StoreAdapter {
    brand: string;
    scrape: (query: string, context?: ScrapeContext) => Promise<Product[]>;
}

export type ScrapingSourceType = 'brand_api' | 'instagram' | 'website' | 'rss' | 'sheet' | 'custom';

export interface StoreSource {
    id: string;
    store_id: string;
    source_type: ScrapingSourceType;
    source_identifier?: string | null;
    config: Record<string, unknown>;
    active: boolean;
    priority: number;
}

export interface ScrapeContext {
    storeId?: string;
    storeName?: string;
    storeBrand?: string | null;
    storeWebsite?: string | null;
}

export interface SourceAdapter {
    type: ScrapingSourceType;
    scrape: (source: StoreSource, query: string, context?: ScrapeContext) => Promise<Product[]>;
}
