import { auditDependencies } from "@server/services/scanner/deps-auditor";
import { afterEach, describe, expect, it, vi } from "vitest";

function mockOsv(resultsByCall: unknown[]): void {
  const fetchMock = vi.fn();
  for (const results of resultsByCall) {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => results,
    });
  }
  vi.stubGlobal("fetch", fetchMock);
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("auditDependencies — severity, ecosystem and fallback branches", () => {
  it("maps CVSS bands, python ecosystem and remediation variants", async () => {
    const npm = {
      type: "npm" as const,
      path: "package.json",
      content: JSON.stringify({ dependencies: { "high-pkg": "1.0.0" } }),
    };
    const python = {
      type: "python" as const,
      path: "requirements.txt",
      content: ["med-pkg==2.0.0", "low-pkg==3.0.0", "nocve-pkg==4.0.0"].join(
        "\n"
      ),
    };

    // One results entry per package, in push order: npm first, then python.
    mockOsv([
      {
        results: [
          {
            // high-pkg — CVSS 7.5 high, has a fixed version → "Update ..."
            vulns: [
              {
                id: "GHSA-high",
                summary: "High sev issue",
                details: "details here",
                aliases: ["CVE-2020-1111"],
                severity: [{ type: "CVSS_V3", score: "7.5" }],
                affected: [{ ranges: [{ events: [{ fixed: "1.0.1" }] }] }],
              },
            ],
          },
          {
            // med-pkg — CVSS 5.0 medium, no fixed version → "Review ..."
            vulns: [
              {
                id: "GHSA-med",
                details: "medium details",
                aliases: [],
                severity: [{ type: "CVSS_V3", score: "5.0" }],
              },
            ],
          },
          {
            // low-pkg — no severity array → defaults to low; no details/summary.
            // affected ranges present but with no `fixed` event exercises the
            // fixedVersion loops falling through to null.
            vulns: [
              {
                id: "GHSA-low",
                aliases: ["GHSA-low"],
                affected: [{ ranges: [{ events: [{ introduced: "0" }] }] }],
              },
            ],
          },
          {
            // nocve-pkg — alias present but no CVE- entry → cveId null
            vulns: [
              {
                id: "GHSA-nocve",
                summary: "some summary",
                aliases: ["GHSA-xyz"],
                severity: [{ type: "CVSS_V3", score: "8.9" }],
              },
            ],
          },
        ],
      },
    ]);

    const findings = await auditDependencies([npm, python]);
    const byPkg = new Map(findings.map((f) => [f.packageName, f]));

    expect(byPkg.get("high-pkg")).toMatchObject({
      severity: "high",
      ecosystem: "npm",
      cveId: "CVE-2020-1111",
      fixedIn: "1.0.1",
      remediation: "Update high-pkg to version 1.0.1 or later.",
    });
    expect(byPkg.get("med-pkg")).toMatchObject({
      severity: "medium",
      ecosystem: "python",
      cveId: null,
      fixedIn: null,
      remediation: "Review GHSA-med and update med-pkg to a patched version.",
    });
    expect(byPkg.get("low-pkg")).toMatchObject({
      severity: "low",
      title: "Vulnerability in low-pkg",
      description: "See OSV entry for details.",
    });
    expect(byPkg.get("nocve-pkg")).toMatchObject({
      severity: "high",
      cveId: null,
      description: "some summary",
    });
  });

  it("handles scoped packages, empty ranges and short result arrays", async () => {
    const npm = {
      type: "npm" as const,
      path: "package.json",
      content: JSON.stringify({
        dependencies: { "@scope/pkg": "1.0.0", "plain-pkg": "2.0.0" },
      }),
    };
    // Only one result entry for two queries — the second falls back to [].
    mockOsv([
      {
        results: [
          {
            vulns: [
              {
                id: "GHSA-scoped",
                summary: "scoped vuln",
                aliases: [],
                severity: [{ type: "CVSS_V3", score: "6.0" }],
                // affected with no ranges, and a range with no events, exercises
                // the fixedVersion `?? []` fallbacks.
                affected: [{}, { ranges: [{}] }],
              },
            ],
          },
        ],
      },
    ]);

    const findings = await auditDependencies([npm]);
    // The scoped package key "@scope/pkg@1.0.0" splits on "@" to an empty pkg
    // name, so the ecosystem lookup falls back to npm.
    expect(findings).toHaveLength(1);
    expect(findings[0]?.ecosystem).toBe("npm");
    expect(findings[0]?.fixedIn).toBeNull();
  });

  it("batches queries in chunks of 100", async () => {
    const deps: Record<string, string> = {};
    for (let i = 0; i < 101; i++) {
      deps[`pkg-${i}`] = "1.0.0";
    }
    const npm = {
      type: "npm" as const,
      path: "package.json",
      content: JSON.stringify({ dependencies: deps }),
    };
    // Two batches (100 + 1); both return no vulns.
    mockOsv([
      { results: Array.from({ length: 100 }, () => ({ vulns: [] })) },
      { results: [{ vulns: [] }] },
    ]);

    const findings = await auditDependencies([npm]);

    expect(findings).toEqual([]);
    expect(fetch).toHaveBeenCalledTimes(2);
  });
});
