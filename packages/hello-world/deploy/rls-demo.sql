-- Deploy: rls-demo to pg
-- made with <3 @ constructive.io

-- Create rls_test schema
CREATE SCHEMA IF NOT EXISTS rls_test;

-- Create pets table
CREATE TABLE IF NOT EXISTS rls_test.pets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- owner reference to auth.users
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    -- pet details
    name TEXT NOT NULL,
    breed TEXT NOT NULL,

    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS on pets table
ALTER TABLE rls_test.pets ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
-- Users can view their own data
CREATE POLICY "Users can view own data" ON rls_test.pets
    FOR SELECT USING (auth.uid() = user_id);

-- Users can update their own data
CREATE POLICY "Users can update own data" ON rls_test.pets
    FOR UPDATE USING (auth.uid() = user_id);

-- Users can insert their own data
CREATE POLICY "Users can insert own data" ON rls_test.pets
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can delete their own data
CREATE POLICY "Users can delete own data" ON rls_test.pets
    FOR DELETE USING (auth.uid() = user_id);

-- Grant permissions to anon users
GRANT USAGE ON SCHEMA rls_test TO anon;
GRANT ALL ON rls_test.pets TO anon;

-- Grant permissions to authenticated users
GRANT USAGE ON SCHEMA rls_test TO authenticated;
GRANT ALL ON rls_test.pets TO authenticated;

-- Grant permissions to project_admin (for admin operations)
GRANT USAGE ON SCHEMA rls_test TO project_admin;
GRANT ALL ON rls_test.pets TO project_admin;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_pets_user_id ON rls_test.pets(user_id);

-- Create updated_at trigger function
CREATE FUNCTION rls_test.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updated_at
CREATE TRIGGER update_pets_updated_at
    BEFORE UPDATE ON rls_test.pets
    FOR EACH ROW
    EXECUTE FUNCTION rls_test.update_updated_at_column();
