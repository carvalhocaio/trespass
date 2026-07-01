import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import vue from "@vitejs/plugin-vue";
import { defineConfig } from "vitest/config";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..");

const serverSrc = resolve(repoRoot, "apps/server/src");
const webApp = resolve(repoRoot, "apps/web/app");

const NODE_TEST_ENV = {
  DATABASE_URL: "postgresql://test:test@localhost:5432/test",
  BETTER_AUTH_SECRET: "test-secret-exactly-32-chars-123",
  BETTER_AUTH_URL: "http://localhost:3000",
  CORS_ORIGIN: "http://localhost:3001",
  GITHUB_CLIENT_ID: "test-client-id",
  GITHUB_CLIENT_SECRET: "test-client-secret",
  SECRET_ENCRYPTION_KEY: "a".repeat(64),
  NODE_ENV: "test",
};

const coverage = {
  provider: "v8" as const,
  all: true,
  reporter: ["text", "html", "lcov"],
  reportsDirectory: resolve(__dirname, "coverage"),
  include: [
    "apps/server/src/**/*.ts",
    "apps/web/app/**/*.{ts,vue}",
    "apps/web/server/**/*.ts",
    "packages/*/src/**/*.ts",
  ],
  exclude: [
    // Type-only / no executable logic
    "**/*.d.ts",
    "apps/server/src/types.ts",
    // Drizzle schema definitions (table shapes, no logic)
    "packages/db/src/schema/**",
    // Pure I/O wiring, no branching: DB pool + Better-Auth config + pino
    // logger instance. Exercised end-to-end, not unit-tested.
    "packages/db/src/index.ts",
    "packages/auth/src/index.ts",
    "apps/server/src/lib/logger.ts",
    // Vendored shadcn/ui components (third-party)
    "apps/web/app/components/ui/**",
    // Config & generated
    "**/*.config.{ts,js,mjs}",
    "**/.nuxt/**",
    "**/dist/**",
    "**/*.bench.ts",
    // Co-located package tests (crypto keeps its own test file)
    "**/*.test.ts",
  ],
  thresholds: {
    lines: 100,
    functions: 100,
    branches: 100,
    statements: 100,
  },
};

export default defineConfig({
  // Single Vite root at the repo root so coverage `include` globs resolve
  // against it; test globs below are written repo-relative to match.
  root: repoRoot,
  resolve: {
    alias: {
      "@server": serverSrc,
      "@web": webApp,
    },
  },
  test: {
    coverage,
    projects: [
      {
        // Backend (Hono) + shared packages — plain Node runtime.
        resolve: { alias: { "@server": serverSrc, "@web": webApp } },
        test: {
          name: "node",
          globals: true,
          environment: "node",
          root: repoRoot,
          include: [
            "tests/unit/**/*.test.ts",
            "tests/integration/**/*.test.ts",
            "tests/functional/**/*.test.ts",
            "tests/security/**/*.test.ts",
            "tests/smoke/**/*.test.ts",
            "tests/regression/**/*.test.ts",
            // Co-located package unit tests (e.g. crypto).
            "packages/**/src/**/*.test.ts",
          ],
          env: NODE_TEST_ENV,
        },
      },
      {
        // Frontend (Nuxt 4 / Vue 3) — DOM runtime for component/composable tests.
        plugins: [
          vue(),
          {
            // Vite `define` can't rewrite `import.meta.client` (import.meta is
            // handled specially), so map Nuxt's build-time client flag to a
            // toggleable global here — lets tests reach both client and SSR
            // branches.
            name: "nuxt-import-meta-client",
            enforce: "pre" as const,
            transform(code: string, id: string) {
              if (
                id.includes("/apps/web/") &&
                code.includes("import.meta.client")
              ) {
                return {
                  code: code.replace(
                    /import\.meta\.client/g,
                    "globalThis.__NUXT_CLIENT__"
                  ),
                  map: null,
                };
              }
            },
          },
        ],
        resolve: {
          alias: {
            "@server": serverSrc,
            "@web": webApp,
            // vue-sonner is an apps/web dependency, unresolvable from here — use
            // a local recording stub so composables that import it are testable.
            "vue-sonner": resolve(__dirname, "web/stubs/vue-sonner.ts"),
          },
        },
        // Skip the app's tsconfig lookup — it references generated .nuxt/ files
        // that don't exist outside a Nuxt build.
        esbuild: { tsconfigRaw: "{}" },
        test: {
          name: "web",
          globals: true,
          environment: "happy-dom",
          root: repoRoot,
          include: ["tests/web/**/*.test.ts"],
          setupFiles: [resolve(__dirname, "web/setup.ts")],
          passWithNoTests: true,
        },
      },
    ],
  },
});
