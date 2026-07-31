import {
  generateCreateBaseRolesSQL,
  generateGrantRoleSQL,
  materializeApplyModule,
  parseApplySpec,
  PgpmPackage,
  readApplySpec
} from '@pgpmjs/core';
import { getEnvOptions } from '@pgpmjs/env';
import { insforge, ProviderBinding, toVendorProfile } from '@pgpmjs/portability';
import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { getConnections, PgTestClient, seed } from 'pgsql-test';

// The reverse direction: a pgpm-shaped (ported) module transpiled back onto
// InsForge's native auth subsystem. InsForge's subsystem is itself a pgpm module
// (repo-root `packages/insforge` — the auth schema, `auth.users`, `auth.uid()`),
// so the round-trip is proven on plain PostgreSQL by deploying that module as
// the native subsystem, then the reverse-transpiled app on top of it.
const packagesDir = join(__dirname, '..', '..');
const repoRoot = join(packagesDir, '..', '..');
const vendorAppDir = join(packagesDir, 'vendor-app');
const portedSpecDir = join(packagesDir, 'vendor-app-ported');

const roles = {
  anonymous: 'anon',
  authenticated: 'authenticated',
  administrator: 'project_admin',
  default: 'anon'
};

const provider: ProviderBinding = {
  schema: 'app_auth',
  users: 'users',
  accessors: { uid: 'current_user_id' }
};

let pg: PgTestClient;
let teardown: () => Promise<void>;

const cleanup: string[] = [];

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

    // source → pgpm shape → back onto the InsForge shape, then deploy on top of
    // the native subsystem. The reverse profile is derived from the vendor shape.
    seed.fn(async ({ config }) => {
      const ported = await materializeApplyModule({
        sourceDir: vendorAppDir,
        spec: readApplySpec(portedSpecDir)
      });
      cleanup.push(ported.outDir);

      const reverse = parseApplySpec(
        JSON.stringify({
          source: 'vendor-app-ported',
          name: 'vendor-app-native',
          schemas: { app: 'ported_app' },
          ...toVendorProfile(insforge, provider),
          requires: []
        }),
        '/spec/pgpm.apply.json'
      );

      const wsRoot = mkdtempSync(join(tmpdir(), 'pgpm-native-ws-'));
      cleanup.push(wsRoot);
      writeFileSync(
        join(wsRoot, 'pgpm.json'),
        JSON.stringify({ packages: ['packages/*'] })
      );
      await materializeApplyModule({
        sourceDir: ported.outDir,
        spec: reverse,
        outDir: join(wsRoot, 'packages', 'vendor-app-native')
      });

      await new PgpmPackage(wsRoot).deploy(
        getEnvOptions({ pg: config, deployment: { fast: true, usePlan: true } }),
        'vendor-app-native'
      );
    })
  ]));
});

afterAll(async () => {
  for (const dir of cleanup) rmSync(dir, { recursive: true, force: true });
  await teardown();
});

beforeEach(async () => {
  await pg.beforeEach();
});

afterEach(async () => {
  await pg.afterEach();
});

describe('pgpm-shaped module transpiled back onto the InsForge subsystem', () => {
  it('the native auth subsystem is present', async () => {
    const res = await pg.any(
      `SELECT 1 FROM information_schema.tables WHERE table_schema = 'auth' AND table_name = 'users'`
    );
    expect(res.length).toBe(1);
  });

  it('rebinds the FK onto the native users table', async () => {
    const fk = await pg.any(`
      SELECT n.nspname || '.' || c.relname AS target
      FROM pg_constraint con
      JOIN pg_class c ON c.oid = con.confrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE con.conname = 'documents_owner_fkey'
    `);
    expect(fk[0].target).toBe('auth.users');
  });

  it('rebinds the RLS predicate onto the native accessor', async () => {
    const policy = await pg.any(`
      SELECT pg_get_expr(polqual, polrelid) AS predicate
      FROM pg_policy
      WHERE polname = 'documents_owner'
    `);
    expect(policy[0].predicate).toMatch(/\buid\(\)/);
    expect(policy[0].predicate).not.toMatch(/current_user_id/);
  });
});
