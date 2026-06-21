import { scanFileForPatterns } from "@server/services/scanner/sast-patterns";
import { scanFileForSecrets } from "@server/services/scanner/secrets-detector";
import { describe, expect, it } from "vitest";

/**
 * Security coverage tests: verify that each known attack pattern category
 * is detected by at least one scanner. These tests pin the detection surface
 * so regressions are immediately visible.
 */
describe("secrets detector coverage", () => {
  const CASES: [string, string, string][] = [
    ["AWS Access Key", 'const k = "AKIAZQ3WVBFGHI3JKLMN"', "AWS Access Key"],
    [
      "OpenAI key",
      'const k = "sk-aBcDeFgHiJkLmNoPqRsTuVwXyZ12345678"',
      "OpenAI",
    ],
    [
      "Anthropic key",
      'const k = "sk-ant-aBcDeFgHiJkLmNoPqRsTuVwXyZaBcDeFgH"',
      "Anthropic",
    ],
    [
      "GitHub PAT",
      'const t = "ghp_A1B2C3D4E5F6G7H8I9J0K1L2M3N4O5P6Q7R8"',
      "GitHub",
    ],
    ["PEM key", "-----BEGIN RSA PRIVATE KEY-----", "PEM"],
    [
      "Stripe live key",
      `const k = "sk_${"live"}_aBcDeFgHiJkLmNoPqRsTuVwXy"`,
      "Stripe",
    ],
    [
      "Database URL",
      'const u = "postgres://user:pwd@db.prod.acme.io/mydb"',
      "Database",
    ],
  ];

  for (const [label, content, titleFragment] of CASES) {
    it(`detects ${label}`, () => {
      const results = scanFileForSecrets(content, "test.ts");
      expect(
        results.some((r) => r.title.includes(titleFragment)),
        `Expected to find "${titleFragment}" in results for: ${content}`
      ).toBe(true);
    });
  }
});

describe("SAST pattern coverage", () => {
  const CASES: [string, string, string, string][] = [
    [
      "SQL injection",
      'const sql = "SELECT * FROM users WHERE id = " + id',
      "SQL",
      "ts",
    ],
    ["eval() injection", "eval(userInput)", "eval", "ts"],
    ["command injection", "execSync(userCommand)", "Command", "ts"],
    ["XSS innerHTML", "div.innerHTML = userInput", "innerHTML", "ts"],
    ["path traversal", "readFile(req.params.path)", "Path", "ts"],
    ["weak hash MD5", "md5(password)", "MD5", "ts"],
    ["weak hash SHA-1", "sha1(data)", "SHA-1", "ts"],
    ["insecure random", "Math.random()", "Non-Cryptographic", "ts"],
    ["JWT none alg", "algorithms: ['none']", "JWT", "ts"],
    ["SSL verify off", `${"rejectUnauthorized"}: false`, "TLS", "ts"],
  ];

  for (const [label, content, titleFragment, ext] of CASES) {
    it(`detects ${label}`, () => {
      const results = scanFileForPatterns(content, `file.${ext}`);
      expect(
        results.some((r) => r.title.includes(titleFragment)),
        `Expected to find "${titleFragment}" in results for: ${content}`
      ).toBe(true);
    });
  }
});
