import { beforeEach, describe, expect, it, vi } from "vitest";

// ── Controllable dependency mocks ────────────────────────────────────────────
const h = vi.hoisted(() => ({
  // checkCancelled returns "cancelled" once its call count exceeds cancelAfter.
  cancelAfter: Number.POSITIVE_INFINITY,
  cancelCalls: 0,
  summaryRows: [] as { severity: string }[],
  tree: [] as { type: string; path: string }[],
  manifests: [] as { type: string; path: string; content: string }[],
  fileContent: new Map<string, string | null>(),
  auditResult: [] as unknown[],
  reviewResult: null as unknown,
  reviewError: null as Error | null,
  inserted: [] as Record<string, unknown>[],
  statusUpdates: [] as Record<string, unknown>[],
  treeError: null as unknown,
}));

vi.mock("@trespass/db", () => {
  function selectChain(cols: Record<string, unknown> | undefined) {
    const key = cols ? Object.keys(cols)[0] : undefined;
    const chain: Record<string, unknown> = {};
    const self = () => chain;
    for (const m of ["from", "where", "leftJoin", "orderBy", "limit"]) {
      chain[m] = self;
    }
    const resolve = () => {
      if (key === "status") {
        h.cancelCalls++;
        return h.cancelCalls > h.cancelAfter
          ? [{ status: "cancelled" }]
          : [{ status: "running" }];
      }
      if (key === "severity") {
        return h.summaryRows;
      }
      return [];
    };
    const p = Promise.resolve().then(resolve);
    // biome-ignore lint/suspicious/noThenProperty: thenable query chain
    chain.then = p.then.bind(p);
    return chain;
  }
  return {
    createDb: () => ({
      select: (cols?: Record<string, unknown>) => selectChain(cols),
      insert: () => ({
        values: (row: Record<string, unknown>) => {
          h.inserted.push(row);
          return Promise.resolve(undefined);
        },
      }),
      update: () => ({
        set: (patch: Record<string, unknown>) => ({
          where: () => {
            h.statusUpdates.push(patch);
            return Promise.resolve(undefined);
          },
        }),
      }),
    }),
  };
});

vi.mock("@trespass/db/schema/app", () => ({
  finding: { severity: "severity", file: "file", scanId: "scanId" },
  scan: { id: "id", status: "status" },
}));

vi.mock("@trespass/github", () => ({
  createOctokit: () => ({}),
  getFileTree: () =>
    h.treeError ? Promise.reject(h.treeError) : Promise.resolve(h.tree),
  getPackageManifests: () => Promise.resolve(h.manifests),
  getFileContent: (_o: unknown, _ow: string, _r: string, path: string) =>
    Promise.resolve(h.fileContent.get(path) ?? null),
}));

vi.mock("@server/services/scanner/deps-auditor", () => ({
  auditDependencies: () => Promise.resolve(h.auditResult),
}));

vi.mock("@server/services/scanner/llm-reviewer", () => ({
  reviewFileWithLlm: () =>
    h.reviewError
      ? Promise.reject(h.reviewError)
      : Promise.resolve(h.reviewResult ?? { findings: [], error: null }),
}));

import { runScan } from "@server/services/scanner/index";

const BASE_INPUT = {
  scanId: "scan-1",
  repoId: "repo-1",
  userId: "user-1",
  owner: "owner",
  repoName: "repo",
  defaultBranch: "main",
  pat: "ghp_x",
  llmConfig: null as unknown,
};

beforeEach(() => {
  h.cancelAfter = Number.POSITIVE_INFINITY;
  h.cancelCalls = 0;
  h.summaryRows = [];
  h.tree = [];
  h.manifests = [];
  h.fileContent = new Map();
  h.auditResult = [];
  h.reviewResult = null;
  h.inserted = [];
  h.statusUpdates = [];
  h.treeError = null;
  h.reviewError = null;
});

