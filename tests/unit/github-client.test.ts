import {
  checkForDuplicateIssue,
  createOctokit,
  getFileContent,
  getFileTree,
  getPackageManifests,
  listUserRepos,
  type Octokit,
} from "@trespass/github";
import { describe, expect, it, vi } from "vitest";

// The exported helpers take an Octokit instance as a parameter, so we build a
// minimal fake with only the `rest.*` methods each helper touches — no need to
// mock the module itself.
function fakeOctokit(rest: Record<string, unknown>): Octokit {
  return { rest } as unknown as Octokit;
}

describe("createOctokit", () => {
  it("returns an Octokit instance authenticated with the PAT", () => {
    const octokit = createOctokit("ghp_token");
    expect(octokit).toBeDefined();
    expect(octokit.rest).toBeDefined();
  });
});

describe("listUserRepos", () => {
  it("maps repo fields and stops when a page is not full", async () => {
    const listForAuthenticatedUser = vi.fn().mockResolvedValue({
      data: [
        {
          id: 1,
          name: "repo",
          full_name: "owner/repo",
          description: "desc",
          private: true,
          default_branch: "main",
          language: "TypeScript",
          html_url: "https://github.com/owner/repo",
        },
      ],
    });
    const octokit = fakeOctokit({ repos: { listForAuthenticatedUser } });

    const repos = await listUserRepos(octokit);

    expect(repos).toEqual([
      {
        githubId: 1,
        name: "repo",
        fullName: "owner/repo",
        description: "desc",
        isPrivate: true,
        defaultBranch: "main",
        language: "TypeScript",
        htmlUrl: "https://github.com/owner/repo",
      },
    ]);
    expect(listForAuthenticatedUser).toHaveBeenCalledTimes(1);
  });

  it("coerces null description/language and paginates across full pages", async () => {
    const firstPage = {
      data: Array.from({ length: 100 }, (_, i) => ({
        id: i,
        name: `repo-${i}`,
        full_name: `owner/repo-${i}`,
        description: null,
        private: false,
        default_branch: "main",
        language: null,
        html_url: `https://github.com/owner/repo-${i}`,
      })),
    };
    const secondPage = { data: [] };
    const listForAuthenticatedUser = vi
      .fn()
      .mockResolvedValueOnce(firstPage)
      .mockResolvedValueOnce(secondPage);
    const octokit = fakeOctokit({ repos: { listForAuthenticatedUser } });

    const repos = await listUserRepos(octokit);

    expect(repos).toHaveLength(100);
    expect(repos[0]?.description).toBeNull();
    expect(repos[0]?.language).toBeNull();
    expect(listForAuthenticatedUser).toHaveBeenCalledTimes(2);
  });
});

describe("getFileTree", () => {
  it("keeps blobs/trees with a path and drops the rest", async () => {
    const getTree = vi.fn().mockResolvedValue({
      data: {
        tree: [
          { path: "src/a.ts", type: "blob", sha: "sha-a", size: 10 },
          { path: "src", type: "tree", sha: "sha-dir" },
          { path: undefined, type: "blob", sha: "no-path" },
          { path: "commit", type: "commit", sha: "sha-c" },
        ],
      },
    });
    const octokit = fakeOctokit({ git: { getTree } });

    const entries = await getFileTree(octokit, "owner", "repo", "main");

    expect(entries).toEqual([
      { path: "src/a.ts", type: "blob", sha: "sha-a", size: 10 },
      { path: "src", type: "tree", sha: "sha-dir", size: undefined },
    ]);
  });

  it("handles a missing tree array", async () => {
    const getTree = vi.fn().mockResolvedValue({ data: {} });
    const octokit = fakeOctokit({ git: { getTree } });

    const entries = await getFileTree(octokit, "owner", "repo", "main");

    expect(entries).toEqual([]);
  });
});

