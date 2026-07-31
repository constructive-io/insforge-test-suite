# Materialized (ejected) vendor modules

These are the **committed output** of the apply proxies under `../packages`.

An apply proxy (`pgpm.apply.json` + the `insforge` vendor shape) is a *recipe*:
it transforms a source module into a new shape at deploy time. Running
`pgpm materialize` / `materializeApplyModule` on that recipe **ejects** the
result into an ordinary pgpm module — plain `deploy/ revert/ verify/ pgpm.plan /
*.control`, with every transform already baked into the SQL and no
`pgpm.apply.json`. Once ejected, it deploys like any hand-written module.

Both directions are ejected here:

| Module | Direction | What it proves |
|---|---|---|
| `packages/vendor-app-materialized` | InsForge shape → pgpm shape | auth subsystem excluded; FK + RLS rebound onto the generic `app_auth` provider (declared in its control `requires`); `gen_random_uuid()` stays unqualified (InsForge has no extensions schema) |
| `packages/vendor-app-native-materialized` | pgpm shape → InsForge shape | references routed back onto the native `auth.users` / `auth.uid()`; deploys on top of the `insforge` subsystem module |

## Regenerating

The modules are generated (and their `requires` finalized) by the committed
recipe in the test package:

```bash
cd ../packages/portability-tests
pnpm exec ts-node src/materialize-fixtures.ts
```

Materialization is deterministic, so `__tests__/materialized-drift.test.ts` is
the drift gate: it re-materializes into a temp dir and asserts byte-identical
output against what is committed here. If a source module, the vendor shape, or
the transform engine changes the emitted SQL, that test fails until these
artifacts are regenerated and reviewed.

They are deployed and exercised on plain PostgreSQL as ordinary modules by
`__tests__/materialized-forward.test.ts` and
`__tests__/materialized-reverse.test.ts`.
