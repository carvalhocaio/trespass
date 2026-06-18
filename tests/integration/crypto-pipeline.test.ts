import { createCrypto } from "@trespass/crypto";
import { describe, expect, it } from "vitest";

const KEY = "b".repeat(64);

describe("crypto round-trip pipeline", () => {
  const { encrypt, decrypt } = createCrypto(KEY);

  it("encrypt → decrypt returns the original plaintext", () => {
    const plain = "my-github-pat-ghp_secret";
    expect(decrypt(encrypt(plain))).toBe(plain);
  });

  it("handles long plaintext (API keys, JWTs)", () => {
    const plain = "x".repeat(2048);
    expect(decrypt(encrypt(plain))).toBe(plain);
  });

  it("different encryptions of the same plaintext produce different ciphertexts (IV randomization)", () => {
    const plain = "same-secret";
    const a = encrypt(plain);
    const b = encrypt(plain);
    expect(a).not.toBe(b);
    // But both decrypt correctly
    expect(decrypt(a)).toBe(plain);
    expect(decrypt(b)).toBe(plain);
  });

  it("two different keys produce different ciphertexts", () => {
    const { encrypt: encA } = createCrypto("a".repeat(64));
    const { encrypt: encB } = createCrypto("b".repeat(64));
    const a = encA("secret");
    const b = encB("secret");
    expect(a.split(":")[1]).not.toBe(b.split(":")[1]);
  });

  it("decrypting with the wrong key throws", () => {
    const { encrypt: enc } = createCrypto("a".repeat(64));
    const { decrypt: dec } = createCrypto("b".repeat(64));
    expect(() => dec(enc("secret"))).toThrow();
  });
});
