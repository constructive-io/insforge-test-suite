import { materializeApplyModule, parseApplySpec } from '@pgpmjs/core';
import { fromVendorProfile, insforge, ProviderBinding, toVendorProfile } from '@pgpmjs/portability';
import { rmSync } from 'fs';
import { join } from 'path';

const packagesDir = join(__dirname, '..', '..');
const sourceDir = join(packagesDir, 'vendor-app');

// The generic provider that substitutes InsForge's managed auth subsystem.
const provider: ProviderBinding = {
  schema: 'app_auth',
  users: 'users',
  accessors: { uid: 'current_user_id' },
  roles: { authenticated: 'app_authenticated' }
};

// The full transpile spec is derived from the InsForge vendor shape — not
// hand-written routing JSON. This is the whole point: InsForge is a data
// declaration (@pgpmjs/portability's `insforge` shape), and moving a package
// off it is `fromVendorProfile(insforge, provider)`.
const portedSpec = () =>
  parseApplySpec(
    JSON.stringify({
      source: 'vendor-app',
      name: 'vendor-app-ported',
      ...fromVendorProfile(insforge, provider),
      requires: ['auth-provider']
    }),
    '/spec/pgpm.apply.json'
  );

describe('InsForge shape → pgpm shape (subsystem substitution)', () => {
  it('drops the auth subsystem, rebinds survivors, translates roles — no extensions transform', async () => {
    const { bundle, outDir } = await materializeApplyModule({
      sourceDir,
      spec: portedSpec()
    });
    try {
      // the excluded subsystem's changes are dropped from the artifact entirely
      expect(
        bundle.changes.find(c => c.name === 'schemas/auth/tables/users/table')
      ).toBeUndefined();
      expect(
        bundle.changes.find(c => c.name === 'schemas/auth/procedures/uid')
      ).toBeUndefined();
      expect(bundle.plan).not.toMatch(/schemas\/auth\//);

      const documents = bundle.changes.find(
        c => c.name === 'schemas/app/tables/documents/table'
      )!;
      // FK rebound onto the provider's users table
      expect(documents.deploy!.sql).toMatch(/REFERENCES app_auth\.users/i);
      expect(documents.deploy!.sql).not.toMatch(/(?<!app_)auth\.users/);
      // InsForge has no extensions schema — gen_random_uuid() is core and
      // survives untouched (no de-qualification pass runs)
      expect(documents.deploy!.sql).toMatch(/DEFAULT gen_random_uuid\(\)/i);
      // roles translated
      expect(documents.deploy!.sql).toMatch(/TO app_authenticated/i);
      expect(documents.deploy!.sql).not.toMatch(/\bauthenticated\b/);

      // RLS predicate rebound onto the provider accessor
      const policy = bundle.changes.find(
        c => c.name === 'schemas/app/policies/documents_owner'
      )!;
      expect(policy.deploy!.sql).toMatch(/app_auth\.current_user_id\s*\(\)/i);
      expect(policy.deploy!.sql).not.toMatch(/auth\.uid/);
    } finally {
      rmSync(outDir, { recursive: true, force: true });
    }
  });

  it('refuses the exclusion when a surviving reference has no substitute', async () => {
    // a provider that binds only the users table — the surviving auth.uid()
    // call site has nothing to rebind onto, so exclusion must fail closed
    const spec = parseApplySpec(
      JSON.stringify({
        source: 'vendor-app',
        name: 'vendor-app-ported',
        ...fromVendorProfile(insforge, { schema: 'app_auth', users: 'users' })
      }),
      '/spec/pgpm.apply.json'
    );
    await expect(materializeApplyModule({ sourceDir, spec })).rejects.toThrow(
      /auth\.uid.*no route\/rebind target/s
    );
  });
});

describe('pgpm shape → InsForge shape (reverse direction)', () => {
  it('routes provider objects back onto the native auth subsystem', async () => {
    const ported = await materializeApplyModule({ sourceDir, spec: portedSpec() });
    try {
      const reverse = parseApplySpec(
        JSON.stringify({
          source: 'vendor-app-ported',
          name: 'vendor-app-roundtrip',
          ...toVendorProfile(insforge, provider)
        }),
        '/spec/pgpm.apply.json'
      );
      const roundtrip = await materializeApplyModule({
        sourceDir: ported.outDir,
        spec: reverse
      });
      try {
        const documents = roundtrip.bundle.changes.find(
          c => c.name === 'schemas/app/tables/documents/table'
        )!;
        expect(documents.deploy!.sql).toMatch(/REFERENCES auth\.users/i);
        expect(documents.deploy!.sql).toMatch(/TO authenticated/i);
        expect(documents.deploy!.sql).not.toMatch(/app_auth\./);
        expect(documents.deploy!.sql).not.toMatch(/\bapp_authenticated\b/);
        // still no extensions qualification — InsForge has none
        expect(documents.deploy!.sql).toMatch(/DEFAULT gen_random_uuid\(\)/i);
        expect(documents.deploy!.sql).not.toMatch(/extensions\./);

        const policy = roundtrip.bundle.changes.find(
          c => c.name === 'schemas/app/policies/documents_owner'
        )!;
        expect(policy.deploy!.sql).toMatch(/auth\.uid\s*\(\)/i);
        expect(policy.deploy!.sql).not.toMatch(/current_user_id/);
      } finally {
        rmSync(roundtrip.outDir, { recursive: true, force: true });
      }
    } finally {
      rmSync(ported.outDir, { recursive: true, force: true });
    }
  });
});
