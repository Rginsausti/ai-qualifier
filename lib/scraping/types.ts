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
    scrape: (query: string) => Promise<Product[]>;
}
