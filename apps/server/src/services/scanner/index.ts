import { createDb } from "@trespass/db";
import { finding, scan } from "@trespass/db/schema/app";
import {
  createOctokit,
  getFileContent,
  getFileTree,
  getPackageManifests,
} from "@trespass/github";
import { eq } from "drizzle-orm";
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

async function insertFinding(db: Db, row: FindingRow): Promise<void> {
  await db.insert(finding).values({ id: nanoid(), ...row });
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

async function runLlmPhase(
  db: Db,
  llmQueue: { path: string; content: string }[],
  llmConfig: LlmConfig,
  input: ScanInput
): Promise<void> {
  const toReview = llmQueue.slice(0, 30);
  for (const { path, content } of toReview) {
    const llmFindings = await reviewFileWithLlm(path, content, llmConfig);
    for (const f of llmFindings) {
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

export async function runScan(input: ScanInput): Promise<void> {
  const db = createDb();

  await db
    .update(scan)
    .set({ status: "running", startedAt: new Date() })
    .where(eq(scan.id, input.scanId));

  try {
    const octokit = createOctokit(input.pat);

    // Phase 1: dependency audit
    const manifests = await getPackageManifests(
      octokit,
      input.owner,
      input.repoName
    );
    const depsVulns = await auditDependencies(manifests);
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

    // Phase 2: per-file code scan
    const tree = await getFileTree(
      octokit,
      input.owner,
      input.repoName,
      input.defaultBranch
    );
    const scannableFiles = tree.filter(
      (e) => e.type === "blob" && shouldScan(e.path)
    );

    let filesScanned = 0;
    const llmQueue: { path: string; content: string }[] = [];

    for (const file of scannableFiles) {
      const result = await scanCodeFile(db, octokit, file.path, input);
      if (!result) {
        continue;
      }
      filesScanned++;
      if (
        input.llmConfig &&
        (result.hasFindings || isLlmPriorityFile(file.path))
      ) {
        llmQueue.push({ path: file.path, content: result.content });
      }
    }

    // Phase 3: LLM enrichment (optional)
    let llmEnriched = false;
    if (input.llmConfig && llmQueue.length > 0) {
      await runLlmPhase(db, llmQueue, input.llmConfig, input);
      llmEnriched = true;
    }

    // Finalize
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
      .where(eq(scan.id, input.scanId));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await db
      .update(scan)
      .set({ status: "error", finishedAt: new Date(), error: message })
      .where(eq(scan.id, input.scanId));
  }
}
