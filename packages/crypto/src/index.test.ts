import { describe, expect, it } from "vitest";
import { createCrypto } from "./index";

const TEST_KEY = "a".repeat(64);

describe("createCrypto", () => {
  it("throws when key is not 32 bytes", () => {
    expect(() => createCrypto("short")).toThrow("32 bytes");
  });

  it("returns encrypt and decrypt functions", () => {
    const { encrypt, decrypt } = createCrypto(TEST_KEY);
    expect(typeof encrypt).toBe("function");
    expect(typeof decrypt).toBe("function");
  });
});

describe("encrypt / decrypt", () => {
  const { encrypt, decrypt } = createCrypto(TEST_KEY);

  it("round-trips plaintext correctly", () => {
    const plain = "super-secret-value";
    expect(decrypt(encrypt(plain))).toBe(plain);
  });

  it("round-trips unicode content", () => {
    const plain = "senha: 🔐 chave-especial-€¥";
    expect(decrypt(encrypt(plain))).toBe(plain);
  });

  it("round-trips empty string", () => {
    expect(decrypt(encrypt(""))).toBe("");
  });

  it("produces iv:ciphertext:authtag format", () => {
    const parts = encrypt("hello").split(":");
    expect(parts).toHaveLength(3);
    // IV = 12 bytes = 24 hex chars
    expect(parts[0]).toHaveLength(24);
    // auth tag = 16 bytes = 32 hex chars
    expect(parts[2]).toHaveLength(32);
  });

  it("throws on malformed ciphertext", () => {
    expect(() => decrypt("bad-format")).toThrow("Invalid ciphertext format");
  });

  it("throws when auth tag is tampered", () => {
    const encrypted = encrypt("sensitive");
    const [iv, data] = encrypted.split(":");
    const tampered = `${iv}:${data}:${"ff".repeat(16)}`;
    expect(() => decrypt(tampered)).toThrow();
  });
});
