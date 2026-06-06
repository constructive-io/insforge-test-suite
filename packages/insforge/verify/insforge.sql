-- Verify: insforge on pg

-- Verify auth schema exists
SELECT 1 FROM information_schema.schemata WHERE schema_name = 'auth';

-- Verify auth.users table exists
SELECT 1 FROM information_schema.tables
WHERE table_schema = 'auth' AND table_name = 'users';

-- Verify auth.uid() function exists
SELECT 1 FROM information_schema.routines
WHERE routine_schema = 'auth' AND routine_name = 'uid';

-- Verify auth.email() function exists
SELECT 1 FROM information_schema.routines
WHERE routine_schema = 'auth' AND routine_name = 'email';

-- Verify auth.role() function exists
SELECT 1 FROM information_schema.routines
WHERE routine_schema = 'auth' AND routine_name = 'role';

-- Verify auto-RLS event trigger functions exist
SELECT 1 FROM information_schema.routines
WHERE routine_schema = 'public' AND routine_name = 'create_default_policies';

SELECT 1 FROM information_schema.routines
WHERE routine_schema = 'public' AND routine_name = 'create_policies_after_rls';
