import { createCrypto } from "@trespass/crypto";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { makeDbMock } from "../helpers/db-mock";
import { TEST_ENV } from "../helpers/env-mock";

const MOCK_USER = { id: "user-1", email: "test@example.com", name: "Test" };
const MOCK_SESSION = { id: "session-1", userId: "user-1" };

vi.mock("@trespass/auth", () => ({
  auth: {
    handler: vi.fn(),
    api: {
      getSession: vi
        .fn()
        .mockResolvedValue({ user: MOCK_USER, session: MOCK_SESSION }),
    },
  },
}));

vi.mock("@trespass/env/server", () => ({ env: TEST_ENV }));

// Shared holders so vi.mock factories (hoisted) can read per-test state.
const h = vi.hoisted(() => ({
  db: null as ReturnType<typeof import("../helpers/db-mock").makeDbMock> | null,
  listUserRepos: null as unknown,
  checkForDuplicateIssue: null as unknown,
  runScan: null as unknown,
}));

vi.mock("@trespass/db", () => ({ createDb: () => h.db?.db }));

vi.mock("@trespass/github", () => ({
  createOctokit: vi.fn(() => ({})),
  listUserRepos: (...args: unknown[]) =>
    (h.listUserRepos as (...a: unknown[]) => unknown)(...args),
  checkForDuplicateIssue: (...args: unknown[]) =>
    (h.checkForDuplicateIssue as (...a: unknown[]) => unknown)(...args),
}));

vi.mock("@server/services/scanner/index", () => ({
  runScan: (...args: unknown[]) =>
    (h.runScan as (...a: unknown[]) => unknown)(...args),
}));

const crypto = createCrypto(TEST_ENV.SECRET_ENCRYPTION_KEY);
const ENC_PAT = crypto.encrypt("ghp_secret");
const ENC_LLM = crypto.encrypt("sk-llm-key");

async function json(res: Response): Promise<unknown> {
  return await res.json();
}

