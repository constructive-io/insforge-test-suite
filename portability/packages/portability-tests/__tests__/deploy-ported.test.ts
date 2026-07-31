import { generateCreateBaseRolesSQL, generateGrantRoleSQL } from '@pgpmjs/core';
import { seed as portability } from '@pgpmjs/portability';
import { getConnections, PgTestClient, seed } from 'pgsql-test';

// InsForge's application role names. The plain postgres image ships none of
// them, so the suite provisions them natively with the same generators
// `pgpm init` uses — rather than relying on the InsForge image's bootstrap.
const roles = {
  anonymous: 'anon',
  authenticated: 'authenticated',
  administrator: 'project_admin',
  default: 'anon'
};

let pg: PgTestClient;
let db: PgTestClient;
let teardown: () => Promise<void>;

let aliceId: string;

beforeAll(async () => {
  ({ pg, db, teardown } = await getConnections({ db: { roles } }, [
    // Create the InsForge roles natively and grant them to the app connection
    // role so transaction-local SET ROLE works in tests.
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

    // Deploy the apply proxy through @pgpmjs/portability's native seed adapter.
    // The workspace root is discovered automatically from the test's cwd; pgpm
    // resolves the proxy's dependencies (the generic auth-provider first) and
    // deploys the transpiled InsForge-shaped application on top — no hand-rolled
    // deploy loop, no imperative role bootstrap.
    portability.apply('vendor-app-ported'),

    seed.fn(async ({ pg }) => {
      // Narrow, application-level grants onto the generic provider's objects.
      await pg.any(`GRANT USAGE ON SCHEMA app_auth TO authenticated`);
      await pg.any(
        `GRANT EXECUTE ON FUNCTION app_auth.current_user_id() TO authenticated`
      );

      // Committed seed rows for the RLS test (per-test clients are
      // transaction-wrapped, so cross-client visibility needs committed data).
      const [alice] = await pg.any(
        `INSERT INTO app_auth.users DEFAULT VALUES RETURNING id`
      );
      const [bob] = await pg.any(
        `INSERT INTO app_auth.users DEFAULT VALUES RETURNING id`
      );
      aliceId = alice.id;
      await pg.any(
        `INSERT INTO app.documents (owner, title) VALUES ($1, 'alice doc')`,
        [alice.id]
      );
      await pg.any(
        `INSERT INTO app.documents (owner, title) VALUES ($1, 'bob doc')`,
        [bob.id]
      );
    })
  ]));
});

afterAll(async () => {
  await teardown();
});

beforeEach(async () => {
  await pg.beforeEach();
  await db.beforeEach();
});

afterEach(async () => {
  await db.afterEach();
  await pg.afterEach();
});

describe('ported InsForge package on plain PostgreSQL', () => {
  it('never deploys the excluded auth subsystem', async () => {
    const res = await pg.any(
      `SELECT 1 FROM information_schema.schemata WHERE schema_name = 'auth'`
    );
    expect(res.length).toBe(0);
  });

  it('rebinds the FK onto the provider users table', async () => {
    const [{ id }] = await pg.any(
      `INSERT INTO app_auth.users DEFAULT VALUES RETURNING id`
    );
    await pg.any(`INSERT INTO app.documents (owner, title) VALUES ($1, 'mine')`, [
      id
    ]);

    await expect(
      pg.any(
        `INSERT INTO app.documents (owner, title) VALUES (gen_random_uuid(), 'nope')`
      )
    ).rejects.toThrow(/foreign key/i);
  });

  it('enforces RLS through the provider accessor', async () => {
    db.setContext({ role: 'authenticated', 'jwt.claims.user_id': aliceId });
    const visible = await db.any(`SELECT title FROM app.documents`);
    expect(visible.map((r: { title: string }) => r.title)).toEqual(['alice doc']);
  });
});
