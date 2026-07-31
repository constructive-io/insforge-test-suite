-- Deploy schemas/auth/tables/users/table to pg

-- requires: schemas/auth/schema

BEGIN;

CREATE TABLE auth.users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  encrypted_password text,
  confirmation_token text,
  recovery_token text
);

COMMIT;
