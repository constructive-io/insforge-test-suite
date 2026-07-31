# Portability

This folder is **not** part of the InsForge RLS tutorial in `packages/` — it's a
self-contained demonstration of **cross-shape transpilation**: taking a database
package written against InsForge's conventions and mechanically re-shaping it for
another environment, the way npm lets you import a package under whatever name
fits your project.

It is the InsForge counterpart of the same proof in `supabase-test-suite`, and
its whole point is that **InsForge is just a data declaration** — the `insforge`
`VendorShape` in [`@pgpmjs/portability`](https://www.npmjs.com/package/@pgpmjs/portability) —
not bespoke code. Every transform is driven by that shape via
`fromVendorProfile(insforge, provider)` / `toVendorProfile(insforge, provider)`.

It exercises the pgpm apply/transform toolchain (`@pgpmjs/core`, `@pgpmjs/slice`,
`@pgpmjs/transform`) end-to-end, in **both directions**:

| Direction | What happens |
|-----------|--------------|
| InsForge shape → pgpm shape | The package's `auth` subsystem is **excluded** wholesale; every surviving reference (the FK onto `auth.users`, the `auth.uid()` RLS call sites) is **rebound** onto a tiny generic provider module deployed as an ordinary dependency; grants are translated to local role names. Unlike Supabase there is **no extensions schema** — `gen_random_uuid()` is core, so no de-qualification pass runs. |
| pgpm shape → InsForge shape | The same transforms inverted: provider objects rebound onto InsForge's native `auth` subsystem, roles translated back. InsForge's subsystem is itself a pgpm module (repo-root `packages/insforge`), so this deploys on plain PostgreSQL too — no provider needed, the native subsystem satisfies the contract. |

## Layout

```
portability/
├── pgpm.json             # pgpm workspace for the fixture modules
└── packages/
    ├── vendor-app/       # InsForge-shaped module: auth subsystem + consumer app
    ├── auth-provider/    # generic replacement provider (users table + accessor)
    ├── vendor-app-ported/# apply spec: exclude auth, rebind onto the provider
    └── portability-tests/# the test suites
```

## The substitution contract

Subsystem exclusion is **cascade-safe**: `excludeSubsystem` measures the external
surface of the excluded schema from the reference graph and refuses unless every
surviving reference has a substitute. `contract.test.ts` measures the fixture and
shows the entire external contract of its `auth` subsystem is just:

- one `users` table (a uuid PK, referenced by a foreign key), and
- the `auth.uid()` claim accessor with a live call site.

A provider satisfying that tiny surface is a drop-in substitute — and that
provider binding is exactly what the `insforge` shape produces.

## Test suites

- `transpile.test.ts` — pure transforms, both directions, plus the refusal path,
  all driven by `fromVendorProfile`/`toVendorProfile(insforge, …)`
- `contract.test.ts` — contract measurement on the fixture's auth subsystem
- `deploy-ported.test.ts` — pgpm-shaped output deployed live via
  `@pgpmjs/portability`'s `seed.apply(...)`: FK enforcement and RLS through the
  provider accessor (runs on any plain PostgreSQL)
- `deploy-vendor.test.ts` — pgpm-shaped output transpiled back onto InsForge's
  native subsystem (the `insforge` module) and deployed on top of it (plain
  PostgreSQL)

All four suites run on plain PostgreSQL in `portability.yml`. The main tutorial
workflow (`ci.yml`) is untouched.
