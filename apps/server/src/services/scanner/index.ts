import { createDb } from "@trespass/db";
import { finding, scan } from "@trespass/db/schema/app";
import type { TreeEntry } from "@trespass/github";
import {
  createOctokit,
  getFileContent,
  getFileTree,
  getPackageManifests,
} from "@trespass/github";
import { and, eq } from "drizzle-orm";
import { nanoid } from "nanoid";

import { auditDependencies } from "./deps-auditor";
import type { LlmConfig } from "./llm-reviewer";
import { reviewFileWithLlm } from "./llm-reviewer";
import { scanFileForPatterns } from "./sast-patterns";
import { scanFileForSecrets } from "./secrets-detector";

const SCANNABLE_EXTENSIONS = new Set([
  "ts",
  "tsx",
  "js",
  "jsx",
  "mjs",
  "cjs",
  "py",
  "go",
  "rb",
  "php",
  "java",
  "env",
  "yaml",
  "yml",
  "json",
  "toml",
  "sh",
  "bash",
]);

const SKIP_PATH_PATTERNS = [
  /node_modules\//,
  /\.git\//,
  /dist\//,
  /build\//,
  /\.next\//,
  /\.nuxt\//,
  /coverage\//,
  /\.cache\//,
  /vendor\//,
  /__pycache__\//,
  /\.venv\//,
  /venv\//,
];

function shouldScan(path: string): boolean {
  if (SKIP_PATH_PATTERNS.some((p) => p.test(path))) {
    return false;
  }
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  return SCANNABLE_EXTENSIONS.has(ext);
}

const LLM_PRIORITY_PATTERNS = [
  /auth/i,
  /secret/i,
  /token/i,
  /password/i,
  /credential/i,
  /api/i,
  /middleware/i,
  /llm/i,
  /prompt/i,
  /openai/i,
  /anthropic/i,
];

function isLlmPriorityFile(path: string): boolean {
  return LLM_PRIORITY_PATTERNS.some((p) => p.test(path));
}

interface FindingRow {
  category: "dependency" | "llm" | "sast" | "secret";
  description: string;
  file: null | string;
  line: null | number;
  llmEnriched: boolean;
  remediation: string;
  repoId: string;
  scanId: string;
  severity: "critical" | "high" | "info" | "low" | "medium";
  snippet: null | string;
  title: string;
  userId: string;
}

type Db = ReturnType<typeof createDb>;

type ProgressStatus = "done" | "error" | "running" | "warn";

interface ProgressStep {
  detail: null | string;
  key: string;
  label: string;
  status: ProgressStatus;
}

class ScanCancelledError extends Error {
  constructor() {
    super("Scan cancelled");
    this.name = "ScanCancelledError";
  }
}

async function checkCancelled(db: Db, scanId: string): Promise<void> {
  const [row] = await db
    .select({ status: scan.status })
    .from(scan)
    .where(eq(scan.id, scanId))
    .limit(1);
  if (row?.status === "cancelled") {
    throw new ScanCancelledError();
  }
}

async function pushProgress(
  db: Db,
  scanId: string,
  current: ProgressStep[],
  step: ProgressStep
): Promise<ProgressStep[]> {
  const next = [...current, step];
  await db.update(scan).set({ progress: next }).where(eq(scan.id, scanId));
  return next;
}

async function updateLastProgress(
  db: Db,
  scanId: string,
  current: ProgressStep[],
  patch: Partial<ProgressStep>
): Promise<ProgressStep[]> {
  const next = current.map((s, i) =>
    i === current.length - 1 ? { ...s, ...patch } : s
  );
  await db.update(scan).set({ progress: next }).where(eq(scan.id, scanId));
  return next;
}

async function insertFinding(db: Db, row: FindingRow): Promise<void> {
  await db.insert(finding).values({ id: nanoid(), ...row });
}

function countManifestPackages(manifests: { content: string }[]): number {
  return manifests.reduce((acc, m) => {
    try {
      const parsed = JSON.parse(m.content) as Record<string, unknown>;
      const deps = {
        ...(parsed.dependencies as object | undefined),
        ...(parsed.devDependencies as object | undefined),
        // biome-ignore lint/complexity/useLiteralKeys: key contains underscore, bracket access required
        ...(parsed["install_requires"] as object | undefined),
      };
      return acc + Object.keys(deps).length;
    } catch {
      return acc;
    }
  }, 0);
}

interface ScanInput {
  defaultBranch: string;
  llmConfig: LlmConfig | null;
  owner: string;
  pat: string;
  repoId: string;
  repoName: string;
  scanId: string;
  userId: string;
}

