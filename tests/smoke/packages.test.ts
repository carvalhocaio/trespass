import { describe, expect, it } from "vitest";

describe("smoke: @trespass/crypto exports", () => {
  it("exports createCrypto as a function", async () => {
    const mod = await import("@trespass/crypto");
    expect(typeof mod.createCrypto).toBe("function");
  });

  it("createCrypto returns encrypt and decrypt", async () => {
    const { createCrypto } = await import("@trespass/crypto");
    const crypto = createCrypto("a".repeat(64));
    expect(typeof crypto.encrypt).toBe("function");
    expect(typeof crypto.decrypt).toBe("function");
  });
});

describe("smoke: scanner service exports", () => {
  it("secrets-detector exports scanFileForSecrets", async () => {
    const mod = await import("@server/services/scanner/secrets-detector");
    expect(typeof mod.scanFileForSecrets).toBe("function");
  });

  it("sast-patterns exports scanFileForPatterns", async () => {
    const mod = await import("@server/services/scanner/sast-patterns");
    expect(typeof mod.scanFileForPatterns).toBe("function");
  });

  it("deps-auditor exports auditDependencies", async () => {
    const mod = await import("@server/services/scanner/deps-auditor");
    expect(typeof mod.auditDependencies).toBe("function");
  });

  it("deps-auditor exports parseNpmDeps", async () => {
    const mod = await import("@server/services/scanner/deps-auditor");
    expect(typeof mod.parseNpmDeps).toBe("function");
  });

  it("deps-auditor exports parsePythonDeps", async () => {
    const mod = await import("@server/services/scanner/deps-auditor");
    expect(typeof mod.parsePythonDeps).toBe("function");
  });
});
