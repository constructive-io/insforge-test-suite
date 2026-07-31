import { generateCreateBaseRolesSQL, generateGrantRoleSQL, PgpmPackage } from '@pgpmjs/core';
import { getEnvOptions } from '@pgpmjs/env';
import { join } from 'path';
import { getConnections, PgTestClient, seed } from 'pgsql-test';

import { portabilityRoot, REVERSE_MODULE } from '../src/materialize-fixtures';

// Reverse direction, deployed from the COMMITTED ejected module. The pgpm-shaped
// app was materialized back onto InsForge's native `auth` subsystem: the
// committed SQL in `vendor-app-native-materialized` references `auth.users` /
// `auth.uid()` directly. The native subsystem is itself a pgpm module
// (repo-root `packages/insforge`), so the round-trip is proven on plain
// PostgreSQL by deploying that module, then the committed reverse app on top.
const repoRoot = join(portabilityRoot, '..');

const roles = {
  anonymous: 'anon',
  authenticated: 'authenticated',
  administrator: 'project_admin',
  default: 'anon'
};

let pg: PgTestClient;
let teardown: () => Promise<void>;

beforeAll(async () => {
  ({ pg, teardown } = await getConnections({ db: { roles } }, [
    seed.fn(async ({ pg, connect }) => {
      await pg.any(generateCreateBaseRolesSQL(connect.roles));
      const appUser = connect.connections.app.user;
      for (const role of [
        connect.roles.anonymous,
        connect.roles.authenticated,
        connect.roles.administrator
      ]) {
        await pg.any(generateGrantRoleSQL(role, appUser));
      }
    }),

    // Deploy InsForge's native auth subsystem (its own pgpm module).
    seed.fn(async ({ config }) => {
      await new PgpmPackage(repoRoot).deploy(
        getEnvOptions({ pg: config, deployment: { fast: true, usePlan: true } }),
        'insforge'
      );
    }),

    // Deploy the committed reverse module as a plain pgpm module on top.
    seed.fn(async ({ config }) => {
      await new PgpmPackage(portabilityRoot).deploy(
        getEnvOptions({ pg: config, deployment: { fast: true, usePlan: true } }),
        REVERSE_MODULE
      );
    })
  ]));
});

afterAll(async () => {
  await teardown();
});

beforeEach(async () => {
  await pg.beforeEach();
});

afterEach(async () => {
  await pg.afterEach();
});

describe('committed reverse (pgpm → InsForge) module on plain PostgreSQL', () => {
  it('the native auth subsystem is present', async () => {
    const res = await pg.any(
      `SELECT 1 FROM information_schema.tables WHERE table_schema = 'auth' AND table_name = 'users'`
    );
    expect(res.length).toBe(1);
  });

  it('the FK is baked onto the native users table', async () => {
    const fk = await pg.any(`
      SELECT n.nspname || '.' || c.relname AS target
      FROM pg_constraint con
      JOIN pg_class c ON c.oid = con.confrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE con.conname = 'documents_owner_fkey'
    `);
    expect(fk[0].target).toBe('auth.users');
  });

  it('the RLS predicate is baked onto the native accessor', async () => {
    const policy = await pg.any(`
      SELECT pg_get_expr(polqual, polrelid) AS predicate
      FROM pg_policy
      WHERE polname = 'documents_owner'
    `);
    expect(policy[0].predicate).toMatch(/\buid\(\)/);
    expect(policy[0].predicate).not.toMatch(/current_user_id/);
  });
});