describe("route branch coverage", () => {
  let app: Awaited<ReturnType<typeof import("@server/index").createApp>>;
  let db: ReturnType<typeof makeDbMock>;

  beforeAll(async () => {
    const { createApp } = await import("@server/index");
    app = createApp();
  });

  beforeEach(() => {
    db = makeDbMock();
    h.db = db;
    h.listUserRepos = vi.fn().mockResolvedValue([]);
    h.checkForDuplicateIssue = vi.fn().mockResolvedValue({
      duplicate: false,
      isOpen: null,
      issueNumber: null,
      issueUrl: null,
    });
    h.runScan = vi.fn();
  });

  // ---- GET /api/repos ----
  it("GET /api/repos returns [] when the user has no repos", async () => {
    db.queueSelect([]);
    const res = await app.request("/api/repos");
    expect(await json(res)).toEqual([]);
  });

  it("GET /api/repos attaches the latest scan per repo", async () => {
    db.queueSelect([{ id: "repo-1", userId: "user-1" }]);
    db.queueSelect([
      {
        id: "scan-2",
        repoId: "repo-1",
        status: "done",
        summary: "ok",
        finishedAt: null,
        startedAt: new Date(),
      },
      // second scan for same repo is ignored (older)
      { id: "scan-1", repoId: "repo-1", status: "done", startedAt: new Date() },
      // scan for an unknown repo is skipped
      { id: "scan-x", repoId: "other", status: "done", startedAt: new Date() },
    ]);
    const res = await app.request("/api/repos");
    const body = (await json(res)) as Array<{ lastScan: { id: string } }>;
    expect(body[0]?.lastScan?.id).toBe("scan-2");
  });

  it("GET /api/repos leaves lastScan null when a repo has no scans", async () => {
    db.queueSelect([{ id: "repo-1", userId: "user-1" }]);
    db.queueSelect([]);
    const res = await app.request("/api/repos");
    const body = (await json(res)) as Array<{ lastScan: unknown }>;
    expect(body[0]?.lastScan).toBeNull();
  });

  // ---- POST /api/repos/sync ----
  it("POST /api/repos/sync 422 without a PAT", async () => {
    db.queueSelect([]);
    const res = await app.request("/api/repos/sync", { method: "POST" });
    expect(res.status).toBe(422);
  });

  it("POST /api/repos/sync returns synced:0 when GitHub has no repos", async () => {
    db.queueSelect([{ githubPatEnc: ENC_PAT }]);
    const res = await app.request("/api/repos/sync", { method: "POST" });
    expect(await json(res)).toEqual({ synced: 0 });
  });

  it("POST /api/repos/sync upserts fetched repos", async () => {
    db.queueSelect([{ githubPatEnc: ENC_PAT }]);
    h.listUserRepos = vi.fn().mockResolvedValue([
      {
        githubId: 1,
        name: "r",
        fullName: "o/r",
        description: null,
        isPrivate: false,
        defaultBranch: "main",
        language: null,
        htmlUrl: "u",
      },
    ]);
    const res = await app.request("/api/repos/sync", { method: "POST" });
    expect(await json(res)).toEqual({ synced: 1 });
  });

  // ---- GET /api/scans ----
  it("GET /api/scans lists scans", async () => {
    db.queueSelect([{ id: "scan-1", status: "done" }]);
    const res = await app.request("/api/scans");
    expect((await json(res)) as unknown[]).toHaveLength(1);
  });

  // ---- GET /api/scans/:id ----
  it("GET /api/scans/:id 404 when missing", async () => {
    db.queueSelect([]);
    const res = await app.request("/api/scans/nope");
    expect(res.status).toBe(404);
  });

  it("GET /api/scans/:id returns a running (not stuck) scan", async () => {
    db.queueSelect([{ id: "s1", status: "running", startedAt: new Date() }]);
    db.queueSelect([]); // findings
    const res = await app.request("/api/scans/s1");
    const body = (await json(res)) as { scan: { status: string } };
    expect(body.scan.status).toBe("running");
  });

  it("GET /api/scans/:id recovers a stuck running scan to error", async () => {
    const old = new Date(Date.now() - 31 * 60 * 1000);
    db.queueSelect([{ id: "s1", status: "running", startedAt: old }]);
    db.queueSelect([]); // findings
    const res = await app.request("/api/scans/s1");
    const body = (await json(res)) as { scan: { status: string } };
    expect(body.scan.status).toBe("error");
  });

  // ---- DELETE /api/scans/:id ----
  it("DELETE /api/scans/:id 404 when missing", async () => {
    db.queueSelect([]);
    const res = await app.request("/api/scans/x", { method: "DELETE" });
    expect(res.status).toBe(404);
  });

  it("DELETE /api/scans/:id 409 when already finished", async () => {
    db.queueSelect([{ id: "s1", status: "done" }]);
    const res = await app.request("/api/scans/s1", { method: "DELETE" });
    expect(res.status).toBe(409);
  });

  it("DELETE /api/scans/:id cancels a queued scan", async () => {
    db.queueSelect([{ id: "s1", status: "queued" }]);
    db.queueReturning([{ id: "s1", status: "cancelled" }]);
    const res = await app.request("/api/scans/s1", { method: "DELETE" });
    expect(res.status).toBe(200);
  });

  it("DELETE /api/scans/:id 409 when the row was already updated (race)", async () => {
    db.queueSelect([{ id: "s1", status: "running" }]);
    db.queueReturning([]); // update matched nothing
    const res = await app.request("/api/scans/s1", { method: "DELETE" });
    expect(res.status).toBe(409);
  });

  // ---- POST /api/scans ----
  it("POST /api/scans 400 on invalid body", async () => {
    const res = await app.request("/api/scans", {
      method: "POST",
      body: JSON.stringify({}),
      headers: { "content-type": "application/json" },
    });
    expect(res.status).toBe(400);
  });

  it("POST /api/scans 404 when the repo is not owned", async () => {
    db.queueSelect([]); // repo lookup
    const res = await app.request("/api/scans", {
      method: "POST",
      body: JSON.stringify({ repoId: "r1" }),
      headers: { "content-type": "application/json" },
    });
    expect(res.status).toBe(404);
  });

  it("POST /api/scans 422 without a PAT", async () => {
    db.queueSelect([{ id: "r1", fullName: "o/r", defaultBranch: "main" }]);
    db.queueSelect([]); // secret
    const res = await app.request("/api/scans", {
      method: "POST",
      body: JSON.stringify({ repoId: "r1" }),
      headers: { "content-type": "application/json" },
    });
    expect(res.status).toBe(422);
  });

  it("POST /api/scans starts a scan without LLM config", async () => {
    db.queueSelect([{ id: "r1", fullName: "o/r", defaultBranch: "main" }]);
    db.queueSelect([{ githubPatEnc: ENC_PAT }]);
    db.queueReturning([{ id: "scan-new", status: "queued" }]);
    const res = await app.request("/api/scans", {
      method: "POST",
      body: JSON.stringify({ repoId: "r1", includeLlm: false }),
      headers: { "content-type": "application/json" },
    });
    expect(res.status).toBe(201);
    // runScan is fired via setImmediate after the response — flush the loop.
    await new Promise((r) => setImmediate(r));
    expect(h.runScan).toHaveBeenCalled();
  });

  it("POST /api/scans starts a scan with LLM config", async () => {
    db.queueSelect([{ id: "r1", fullName: "o/r", defaultBranch: "main" }]);
    db.queueSelect([
      {
        githubPatEnc: ENC_PAT,
        llmApiKeyEnc: ENC_LLM,
        llmProvider: "openai",
        llmModel: "gpt-4o",
      },
    ]);
    db.queueReturning([{ id: "scan-new", status: "queued" }]);
    const res = await app.request("/api/scans", {
      method: "POST",
      body: JSON.stringify({ repoId: "r1" }),
      headers: { "content-type": "application/json" },
    });
    expect(res.status).toBe(201);
    await new Promise((r) => setImmediate(r));
  });

  // ---- GET /api/me/secrets/status ----
  it("GET /api/me/secrets/status reports configured flags", async () => {
    db.queueSelect([
      {
        githubPatEnc: ENC_PAT,
        llmApiKeyEnc: ENC_LLM,
        llmProvider: "openai",
        llmModel: "gpt-4o",
      },
    ]);
    const res = await app.request("/api/me/secrets/status");
    expect(await json(res)).toMatchObject({ hasPat: true, hasLlmKey: true });
  });

  // ---- PUT /api/me/secrets ----
  it("PUT /api/me/secrets 400 on invalid body", async () => {
    const res = await app.request("/api/me/secrets", {
      method: "PUT",
      body: JSON.stringify({ llmProvider: "invalid" }),
      headers: { "content-type": "application/json" },
    });
    expect(res.status).toBe(400);
  });

  it("PUT /api/me/secrets inserts when no row exists", async () => {
    db.queueSelect([]); // existing lookup
    const res = await app.request("/api/me/secrets", {
      method: "PUT",
      body: JSON.stringify({
        githubPat: "ghp_x",
        llmProvider: "openai",
        llmApiKey: "sk-x",
        llmModel: "gpt-4o",
      }),
      headers: { "content-type": "application/json" },
    });
    expect(await json(res)).toEqual({ ok: true });
  });

  it("PUT /api/me/secrets updates an existing row", async () => {
    db.queueSelect([{ id: "sec-1" }]);
    const res = await app.request("/api/me/secrets", {
      method: "PUT",
      body: JSON.stringify({ githubPat: "ghp_y" }),
      headers: { "content-type": "application/json" },
    });
    expect(await json(res)).toEqual({ ok: true });
  });

  // ---- GET /api/github/:owner/:repo/issues/check ----
  it("issues/check 400 without a title", async () => {
    const res = await app.request("/api/github/o/r/issues/check");
    expect(res.status).toBe(400);
  });

  it("issues/check returns not-duplicate when no PAT is set", async () => {
    db.queueSelect([]);
    const res = await app.request("/api/github/o/r/issues/check?title=Test");
    expect(await json(res)).toMatchObject({ duplicate: false });
  });

  it("issues/check queries GitHub when a PAT is set", async () => {
    db.queueSelect([{ githubPatEnc: ENC_PAT }]);
    h.checkForDuplicateIssue = vi.fn().mockResolvedValue({
      duplicate: true,
      isOpen: true,
      issueNumber: 7,
      issueUrl: "u",
    });
    const res = await app.request("/api/github/o/r/issues/check?title=Dup");
    expect(await json(res)).toMatchObject({ duplicate: true, issueNumber: 7 });
  });
});
