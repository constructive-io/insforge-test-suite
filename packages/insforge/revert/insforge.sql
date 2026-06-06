-- Revert: insforge from pg

BEGIN;

DROP EVENT TRIGGER IF EXISTS create_policies_on_rls_enable;
DROP EVENT TRIGGER IF EXISTS create_policies_on_table_create;
DROP FUNCTION IF EXISTS public.create_policies_after_rls();
DROP FUNCTION IF EXISTS public.create_default_policies();
REVOKE ALL ON auth.users FROM project_admin;
REVOKE ALL ON auth.users FROM authenticated;
REVOKE USAGE ON SCHEMA auth FROM project_admin;
REVOKE USAGE ON SCHEMA auth FROM authenticated;
DROP TABLE IF EXISTS auth.users;
DROP FUNCTION IF EXISTS auth.uid();
DROP FUNCTION IF EXISTS auth.email();
DROP FUNCTION IF EXISTS auth.role();
DROP SCHEMA IF EXISTS auth;

COMMIT;
