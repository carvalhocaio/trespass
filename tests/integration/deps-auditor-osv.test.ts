import { auditDependencies } from "@server/services/scanner/deps-auditor";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const MOCK_VULN = {
  id: "GHSA-test-1234-abcd",
  summary: "Prototype pollution in lodash",
  details: "Attacker can pollute Object prototype.",
  aliases: ["CVE-2021-12345"],
  severity: [{ type: "CVSS_V3", score: "9.8" }],
  affected: [
    {
      ranges: [{ type: "SEMVER", events: [{ fixed: "4.17.21" }] }],
    },
  ],
};

describe("auditDependencies", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          results: [{ vulns: [MOCK_VULN] }, { vulns: [] }],
        }),
      })
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns empty array when no manifests provided", async () => {
    const result = await auditDependencies([]);
    expect(result).toHaveLength(0);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("returns findings for vulnerable npm packages", async () => {
    const manifest = {
      type: "npm" as const,
      path: "package.json",
      content: JSON.stringify({
        dependencies: { lodash: "^4.17.20", zod: "3.22.0" },
      }),
    };

    const findings = await auditDependencies([manifest]);
    expect(findings).toHaveLength(1);
    expect(findings[0]?.packageName).toBe("lodash");
    expect(findings[0]?.severity).toBe("critical"); // CVSS 9.8
    expect(findings[0]?.cveId).toBe("CVE-2021-12345");
    expect(findings[0]?.fixedIn).toBe("4.17.21");
  });

  it("maps CVSS 9.8 to critical severity", async () => {
    const manifest = {
      type: "npm" as const,
      path: "package.json",
      content: JSON.stringify({ dependencies: { lodash: "^4.17.20" } }),
    };
    const [finding] = await auditDependencies([manifest]);
    expect(finding?.severity).toBe("critical");
  });

  it("handles OSV API failure gracefully (continues without throwing)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 500 })
    );

    const manifest = {
      type: "npm" as const,
      path: "package.json",
      content: JSON.stringify({ dependencies: { lodash: "4.17.20" } }),
    };

    await expect(auditDependencies([manifest])).resolves.toEqual([]);
  });

  it("returns empty when OSV finds no vulnerabilities", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ results: [{ vulns: [] }] }),
      })
    );

    const manifest = {
      type: "npm" as const,
      path: "package.json",
      content: JSON.stringify({ dependencies: { "safe-pkg": "1.0.0" } }),
    };

    const findings = await auditDependencies([manifest]);
    expect(findings).toHaveLength(0);
  });
});
