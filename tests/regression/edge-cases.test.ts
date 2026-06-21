import {
  parseNpmDeps,
  parsePythonDeps,
} from "@server/services/scanner/deps-auditor";
import { scanFileForPatterns } from "@server/services/scanner/sast-patterns";
import { scanFileForSecrets } from "@server/services/scanner/secrets-detector";
import { describe, expect, it } from "vitest";

/**
 * Regression tests: pin known bugs so they cannot silently resurface.
 */

describe("regression: npm version stripping (NPM_VERSION_STRIP_RE)", () => {
  // Bug: NPM_VERSION_STRIP_RE = /^[^\d]*/ strips all non-digit leading chars.
  // Previously a broader regex stripped entire versions with ^ leaving empty strings,
  // causing OSV queries to silently return zero results.

  it("strips ^ prefix correctly", () => {
    const deps = parseNpmDeps(
      JSON.stringify({ dependencies: { lodash: "^4.17.21" } })
    );
    expect(deps[0]?.version).toBe("4.17.21");
  });

  it("strips ~ prefix correctly", () => {
    const deps = parseNpmDeps(
      JSON.stringify({ dependencies: { express: "~4.18.0" } })
    );
    expect(deps[0]?.version).toBe("4.18.0");
  });

  it("strips >= prefix correctly", () => {
    const deps = parseNpmDeps(
      JSON.stringify({ dependencies: { react: ">=18.0.0" } })
    );
    expect(deps[0]?.version).toBe("18.0.0");
  });

  it("does NOT produce empty version strings", () => {
    const deps = parseNpmDeps(
      JSON.stringify({ dependencies: { pkg: "^1.2.3" } })
    );
    expect(deps[0]?.version).not.toBe("");
    expect(deps[0]?.version).toBe("1.2.3");
  });
});

describe("regression: manifest type detection", () => {
  // Bug: manifest type comparison in auditDependencies used wrong field values,
  // causing npm manifest to never be found and dep findings to always be zero.

  it("parseNpmDeps handles package.json with both dep blocks", () => {
    const content = JSON.stringify({
      name: "app",
      dependencies: { axios: "1.0.0" },
      devDependencies: { vitest: "1.0.0" },
    });
    const deps = parseNpmDeps(content);
    expect(deps).toHaveLength(2);
    expect(deps.some((d) => d.name === "axios")).toBe(true);
    expect(deps.some((d) => d.name === "vitest")).toBe(true);
  });

  it("parsePythonDeps handles requirements.txt with pinned and range deps", () => {
    const content = [
      "# Web framework",
      "django==4.2.0",
      "requests>=2.28.0",
      "",
      "-r extras.txt",
    ].join("\n");
    const deps = parsePythonDeps(content);
    expect(deps).toHaveLength(2);
    expect(deps.some((d) => d.name === "django")).toBe(true);
    expect(deps.some((d) => d.name === "requests")).toBe(true);
  });
});

describe("regression: secrets detector false positive handling", () => {
  // Ensure that adding new patterns doesn't break the false-positive filter

  it("does not flag lines with 'example' in the matched value", () => {
    // 'AKIAIOSFODNN7EXAMPLE' triggers /example/i false-positive filter
    const content = 'const KEY = "AKIAIOSFODNN7EXAMPLE"';
    expect(scanFileForSecrets(content, "config.ts")).toHaveLength(0);
  });

  it("does not flag comment lines even with valid-looking secrets", () => {
    const lines = [
      `// const key = '${"AKIA"}ZQ3WVBFGHI3JKLMN'`,
      `# SECRET=sk_${"live"}_aBcDeFgHiJkLmNoPqRsTuVwXy`,
      `* @param token - ${"ghp_"}A1B2C3D4E5F6G7H8I9J0K1L2M3N4O5P6Q7R8`,
    ];
    for (const line of lines) {
      const results = scanFileForSecrets(line, "config.ts");
      expect(results, `Should not flag: ${line}`).toHaveLength(0);
    }
  });
});

describe("regression: SAST extension filter", () => {
  // Ensure patterns with extension filters are not applied to wrong file types

  it("eval pattern not flagged in .py files", () => {
    const code = `result = ${"eval"}(x)`;
    const results = scanFileForPatterns(code, "script.py");
    expect(results.some((r) => r.title.includes("eval"))).toBe(false);
  });

  it("Math.random() not flagged in .py files", () => {
    const results = scanFileForPatterns("x = Math.random()", "script.py");
    expect(results.some((r) => r.title.includes("random"))).toBe(false);
  });
});
