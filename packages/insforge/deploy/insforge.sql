-- Deploy: insforge to pg
-- made with <3 @ constructive.io

-- =============================================================
-- InsForge base schema
-- Bootstraps roles, auth schema, auth functions, and auto-RLS
-- event triggers matching InsForge's db-init.sql + app server.
-- =============================================================

-- -----------------------------------------------------------
-- Auth schema
-- -----------------------------------------------------------
CREATE SCHEMA IF NOT EXISTS auth;

-- -----------------------------------------------------------
-- Auth functions (used in RLS policies)
-- -----------------------------------------------------------

CREATE FUNCTION auth.uid() RETURNS uuid
    LANGUAGE sql STABLE
    AS $$
  SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;

CREATE FUNCTION auth.email() RETURNS text
    LANGUAGE sql STABLE
    AS $$
  SELECT NULLIF(current_setting('request.jwt.claim.email', true), '')::text;
$$;

CREATE FUNCTION auth.role() RETURNS text
    LANGUAGE sql STABLE
    AS $$
  SELECT NULLIF(current_setting('request.jwt.claim.role', true), '')::text;
$$;

-- -----------------------------------------------------------
-- Auth users table (minimal, matches InsForge auth.users)
-- -----------------------------------------------------------
CREATE TABLE auth.users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE,
    password_hash TEXT,
    name TEXT,
    email_verified BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- -----------------------------------------------------------
-- Grants: public schema access for all roles
-- -----------------------------------------------------------
GRANT USAGE ON SCHEMA public TO anon;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon;

GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;

GRANT USAGE ON SCHEMA public TO project_admin;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO project_admin;

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO anon, authenticated, project_admin;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO anon, authenticated, project_admin;

-- -----------------------------------------------------------
-- Grants: auth schema access (read for authenticated, full for admin)
-- -----------------------------------------------------------
GRANT USAGE ON SCHEMA auth TO authenticated;
GRANT USAGE ON SCHEMA auth TO project_admin;
GRANT SELECT ON auth.users TO authenticated;
GRANT ALL ON auth.users TO project_admin;
GRANT EXECUTE ON FUNCTION auth.uid() TO anon, authenticated, project_admin;
GRANT EXECUTE ON FUNCTION auth.email() TO anon, authenticated, project_admin;
GRANT EXECUTE ON FUNCTION auth.role() TO anon, authenticated, project_admin;

-- -----------------------------------------------------------
-- Auto-RLS: event trigger to create project_admin policy
-- when RLS is enabled on new tables (from InsForge db-init.sql)
-- -----------------------------------------------------------

CREATE FUNCTION public.create_default_policies()
RETURNS event_trigger AS $$
DECLARE
  obj record;
  table_schema text;
  table_name text;
  has_rls boolean;
BEGIN
  FOR obj IN SELECT * FROM pg_event_trigger_ddl_commands() WHERE command_tag = 'CREATE TABLE'
  LOOP
    SELECT INTO table_schema, table_name
      split_part(obj.object_identity, '.', 1),
      trim(both '"' from split_part(obj.object_identity, '.', 2));

    SELECT INTO has_rls
      rowsecurity
    FROM pg_tables
    WHERE schemaname = table_schema
    AND tablename = table_name;

    IF has_rls THEN
      EXECUTE format(
        'CREATE POLICY "project_admin_policy" ON %s FOR ALL TO project_admin USING (true) WITH CHECK (true)',
        obj.object_identity
      );
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

CREATE EVENT TRIGGER create_policies_on_table_create
  ON ddl_command_end
  WHEN TAG IN ('CREATE TABLE')
  EXECUTE FUNCTION public.create_default_policies();

-- Auto-RLS: event trigger for ALTER TABLE (RLS enabled after creation)
CREATE FUNCTION public.create_policies_after_rls()
RETURNS event_trigger AS $$
DECLARE
  obj record;
  table_schema text;
  table_name text;
BEGIN
  FOR obj IN SELECT * FROM pg_event_trigger_ddl_commands() WHERE command_tag = 'ALTER TABLE'
  LOOP
    SELECT INTO table_schema, table_name
      split_part(obj.object_identity, '.', 1),
      trim(both '"' from split_part(obj.object_identity, '.', 2));

    IF EXISTS (
      SELECT 1 FROM pg_tables
      WHERE schemaname = table_schema
      AND tablename = table_name
      AND rowsecurity = true
    ) AND NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = table_schema
      AND tablename = table_name
    ) THEN
      EXECUTE format(
        'CREATE POLICY "project_admin_policy" ON %s FOR ALL TO project_admin USING (true) WITH CHECK (true)',
        obj.object_identity
      );
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

CREATE EVENT TRIGGER create_policies_on_rls_enable
  ON ddl_command_end
  WHEN TAG IN ('ALTER TABLE')
  EXECUTE FUNCTION public.create_policies_after_rls();
