import { scanFileForPatterns } from "@server/services/scanner/sast-patterns";
import { describe, expect, it } from "vitest";

describe("scanFileForPatterns", () => {
  it("detects eval in TypeScript files", () => {
    const content = `const result = ${"eval"}(userInput)`;
    const results = scanFileForPatterns(content, "script.ts");
    expect(results.some((r) => r.title.includes("eval"))).toBe(true);
    expect(results[0]?.severity).toBe("critical");
  });

  it("does NOT flag eval in .py files (extension filter)", () => {
    const content = `result = ${"eval"}(user_input)`;
    const results = scanFileForPatterns(content, "script.py");
    // eval pattern only applies to ts, js, mjs, cjs
    expect(results.some((r) => r.title.includes("eval"))).toBe(false);
  });

  it("detects potential SQL injection via string concatenation", () => {
    const content = `const ${"query"} = "SELECT * FROM users WHERE id = " + id`;
    const results = scanFileForPatterns(content, "repo.ts");
    expect(results.some((r) => r.title.includes("SQL"))).toBe(true);
    expect(results[0]?.severity).toBe("critical");
  });

  it("detects Math.random() as non-cryptographic random", () => {
    const content = "const token = Math.random().toString(36)";
    const results = scanFileForPatterns(content, "auth.ts");
    expect(results.some((r) => r.title.includes("Non-Cryptographic"))).toBe(
      true
    );
    expect(results[0]?.severity).toBe("high");
  });

  it("detects MD5 usage as weak hash", () => {
    const content = "const hash = md5(password)";
    const results = scanFileForPatterns(content, "hash.ts");
    expect(results.some((r) => r.title.includes("MD5"))).toBe(true);
    expect(results[0]?.severity).toBe("high");
  });

  it("detects SHA-1 as weak hash", () => {
    const content = "const sig = sha1(data)";
    const results = scanFileForPatterns(content, "crypto.ts");
    expect(results.some((r) => r.title.includes("SHA-1"))).toBe(true);
  });

  it("detects innerHTML assignment as potential XSS", () => {
    const content = "element.innerHTML = userContent";
    const results = scanFileForPatterns(content, "dom.ts");
    expect(results.some((r) => r.title.includes("innerHTML"))).toBe(true);
    expect(results[0]?.severity).toBe("high");
  });

  it("detects TLS/SSL verification disabled", () => {
    const content = `const agent = new https.Agent({ ${"rejectUnauthorized"}: false })`;
    const results = scanFileForPatterns(content, "http.ts");
    expect(results.some((r) => r.title.includes("TLS"))).toBe(true);
    expect(results[0]?.severity).toBe("critical");
  });

  it("detects JWT 'none' algorithm acceptance", () => {
    const content = `verify(token, secret, { algorithms: ['${"none"}'] })`;
    const results = scanFileForPatterns(content, "auth.ts");
    expect(results.some((r) => r.title.includes("JWT"))).toBe(true);
    expect(results[0]?.severity).toBe("critical");
  });

  it("detects console.log as debug statement", () => {
    const content = "console.log('user data:', user)";
    const results = scanFileForPatterns(content, "handler.ts");
    expect(results.some((r) => r.severity === "info")).toBe(true);
  });

  it("returns correct line number", () => {
    const content = `const a = 1\nconst b = ${"eval"}(input)\nconst c = 3`;
    const results = scanFileForPatterns(content, "file.ts");
    const evalMatch = results.find((r) => r.title.includes("eval"));
    expect(evalMatch?.line).toBe(2);
  });

  it("returns empty array for clean code", () => {
    const content =
      "const add = (a: number, b: number) => a + b\nexport { add }";
    const results = scanFileForPatterns(content, "math.ts");
    expect(results).toHaveLength(0);
  });

  it("respects extension filter — MD5 not flagged in unsupported extension", () => {
    // MD5 pattern: extensions include ts, js, py, php, java, go, rb — not .yaml
    const content = "hash: md5(value)";
    const results = scanFileForPatterns(content, "config.yaml");
    expect(results.some((r) => r.title.includes("MD5"))).toBe(false);
  });
});
