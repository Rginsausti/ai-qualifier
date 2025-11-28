"use client";

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Image from 'next/image';
import { MapPin, Search, AlertCircle, Loader2, ShoppingBag, Tag, Navigation } from 'lucide-react';

const LOADER_MESSAGES = [
    { key: 'productSearch.loader.step1', fallback: 'Estamos buscando en los comercios cercanos a tu casa' },
    { key: 'productSearch.loader.step2', fallback: 'Esto puede tardar unos instantes, sé paciente' },
    { key: 'productSearch.loader.step3', fallback: 'Estamos analizando la zona de tu hogar' },
];

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
    store_lat: number;
    store_lon: number;
};

type SearchResults = {
    products: ProductResult[];
    stores_searched: number;
    cache_hit: boolean;
    search_latency_ms: number;
    filtered_out_count?: number;
};

export default function NearbyProductFinder() {
    const { t } = useTranslation();
    const [location, setLocation] = useState<{ lat: number; lon: number } | null>(null);
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<SearchResults | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [locationDenied, setLocationDenied] = useState(false);
    const [searchMessageIndex, setSearchMessageIndex] = useState(0);

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
        setSearchMessageIndex(0);
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

    const loadingMessages = LOADER_MESSAGES.map(message => t(message.key, message.fallback));

    useEffect(() => {
        if (!loading) {
            setSearchMessageIndex(0);
            return;
        }

        const interval = window.setInterval(() => {
            setSearchMessageIndex(prev => (prev + 1) % LOADER_MESSAGES.length);
        }, 3500);

        return () => window.clearInterval(interval);
    }, [loading]);

    return (
        <div className="relative space-y-8 overflow-hidden">
            {/* Header */}
            <div className="space-y-2">
                <p className="text-xs uppercase tracking-[0.4em] text-slate-500">
                    {t('productSearch.badge', 'Explorador Local')}
                </p>
                <h2 className="text-3xl font-semibold tracking-tight text-slate-900">
                    {t('productSearch.title', 'Encuentra productos cercanos')}
                </h2>
                <p className="text-base text-slate-600">
                    {t('productSearch.subtitle', 'Busca opciones saludables en tiendas a tu alrededor.')}
                </p>
            </div>

            {/* Geolocation Request */}
            {!location && (
                <div className="rounded-3xl border border-white/60 bg-white/80 p-8 text-center shadow-xl shadow-emerald-100">
                    <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                        <MapPin className="h-8 w-8" />
                    </div>
                    <h3 className="text-xl font-semibold text-slate-900">
                        {t('productSearch.locationRequired', 'Necesitamos tu ubicación')}
                    </h3>
                    <p className="mt-2 text-slate-500">
                        {t('productSearch.locationDescription', 'Para mostrarte productos disponibles cerca de ti, necesitamos acceder a tu ubicación actual.')}
                    </p>
                    <button
                        onClick={requestLocation}
                        className="mt-6 inline-flex items-center gap-2 rounded-full bg-slate-900 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-slate-900/20 transition hover:bg-slate-800 hover:-translate-y-0.5"
                    >
                        <Navigation className="h-4 w-4" />
                        {t('productSearch.enableLocation', 'Activar ubicación')}
                    </button>
                    {locationDenied && (
                        <p className="mt-4 text-sm text-rose-500">
                            {t('productSearch.locationDeniedHelp', 'Por favor, habilita la ubicación en la configuración de tu navegador.')}
                        </p>
                    )}
                </div>
            )}

            {/* Search Input */}
            {location && (
                <div className="relative flex items-center gap-3 rounded-3xl border border-white/60 bg-white/80 p-2 shadow-lg shadow-emerald-100/50">
                    <div className="flex-1 px-4">
                        <input
                            type="text"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                            placeholder={t('productSearch.searchPlaceholder', 'Ej: Leche de almendras, Tofu, Manzanas...')}
                            className="w-full bg-transparent text-lg text-slate-900 placeholder:text-slate-400 focus:outline-none"
                        />
                    </div>
                    <button
                        onClick={handleSearch}
                        disabled={loading}
                        className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-emerald-600 text-white shadow-md transition hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Search className="h-5 w-5" />}
                    </button>
                </div>
            )}

            {/* Error Message */}
            {error && (
                <div className="flex items-center gap-3 rounded-2xl border border-rose-100 bg-rose-50/50 p-4 text-rose-700">
                    <AlertCircle className="h-5 w-5 shrink-0" />
                    <p className="text-sm font-medium">{error}</p>
                </div>
            )}

            {/* Loading State */}
            {loading && (
                <div className="py-12 text-center">
                    <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-slate-200 border-t-emerald-500" />
                    <p className="mt-4 text-sm font-medium text-slate-500 animate-pulse">
                        {loadingMessages[searchMessageIndex]}
                    </p>
                </div>
            )}

            {/* Results */}
            {results && !loading && (
                <div className="space-y-6">
                    <div className="flex items-center justify-between px-2">
                        <h3 className="text-lg font-semibold text-slate-900">
                            {t('productSearch.resultsFound', { count: results.products.length, defaultValue: `${results.products.length} resultados encontrados` })}
                        </h3>
                        <div className="flex items-center gap-3 text-xs font-medium text-slate-500">
                            {results.cache_hit && (
                                <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-1 text-amber-700">
                                    <Tag className="h-3 w-3" />
                                    {t('productSearch.cached', 'Cache')}
                                </span>
                            )}
                            <span className="rounded-full bg-slate-100 px-2 py-1">
                                {results.stores_searched} {t('productSearch.storesSearched', 'tiendas')}
                            </span>
                            {results.filtered_out_count ? (
                                <span className="rounded-full bg-rose-50 px-2 py-1 text-rose-600">
                                    {t('productSearch.filteredOut', {
                                        count: results.filtered_out_count,
                                        defaultValue: `${results.filtered_out_count} filtrados por tus preferencias`
                                    })}
                                </span>
                            ) : null}
                        </div>
                    </div>

                    {results.products.length === 0 ? (
                        <div className="rounded-3xl border border-dashed border-slate-300 p-12 text-center">
                            <ShoppingBag className="mx-auto h-12 w-12 text-slate-300" />
                            <p className="mt-4 text-slate-500">
                                {t('productSearch.noResults', 'No encontramos productos que coincidan con tu búsqueda en esta zona.')}
                            </p>
                            {results.filtered_out_count ? (
                                <p className="mt-2 text-sm text-rose-500">
                                    {t('productSearch.filteredOutHint', {
                                        count: results.filtered_out_count,
                                        defaultValue: `Omitimos ${results.filtered_out_count} opciones que no son aptas para tus preferencias.`
                                    })}
                                </p>
                            ) : null}
                        </div>
                    ) : (
                        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
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

// Product Card Component
function ProductCard({ product }: { product: ProductResult }) {
    const { t } = useTranslation();

    const discount = product.price_regular
        ? Math.round(((product.price_regular - product.price_current) / product.price_regular) * 100)
        : 0;

    return (
        <article className="group relative flex flex-col overflow-hidden rounded-3xl border border-white/60 bg-white/80 shadow-sm transition hover:shadow-xl hover:shadow-emerald-100/50">
            {/* Product Image */}
            <div className="relative aspect-square bg-slate-50 p-6">
                {product.image_url ? (
                    <Image
                        src={product.image_url}
                        alt={product.product_name}
                        fill
                        className="object-contain transition group-hover:scale-105"
                    />
                ) : (
                    <div className="flex h-full w-full items-center justify-center text-slate-300">
                        <ShoppingBag className="h-12 w-12" />
                    </div>
                )}
                {discount > 0 && (
                    <span className="absolute left-4 top-4 rounded-full bg-rose-500 px-2 py-1 text-xs font-bold text-white shadow-sm">
                        -{discount}%
                    </span>
                )}
            </div>

            {/* Product Info */}
            <div className="flex flex-1 flex-col p-5">
                <div className="mb-2">
                    {product.brand && (
                        <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                            {product.brand}
                        </p>
                    )}
                    <h4 className="mt-1 font-medium text-slate-900 line-clamp-2">
                        {product.product_name}
                    </h4>
                </div>

                {/* Nutritional Claims */}
                {product.nutritional_claims && product.nutritional_claims.length > 0 && (
                    <div className="mb-4 flex flex-wrap gap-1.5">
                        {product.nutritional_claims.slice(0, 3).map((claim, i) => (
                            <span
                                key={i}
                                className="inline-flex items-center rounded-md bg-emerald-50 px-2 py-1 text-[10px] font-medium text-emerald-700"
                            >
                                {claim}
                            </span>
                        ))}
                    </div>
                )}

                <div className="mt-auto pt-4 border-t border-slate-100">
                    <div className="flex items-end justify-between">
                        <div>
                            <div className="flex items-baseline gap-2">
                                <span className="text-xl font-bold text-slate-900">
                                    ${product.price_current.toFixed(2)}
                                </span>
                                {product.price_regular && (
                                    <span className="text-xs text-slate-400 line-through">
                                        ${product.price_regular.toFixed(2)}
                                    </span>
                                )}
                            </div>
                            <div className="mt-1 flex items-center gap-1 text-xs text-slate-500">
                                <MapPin className="h-3 w-3" />
                                <span className="font-medium">{product.store_brand || product.store_name}</span>
                                <span>·</span>
                                <span>{Math.round(product.distance_meters)}m</span>
                            </div>
                        </div>
                        <a
                            href={`https://www.google.com/maps/dir/?api=1&destination=${product.store_lat},${product.store_lon}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-600 transition hover:bg-emerald-100 hover:text-emerald-700"
                            title={t('productSearch.directions', 'Cómo llegar')}
                        >
                            <Navigation className="h-4 w-4" />
                        </a>
                    </div>
                </div>
            </div>
        </article>
    );
}
