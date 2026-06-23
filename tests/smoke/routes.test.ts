import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

// Static source inspection — verifies route registration without starting a server.
// This is intentionally lightweight: if a route is removed or renamed, this test fails fast.

const indexSrc = readFileSync(
  resolve(import.meta.dirname, "../../apps/server/src/index.ts"),
  "utf8"
);

describe("smoke: route registration (static)", () => {
  it("registers /me/secrets route", () => {
    expect(indexSrc).toContain('api.route("/me/secrets"');
  });

  it("registers /repos route", () => {
    expect(indexSrc).toContain('api.route("/repos"');
  });

  it("registers /scans route", () => {
    expect(indexSrc).toContain('api.route("/scans"');
  });

  it("registers /github route", () => {
    expect(indexSrc).toContain('api.route("/github"');
  });

  it("applies requireAuth middleware to all API routes", () => {
    expect(indexSrc).toContain("requireAuth");
  });

  it("mounts Better-Auth handler at /api/auth/*", () => {
    expect(indexSrc).toContain('"/api/auth/*"');
  });

  it("exports createApp function", () => {
    expect(indexSrc).toContain("export function createApp");
  });
});
