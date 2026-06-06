-- Verify: insforge on pg

BEGIN;

SELECT 1 FROM information_schema.schemata WHERE schema_name = 'auth';
SELECT 1 FROM information_schema.tables
WHERE table_schema = 'auth' AND table_name = 'users';
SELECT 1 FROM information_schema.routines
WHERE routine_schema = 'auth' AND routine_name = 'uid';
SELECT 1 FROM information_schema.routines
WHERE routine_schema = 'auth' AND routine_name = 'email';
SELECT 1 FROM information_schema.routines
WHERE routine_schema = 'auth' AND routine_name = 'role';
SELECT 1 FROM information_schema.routines
WHERE routine_schema = 'public' AND routine_name = 'create_default_policies';

ROLLBACK;
