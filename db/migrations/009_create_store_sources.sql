-- Migration 009: Store Scraping Sources
-- Objetivo: registrar fuentes alternativas (Instagram, webs, RSS, planillas) para comercios consentidos

CREATE TABLE IF NOT EXISTS store_sources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID NOT NULL REFERENCES nearby_stores(id) ON DELETE CASCADE,
    source_type TEXT NOT NULL CHECK (source_type IN ('brand_api','instagram','website','rss','sheet','custom')),
    source_identifier TEXT,
    config JSONB NOT NULL DEFAULT '{}'::jsonb,
    active BOOLEAN NOT NULL DEFAULT true,
    priority INTEGER NOT NULL DEFAULT 10,
    last_run_at TIMESTAMPTZ,
    last_status TEXT,
    last_error TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_store_sources_store ON store_sources(store_id);
CREATE INDEX IF NOT EXISTS idx_store_sources_active ON store_sources(store_id, active) WHERE active = true;
CREATE INDEX IF NOT EXISTS idx_store_sources_type ON store_sources(source_type);

ALTER TABLE store_sources ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read store sources"
    ON store_sources FOR SELECT
    USING (true);

CREATE POLICY "Service manage store sources"
    ON store_sources FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

CREATE OR REPLACE FUNCTION trigger_set_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_timestamp_store_sources ON store_sources;
CREATE TRIGGER set_timestamp_store_sources
BEFORE UPDATE ON store_sources
FOR EACH ROW
EXECUTE FUNCTION trigger_set_timestamp();
