/**
 * Regenerate the committed, materialized ("ejected") vendor modules under
 * `portability/materialized/packages`.
 *
 * The apply proxies under `portability/packages` are the *recipe*; the plain
 * modules in `portability/materialized/packages` are their committed *output* —
 * ordinary pgpm modules with the transforms baked into the SQL (no
 * `pgpm.apply.json`, no deploy-time apply). Every transform is derived from the
 * `insforge` vendor shape, not hand-written routing, so the ejected modules
 * stay a query away from the shape declaration.
 *
 * Materialization is deterministic: identical source + spec always produce a
 * byte-identical bundle, which is what lets `materialized-drift.test.ts` re-run
 * this and assert the committed output has not drifted.
 *
 * Regenerate the committed output with:
 *
 *   pnpm --filter @pgpm/portability-tests exec ts-node src/materialize-fixtures.ts
 */
import { materializeApplyModule, parseApplySpec } from '@pgpmjs/core';
import {
  fromVendorProfile,
  insforge,
  ProviderBinding,
  toVendorProfile
} from '@pgpmjs/portability';
import { readFileSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';

/** The generic provider that substitutes InsForge's managed auth subsystem. */
const provider: ProviderBinding = {
  schema: 'app_auth',
  users: 'users',
  accessors: { uid: 'current_user_id' }
};

// package root: portability/packages/portability-tests
const packageRoot = join(__dirname, '..');
export const portabilityRoot = join(packageRoot, '..', '..');
export const vendorAppDir = join(portabilityRoot, 'packages', 'vendor-app');
export const committedRoot = join(portabilityRoot, 'materialized', 'packages');

export const FORWARD_MODULE = 'vendor-app-materialized';
export const REVERSE_MODULE = 'vendor-app-native-materialized';

// InsForge shape → pgpm shape: exclude the auth subsystem, rebind survivors
// onto the generic provider. InsForge has no extensions schema, so no
// de-qualification pass runs.
const forwardSpec = () =>
  parseApplySpec(
    JSON.stringify({
      source: 'vendor-app',
      name: FORWARD_MODULE,
      ...fromVendorProfile(insforge, provider),
      requires: ['auth-provider']
    }),
    '/spec/pgpm.apply.json'
  );

// pgpm shape → InsForge shape: the inverse binding, routing the provider's
// objects back onto InsForge's native `auth` subsystem.
const reverseSpec = () =>
  parseApplySpec(
    JSON.stringify({
      source: FORWARD_MODULE,
      name: REVERSE_MODULE,
      ...toVendorProfile(insforge, provider),
      requires: []
    }),
    '/spec/pgpm.apply.json'
  );

/**
 * Declare a module dependency in the ejected module's `.control` `requires`.
 *
 * The apply spec's `requires` names the transpiled output's runtime deps (the
 * generic provider), but `materializeApplyModule` does not yet fold them into
 * the emitted control — so a plainly-deployed ejected module would not pull its
 * provider. Recording it here keeps the ejected module self-contained: `pgpm
 * deploy vendor-app-materialized` resolves and deploys `auth-provider` first,
 * exactly as `seed.apply` does for the proxy. Deterministic and idempotent, so
 * the drift check stays byte-stable.
 */
function rewriteControlRequires(
  moduleDir: string,
  moduleName: string,
  rewrite: (deps: string[]) => string[]
): void {
  const controlPath = join(moduleDir, `${moduleName}.control`);
  const content = readFileSync(controlPath, 'utf-8');
  const updated = content.replace(
    /^(\s*requires\s*=\s*')([^']*)(')/m,
    (_m, prefix: string, list: string, suffix: string) => {
      const parts = list
        .split(',')
        .map(p => p.trim())
        .filter(Boolean);
      return `${prefix}${rewrite(parts).join(', ')}${suffix}`;
    }
  );
  writeFileSync(controlPath, updated);
}

export async function materializeForward(outRoot: string): Promise<string> {
  const outDir = join(outRoot, FORWARD_MODULE);
  rmSync(outDir, { recursive: true, force: true });
  await materializeApplyModule({ sourceDir: vendorAppDir, spec: forwardSpec(), outDir });
  // Self-contained forward module: declare the generic provider it now targets.
  rewriteControlRequires(outDir, FORWARD_MODULE, deps =>
    deps.includes('auth-provider') ? deps : [...deps, 'auth-provider']
  );
  return outDir;
}

export async function materializeReverse(
  outRoot: string,
  forwardDir: string
): Promise<string> {
  const outDir = join(outRoot, REVERSE_MODULE);
  rmSync(outDir, { recursive: true, force: true });
  await materializeApplyModule({ sourceDir: forwardDir, spec: reverseSpec(), outDir });
  // The reverse module targets InsForge's *native* `auth` subsystem (the
  // `insforge` module, deployed alongside — not part of this workspace), so it
  // must not inherit the forward source's `auth-provider` requirement.
  rewriteControlRequires(outDir, REVERSE_MODULE, deps =>
    deps.filter(d => d !== 'auth-provider')
  );
  return outDir;
}

export async function materializeAll(
  outRoot: string
): Promise<{ forward: string; reverse: string }> {
  const forward = await materializeForward(outRoot);
  const reverse = await materializeReverse(outRoot, forward);
  return { forward, reverse };
}

if (require.main === module) {
  materializeAll(committedRoot)
    .then(r => {
      // eslint-disable-next-line no-console
      console.log(`materialized:\n  ${r.forward}\n  ${r.reverse}`);
    })
    .catch(err => {
      // eslint-disable-next-line no-console
      console.error(err);
      process.exit(1);
    });
}