describe("runScan", () => {
  it("runs the full pipeline with dependency, code and LLM phases", async () => {
    h.tree = [
      { type: "blob", path: "src/auth.ts" }, // priority + scannable
      { type: "blob", path: "node_modules/x.js" }, // skipped by path
      { type: "blob", path: "README.md" }, // non-scannable extension
      { type: "tree", path: "src" }, // not a blob
      { type: "blob", path: "src/plain.ts" }, // scannable, SAST finding
      { type: "blob", path: "src/creds.ts" }, // scannable, secret finding
      { type: "blob", path: "src/empty.ts" }, // content unavailable
    ];
    h.fileContent.set("src/auth.ts", "const ok = true;");
    // eval(...) is flagged by the SAST layer, so this file reports findings.
    h.fileContent.set("src/plain.ts", "eval(userInput);");
    // A GitHub token literal is flagged by the secrets layer.
    h.fileContent.set(
      "src/creds.ts",
      'const t = "ghp_1234567890abcdefghijklmnopqrstuvwx12";'
    );
    h.fileContent.set("src/empty.ts", null);

    h.manifests = [
      {
        type: "npm",
        path: "package.json",
        content: '{"dependencies":{"a":"1"}}',
      },
      // Non-JSON content exercises the countManifestPackages catch branch.
      { type: "python", path: "requirements.txt", content: "flask==2.0" },
    ];
    h.auditResult = [
      {
        severity: "high",
        title: "npm vuln",
        description: "desc",
        cveId: "CVE-1",
        packageName: "a",
        installedVersion: "1",
        fixedIn: "2",
        ecosystem: "npm",
        remediation: "update",
      },
      {
        severity: "medium",
        title: "py vuln",
        description: "desc2",
        cveId: null,
        packageName: "flask",
        installedVersion: "2.0",
        fixedIn: null,
        ecosystem: "python",
        remediation: "review",
      },
    ];
    h.reviewResult = {
      findings: [
        {
          title: "LLM finding",
          severity: "critical",
          description: "d",
          file: "src/auth.ts",
          line: 1,
          snippet: null,
          remediation: "fix",
        },
      ],
      error: "partial failure",
    };
    h.summaryRows = [
      { severity: "critical" },
      { severity: "high" },
      { severity: "medium" },
      { severity: "low" },
      { severity: "info" },
    ];

    await runScan({
      ...BASE_INPUT,
      llmConfig: { provider: "openai", apiKey: "k", model: "gpt-4o" },
    });

    // Final status update marks the scan done.
    const last = h.statusUpdates.at(-1);
    expect(last?.status).toBe("done");
    // Dependency + LLM findings were persisted.
    expect(h.inserted.some((f) => f.category === "dependency")).toBe(true);
    expect(h.inserted.some((f) => f.category === "llm")).toBe(true);
  });

  it("reports a clean LLM phase when review returns no error", async () => {
    h.tree = [{ type: "blob", path: "src/auth.ts" }]; // priority file
    h.fileContent.set("src/auth.ts", "const ok = true;");
    h.reviewResult = {
      findings: [
        {
          title: "F",
          severity: "low",
          description: "d",
          file: "src/auth.ts",
          line: null,
          snippet: null,
          remediation: "r",
        },
      ],
      error: null,
    };

    await runScan({
      ...BASE_INPUT,
      llmConfig: { provider: "openai", apiKey: "k", model: "gpt-4o" },
    });

    const reviewed = h.statusUpdates.some(
      (u) =>
        Array.isArray(u.progress) &&
        (u.progress as { detail?: string | null }[]).some((s) =>
          s.detail?.includes("files reviewed")
        )
    );
    expect(reviewed).toBe(true);
  });

  it("swallows a non-cancel LLM worker error and finishes", async () => {
    h.tree = [{ type: "blob", path: "src/auth.ts" }];
    h.fileContent.set("src/auth.ts", "const ok = true;");
    h.reviewError = new Error("llm exploded");

    await runScan({
      ...BASE_INPUT,
      llmConfig: { provider: "openai", apiKey: "k", model: "gpt-4o" },
    });

    // The scan still reaches a terminal "done" status despite the LLM error.
    expect(h.statusUpdates.at(-1)?.status).toBe("done");
  });

  it("propagates cancellation raised during the LLM phase", async () => {
    // Calls: after depAudit (1), before the single file (2), after codeScan
    // (3), then inside the LLM worker (4) → cancel on the 4th check.
    h.cancelAfter = 3;
    h.tree = [{ type: "blob", path: "src/auth.ts" }]; // priority → queued
    h.fileContent.set("src/auth.ts", "const ok = true;");

    await runScan({
      ...BASE_INPUT,
      llmConfig: { provider: "openai", apiKey: "k", model: "gpt-4o" },
    });

    expect(h.statusUpdates.some((u) => u.status === "done")).toBe(false);
  });

  it("completes without an LLM phase when no config is provided", async () => {
    h.tree = [{ type: "blob", path: "src/plain.ts" }];
    h.fileContent.set("src/plain.ts", "const x = 1;");

    await runScan(BASE_INPUT);

    const last = h.statusUpdates.at(-1);
    expect(last?.status).toBe("done");
    expect(h.inserted.some((f) => f.category === "llm")).toBe(false);
  });

  it("stops quietly when the scan is cancelled mid-run", async () => {
    h.cancelAfter = 1; // first check passes, second (in code scan) cancels
    h.tree = [
      { type: "blob", path: "src/a.ts" },
      { type: "blob", path: "src/b.ts" },
    ];
    h.fileContent.set("src/a.ts", "const x = 1;");
    h.fileContent.set("src/b.ts", "const y = 2;");

    await runScan(BASE_INPUT);

    // Cancellation returns early — no "done"/"error" terminal status recorded.
    expect(h.statusUpdates.some((u) => u.status === "done")).toBe(false);
  });

  it("records an error status when a phase throws", async () => {
    h.treeError = new Error("github down");

    await runScan(BASE_INPUT);

    const last = h.statusUpdates.at(-1);
    expect(last?.status).toBe("error");
    expect(last?.error).toBe("github down");
  });

  it("stringifies non-Error failures in the error status", async () => {
    h.treeError = "raw string failure";

    await runScan(BASE_INPUT);

    const last = h.statusUpdates.at(-1);
    expect(last?.status).toBe("error");
    expect(last?.error).toBe("raw string failure");
  });
});
