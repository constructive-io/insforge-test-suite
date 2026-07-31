-- Deploy schemas/app/tables/documents/table to pg

-- requires: schemas/app/schema
-- requires: schemas/auth/tables/users/table

BEGIN;

CREATE TABLE app.documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner uuid NOT NULL,
  title text NOT NULL
);

ALTER TABLE app.documents
  ADD CONSTRAINT documents_owner_fkey
  FOREIGN KEY (owner) REFERENCES auth.users (id);

GRANT SELECT, INSERT ON TABLE app.documents TO authenticated;

COMMIT;
