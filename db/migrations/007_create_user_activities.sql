-- Migration: Create user activity tracking tables
-- Purpose: Enable dashboard features (rituals, pantry, mindfulness, physical activity)

-- Daily rituals/habits table
CREATE TABLE IF NOT EXISTS daily_rituals (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    ritual_type TEXT NOT NULL, -- 'morning', 'lunch', 'snack', 'dinner', 'bedtime'
    completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create index for faster queries
CREATE INDEX idx_daily_rituals_user_date ON daily_rituals(user_id, DATE(completed_at));

-- Pantry/inventory items
CREATE TABLE IF NOT EXISTS pantry_items (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    item_name TEXT NOT NULL,
    category TEXT, -- 'protein', 'carbs', 'vegetables', 'fruits', 'snacks', 'beverages'
    quantity DECIMAL,
    unit TEXT, -- 'kg', 'g', 'L', 'ml', 'units'
    expiry_date DATE,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create index for pantry queries
CREATE INDEX idx_pantry_items_user ON pantry_items(user_id);
CREATE INDEX idx_pantry_items_expiry ON pantry_items(user_id, expiry_date) WHERE expiry_date IS NOT NULL;

-- Mindful moments/mood tracking
CREATE TABLE IF NOT EXISTS mindful_moments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    moment_type TEXT NOT NULL, -- 'energy', 'hunger', 'mood', 'stress'
    value TEXT NOT NULL, -- e.g., 'high', 'medium', 'low', 'happy', 'anxious'
    notes TEXT,
    location_lat DECIMAL,
    location_lng DECIMAL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create index for mindful moments
CREATE INDEX idx_mindful_moments_user_date ON mindful_moments(user_id, DATE(created_at));

-- Physical activity/walks
CREATE TABLE IF NOT EXISTS physical_activities (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    activity_type TEXT NOT NULL, -- 'walk', 'run', 'yoga', 'gym', 'other'
    duration_minutes INTEGER,
    distance_km DECIMAL,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create index for activity queries
CREATE INDEX idx_physical_activities_user_date ON physical_activities(user_id, DATE(created_at));

-- Enable Row Level Security
ALTER TABLE daily_rituals ENABLE ROW LEVEL SECURITY;
ALTER TABLE pantry_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE mindful_moments ENABLE ROW LEVEL SECURITY;
ALTER TABLE physical_activities ENABLE ROW LEVEL SECURITY;

-- RLS Policies for daily_rituals
CREATE POLICY "Users can view own rituals" 
ON daily_rituals FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own rituals" 
ON daily_rituals FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own rituals" 
ON daily_rituals FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own rituals" 
ON daily_rituals FOR DELETE 
USING (auth.uid() = user_id);

-- RLS Policies for pantry_items
CREATE POLICY "Users can view own pantry" 
ON pantry_items FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own pantry items" 
ON pantry_items FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own pantry items" 
ON pantry_items FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own pantry items" 
ON pantry_items FOR DELETE 
USING (auth.uid() = user_id);

-- RLS Policies for mindful_moments
CREATE POLICY "Users can view own moments" 
ON mindful_moments FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own moments" 
ON mindful_moments FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own moments" 
ON mindful_moments FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own moments" 
ON mindful_moments FOR DELETE 
USING (auth.uid() = user_id);

-- RLS Policies for physical_activities
CREATE POLICY "Users can view own activities" 
ON physical_activities FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own activities" 
ON physical_activities FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own activities" 
ON physical_activities FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own activities" 
ON physical_activities FOR DELETE 
USING (auth.uid() = user_id);
