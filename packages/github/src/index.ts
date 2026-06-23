export type { Octokit } from "@octokit/rest";

import { Octokit } from "@octokit/rest";

export interface RepoInfo {
  defaultBranch: string;
  description: string | null;
  fullName: string;
  githubId: number;
  htmlUrl: string;
  isPrivate: boolean;
  language: string | null;
  name: string;
}

export interface TreeEntry {
  path: string;
  sha: string;
  size?: number;
  type: "blob" | "tree";
}

export interface PackageManifest {
  content: string;
  path: string;
  type: "npm" | "python" | "go" | "cargo" | "composer";
}

/**
 * Creates an Octokit REST client authenticated with the user's PAT.
 * The PAT is decrypted by the caller immediately before use and never stored.
 */
export function createOctokit(pat: string): Octokit {
  return new Octokit({
    auth: pat,
    userAgent: "trespass/1.0",
  });
}

/**
 * Lists all repositories accessible to the authenticated user,
 * including private repos when using a PAT with `repo` scope.
 */
export async function listUserRepos(octokit: Octokit): Promise<RepoInfo[]> {
  const repos: RepoInfo[] = [];
  let page = 1;

  while (true) {
    const { data } = await octokit.rest.repos.listForAuthenticatedUser({
      per_page: 100,
      page,
      sort: "updated",
      affiliation: "owner,collaborator,organization_member",
    });

    for (const repo of data) {
      repos.push({
        githubId: repo.id,
        name: repo.name,
        fullName: repo.full_name,
        description: repo.description ?? null,
        isPrivate: repo.private,
        defaultBranch: repo.default_branch,
        language: repo.language ?? null,
        htmlUrl: repo.html_url,
      });
    }

    if (data.length < 100) {
      break;
    }
    page++;
  }

  return repos;
}

/**
 * Returns the full file tree of a repository at the given ref (branch/sha).
 * Uses the recursive trees API — one request for the full tree.
 */
export async function getFileTree(
  octokit: Octokit,
  owner: string,
  repo: string,
  ref: string
): Promise<TreeEntry[]> {
  const { data } = await octokit.rest.git.getTree({
    owner,
    repo,
    tree_sha: ref,
    recursive: "true",
  });

  return (data.tree ?? [])
    .filter(
      (e): e is typeof e & { path: string; type: "blob" | "tree" } =>
        e.path !== undefined && (e.type === "blob" || e.type === "tree")
    )
    .map((e) => ({
      path: e.path,
      type: e.type,
      sha: e.sha ?? "",
      size: e.size,
    }));
}

/**
 * Returns the decoded content of a single file.
 * Returns null if the file is too large (>1 MB) or binary.
 */
export async function getFileContent(
  octokit: Octokit,
  owner: string,
  repo: string,
  path: string
): Promise<string | null> {
  try {
    const { data } = await octokit.rest.repos.getContent({
      owner,
      repo,
      path,
    });

    if (Array.isArray(data) || data.type !== "file") {
      return null;
    }
    if (!data.content) {
      return null;
    }
    // GitHub returns base64-encoded content with newlines
    return Buffer.from(data.content, "base64").toString("utf8");
  } catch {
    return null;
  }
}

const MANIFEST_PATHS: Record<PackageManifest["type"], string[]> = {
  npm: ["package.json", "package-lock.json", "yarn.lock", "pnpm-lock.yaml"],
  python: ["requirements.txt", "Pipfile", "pyproject.toml", "setup.py"],
  go: ["go.mod", "go.sum"],
  cargo: ["Cargo.toml", "Cargo.lock"],
  composer: ["composer.json", "composer.lock"],
};

/**
 * Fetches all dependency manifest files present in the repository root.
 * Used by the dependency vulnerability scanner.
 */
export async function getPackageManifests(
  octokit: Octokit,
  owner: string,
  repo: string
): Promise<PackageManifest[]> {
  const manifests: PackageManifest[] = [];

  for (const [type, paths] of Object.entries(MANIFEST_PATHS) as [
    PackageManifest["type"],
    string[],
  ][]) {
    for (const path of paths) {
      const content = await getFileContent(octokit, owner, repo, path);
      if (content !== null) {
        manifests.push({ type, path, content });
      }
    }
  }

  return manifests;
}

export interface DuplicateIssueResult {
  duplicate: boolean;
  issueNumber: number | null;
  issueUrl: string | null;
}

export async function checkForDuplicateIssue(
  octokit: Octokit,
  owner: string,
  repo: string,
  title: string
): Promise<DuplicateIssueResult> {
  try {
    const { data } = await octokit.rest.issues.listForRepo({
      owner,
      repo,
      state: "open",
      per_page: 100,
      page: 1,
    });
    const match = data.find((issue) => issue.title === title);
    if (match) {
      return {
        duplicate: true,
        issueNumber: match.number,
        issueUrl: match.html_url,
      };
    }
    return { duplicate: false, issueNumber: null, issueUrl: null };
  } catch {
    return { duplicate: false, issueNumber: null, issueUrl: null };
  }
}
