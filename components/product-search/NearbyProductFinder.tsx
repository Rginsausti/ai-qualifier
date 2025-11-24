"use client";

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import Image from 'next/image';

export type ProductResult = {
    product_name: string;
    brand?: string;
    price_current: number;
    price_regular?: number;
    unit?: string;
    nutritional_claims?: string[];
    image_url?: string;
    store_name: string;
    store_brand?: string;
    distance_meters: number;
};

type SearchResults = {
    products: ProductResult[];
    stores_searched: number;
    cache_hit: boolean;
    search_latency_ms: number;
};

export default function NearbyProductFinder() {
    const { t } = useTranslation();
    const [location, setLocation] = useState<{ lat: number; lon: number } | null>(null);
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<SearchResults | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [locationDenied, setLocationDenied] = useState(false);

    // Request geolocation permission
    const requestLocation = () => {
        setError(null);
        setLocationDenied(false);

        if (!navigator.geolocation) {
            setError(t('errors.geolocationNotSupported'));
            return;
        }

        navigator.geolocation.getCurrentPosition(
            (position) => {
                setLocation({
                    lat: position.coords.latitude,
                    lon: position.coords.longitude,
                });
            },
            (error) => {
                console.error('Geolocation error:', error);
                setLocationDenied(true);
                setError(t('errors.locationDenied'));
            }
        );
    };

    // Search for products
    const handleSearch = async () => {
        if (!location) {
            setError(t('errors.locationRequired'));
            return;
        }

        if (!query.trim() || query.trim().length < 2) {
            setError(t('errors.queryTooShort'));
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const response = await fetch('/api/products/search', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    lat: location.lat,
                    lon: location.lon,
                    query: query.trim(),
                }),
            });

            if (!response.ok) {
                throw new Error('Search failed');
            }

            const data = await response.json();
            setResults(data);
        } catch (err) {
            console.error('Search error:', err);
            setError(t('errors.searchFailed'));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                    {t('productSearch.title')}
                </h2>
                <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                    {t('productSearch.subtitle')}
                </p>
            </div>

            {/* Geolocation Request */}
            {!location && (
                <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-6 text-center">
                    <svg
                        className="mx-auto h-12 w-12 text-blue-500"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                    >
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                        />
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                        />
                    </svg>
                    <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">
                        {t('productSearch.locationRequired')}
                    </h3>
                    <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                        {t('productSearch.locationDescription')}
                    </p>
                    <button
                        onClick={requestLocation}
                        className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                        {t('productSearch.enableLocation')}
                    </button>
                    {locationDenied && (
                        <p className="mt-2 text-sm text-red-600 dark:text-red-400">
                            {t('productSearch.locationDeniedHelp')}
                        </p>
                    )}
                </div>
            )}

            {/* Search Input */}
            {location && (
                <div className="flex gap-2">
                    <input
                        type="text"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                        placeholder={t('productSearch.searchPlaceholder')}
                        className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-white"
                    />
                    <button
                        onClick={handleSearch}
                        disabled={loading}
                        className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                        {loading ? t('common.loading') : t('common.search')}
                    </button>
                </div>
            )}

            {/* Error Message */}
            {error && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                    <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
                </div>
            )}

            {/* Loading State */}
            {loading && (
                <div className="text-center py-8">
                    <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-gray-200 border-t-blue-600"></div>
                    <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                        {t('productSearch.searching')}
                    </p>
                </div>
            )}

            {/* Results */}
            {results && !loading && (
                <div>
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                            {t('productSearch.resultsFound', { count: results.products.length })}
                        </h3>
                        <div className="text-xs text-gray-500">
                            {results.cache_hit && (
                                <span className="mr-2">📦 {t('productSearch.cached')}</span>
                            )}
                            <span>{results.stores_searched} {t('productSearch.storesSearched')}</span>
                        </div>
                    </div>

                    {results.products.length === 0 ? (
                        <div className="text-center py-8 text-gray-500">
                            {t('productSearch.noResults')}
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {results.products.map((product, index) => (
                                <ProductCard key={index} product={product} />
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

// Product Card Component (extracted for clarity)
function ProductCard({ product }: { product: ProductResult }) {
    const { t } = useTranslation();

    const discount = product.price_regular
        ? Math.round(((product.price_regular - product.price_current) / product.price_regular) * 100)
        : 0;

    return (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4 hover:shadow-lg transition-shadow">
            {/* Product Image */}
            {product.image_url && (
                <div className="relative h-32 mb-3 bg-gray-100 dark:bg-gray-700 rounded-md">
                    <Image
                        src={product.image_url}
                        alt={product.product_name}
                        fill
                        className="object-contain p-2"
                    />
                </div>
            )}

            {/* Product Info */}
            <div className="space-y-2">
                <h4 className="font-medium text-gray-900 dark:text-white line-clamp-2">
                    {product.product_name}
                </h4>

                {product.brand && (
                    <p className="text-xs text-gray-600 dark:text-gray-400">{product.brand}</p>
                )}

                {/* Price */}
                <div className="flex items-baseline gap-2">
                    <span className="text-xl font-bold text-green-600">
                        ${product.price_current.toFixed(2)}
                    </span>
                    {product.price_regular && (
                        <>
                            <span className="text-sm line-through text-gray-500">
                                ${product.price_regular.toFixed(2)}
                            </span>
                            <span className="text-xs bg-red-100 text-red-800 px-2 py-1 rounded">
                                -{discount}%
                            </span>
                        </>
                    )}
                </div>

                {/* Nutritional Claims */}
                {product.nutritional_claims && product.nutritional_claims.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                        {product.nutritional_claims.slice(0, 3).map((claim, i) => (
                            <span
                                key={i}
                                className="text-xs bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 px-2 py-1 rounded"
                            >
                                {claim}
                            </span>
                        ))}
                    </div>
                )}

                {/* Store Info */}
                <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
                    <div className="flex items-center justify-between text-xs text-gray-600 dark:text-gray-400">
                        <span className="font-medium">{product.store_brand || product.store_name}</span>
                        <span>{Math.round(product.distance_meters)}m</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
