import { createCipheriv, createDecipheriv, createHash, randomBytes, scryptSync, timingSafeEqual } from "crypto";
import { sessionSecret } from "./config";
import { UserFacingError } from "./errors";

function key(): Buffer {
  const secret = sessionSecret();
  if (!secret) {
    throw new UserFacingError("The sign-in secret is missing. Add SESSION_SECRET in Vercel.", 500);
  }
  return createHash("sha256").update(secret).digest();
}

export function encryptString(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const ciphertext = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return ["v1", iv.toString("base64url"), tag.toString("base64url"), ciphertext.toString("base64url")].join(".");
}

export function decryptString(payload: string): string {
  const [version, iv, tag, data] = payload.split(".");
  if (version !== "v1" || !iv || !tag || !data) {
    throw new UserFacingError("Stored data could not be read. Sign in again.", 500);
  }
  const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  const plain = Buffer.concat([decipher.update(Buffer.from(data, "base64url")), decipher.final()]);
  return plain.toString("utf8");
}

const BACKUP_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function generateBackupCodes(count = 10): string[] {
  const codes: string[] = [];
  for (let i = 0; i < count; i++) {
    const bytes = randomBytes(8);
    let raw = "";
    for (let j = 0; j < 8; j++) raw += BACKUP_ALPHABET[bytes[j] % BACKUP_ALPHABET.length];
    codes.push(`${raw.slice(0, 4)}-${raw.slice(4)}`);
  }
  return codes;
}

export function normalizeBackupCode(code: string): string {
  return code.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function pepper(): Buffer {
  return createHash("sha256").update(`fdc-backup:${sessionSecret() ?? ""}`).digest();
}

export function hashBackupCode(code: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(normalizeBackupCode(code), Buffer.concat([pepper(), salt]), 32, {
    N: 16384,
    r: 8,
    p: 1,
  });
  return `${salt.toString("base64url")}.${hash.toString("base64url")}`;
}

export function backupCodeMatches(code: string, stored: string): boolean {
  const [salt, hash] = stored.split(".");
  if (!salt || !hash) return false;
  const next = scryptSync(normalizeBackupCode(code), Buffer.concat([pepper(), Buffer.from(salt, "base64url")]), 32, {
    N: 16384,
    r: 8,
    p: 1,
  });
  const previous = Buffer.from(hash, "base64url");
  if (next.length !== previous.length) return false;
  return timingSafeEqual(next, previous);
}
