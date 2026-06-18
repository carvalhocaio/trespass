import {
  parseNpmDeps,
  parsePythonDeps,
} from "@server/services/scanner/deps-auditor";
import { describe, expect, it } from "vitest";

describe("parseNpmDeps", () => {
  it("parses production dependencies", () => {
    const content = JSON.stringify({
      dependencies: { express: "^4.18.0", zod: "3.22.0" },
    });
    const deps = parseNpmDeps(content);
    expect(deps).toHaveLength(2);
    expect(deps.find((d) => d.name === "express")?.version).toBe("4.18.0");
    expect(deps.find((d) => d.name === "zod")?.version).toBe("3.22.0");
  });

  it("parses devDependencies", () => {
    const content = JSON.stringify({
      devDependencies: { vitest: "^1.0.0" },
    });
    const deps = parseNpmDeps(content);
    expect(deps).toHaveLength(1);
    expect(deps[0]?.name).toBe("vitest");
    expect(deps[0]?.version).toBe("1.0.0");
  });

  it("merges dependencies and devDependencies", () => {
    const content = JSON.stringify({
      dependencies: { react: "18.0.0" },
      devDependencies: { typescript: "^5.0.0" },
    });
    const deps = parseNpmDeps(content);
    expect(deps).toHaveLength(2);
  });

  it("strips ^ prefix from version", () => {
    const content = JSON.stringify({ dependencies: { lodash: "^4.17.21" } });
    const [dep] = parseNpmDeps(content);
    expect(dep?.version).toBe("4.17.21");
  });

  it("strips ~ prefix from version", () => {
    const content = JSON.stringify({ dependencies: { lodash: "~4.17.0" } });
    const [dep] = parseNpmDeps(content);
    expect(dep?.version).toBe("4.17.0");
  });

  it("strips >= prefix from version", () => {
    const content = JSON.stringify({ dependencies: { pkg: ">=2.0.0" } });
    const [dep] = parseNpmDeps(content);
    expect(dep?.version).toBe("2.0.0");
  });

  it("returns empty array for malformed JSON", () => {
    const deps = parseNpmDeps("not valid json { broken");
    expect(deps).toHaveLength(0);
  });

  it("returns empty array when no dependencies key exists", () => {
    const content = JSON.stringify({ name: "my-app", version: "1.0.0" });
    const deps = parseNpmDeps(content);
    expect(deps).toHaveLength(0);
  });
});

describe("parsePythonDeps", () => {
  it("parses pinned version requirements", () => {
    const content = "requests==2.28.1\nflask==2.3.0";
    const deps = parsePythonDeps(content);
    expect(deps).toHaveLength(2);
    expect(deps.find((d) => d.name === "requests")?.version).toBe("2.28.1");
    expect(deps.find((d) => d.name === "flask")?.version).toBe("2.3.0");
  });

  it("parses >= version specifiers", () => {
    const content = "django>=4.0,<5.0";
    const deps = parsePythonDeps(content);
    expect(deps).toHaveLength(1);
    expect(deps[0]?.name).toBe("django");
    expect(deps[0]?.version).toBe("4.0");
  });

  it("skips comment lines", () => {
    const content = "# production deps\nrequests==2.28.1";
    const deps = parsePythonDeps(content);
    expect(deps).toHaveLength(1);
    expect(deps[0]?.name).toBe("requests");
  });

  it("skips -r include directives", () => {
    const content = "-r base.txt\nrequests==2.28.1";
    const deps = parsePythonDeps(content);
    expect(deps).toHaveLength(1);
  });

  it("skips empty lines", () => {
    const content = "requests==2.28.1\n\n\nflask==2.3.0\n";
    const deps = parsePythonDeps(content);
    expect(deps).toHaveLength(2);
  });

  it("returns empty array for empty content", () => {
    expect(parsePythonDeps("")).toHaveLength(0);
  });

  it("skips lines without version specifier", () => {
    const content = "requests\nflask==2.3.0";
    const deps = parsePythonDeps(content);
    // 'requests' has no version operator → no match → skipped
    expect(deps.find((d) => d.name === "flask")).toBeDefined();
    expect(deps.find((d) => d.name === "requests")).toBeUndefined();
  });
});
