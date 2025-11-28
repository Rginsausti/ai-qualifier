import axios from 'axios';
import { StoreAdapter, Product, ScrapeContext } from '../types';

const CARREFOUR_BASE_URL = 'https://www.carrefour.com.ar';

interface CarrefourApiProduct {
    productName?: string;
    brand?: string;
    link?: string;
    linkText?: string;
    items?: Array<{
        name?: string;
        measurementUnit?: string;
        unitMultiplier?: number;
        images?: Array<{ imageUrl?: string | null }>;
        sellers?: Array<{
            sellerDefault?: boolean;
            commertialOffer?: {
                Price?: number;
                ListPrice?: number;
                IsAvailable?: boolean;
            };
        }>;
    }>;
}

async function fetchProducts(query: string): Promise<CarrefourApiProduct[]> {
    const url = `${CARREFOUR_BASE_URL}/api/catalog_system/pub/products/search/${encodeURIComponent(query)}`;

    const response = await axios.get<CarrefourApiProduct[]>(url, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; EatAppBot/1.0)'
        },
        timeout: 25000
    });

    return Array.isArray(response.data) ? response.data : [];
}

function normalizeProduct(product: CarrefourApiProduct): Product[] {
    if (!product.items?.length) return [];

    const productUrl = product.link && product.link.startsWith('http')
        ? product.link
        : `${CARREFOUR_BASE_URL}${product.link ?? `/${product.linkText ?? ''}/p`}`;

    return product.items.flatMap((item) => {
        if (!item) return [];

        const imageUrl = item.images?.find((img) => !!img?.imageUrl)?.imageUrl ?? null;
        const seller = (item.sellers ?? []).find((candidate) =>
            candidate?.sellerDefault && candidate.commertialOffer?.IsAvailable
        ) ?? item.sellers?.[0];

        if (!seller?.commertialOffer?.Price) return [];

        const priceRegular = seller.commertialOffer.ListPrice && seller.commertialOffer.ListPrice > 0
            ? seller.commertialOffer.ListPrice
            : null;

        const normalized: Product = {
            product_name: item.name || product.productName || 'Producto Carrefour',
            brand: product.brand || null,
            price_current: seller.commertialOffer.Price,
            price_regular: priceRegular,
            unit: item.measurementUnit ?? null,
            quantity: item.unitMultiplier ?? null,
            image_url: imageUrl,
            product_url: productUrl,
            nutritional_claims: []
        };

        return [normalized];
    });
}

export const carrefourAdapter: StoreAdapter = {
    brand: 'CARREFOUR',
    scrape: async (query: string, _context?: ScrapeContext) => {
        void _context;
        const apiProducts = await fetchProducts(query);

        return apiProducts.flatMap(normalizeProduct)
            .filter((product) => product.price_current > 0);
    }
};
