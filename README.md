# Trespass

> GitHub repository security scanner — find hardcoded secrets, vulnerable dependencies, SAST issues, and LLM prompt injection vectors in your repos.

Trespass connects to your GitHub account, downloads repository content via the GitHub API, and runs four analysis layers:

1. **Secrets detection** — regex + entropy patterns for API keys, tokens, PEM keys, and common credential prefixes
2. **Dependency auditing** — queries [OSV.dev](https://osv.dev) for known CVEs in `package.json` and `requirements.txt`
3. **SAST patterns** — SQL injection, `eval()`, command injection, XSS vectors, weak cryptography, and LLM prompt injection patterns
4. **LLM review** _(optional)_ — sends flagged code snippets to your own model (OpenAI, Anthropic, or Google) for enriched findings and remediation advice

Findings are persisted per scan and exposed through a dark-themed UI with per-severity breakdown and expandable code snippets.

## Features

- GitHub OAuth login (Better-Auth)
- AES-256-GCM encrypted storage for GitHub PATs and LLM API keys
- Fire-and-forget background scan — no blocking on the HTTP request
- Per-scan finding history with status tracking (`queued → running → done | error | cancelled`)
- Terminal-style progress panel during scans — real-time step tracking (dependency audit → file tree → code scan → LLM review) with counts and status icons
- Dashboard shows a "View →" link during active scans — navigate to the live progress screen without waiting for the scan to finish
- Stop Scan button on the results page — cancels any queued or running scan immediately; the scanner checks for cancellation between phases to stop promptly
- Re-scan button on results page — starts a new scan for the same repo and navigates to the fresh result
- Open GitHub Issue directly from any finding — pre-fills title, severity, snippet, and remediation
- LLM review degrades gracefully: if no API key is configured, the scan still runs the three static layers
- Semantic versioning badge in the UI footer

## Tech stack

- **Frontend**: Nuxt 4 · Vue 3 · shadcn-vue · Tailwind CSS v4
- **Backend**: Hono · Node.js
- **Database**: PostgreSQL (tested on [Neon](https://neon.tech)) · Drizzle ORM
- **Auth**: Better-Auth with GitHub OAuth
- **Monorepo**: pnpm workspaces · Turborepo
- **Linting**: Biome (ultracite ruleset)

## Prerequisites

- Node.js 22+
- pnpm 11+
- PostgreSQL 15+ (or a Neon connection string)
- A GitHub OAuth App (Client ID + Secret)

## Installation

```bash
git clone <repo>
cd trespass
pnpm install
```

Copy and fill in the environment files:

```bash
cp apps/server/.env.example apps/server/.env
cp apps/web/.env.example apps/web/.env
```

> **Note:** `apps/web/.env` must contain the same server variables as `apps/server/.env`.
> This is because `apps/web/server/middleware/api.ts` embeds the Hono app inside Nuxt's
> Nitro server. Both files must be kept in sync.

Push the database schema:

```bash
pnpm db:push
```

Start the development servers:

```bash
pnpm dev
```

- Frontend: http://localhost:3001
- API: http://localhost:3000

## Configuration

### `apps/server/.env`

| Variable | Description | Required |
|---|---|---|
| `DATABASE_URL` | PostgreSQL connection string | Yes |
| `BETTER_AUTH_SECRET` | 32+ character secret for session signing | Yes |
| `BETTER_AUTH_URL` | Public URL of the API server | Yes |
| `GITHUB_CLIENT_ID` | GitHub OAuth App client ID | Yes |
| `GITHUB_CLIENT_SECRET` | GitHub OAuth App client secret | Yes |
| `SECRET_ENCRYPTION_KEY` | 64-character hex key for AES-256-GCM | Yes |

Generate a `SECRET_ENCRYPTION_KEY`:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### `apps/web/.env`

| Variable | Description | Required |
|---|---|---|
| `NUXT_PUBLIC_SERVER_URL` | Public URL of the API server | Yes |
| `DATABASE_URL` | PostgreSQL connection string | Yes |
| `BETTER_AUTH_SECRET` | 32+ character secret for session signing | Yes |
| `BETTER_AUTH_URL` | Public URL of the API server | Yes |
| `CORS_ORIGIN` | Allowed CORS origin (frontend URL) | Yes |
| `GITHUB_CLIENT_ID` | GitHub OAuth App client ID | Yes |
| `GITHUB_CLIENT_SECRET` | GitHub OAuth App client secret | Yes |
| `SECRET_ENCRYPTION_KEY` | 64-character hex key for AES-256-GCM | Yes |

> These server variables are required because the Hono API is embedded inside Nuxt via
> `server/middleware/api.ts`. Keep them in sync with `apps/server/.env`.

### Creating a GitHub OAuth App

Go to **GitHub → Settings → Developer settings → OAuth Apps → New OAuth App**:

- **Homepage URL**: `http://localhost:3001`
- **Authorization callback URL**: `http://localhost:3000/api/auth/callback/github`

## Project structure

```
trespass/
├── apps/
│   ├── web/              # Nuxt 4 frontend
│   └── server/           # Hono API
│       └── src/
│           ├── routes/   # repos, scans, secrets
│           ├── services/
│           │   └── scanner/  # scan engine layers
│           └── middleware/
├── packages/
│   ├── auth/             # Better-Auth configuration
│   ├── crypto/           # AES-256-GCM encrypt/decrypt
│   ├── db/               # Drizzle schema + migrations
│   ├── env/              # Validated env vars (Zod)
│   └── github/           # Octokit wrapper
└── tests/                # Vitest suite — unit, integration, functional, security, smoke
```

## Scripts

| Command | Description |
|---|---|
| `pnpm dev` | Start all apps in watch mode |
| `pnpm build` | Build all apps |
| `pnpm check-types` | TypeScript type check across all packages |
| `pnpm db:push` | Push schema to database (no migration files) |
| `pnpm db:generate` | Generate Drizzle migration files |
| `pnpm db:migrate` | Run pending migrations |
| `pnpm db:studio` | Open Drizzle Studio |
| `pnpm test` | Run full test suite |
| `pnpm check` | Biome lint + format check |
| `pnpm fix` | Biome lint + format autofix |

## Tests

```bash
pnpm test          # run all 108 tests across the suite
```

Tests run automatically on every pull request and push to main via GitHub Actions. No database required — all external I/O is mocked.

## Local PostgreSQL (Docker)

```bash
docker compose up -d
# DATABASE_URL=postgresql://postgres:password@localhost:5432/postgres
```

