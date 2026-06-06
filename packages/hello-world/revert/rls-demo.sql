-- Revert: rls-demo from pg

BEGIN;

DROP TRIGGER IF EXISTS update_pets_updated_at ON rls_test.pets;
DROP FUNCTION IF EXISTS rls_test.update_updated_at_column();
DROP INDEX IF EXISTS rls_test.idx_pets_user_id;
DROP POLICY IF EXISTS "Users can delete own data" ON rls_test.pets;
DROP POLICY IF EXISTS "Users can insert own data" ON rls_test.pets;
DROP POLICY IF EXISTS "Users can update own data" ON rls_test.pets;
DROP POLICY IF EXISTS "Users can view own data" ON rls_test.pets;
DROP TABLE IF EXISTS rls_test.pets;
DROP SCHEMA IF EXISTS rls_test;

COMMIT;