describe("getFileContent", () => {
  it("decodes base64 file content", async () => {
    const content = Buffer.from("hello world", "utf8").toString("base64");
    const getContent = vi
      .fn()
      .mockResolvedValue({ data: { type: "file", content } });
    const octokit = fakeOctokit({ repos: { getContent } });

    const result = await getFileContent(octokit, "owner", "repo", "a.txt");

    expect(result).toBe("hello world");
  });

  it("returns null for a directory response", async () => {
    const getContent = vi.fn().mockResolvedValue({ data: [{}, {}] });
    const octokit = fakeOctokit({ repos: { getContent } });

    expect(await getFileContent(octokit, "o", "r", "dir")).toBeNull();
  });

  it("returns null when the entry is not a file", async () => {
    const getContent = vi
      .fn()
      .mockResolvedValue({ data: { type: "submodule" } });
    const octokit = fakeOctokit({ repos: { getContent } });

    expect(await getFileContent(octokit, "o", "r", "sub")).toBeNull();
  });

  it("returns null when content is empty", async () => {
    const getContent = vi
      .fn()
      .mockResolvedValue({ data: { type: "file", content: "" } });
    const octokit = fakeOctokit({ repos: { getContent } });

    expect(await getFileContent(octokit, "o", "r", "empty")).toBeNull();
  });

  it("returns null when the API throws (too large / 404)", async () => {
    const getContent = vi.fn().mockRejectedValue(new Error("too large"));
    const octokit = fakeOctokit({ repos: { getContent } });

    expect(await getFileContent(octokit, "o", "r", "big")).toBeNull();
  });
});

describe("getPackageManifests", () => {
  it("collects present manifests and honors knownPaths filtering", async () => {
    const files: Record<string, string> = {
      "package.json": '{"name":"x"}',
      "requirements.txt": "flask==2.0",
    };
    const getContent = vi.fn(({ path }: { path: string }) => {
      const content = files[path];
      if (content === undefined) {
        return Promise.reject(new Error("404"));
      }
      return Promise.resolve({
        data: {
          type: "file",
          content: Buffer.from(content).toString("base64"),
        },
      });
    });
    const octokit = fakeOctokit({ repos: { getContent } });
    const knownPaths = new Set(["package.json", "requirements.txt"]);

    const manifests = await getPackageManifests(
      octokit,
      "owner",
      "repo",
      knownPaths
    );

    expect(manifests).toEqual([
      { type: "npm", path: "package.json", content: '{"name":"x"}' },
      { type: "python", path: "requirements.txt", content: "flask==2.0" },
    ]);
    // knownPaths gates the request: only the two known files are fetched.
    expect(getContent).toHaveBeenCalledTimes(2);
  });

  it("probes every manifest path when knownPaths is omitted", async () => {
    const getContent = vi.fn().mockResolvedValue({ data: [] });
    const octokit = fakeOctokit({ repos: { getContent } });

    const manifests = await getPackageManifests(octokit, "owner", "repo");

    expect(manifests).toEqual([]);
    expect(getContent.mock.calls.length).toBeGreaterThan(2);
  });
});

describe("checkForDuplicateIssue", () => {
  it("reports an open duplicate on an exact title match", async () => {
    const issuesAndPullRequests = vi.fn().mockResolvedValue({
      data: {
        items: [
          {
            title: "Other",
            state: "closed",
            number: 1,
            html_url: "u1",
          },
          {
            title: "[Security] Leak",
            state: "open",
            number: 42,
            html_url: "https://github.com/o/r/issues/42",
          },
        ],
      },
    });
    const octokit = fakeOctokit({ search: { issuesAndPullRequests } });

    const result = await checkForDuplicateIssue(
      octokit,
      "o",
      "r",
      "[Security] Leak"
    );

    expect(result).toEqual({
      duplicate: true,
      isOpen: true,
      issueNumber: 42,
      issueUrl: "https://github.com/o/r/issues/42",
    });
  });

  it("returns not-duplicate when no title matches", async () => {
    const issuesAndPullRequests = vi
      .fn()
      .mockResolvedValue({ data: { items: [{ title: "Nope" }] } });
    const octokit = fakeOctokit({ search: { issuesAndPullRequests } });

    const result = await checkForDuplicateIssue(octokit, "o", "r", "Missing");

    expect(result).toEqual({
      duplicate: false,
      isOpen: null,
      issueNumber: null,
      issueUrl: null,
    });
  });

  it("swallows API errors and returns not-duplicate", async () => {
    const issuesAndPullRequests = vi
      .fn()
      .mockRejectedValue(new Error("rate limited"));
    const octokit = fakeOctokit({ search: { issuesAndPullRequests } });

    const result = await checkForDuplicateIssue(octokit, "o", "r", "x");

    expect(result.duplicate).toBe(false);
  });
});
