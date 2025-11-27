-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS cube;
CREATE EXTENSION IF NOT EXISTS earthdistance;

-- Create nearby_stores table
CREATE TABLE IF NOT EXISTS public.nearby_stores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    osm_id BIGINT UNIQUE NOT NULL,
    name TEXT,
    brand TEXT,
    lat REAL,
    lon REAL,
    address JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Enable RLS
ALTER TABLE public.nearby_stores ENABLE ROW LEVEL SECURITY;

-- Policies for nearby_stores
DROP POLICY IF EXISTS "Allow public read access" ON public.nearby_stores;
CREATE POLICY "Allow public read access" ON public.nearby_stores
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow insert for authenticated users" ON public.nearby_stores;
CREATE POLICY "Allow insert for authenticated users" ON public.nearby_stores
    FOR INSERT TO authenticated WITH CHECK (true);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_nearby_stores_osm_id ON public.nearby_stores(osm_id);
CREATE INDEX IF NOT EXISTS idx_nearby_stores_location ON public.nearby_stores USING gist (ll_to_earth(lat, lon));
