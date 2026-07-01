import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// These tests re-import the env modules under different process.env states, so
// each case resets the module registry and restores stubbed env afterwards.

const VALID_SERVER_ENV = {
  DATABASE_URL: "postgresql://test:test@localhost:5432/test",
  BETTER_AUTH_SECRET: "test-secret-exactly-32-chars-123",
  BETTER_AUTH_URL: "http://localhost:3000",
  CORS_ORIGIN: "http://localhost:3001",
  GITHUB_CLIENT_ID: "id",
  GITHUB_CLIENT_SECRET: "secret",
  SECRET_ENCRYPTION_KEY: "a".repeat(64),
};

function stubEnv(vars: Record<string, string | undefined>): void {
  for (const [key, value] of Object.entries(vars)) {
    vi.stubEnv(key, value as string);
  }
}

describe("packages/env/server", () => {
  beforeEach(() => {
    vi.resetModules();
    // Ensure the validating path runs (not the skip branch).
    vi.stubEnv("SKIP_ENV_VALIDATION", "");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("exposes validated values and applies defaults", async () => {
    stubEnv(VALID_SERVER_ENV);
    // Vitest sets NODE_ENV=test globally; clear both so the schema defaults run.
    vi.stubEnv("NODE_ENV", undefined as unknown as string);
    vi.stubEnv("LOG_LEVEL", undefined as unknown as string);
    const { env } = await import("@trespass/env/server");

    expect(env.DATABASE_URL).toBe(VALID_SERVER_ENV.DATABASE_URL);
    // Defaults kick in when NODE_ENV / LOG_LEVEL are absent.
    expect(env.NODE_ENV).toBe("development");
    expect(env.LOG_LEVEL).toBe("info");
  });

  it("throws when a required var is missing", async () => {
    stubEnv({ ...VALID_SERVER_ENV, DATABASE_URL: undefined });

    await expect(import("@trespass/env/server")).rejects.toThrow();
  });

  it("throws when the encryption key is the wrong length", async () => {
    stubEnv({ ...VALID_SERVER_ENV, SECRET_ENCRYPTION_KEY: "tooshort" });

    await expect(import("@trespass/env/server")).rejects.toThrow();
  });

  it("throws when a URL var is malformed", async () => {
    stubEnv({ ...VALID_SERVER_ENV, BETTER_AUTH_URL: "not-a-url" });

    await expect(import("@trespass/env/server")).rejects.toThrow();
  });

  it("skips validation when SKIP_ENV_VALIDATION is set", async () => {
    vi.stubEnv("SKIP_ENV_VALIDATION", "1");
    stubEnv({ ...VALID_SERVER_ENV, DATABASE_URL: undefined });

    // No throw despite the missing required var.
    await expect(import("@trespass/env/server")).resolves.toBeDefined();
  });
});

describe("packages/env/web", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("SKIP_ENV_VALIDATION", "");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("validates the public server URL", async () => {
    vi.stubEnv("NUXT_PUBLIC_SERVER_URL", "http://localhost:3000");
    const { env } = await import("@trespass/env/web");

    expect(env.NUXT_PUBLIC_SERVER_URL).toBe("http://localhost:3000");
  });

  it("throws when the public server URL is invalid", async () => {
    vi.stubEnv("NUXT_PUBLIC_SERVER_URL", "nope");

    await expect(import("@trespass/env/web")).rejects.toThrow();
  });
});
