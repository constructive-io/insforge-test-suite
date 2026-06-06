-- Verify: rls-demo on pg

BEGIN;

SELECT 1 FROM information_schema.schemata WHERE schema_name = 'rls_test';
SELECT 1 FROM information_schema.tables
WHERE table_schema = 'rls_test' AND table_name = 'pets';
SELECT 1 FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'rls_test'
AND c.relname = 'pets'
AND c.relrowsecurity = true;

ROLLBACK;
