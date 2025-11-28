-- Migration 010: Infraestructura de notificaciones push
-- Crea tablas para suscripciones, eventos y preferencias básicas por usuario

CREATE TABLE IF NOT EXISTS user_settings (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    locale TEXT,
    water_interval_minutes INTEGER NOT NULL DEFAULT 120,
    hydration_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    meals_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    day_end_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    nearby_search_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    preferred_meal_times JSONB NOT NULL DEFAULT '["08:30","13:00","20:00"]'::jsonb,
    day_end_hour INTEGER NOT NULL DEFAULT 21,
    timezone TEXT DEFAULT 'America/Buenos_Aires',
    last_water_ping_at TIMESTAMPTZ,
    last_meal_ping_at TIMESTAMPTZ,
    last_day_end_ping_at TIMESTAMPTZ,
    last_nearby_alert_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS push_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    endpoint TEXT NOT NULL UNIQUE,
    subscription_json JSONB NOT NULL,
    p256dh TEXT NOT NULL,
    auth TEXT NOT NULL,
    locale TEXT,
    channels JSONB NOT NULL DEFAULT '{"water":true,"meals":true,"dayEnd":true,"nearbySearch":true}'::jsonb,
    last_seen_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS notification_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    subscription_id UUID REFERENCES push_subscriptions(id) ON DELETE SET NULL,
    type TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    payload JSONB,
    error TEXT,
    dedupe_key TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user ON push_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_notification_events_user ON notification_events(user_id);
CREATE INDEX IF NOT EXISTS idx_notification_events_type ON notification_events(type);
CREATE INDEX IF NOT EXISTS idx_notification_events_dedupe ON notification_events(dedupe_key);

ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own settings"
    ON user_settings FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Service manage settings"
    ON user_settings FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Service manage push subscriptions"
    ON push_subscriptions FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Service manage notification events"
    ON notification_events FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

DROP TRIGGER IF EXISTS set_timestamp_user_settings ON user_settings;
CREATE TRIGGER set_timestamp_user_settings
BEFORE UPDATE ON user_settings
FOR EACH ROW
EXECUTE FUNCTION trigger_set_timestamp();

DROP TRIGGER IF EXISTS set_timestamp_push_subscriptions ON push_subscriptions;
CREATE TRIGGER set_timestamp_push_subscriptions
BEFORE UPDATE ON push_subscriptions
FOR EACH ROW
EXECUTE FUNCTION trigger_set_timestamp();

DROP TRIGGER IF EXISTS set_timestamp_notification_events ON notification_events;
CREATE TRIGGER set_timestamp_notification_events
BEFORE UPDATE ON notification_events
FOR EACH ROW
EXECUTE FUNCTION trigger_set_timestamp();
