# InsForge Test Suite

<p align="center" width="100%">
  <a href="https://github.com/constructive-io/insforge-test-suite/actions/workflows/ci.yml">
    <img height="20" src="https://github.com/constructive-io/insforge-test-suite/actions/workflows/ci.yml/badge.svg" />
  </a>
   <a href="https://github.com/constructive-io/insforge-test-suite/blob/main/LICENSE"><img height="20" src="https://img.shields.io/badge/license-MIT-blue.svg"/></a>
</p>

A friendly playground for building and validating InsForge Row-Level Security (RLS). It includes real-world examples, migrations, and a comprehensive test suite you can run locally.

Built with [`insforge-test`](https://www.npmjs.com/package/insforge-test) — an InsForge-optimized version of [`pgsql-test`](https://www.npmjs.com/package/pgsql-test) for instant, isolated Postgres test databases with automatic rollbacks and InsForge defaults.

## Developing

```sh
docker-compose up -d
pnpm install
make roles
cd packages/hello-world
pnpm test:watch
```

> **Note:** Unlike Supabase (where `supabase start` pre-creates roles), the InsForge Docker image is vanilla Postgres. `make roles` runs `pgpm admin-users bootstrap` to create the `anon`, `authenticated`, and `project_admin` NOLOGIN roles before seeding test users.

## InsForge Roles

InsForge uses three built-in PostgreSQL roles:

| Role | Description | Use Case |
|------|-------------|----------|
| `anon` | Unauthenticated users | Public read access |
| `authenticated` | Logged-in users | Standard user operations |
| `project_admin` | System administrators | Full access to all resources |

These roles are mapped in `pgpm.json` and used by `insforge-test` for RLS testing.

## Credits

**Built by [Constructive](https://constructive.io) — creators of modular Postgres tooling for secure, composable backends. If you like our work, contribute on [GitHub](https://github.com/constructive-io).**

## Disclaimer

AS DESCRIBED IN THE LICENSES, THE SOFTWARE IS PROVIDED "AS IS", AT YOUR OWN RISK, AND WITHOUT WARRANTIES OF ANY KIND.

No developer or entity involved in creating this software will be liable for any claims or damages whatsoever associated with your use, inability to use, or your interaction with other users of the code, including any direct, indirect, incidental, special, exemplary, punitive or consequential damages, or loss of profits, cryptocurrencies, tokens, or anything else of value.
