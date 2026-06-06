# InsForge Test Suite

<p align="center" width="100%">
  <a href="https://github.com/constructive-io/insforge-test-suite/actions/workflows/ci.yml">
    <img height="20" src="https://github.com/constructive-io/insforge-test-suite/actions/workflows/ci.yml/badge.svg" />
  </a>
   <a href="https://github.com/constructive-io/insforge-test-suite/blob/main/LICENSE"><img height="20" src="https://img.shields.io/badge/license-MIT-blue.svg"/></a>
</p>

A friendly playground for building and validating InsForge Row-Level Security (RLS). It includes real-world examples, migrations, and a comprehensive test suite you can run locally.

Built with [`insforge-test`](https://www.npmjs.com/package/insforge-test) — an InsForge-optimized version of [`pgsql-test`](https://www.npmjs.com/package/pgsql-test) for instant, isolated Postgres test databases with automatic rollbacks and InsForge defaults.

## Features

- 🔐 **RLS Policy Testing** - Real-world examples with pets table and user-scoped access
- 🧪 **Comprehensive Test Suite** - End-to-end tests against InsForge auth schema
- 🐘 **InsForge Docker Stack** - Uses `ghcr.io/insforge/postgres` for native InsForge environment
- ⚡ **Jest Integration** - Fast, isolated tests with automatic rollbacks
- 🚀 **CI/CD Ready** - GitHub Actions workflows with InsForge Docker services
- 🧩 **Modular Architecture** - Reusable pgpm schema packages you can extend

## Quick Start

```bash
# Start InsForge Postgres via Docker
docker compose up -d

# Install dependencies
pnpm install

# Run tests in watch mode
cd packages/hello-world
pnpm test:watch
```

## Repository Structure

This is a pgpm workspace combining `pnpm` and `pgpm` for modular Postgres packages:

- **`packages/insforge`** - InsForge base schema: auth functions, users table, auto-RLS event triggers
- **`packages/hello-world`** - Demo extension showcasing RLS with pets table

## InsForge Roles

InsForge uses three built-in PostgreSQL roles:

| Role | Description | Use Case |
|------|-------------|----------|
| `anon` | Unauthenticated users | Public read access |
| `authenticated` | Logged-in users | Standard user operations |
| `project_admin` | System administrators | Full access to all resources |

These roles are mapped in `pgpm.json` and used by `insforge-test` for RLS testing.

## Testing

Run tests in different modes:

```bash
# Run all tests from root
pnpm test

# Watch mode for specific package
cd packages/hello-world
pnpm test:watch
```

## Docker Setup

### Using Docker Compose (recommended)

```bash
docker compose up -d
```

This starts the InsForge Postgres image (`ghcr.io/insforge/postgres:v15.13.2`) on port 5432.

### Using Docker directly

```bash
docker run -d \
  --name insforge-postgres \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=insforge \
  -p 5432:5432 \
  ghcr.io/insforge/postgres:v15.13.2
```

## Requirements

- Node.js 20+
- pnpm 10+
- Docker (for running InsForge Postgres)

## Troubleshooting

If you encounter connection issues, set your environment variables:

```bash
export PGPORT=5432
export PGHOST=localhost
export PGUSER=postgres
export PGPASSWORD=postgres
```

Common issues:
- Ensure InsForge Postgres container is running (`docker compose ps`)
- Check that port 5432 is available and not used by another Postgres instance
- Use Node.js 20+ to avoid compatibility issues

## Education and Tutorials

 1. 🚀 [Quickstart: Getting Up and Running](https://constructive.io/learn/quickstart)
Get started with modular databases in minutes. Install prerequisites and deploy your first module.

 2. 📦 [Modular PostgreSQL Development with Database Packages](https://constructive.io/learn/modular-postgres)
Learn to organize PostgreSQL projects with pgpm workspaces and reusable database modules.

 3. ✏️ [Authoring Database Changes](https://constructive.io/learn/authoring-database-changes)
Master the workflow for adding, organizing, and managing database changes with pgpm.

 4. 🧪 [End-to-End PostgreSQL Testing with TypeScript](https://constructive.io/learn/e2e-postgres-testing)
Master end-to-end PostgreSQL testing with ephemeral databases, RLS testing, and CI/CD automation.

## Credits

**🛠 Built by the [Constructive](https://constructive.io) team — creators of modular Postgres tooling for secure, composable backends. If you like our work, contribute on [GitHub](https://github.com/constructive-io).**

## Disclaimer

AS DESCRIBED IN THE LICENSES, THE SOFTWARE IS PROVIDED "AS IS", AT YOUR OWN RISK, AND WITHOUT WARRANTIES OF ANY KIND.

No developer or entity involved in creating this software will be liable for any claims or damages whatsoever associated with your use, inability to use, or your interaction with other users of the code, including any direct, indirect, incidental, special, exemplary, punitive or consequential damages, or loss of profits, cryptocurrencies, tokens, or anything else of value.
