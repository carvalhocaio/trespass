import { beforeAll, describe, expect, it, vi } from "vitest";
import { TEST_ENV } from "../helpers/env-mock";

// Mock auth before importing the app so requireAuth uses the mock
vi.mock("@trespass/auth", () => ({
  auth: {
    handler: vi.fn(),
    api: {
      getSession: vi.fn().mockResolvedValue(null),
    },
  },
}));

vi.mock("@trespass/db", () => ({
  createDb: vi.fn(),
}));

vi.mock("@trespass/env/server", () => ({ env: TEST_ENV }));

describe("route authentication", () => {
  let app: Awaited<ReturnType<typeof import("@server/index").createApp>>;

  beforeAll(async () => {
    const { createApp } = await import("@server/index");
    app = createApp();
  });

  it("GET /api/repos returns 401 without a session", async () => {
    const res = await app.request("/api/repos");
    expect(res.status).toBe(401);
  });

  it("GET /api/scans returns 401 without a session", async () => {
    const res = await app.request("/api/scans");
    expect(res.status).toBe(401);
  });

  it("POST /api/scans returns 401 without a session", async () => {
    const res = await app.request("/api/scans", { method: "POST" });
    expect(res.status).toBe(401);
  });

  it("GET /api/me/secrets/status returns 401 without a session", async () => {
    const res = await app.request("/api/me/secrets/status");
    expect(res.status).toBe(401);
  });

  it("GET /api/github/owner/repo/issues/check returns 401 without a session", async () => {
    const res = await app.request(
      "/api/github/owner/repo/issues/check?title=test"
    );
    expect(res.status).toBe(401);
  });

  it("GET / returns 200 (health check, no auth required)", async () => {
    const res = await app.request("/");
    expect(res.status).toBe(200);
  });
});
