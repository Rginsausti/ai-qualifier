-- Migration 008: Hyperlocal Product Scraping System
-- Purpose: Enable discovery and caching of nearby supermarket products

-- Enable PostGIS extension for geospatial queries
CREATE EXTENSION IF NOT EXISTS earthdistance CASCADE;

-- Stores discovered via OpenStreetMap
CREATE TABLE IF NOT EXISTS nearby_stores (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    osm_id BIGINT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    brand TEXT, -- Normalized: COTO, CARREFOUR, JUMBO, VEA, DISCO
    store_type TEXT NOT NULL, -- supermarket, convenience, health_food
    latitude DECIMAL(10, 7) NOT NULL,
    longitude DECIMAL(10, 7) NOT NULL,
    address TEXT,
    website_url TEXT,
    scraping_enabled BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Geospatial index for proximity queries
CREATE INDEX idx_nearby_stores_location ON nearby_stores USING GIST (
    ll_to_earth(latitude, longitude)
);

-- Index for brand filtering
CREATE INDEX idx_nearby_stores_brand ON nearby_stores(brand) WHERE brand IS NOT NULL;

-- Scraped products cache (daily refresh)
CREATE TABLE IF NOT EXISTS scraped_products (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    store_id UUID NOT NULL REFERENCES nearby_stores(id) ON DELETE CASCADE,
    product_name TEXT NOT NULL,
    brand TEXT,
    price_current DECIMAL(10, 2) NOT NULL,
    price_regular DECIMAL(10, 2),
    unit TEXT, -- kg, g, L, ml, units
    quantity DECIMAL,
    nutritional_claims TEXT[], -- ['Sin TACC', 'Alto en Proteínas', 'Bajo Sodio']
    nutrition_info JSONB, -- { calories, protein, carbs, fats, sodium }
    image_url TEXT,
    product_url TEXT,
    in_stock BOOLEAN DEFAULT true,
    scraped_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for efficient queries
CREATE INDEX idx_scraped_products_store ON scraped_products(store_id);
CREATE INDEX idx_scraped_products_name ON scraped_products USING GIN (to_tsvector('spanish', product_name));
CREATE INDEX idx_scraped_products_brand ON scraped_products(brand) WHERE brand IS NOT NULL;
CREATE INDEX idx_scraped_products_date ON scraped_products(scraped_at DESC);
CREATE INDEX idx_scraped_products_price ON scraped_products(price_current);

-- User search cache (geohash-based for ~1.2km precision)
CREATE TABLE IF NOT EXISTS product_search_cache (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    geohash TEXT NOT NULL, -- 6-character geohash
    query TEXT NOT NULL,
    results JSONB NOT NULL, -- Aggregated product results
    result_count INTEGER DEFAULT 0,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(geohash, query)
);

-- Index for cache lookup
CREATE INDEX idx_search_cache_lookup ON product_search_cache(geohash, query, expires_at);
CREATE INDEX idx_search_cache_expiry ON product_search_cache(expires_at) WHERE expires_at > NOW();

-- Scraping job tracking (for monitoring and retry logic)
CREATE TABLE IF NOT EXISTS scraping_jobs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    store_id UUID NOT NULL REFERENCES nearby_stores(id) ON DELETE CASCADE,
    search_query TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending', -- pending, running, completed, failed
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    products_found INTEGER DEFAULT 0,
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_scraping_jobs_status ON scraping_jobs(status, created_at DESC);
CREATE INDEX idx_scraping_jobs_store ON scraping_jobs(store_id, created_at DESC);

-- Enable Row Level Security
ALTER TABLE nearby_stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE scraped_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_search_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE scraping_jobs ENABLE ROW LEVEL SECURITY;

-- Public read access to stores (discovery is public)
CREATE POLICY "Public read stores" 
ON nearby_stores FOR SELECT 
USING (true);

-- Public read access to products
CREATE POLICY "Public read products" 
ON scraped_products FOR SELECT 
USING (true);

-- Public read access to cache
CREATE POLICY "Public read cache" 
ON product_search_cache FOR SELECT 
USING (true);

-- Only service role can manage scraping jobs
CREATE POLICY "Service role manages jobs" 
ON scraping_jobs 
USING (auth.role() = 'service_role');

-- Function to clean expired cache
CREATE OR REPLACE FUNCTION clean_expired_cache()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
    DELETE FROM product_search_cache WHERE expires_at < NOW();
END;
$$;

-- Function to calculate distance between two points (in meters)
CREATE OR REPLACE FUNCTION calculate_distance(
    lat1 DECIMAL,
    lon1 DECIMAL,
    lat2 DECIMAL,
    lon2 DECIMAL
)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN CAST(earth_distance(
        ll_to_earth(lat1, lon1),
        ll_to_earth(lat2, lon2)
    ) AS INTEGER);
END;
$$;
