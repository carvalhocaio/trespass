import { createCrypto } from "@trespass/crypto";
import { describe, expect, it } from "vitest";

const KEY = "c".repeat(64);
const { encrypt, decrypt } = createCrypto(KEY);

describe("crypto security properties", () => {
  it("ciphertext does not contain plaintext", () => {
    const plain = "super-secret-api-key-12345";
    const cipher = encrypt(plain);
    expect(cipher).not.toContain(plain);
  });

  it("ciphertext does not contain plaintext in hex-encoded form", () => {
    const plain = "hello";
    const plainHex = Buffer.from(plain).toString("hex");
    const cipher = encrypt(plain);
    // The ciphertext field (middle part) should differ from the hex of plaintext
    const cipherHex = cipher.split(":")[1];
    expect(cipherHex).not.toBe(plainHex);
  });

  it("tampered auth tag causes decryption to throw", () => {
    const cipher = encrypt("sensitive-data");
    const [iv, data] = cipher.split(":");
    const tampered = `${iv}:${data}:${"ff".repeat(16)}`;
    expect(() => decrypt(tampered)).toThrow();
  });

  it("tampered ciphertext body causes decryption to throw", () => {
    const cipher = encrypt("sensitive-data");
    const [iv, , tag] = cipher.split(":");
    const tampered = `${iv}:${"00".repeat(16)}:${tag}`;
    expect(() => decrypt(tampered)).toThrow();
  });

  it("tampered IV causes decryption to throw", () => {
    const cipher = encrypt("sensitive-data");
    const [, data, tag] = cipher.split(":");
    const tampered = `${"00".repeat(12)}:${data}:${tag}`;
    expect(() => decrypt(tampered)).toThrow();
  });

  it("output is not deterministic (different IVs per call)", () => {
    const outputs = new Set(Array.from({ length: 20 }, () => encrypt("x")));
    // All 20 encryptions should be unique (IV randomization)
    expect(outputs.size).toBe(20);
  });

  it("rejects key shorter than 32 bytes", () => {
    expect(() => createCrypto("tooshort")).toThrow();
  });

  it("rejects key longer than 32 bytes", () => {
    expect(() => createCrypto("a".repeat(66))).toThrow();
  });
});
