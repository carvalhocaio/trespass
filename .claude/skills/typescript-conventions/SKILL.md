---
name: typescript-conventions
description: TypeScript conventions for Hono (backend) and Nuxt/Vue (frontend) — typing, async, error handling, and Drizzle ORM patterns. Auto-loaded when editing .ts/.vue files.
user-invocable: false
paths:
  - "**/*.ts"
  - "**/*.vue"
  - "!**/*.test.*"
  - "!**/*.spec.*"
---

Apply these conventions whenever you read or write TypeScript or Vue files in this project.

## Tooling

- Run `pnpm check` (Biome/ultracite) and `pnpm check-types` (tsc) before considering a file done
- Package manager is `pnpm` — never use `npm install`

## TypeScript

- `strict: true` is assumed — never use `any`; use `unknown` and narrow explicitly
- Prefer `interface` for public contracts, `type` for aliases and unions
- Shared types live in colocated `*.types.ts` or `types.ts` — never inline in routes

## Hono (backend)

- Routes contain no business logic — delegate to `services/`
- `HTTPException` never leaves `routes/` — map domain errors at the boundary only
- Always create a new `db` instance via `createDb()` per-request
- Use `eq`, `and`, `desc` from `drizzle-orm` — never raw SQL strings
- `limit(1)` on single-row queries; destructure: `const [row] = await db...`

## Nuxt / Vue (frontend)

- One component per file; PascalCase filenames (`UserCard.vue`)
- `<script setup lang="ts">` on every component — never Options API
- Composables in `composables/` with camelCase names starting with `use`
- No logic inside the template — extract to variables or computed refs
- `defineProps<{...}>()` and `defineEmits<{...}>()` with explicit TypeScript generics

## Async

- Always `async/await` — never callbacks or nested `.then()`
- Handle errors with `try/catch` — never leave unhandled promises
- Use `Promise.all` for independent parallel operations

## Error handling

- Create domain error classes per module (`class TargetTimeoutError extends Error`)
- Never `catch (e) {}` — at minimum re-throw or log
- Domain errors → HTTP codes only in route layer

## Styling (frontend)

- Tailwind CSS — no inline `style=""` when a utility class exists
- shadcn-vue components from `~/components/ui/` — never reimport from library directly
- Responsive classes follow mobile-first: `text-sm md:text-base`
