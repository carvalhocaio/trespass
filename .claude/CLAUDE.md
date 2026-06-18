# Trespass — TypeScript Monorepo Standards

This project is a GitHub repository security scanner. The Hono API receives scan requests, runs multi-layer static analysis (secrets, deps, SAST, optional LLM review) against a GitHub repository via the GitHub API, and persists findings to PostgreSQL.

Apply these standards whenever you write or review code in this project.

## Tooling

- Package manager: `pnpm` — never use `npm install` directly
- Linter + formatter: `ultracite` (Biome ruleset) — `pnpm check` / `pnpm fix`
- Type checker: `tsc` — `pnpm check-types`
- Line length: **80 characters** (configured in `biome.json`)

Run before considering any file done:

```bash
pnpm check && pnpm check-types
```

## Layer architecture

```
apps/server/src/
├── routes/        ← Hono routes — HTTP parsing and response only
├── services/
│   └── scanner/   ← scan engine layers (secrets, deps, sast, llm)
└── middleware/    ← auth, error mapping
packages/
├── db/            ← Drizzle schema, migrations, createDb()
├── crypto/        ← AES-256-GCM encrypt/decrypt
├── github/        ← Octokit wrapper (file tree, content, manifests)
├── auth/          ← Better-Auth configuration
└── env/           ← Zod-validated env vars
```

Rules:
- `routes/` contains no business logic — delegates to `services/`
- `services/` is HTTP-agnostic — no `Request`/`Response` imports from Hono
- `packages/github/` isolates all GitHub API I/O — scanner never uses Octokit directly
- `HTTPException` never leaves `routes/`

## Zod / TypeScript types

- All public API boundaries validate input with `zod`
- Prefer `interface` for public contracts, `type` for aliases and unions
- `strict: true` always — never use `any`; use `unknown` and narrow explicitly

## Database (Drizzle ORM)

- Always call `createDb()` per-request — never a module-level singleton
- Use `eq`, `and`, `desc` from `drizzle-orm` — never raw SQL strings
- Schema lives in `packages/db/src/schema/app.ts` — push with `pnpm db:push`
- Always `limit(1)` on single-row queries; destructure: `const [row] = await db...`

## Async

- I/O-bound functions are `async` — DB, external HTTP, file reads
- Always `async/await` — never callbacks or nested `.then()`
- Use `Promise.all` for independent parallel operations
- Never mix blocking synchronous code inside `async` without justification

## Error handling

- Create domain error classes per module (`class TargetTimeoutError extends Error`)
- Never `catch (e) {}` — at minimum re-throw or log
- Map domain errors to HTTP status codes only in the route layer
- `HTTPException` never leaves `routes/`

## Testing

- Use `vitest` for unit tests — follow existing test conventions
- Mock external I/O (HTTP, DB) — never make real network calls in unit tests
- Tests live in `tests/` mirroring `src/` structure
