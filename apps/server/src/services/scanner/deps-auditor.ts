import type { PackageManifest } from "@trespass/github";

const NPM_VERSION_STRIP_RE = /^[^\d]*/;
const PY_DEP_RE = /^([A-Za-z0-9_\-.]+)[>=<!~^]+([A-Za-z0-9._*]+)/;

export interface DepsVuln {
  cveId: string | null;
  description: string;
  ecosystem: "npm" | "python";
  fixedIn: string | null;
  installedVersion: string;
  packageName: string;
  remediation: string;
  severity: "critical" | "high" | "medium" | "low";
  title: string;
}

interface OsvVuln {
  affected?: {
    ranges?: {
      type: string;
      events?: { fixed?: string }[];
    }[];
  }[];
  aliases?: string[];
  details?: string;
  id: string;
  severity?: { type: string; score: string }[];
  summary?: string;
}

interface OsvBatchResult {
  results: { vulns?: OsvVuln[] }[];
}

/** Maps CVSS scores to our severity enum */
function cvssToSeverity(score: string | undefined): DepsVuln["severity"] {
  const n = Number.parseFloat(score ?? "0");
  if (n >= 9.0) {
    return "critical";
  }
  if (n >= 7.0) {
    return "high";
  }
  if (n >= 4.0) {
    return "medium";
  }
  return "low";
}

function parseSeverity(vuln: OsvVuln): DepsVuln["severity"] {
  const cvss = vuln.severity?.find((s) => s.type === "CVSS_V3");
  return cvssToSeverity(cvss?.score);
}

function fixedVersion(vuln: OsvVuln): string | null {
  for (const affected of vuln.affected ?? []) {
    for (const range of affected.ranges ?? []) {
      for (const event of range.events ?? []) {
        if (event.fixed) {
          return event.fixed;
        }
      }
    }
  }
  return null;
}

function findCve(vuln: OsvVuln): string | null {
  return vuln.aliases?.find((a) => a.startsWith("CVE-")) ?? null;
}

// ─── npm (package.json) ───────────────────────────────────────────────────────

interface NpmPackageJson {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

function parseNpmDeps(content: string): { name: string; version: string }[] {
  try {
    const pkg = JSON.parse(content) as NpmPackageJson;
    const all = {
      ...pkg.dependencies,
      ...pkg.devDependencies,
    };
    return Object.entries(all).map(([name, version]) => ({
      name,
      version: version.replace(NPM_VERSION_STRIP_RE, ""),
    }));
  } catch {
    return [];
  }
}

// ─── Python (requirements.txt) ────────────────────────────────────────────────

function parsePythonDeps(content: string): { name: string; version: string }[] {
  return content
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#") && !line.startsWith("-"))
    .map((line) => {
      const match = PY_DEP_RE.exec(line);
      if (!match) {
        return null;
      }
      return { name: match[1] ?? "", version: match[2] ?? "" };
    })
    .filter((d): d is { name: string; version: string } => d !== null);
}

// ─── OSV batch query ──────────────────────────────────────────────────────────

const OSV_BATCH_URL = "https://api.osv.dev/v1/querybatch";
const BATCH_SIZE = 100; // OSV supports up to 1000 but 100 keeps payloads small

async function queryOsv(
  packages: { name: string; version: string; ecosystem: string }[]
): Promise<Map<string, OsvVuln[]>> {
  const results = new Map<string, OsvVuln[]>();

  for (let i = 0; i < packages.length; i += BATCH_SIZE) {
    const batch = packages.slice(i, i + BATCH_SIZE);
    const body = {
      queries: batch.map((p) => ({
        version: p.version,
        package: { name: p.name, ecosystem: p.ecosystem },
      })),
    };

    const res = await fetch(OSV_BATCH_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      continue;
    }

    const data = (await res.json()) as OsvBatchResult;
    for (let j = 0; j < batch.length; j++) {
      const pkg = batch[j];
      const vulns = data.results[j]?.vulns ?? [];
      if (pkg && vulns.length > 0) {
        results.set(`${pkg.name}@${pkg.version}`, vulns);
      }
    }
  }

  return results;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Audits dependency manifests against the OSV.dev vulnerability database.
 * Returns one finding per (package, vuln) pair.
 */
export async function auditDependencies(
  manifests: PackageManifest[]
): Promise<DepsVuln[]> {
  const npmManifest = manifests.find(
    (m) => m.type === "npm" && m.path === "package.json"
  );
  const pyManifest = manifests.find(
    (m) => m.type === "python" && m.path === "requirements.txt"
  );

  const packages: { name: string; version: string; ecosystem: string }[] = [];
  const ecosystemByName = new Map<string, "npm" | "python">();

  if (npmManifest) {
    for (const dep of parseNpmDeps(npmManifest.content)) {
      packages.push({ ...dep, ecosystem: "npm" });
      ecosystemByName.set(dep.name, "npm");
    }
  }

  if (pyManifest) {
    for (const dep of parsePythonDeps(pyManifest.content)) {
      packages.push({ ...dep, ecosystem: "PyPI" });
      ecosystemByName.set(dep.name, "python");
    }
  }

  if (packages.length === 0) {
    return [];
  }

  const osvResults = await queryOsv(packages);
  const findings: DepsVuln[] = [];

  for (const [key, vulns] of osvResults) {
    const [pkgName, version] = key.split("@") as [string, string];
    const ecosystem = ecosystemByName.get(pkgName) ?? "npm";

    for (const vuln of vulns) {
      const fixed = fixedVersion(vuln);
      findings.push({
        packageName: pkgName,
        installedVersion: version,
        ecosystem,
        severity: parseSeverity(vuln),
        title: vuln.summary ?? `Vulnerability in ${pkgName}`,
        description:
          vuln.details ?? vuln.summary ?? "See OSV entry for details.",
        cveId: findCve(vuln),
        fixedIn: fixed,
        remediation: fixed
          ? `Update ${pkgName} to version ${fixed} or later.`
          : `Review ${vuln.id} and update ${pkgName} to a patched version.`,
      });
    }
  }

  return findings;
}
