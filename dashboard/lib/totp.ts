import { Secret, TOTP } from "otpauth";

const ISSUER = "FDC Dashboard";

export function createTotpSecret(): string {
  return new Secret({ size: 20 }).base32;
}

export function totpFor(secret: string, email: string): TOTP {
  return new TOTP({
    issuer: ISSUER,
    label: email,
    algorithm: "SHA1",
    digits: 6,
    period: 30,
    secret: Secret.fromBase32(secret),
  });
}

export function totpUri(secret: string, email: string): string {
  return totpFor(secret, email).toString();
}

/** Returns the matched time step, or null. Rejects a code already used. */
export function verifyTotp(secret: string, token: string, email: string, lastStep?: number): number | null {
  const digits = token.replace(/\s/g, "");
  if (!/^\d{6}$/.test(digits)) return null;
  const delta = totpFor(secret, email).validate({ token: digits, window: 1 });
  if (delta === null) return null;
  const step = Math.floor(Date.now() / 1000 / 30) + delta;
  if (lastStep !== undefined && step <= lastStep) return null;
  return step;
}

export function formatSecret(secret: string): string {
  return secret.replace(/(.{4})/g, "$1 ").trim();
}
