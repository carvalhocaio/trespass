import { beforeAll, describe, expect, it, vi } from "vitest";
import { TEST_ENV } from "../helpers/env-mock";

const MOCK_USER = { id: "user-1", email: "test@example.com", name: "Test" };
const MOCK_SESSION = { id: "session-1", userId: "user-1" };

// Authenticated session mock
vi.mock("@trespass/auth", () => ({
  auth: {
    handler: vi.fn(),
    api: {
      getSession: vi.fn().mockResolvedValue({
        user: MOCK_USER,
        session: MOCK_SESSION,
      }),
    },
  },
}));

vi.mock("@trespass/env/server", () => ({ env: TEST_ENV }));

// Chainable DB mock: every builder method returns the same chain object.
// The chain is a thenable — any chain resolves to [] when awaited,
// regardless of which method was called last.
function makeChain() {
  const chain: Record<string, unknown> = {};
  const self = () => chain;
  chain.from = vi.fn(self);
  chain.where = vi.fn(self);
  chain.leftJoin = vi.fn(self);
  chain.orderBy = vi.fn(self);
  chain.limit = vi.fn(self);
  const resolved = Promise.resolve([]);
  // biome-ignore lint/suspicious/noThenProperty: intentional thenable so any chain is directly awaitable
  chain.then = resolved.then.bind(resolved);
  return chain;
}

vi.mock("@trespass/db", () => ({
  createDb: vi.fn(() => ({
    select: vi.fn(() => makeChain()),
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockResolvedValue(undefined),
    }),
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      }),
    }),
  })),
}));

describe("functional: authenticated routes", () => {
  let app: Awaited<ReturnType<typeof import("@server/index").createApp>>;

  beforeAll(async () => {
    const { createApp } = await import("@server/index");
    app = createApp();
  });

  it("GET /api/repos returns 200 with valid session", async () => {
    const res = await app.request("/api/repos");
    expect(res.status).toBe(200);
  });

  it("GET /api/repos returns JSON content-type", async () => {
    const res = await app.request("/api/repos");
    expect(res.headers.get("content-type")).toContain("application/json");
  });

  it("GET /api/scans returns 200 with valid session", async () => {
    const res = await app.request("/api/scans");
    expect(res.status).toBe(200);
  });

  it("GET /api/me/secrets/status returns 200 with valid session", async () => {
    const res = await app.request("/api/me/secrets/status");
    expect(res.status).toBe(200);
  });

  it("GET /api/github/:owner/:repo/issues/check returns 200 with valid session", async () => {
    const res = await app.request(
      "/api/github/owner/repo/issues/check?title=%5BSecurity%5D+Test"
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ duplicate: false });
  });

  it("GET /api/github/:owner/:repo/issues/check returns 400 when title is missing", async () => {
    const res = await app.request("/api/github/owner/repo/issues/check");
    expect(res.status).toBe(400);
  });

  it("GET / health check returns 200", async () => {
    const res = await app.request("/");
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("OK");
  });
});
