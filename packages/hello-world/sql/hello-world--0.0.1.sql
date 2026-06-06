\echo Use "CREATE EXTENSION hello-world" to load this file. \quit
CREATE SCHEMA IF NOT EXISTS rls_test;

CREATE TABLE IF NOT EXISTS rls_test.pets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    breed TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE rls_test.pets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own data" ON rls_test.pets
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own data" ON rls_test.pets
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own data" ON rls_test.pets
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own data" ON rls_test.pets
    FOR DELETE USING (auth.uid() = user_id);

GRANT USAGE ON SCHEMA rls_test TO anon;
GRANT ALL ON rls_test.pets TO anon;

GRANT USAGE ON SCHEMA rls_test TO authenticated;
GRANT ALL ON rls_test.pets TO authenticated;

GRANT USAGE ON SCHEMA rls_test TO project_admin;
GRANT ALL ON rls_test.pets TO project_admin;

CREATE INDEX IF NOT EXISTS idx_pets_user_id ON rls_test.pets(user_id);

CREATE FUNCTION rls_test.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_pets_updated_at
    BEFORE UPDATE ON rls_test.pets
    FOR EACH ROW
    EXECUTE FUNCTION rls_test.update_updated_at_column();
