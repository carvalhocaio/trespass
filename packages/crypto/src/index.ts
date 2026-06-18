import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const IV_BYTES = 12; // 96-bit IV — recommended for AES-GCM
const TAG_BYTES = 16; // 128-bit auth tag

/**
 * Returns an `{ encrypt, decrypt }` pair bound to the given AES-256 key.
 *
 * @param keyHex - 64-character hex string representing 32 bytes.
 *   In production this comes from `SECRET_ENCRYPTION_KEY` env var.
 *   Pass it explicitly so this function is pure and testable without env vars.
 */
export function createCrypto(keyHex: string) {
  const key = Buffer.from(keyHex, "hex");
  if (key.length !== 32) {
    throw new Error(
      `Encryption key must be 32 bytes (64 hex chars); got ${key.length} bytes.`
    );
  }

  /**
   * Encrypts `plaintext` with AES-256-GCM.
   * Output format: `<iv_hex>:<ciphertext_hex>:<authtag_hex>` (colon-separated hex).
   */
  function encrypt(plaintext: string): string {
    const iv = randomBytes(IV_BYTES);
    const cipher = createCipheriv(ALGORITHM, key, iv, {
      authTagLength: TAG_BYTES,
    });
    const ciphertext = Buffer.concat([
      cipher.update(plaintext, "utf8"),
      cipher.final(),
    ]);
    const tag = cipher.getAuthTag();
    return `${iv.toString("hex")}:${ciphertext.toString("hex")}:${tag.toString("hex")}`;
  }

  /**
   * Decrypts a value previously produced by `encrypt`.
   * Throws if the ciphertext is malformed or the auth tag is invalid.
   */
  function decrypt(stored: string): string {
    const parts = stored.split(":");
    if (parts.length !== 3) {
      throw new Error("Invalid ciphertext format — expected iv:data:tag.");
    }
    const [ivHex, dataHex, tagHex] = parts as [string, string, string];
    const iv = Buffer.from(ivHex, "hex");
    const data = Buffer.from(dataHex, "hex");
    const tag = Buffer.from(tagHex, "hex");

    const decipher = createDecipheriv(ALGORITHM, key, iv, {
      authTagLength: TAG_BYTES,
    });
    decipher.setAuthTag(tag);
    const plain = Buffer.concat([decipher.update(data), decipher.final()]);
    return plain.toString("utf8");
  }

  return { encrypt, decrypt };
}

export type Crypto = ReturnType<typeof createCrypto>;
