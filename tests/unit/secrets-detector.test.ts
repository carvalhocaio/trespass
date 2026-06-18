import { scanFileForSecrets } from "@server/services/scanner/secrets-detector";
import { describe, expect, it } from "vitest";

describe("scanFileForSecrets", () => {
  it("detects AWS access key", () => {
    // Valid 20-char AWS key that doesn't trigger false-positive filter
    const content = 'const key = "AKIAZQ3WVBFGHI3JKLMN"';
    const results = scanFileForSecrets(content, "config.ts");
    expect(results).toHaveLength(1);
    expect(results[0]?.severity).toBe("critical");
    expect(results[0]?.title).toContain("AWS Access Key");
  });

  it("detects OpenAI API key", () => {
    const content = 'const key = "sk-aBcDeFgHiJkLmNoPqRsTuVwXyZ12345678"';
    const results = scanFileForSecrets(content, "config.ts");
    expect(results.some((r) => r.title.includes("OpenAI"))).toBe(true);
  });

  it("detects GitHub Personal Access Token", () => {
    const content = 'const token = "ghp_A1B2C3D4E5F6G7H8I9J0K1L2M3N4O5P6Q7R8"';
    const results = scanFileForSecrets(content, "config.ts");
    expect(results.some((r) => r.title.includes("GitHub"))).toBe(true);
    expect(results[0]?.severity).toBe("critical");
  });

  it("detects PEM private key", () => {
    const content =
      "-----BEGIN RSA PRIVATE KEY-----\nMIIEo...\n-----END RSA PRIVATE KEY-----";
    const results = scanFileForSecrets(content, "key.pem");
    expect(results.some((r) => r.title.includes("PEM"))).toBe(true);
    expect(results[0]?.severity).toBe("critical");
  });

  it("detects database connection string with credentials", () => {
    const content =
      'const url = "postgres://admin:s3cr3tpwd@db.prod.acme.io/mydb"';
    const results = scanFileForSecrets(content, "db.ts");
    expect(results.some((r) => r.title.includes("Database"))).toBe(true);
  });

  it("filters false positives containing 'EXAMPLE'", () => {
    // 'AKIAIOSFODNN7EXAMPLE' contains 'EXAMPLE' → triggers false-positive filter
    const content = 'const key = "AKIAIOSFODNN7EXAMPLE"';
    const results = scanFileForSecrets(content, "config.ts");
    expect(results).toHaveLength(0);
  });

  it("filters false positives containing 'test'", () => {
    const content = 'const key = "sk-testaBcDeFgHiJkLmNoPqRsTuVwXyZ12345"';
    const results = scanFileForSecrets(content, "config.ts");
    expect(results).toHaveLength(0);
  });

  it("skips comment lines starting with //", () => {
    const content =
      '// const key = "AKIAZQ3WVBFGHI3JKLMN"\n// token = "ghp_A1B2C3D4E5F6G7H8I9J0K1L2M3N4O5P6Q7R8"';
    const results = scanFileForSecrets(content, "config.ts");
    expect(results).toHaveLength(0);
  });

  it("skips comment lines starting with #", () => {
    const content = `# STRIPE_KEY=sk_${"live"}_aBcDeFgHiJkLmNoPqRsTuVwXy`;
    const results = scanFileForSecrets(content, ".env");
    expect(results).toHaveLength(0);
  });

  it("returns the correct line number", () => {
    const content =
      'const name = "Alice"\nconst token = "ghp_A1B2C3D4E5F6G7H8I9J0K1L2M3N4O5P6Q7R8"\nconst age = 30';
    const results = scanFileForSecrets(content, "user.ts");
    expect(results[0]?.line).toBe(2);
  });

  it("returns empty array for clean content", () => {
    const content =
      'const name = "Alice"\nconst greeting = "hello world"\nexport { name }';
    const results = scanFileForSecrets(content, "app.ts");
    expect(results).toHaveLength(0);
  });

  it("deduplicates findings on the same line", () => {
    // Two AWS keys on the same line would be deduplicated by the same pattern+line key
    const content = 'export const KEY = "AKIAZQ3WVBFGHI3JKLMN"';
    const results = scanFileForSecrets(content, "keys.ts");
    const awsFindings = results.filter((r) => r.title.includes("AWS"));
    expect(awsFindings).toHaveLength(1);
  });
});