async function scanCodeFile(
  db: Db,
  octokit: ReturnType<typeof createOctokit>,
  filePath: string,
  input: ScanInput
): Promise<{ content: string; hasFindings: boolean } | null> {
  const content = await getFileContent(
    octokit,
    input.owner,
    input.repoName,
    filePath
  );
  if (!content) {
    return null;
  }

  const base = {
    scanId: input.scanId,
    repoId: input.repoId,
    userId: input.userId,
    file: filePath,
    llmEnriched: false as const,
  };

  const secretMatches = scanFileForSecrets(content, filePath);
  for (const m of secretMatches) {
    await insertFinding(db, {
      ...base,
      category: "secret",
      severity: m.severity,
      title: m.title,
      description: m.description,
      line: m.line,
      snippet: m.snippet,
      remediation: m.remediation,
    });
  }

  const sastMatches = scanFileForPatterns(content, filePath);
  for (const m of sastMatches) {
    await insertFinding(db, {
      ...base,
      category: "sast",
      severity: m.severity,
      title: m.title,
      description: m.description,
      line: m.line,
      snippet: m.snippet,
      remediation: m.remediation,
    });
  }

  return {
    content,
    hasFindings: secretMatches.length > 0 || sastMatches.length > 0,
  };
}

const LLM_PHASE_TIMEOUT_MS = 180_000; // 3 minutes hard cap
const LLM_CONCURRENCY = 5;

async function runLlmPhase(
  db: Db,
  llmQueue: { path: string; content: string }[],
  llmConfig: LlmConfig,
  input: ScanInput
): Promise<string | null> {
  const toReview = llmQueue.slice(0, 30);
  const deadline = Date.now() + LLM_PHASE_TIMEOUT_MS;
  const pending = [...toReview];
  let aborted = false;
  let lastError: string | null = null;

  const workers = Array.from(
    { length: Math.min(LLM_CONCURRENCY, toReview.length) },
    async () => {
      while (pending.length > 0 && !aborted) {
        if (Date.now() > deadline) {
          return;
        }
        await checkCancelled(db, input.scanId);
        const item = pending.shift();
        if (!item) {
          return;
        }
        const { findings: llmFindings, error } = await reviewFileWithLlm(
          item.path,
          item.content,
          llmConfig
        );
        if (error) {
          lastError = error;
        }
        for (const f of llmFindings) {
          if (aborted) {
            return;
          }
          await insertFinding(db, {
            scanId: input.scanId,
            repoId: input.repoId,
            userId: input.userId,
            category: "llm",
            severity: f.severity,
            title: f.title,
            description: f.description,
            file: f.file,
            line: f.line,
            snippet: f.snippet,
            remediation: f.remediation,
            llmEnriched: true,
          });
        }
      }
    }
  );

  try {
    await Promise.all(workers);
  } catch (err) {
    aborted = true;
    if (err instanceof ScanCancelledError) {
      throw err;
    }
  }

  return lastError;
}

async function phaseDepAudit(
  db: Db,
  octokit: ReturnType<typeof createOctokit>,
  input: ScanInput,
  steps: ProgressStep[],
  knownPaths: Set<string>
): Promise<ProgressStep[]> {
  let s = await pushProgress(db, input.scanId, steps, {
    key: "audit_deps",
    label: "Auditing dependencies...",
    status: "running",
    detail: null,
  });
  const manifests = await getPackageManifests(
    octokit,
    input.owner,
    input.repoName,
    knownPaths
  );
  const totalPackages = countManifestPackages(manifests);
  const depsVulns = await auditDependencies(manifests);
  s = await updateLastProgress(db, input.scanId, s, {
    status: depsVulns.length > 0 ? "warn" : "done",
    detail:
      totalPackages > 0
        ? `${totalPackages} packages · ${depsVulns.length} vulnerable`
        : `${depsVulns.length} vulnerabilities`,
  });
  for (const vuln of depsVulns) {
    await insertFinding(db, {
      scanId: input.scanId,
      repoId: input.repoId,
      userId: input.userId,
      category: "dependency",
      severity: vuln.severity,
      title: vuln.title,
      description: [
        vuln.description,
        vuln.cveId ? `CVE: ${vuln.cveId}` : null,
        `Package: ${vuln.packageName}@${vuln.installedVersion}`,
        vuln.fixedIn ? `Fixed in: ${vuln.fixedIn}` : null,
      ]
        .filter(Boolean)
        .join("\n"),
      file: vuln.ecosystem === "npm" ? "package.json" : "requirements.txt",
      line: null,
      snippet: null,
      remediation: vuln.remediation,
      llmEnriched: false,
    });
  }
  return s;
}

