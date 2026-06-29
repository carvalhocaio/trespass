import { beforeAll, describe, expect, it, vi } from "vitest";
import { TEST_ENV } from "../helpers/env-mock";

const MOCK_USER = { id: "user-1", email: "test@example.com", name: "Test" };
const MOCK_SESSION = { id: "session-1", userId: "user-1" };
const MOCK_REPO = {
  id: "repo-1",
  userId: "user-1",
  githubId: 1,
  name: "my-repo",
  fullName: "user/my-repo",
  defaultBranch: "main",
  htmlUrl: "https://github.com/user/my-repo",
};
const MOCK_SECRET = {
  id: "secret-1",
  userId: "user-1",
  githubPatEnc: "iv:ciphertext:tag",
  llmProvider: "openai",
  llmApiKeyEnc: "iv:llmkey:tag",
  llmModel: "gpt-4o",
};

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

vi.mock("@trespass/crypto", () => ({
  createCrypto: vi.fn(() => ({
    decrypt: vi.fn().mockReturnValue("decrypted-value"),
    encrypt: vi.fn().mockReturnValue("iv:cipher:tag"),
  })),
}));

vi.mock("@trespass/db", () => ({
  createDb: vi.fn(),
}));

// Retorna um chain thenable que resolve para o valor fornecido
function makeChainReturning(value: unknown) {
  const resolved = Promise.resolve(value);
  const chain: Record<string, unknown> = {};
  const self = () => chain;
  chain.from = vi.fn(self);
  chain.where = vi.fn(self);
  chain.leftJoin = vi.fn(self);
  chain.orderBy = vi.fn(self);
  chain.limit = vi.fn(self);
  chain.returning = vi.fn().mockResolvedValue(value);
  // biome-ignore lint/suspicious/noThenProperty: thenable intencional para que o chain seja awaitable
  chain.then = resolved.then.bind(resolved);
  return chain;
}

// Cria um mock de DB com respostas sequenciais por chamada a select()
function makeDbWithSelectSequence(responses: unknown[]) {
  let callIdx = 0;
  return {
    select: vi.fn(() => makeChainReturning(responses[callIdx++] ?? [])),
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        returning: vi
          .fn()
          .mockResolvedValue([{ id: "scan-new", status: "queued" }]),
      })),
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn().mockResolvedValue(undefined),
      })),
    })),
  };
}

import { createDb } from "@trespass/db";

describe("scan rate limiting", () => {
  let app: Awaited<ReturnType<typeof import("@server/index").createApp>>;

  beforeAll(async () => {
    const { createApp } = await import("@server/index");
    app = createApp();
  });

  it("retorna 429 quando o usuário já tem MAX_CONCURRENT_SCANS scans ativos", async () => {
    // select calls: repo → secret → active scans (3 retornados → limite atingido)
    vi.mocked(createDb).mockReturnValue(
      makeDbWithSelectSequence([
        [MOCK_REPO],
        [MOCK_SECRET],
        [{ id: "s1" }, { id: "s2" }, { id: "s3" }],
      ]) as ReturnType<typeof createDb>
    );

    const res = await app.request("/api/scans", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ repoId: "repo-1", includeLlm: false }),
    });

    expect(res.status).toBe(429);
    expect(await res.text()).toContain("active scan");
  });

  it("retorna 429 quando o usuário atingiu o limite diário de scans com LLM", async () => {
    // select calls: repo → secret → active scans (0) → recent scans (10 → limite atingido)
    const recentScans = Array.from({ length: 10 }, (_, i) => ({
      id: `scan-${i}`,
    }));

    vi.mocked(createDb).mockReturnValue(
      makeDbWithSelectSequence([
        [MOCK_REPO],
        [MOCK_SECRET],
        [],
        recentScans,
      ]) as ReturnType<typeof createDb>
    );

    const res = await app.request("/api/scans", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ repoId: "repo-1", includeLlm: true }),
    });

    expect(res.status).toBe(429);
    expect(await res.text()).toContain("LLM");
  });

  it("não aplica o limite diário de LLM quando o usuário não tem LLM configurado", async () => {
    // select calls: repo → secret (sem llmApiKeyEnc) → active scans (0)
    // sem verificação diária de LLM — scan criado com sucesso
    const secretSemLlm = {
      ...MOCK_SECRET,
      llmApiKeyEnc: null,
      llmProvider: null,
      llmModel: null,
    };

    vi.mocked(createDb).mockReturnValue(
      makeDbWithSelectSequence([[MOCK_REPO], [secretSemLlm], []]) as ReturnType<
        typeof createDb
      >
    );

    const res = await app.request("/api/scans", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ repoId: "repo-1", includeLlm: true }),
    });

    expect(res.status).toBe(201);
  });
});
