import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const KEY_HEX = process.env.TOKEN_ENCRYPTION_KEY ?? "";

function getKey(): Buffer {
  if (!KEY_HEX || KEY_HEX.length !== 64) {
    throw new Error("TOKEN_ENCRYPTION_KEY must be a 32-byte (64 hex char) key");
  }
  return Buffer.from(KEY_HEX, "hex");
}

/**
 * AES-256-GCM encrypt. Returns iv:authTag:ciphertext (all base64, colon-separated).
 */
export function encryptToken(plaintext: string): string {
  const key = getKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [iv.toString("base64"), authTag.toString("base64"), encrypted.toString("base64")].join(":");
}

/**
 * AES-256-GCM decrypt. Accepts iv:authTag:ciphertext format.
 */
export function decryptToken(ciphertext: string): string {
  const [ivB64, authTagB64, dataB64] = ciphertext.split(":");
  if (!ivB64 || !authTagB64 || !dataB64) throw new Error("Invalid ciphertext format");

  const key = getKey();
  const iv = Buffer.from(ivB64, "base64");
  const authTag = Buffer.from(authTagB64, "base64");
  const data = Buffer.from(dataB64, "base64");

  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}

export function generateToken(bytes = 32): string {
  return randomBytes(bytes).toString("hex");
}