async function phaseCodeScan(
  db: Db,
  octokit: ReturnType<typeof createOctokit>,
  input: ScanInput,
  steps: ProgressStep[],
  tree: TreeEntry[]
): Promise<{
  filesScanned: number;
  llmQueue: { path: string; content: string }[];
  steps: ProgressStep[];
}> {
  const scannableFiles = tree.filter(
    (e) => e.type === "blob" && shouldScan(e.path)
  );
  let s = await pushProgress(db, input.scanId, steps, {
    key: "fetch_tree",
    label: "Fetching file tree...",
    status: "running",
    detail: null,
  });
  s = await updateLastProgress(db, input.scanId, s, {
    status: "done",
    detail: `${tree.length} files · ${scannableFiles.length} scannable`,
  });

  s = await pushProgress(db, input.scanId, s, {
    key: "scan_code",
    label: "Scanning code patterns...",
    status: "running",
    detail: null,
  });
  let filesScanned = 0;
  let filesWithFindings = 0;
  const llmQueue: { path: string; content: string }[] = [];
  try {
    for (const file of scannableFiles) {
      await checkCancelled(db, input.scanId);
      const result = await scanCodeFile(db, octokit, file.path, input);
      if (!result) {
        continue;
      }
      filesScanned++;
      if (result.hasFindings) {
        filesWithFindings++;
      }
      if (
        input.llmConfig &&
        (result.hasFindings || isLlmPriorityFile(file.path))
      ) {
        llmQueue.push({ path: file.path, content: result.content });
      }
    }
  } catch (err) {
    if (err instanceof ScanCancelledError) {
      await updateLastProgress(db, input.scanId, s, {
        status: "error",
        detail: "interrupted",
      });
    }
    throw err;
  }
  s = await updateLastProgress(db, input.scanId, s, {
    status: filesWithFindings > 0 ? "warn" : "done",
    detail: `${filesScanned} files · ${filesWithFindings} flagged`,
  });
  return { steps: s, filesScanned, llmQueue };
}

export async function runScan(input: ScanInput): Promise<void> {
  const db = createDb();

  await db
    .update(scan)
    .set({ status: "running", startedAt: new Date(), progress: [] })
    .where(eq(scan.id, input.scanId));

  try {
    const octokit = createOctokit(input.pat);

    const tree = await getFileTree(
      octokit,
      input.owner,
      input.repoName,
      input.defaultBranch
    );
    const knownPaths = new Set(tree.map((e) => e.path));

    let steps = await phaseDepAudit(db, octokit, input, [], knownPaths);
    await checkCancelled(db, input.scanId);

    const {
      steps: steps2,
      filesScanned,
      llmQueue,
    } = await phaseCodeScan(db, octokit, input, steps, tree);
    steps = steps2;
    await checkCancelled(db, input.scanId);

    let llmEnriched = false;
    if (input.llmConfig && llmQueue.length > 0) {
      steps = await pushProgress(db, input.scanId, steps, {
        key: "llm_review",
        label: "LLM code review...",
        status: "running",
        detail: null,
      });
      const llmError = await runLlmPhase(db, llmQueue, input.llmConfig, input);
      llmEnriched = true;
      await updateLastProgress(db, input.scanId, steps, {
        status: llmError ? "warn" : "done",
        detail: llmError
          ? `LLM review error: ${llmError.slice(0, 120)}`
          : `${Math.min(llmQueue.length, 30)} files reviewed`,
      });
    }

    const allFindings = await db
      .select({ severity: finding.severity })
      .from(finding)
      .where(eq(finding.scanId, input.scanId));

    const summary = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
      info: 0,
      total: allFindings.length,
      filesScanned,
      llmEnriched,
    };
    for (const f of allFindings) {
      summary[f.severity]++;
    }

    await db
      .update(scan)
      .set({ status: "done", finishedAt: new Date(), summary })
      .where(and(eq(scan.id, input.scanId), eq(scan.status, "running")));
  } catch (err) {
    if (err instanceof ScanCancelledError) {
      return;
    }
    const message = err instanceof Error ? err.message : String(err);
    await db
      .update(scan)
      .set({ status: "error", finishedAt: new Date(), error: message })
      .where(and(eq(scan.id, input.scanId), eq(scan.status, "running")));
  }
}
