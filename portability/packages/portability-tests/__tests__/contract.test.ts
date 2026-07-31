import { fromVendorProfile, insforge } from '@pgpmjs/portability';
import { excludeSubsystem } from '@pgpmjs/slice';
import { buildSchemaRouter, loadModule } from '@pgpmjs/transform';
import { readFileSync } from 'fs';
import { join } from 'path';

// The InsForge-shaped source package, flattened in deploy order. Its `auth`
// subsystem is what a consumer moving off InsForge must substitute.
const deployDir = join(__dirname, '..', '..', 'vendor-app', 'deploy');
const fixtureSql = [
  'schemas/auth/schema',
  'schemas/auth/tables/users/table',
  'schemas/auth/procedures/uid',
  'schemas/app/schema',
  'schemas/app/tables/documents/table',
  'schemas/app/policies/documents_owner'
]
  .map(name => readFileSync(join(deployDir, `${name}.sql`), 'utf8'))
  .join('\n');

beforeAll(async () => {
  await loadModule();
});

describe('measured contract of the InsForge auth subsystem', () => {
  it('the external surface is exactly the users FK target and the uid accessor', () => {
    const { contract } = excludeSubsystem(fixtureSql, { schemas: ['auth'] });
    const required = new Map(contract.required.map(r => [r.object.name, r]));

    // the users table is referenced across the boundary via a foreign key
    expect(required.has('users')).toBe(true);
    expect(required.get('users')!.fk).toBe(true);

    // auth.uid() is called from the surviving RLS policy
    expect(required.has('uid')).toBe(true);

    // nothing else crosses the boundary
    for (const name of required.keys()) {
      expect(['users', 'uid']).toContain(name);
    }
  });

  it('a substitution derived from the InsForge shape satisfies every surviving reference', () => {
    const rebinds = buildSchemaRouter({
      routes: fromVendorProfile(insforge, {
        schema: 'app_auth',
        users: 'users',
        accessors: { uid: 'current_user_id' }
      }).route!
    });
    const { unsatisfied } = excludeSubsystem(fixtureSql, { schemas: ['auth'] }, { rebinds });
    expect(unsatisfied).toEqual([]);
  });

  it('without a substitution the exclusion is refused with named diagnostics', () => {
    const { unsatisfied } = excludeSubsystem(fixtureSql, { schemas: ['auth'] });
    const names = new Set(unsatisfied.map(u => u.object.name));
    expect(names.has('users')).toBe(true);
    expect(names.has('uid')).toBe(true);
  });
});
