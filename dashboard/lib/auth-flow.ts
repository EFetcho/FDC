import { NextResponse } from "next/server";
import { createHash, randomBytes } from "crypto";
import QRCode from "qrcode";
import { GOOGLE_SCOPES, appOrigin, isAllowedEmail } from "./config";
import { backupCodeMatches, encryptString, decryptString, generateBackupCodes, hashBackupCode } from "./crypto";
import { createSession, secureCookie, stageExpiry } from "./session";
import { createTotpSecret, formatSecret, totpUri, verifyTotp } from "./totp";
import type { SessionStage } from "./types";
import {
  assertAuthNotLocked,
  clearAuthFailures,
  getUser,
  readSecret,
  registerAuthFailure,
  saveUser,
  writeSecret,
  type UserRecord,
} from "./user";
import { UserFacingError } from "./errors";

export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

export function codeChallenge(verifier: string): string {
  return createHash("sha256").update(verifier).digest("base64url");
}

export function googleAuthUrl(origin: string, state: string, verifier: string): string {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID ?? "",
    redirect_uri: `${origin}/api/auth/callback`,
    response_type: "code",
    scope: GOOGLE_SCOPES.join(" "),
    access_type: "offline",
    prompt: "select_account consent",
    include_granted_scopes: "true",
    state,
    code_challenge: codeChallenge(verifier),
    code_challenge_method: "S256",
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

export function redirectTo(request: Request, path: string): NextResponse {
  return NextResponse.redirect(new URL(path, appOrigin(request)));
}

export function cookieBase() {
  return { httpOnly: true, sameSite: "lax" as const, path: "/", secure: secureCookie() };
}

export async function attachSession(
  response: NextResponse,
  input: { email: string; name: string; stage: SessionStage; demo?: boolean },
): Promise<NextResponse> {
  const session = {
    email: input.email.toLowerCase(),
    name: input.name.slice(0, 80),
    stage: input.stage,
    demo: Boolean(input.demo),
    exp: stageExpiry(input.stage),
  };
  response.cookies.set("fdc_session", await createSession(session), {
    ...cookieBase(),
    maxAge: Math.max(60, Math.floor((session.exp - Date.now()) / 1000)),
  });
  return response;
}

export function clearAuthCookies(response: NextResponse): NextResponse {
  for (const name of ["fdc_session", "fdc_oauth_state", "fdc_oauth_verifier"]) {
    response.cookies.set(name, "", { ...cookieBase(), maxAge: 0 });
  }
  return response;
}

export async function qrDataUrl(secret: string, email: string): Promise<string> {
  return QRCode.toDataURL(totpUri(secret, email), {
    margin: 1,
    width: 240,
    errorCorrectionLevel: "M",
    color: { dark: "#0e2a5e", light: "#ffffff" },
  });
}

export function rememberBackupCodes(user: UserRecord, codes: string[]): void {
  user.backupCodes = codes.map((code) => ({ hash: hashBackupCode(code), used: false }));
  user.backupPreviewEnc = encryptString(JSON.stringify(codes));
  user.backupPreviewExp = Date.now() + 20 * 60 * 1000;
}

export function previewBackupCodes(user: UserRecord): string[] | null {
  if (!user.backupPreviewEnc || !user.backupPreviewExp || user.backupPreviewExp < Date.now()) return null;
  try {
    const parsed = JSON.parse(decryptString(user.backupPreviewEnc)) as unknown;
    if (!Array.isArray(parsed)) return null;
    return parsed.filter((code): code is string => typeof code === "string");
  } catch {
    return null;
  }
}

export function clearBackupPreview(user: UserRecord): void {
  delete user.backupPreviewEnc;
  delete user.backupPreviewExp;
}

export async function checkSecondFactor(user: UserRecord, code: string): Promise<"totp" | "backup"> {
  await assertAuthNotLocked(user.email);
  const digits = code.replace(/\s/g, "");
  if (/^\d{6}$/.test(digits)) {
    const secret = user.totpSecretEnc ? readSecret(user.totpSecretEnc) : null;
    if (!secret) throw new UserFacingError("The authenticator is not set up yet.");
    const step = verifyTotp(secret, digits, user.email, user.totpLastStep);
    if (step === null) {
      await registerAuthFailure(user.email);
      throw new UserFacingError("That code is not right. Wait for a new code and try again.");
    }
    user.totpLastStep = step;
    await clearAuthFailures(user.email);
    await saveUser(user);
    return "totp";
  }
  const codes = user.backupCodes ?? [];
  let match = -1;
  for (let i = 0; i < codes.length; i++) {
    const ok = backupCodeMatches(code, codes[i].hash);
    if (ok && !codes[i].used && match === -1) match = i;
  }
  if (match < 0) {
    await registerAuthFailure(user.email);
    throw new UserFacingError("That backup code is not right, or it was already used.");
  }
  codes[match].used = true;
  user.backupCodes = codes;
  await clearAuthFailures(user.email);
  await saveUser(user);
  return "backup";
}

export async function ensurePendingSecret(email: string): Promise<{ user: UserRecord; secret: string }> {
  const user = await getUser(email);
  let secret: string | null = null;
  if (user.totpPendingEnc) {
    try {
      secret = readSecret(user.totpPendingEnc);
    } catch {
      secret = null;
    }
  }
  if (!secret) {
    secret = createTotpSecret();
    user.totpPendingEnc = writeSecret(secret);
    await saveUser(user);
  }
  return { user, secret };
}

export function assertAllowed(email: string, verified: boolean): void {
  if (!verified) throw new UserFacingError("That Google account’s email is not verified.");
  if (!isAllowedEmail(email)) {
    throw new UserFacingError("That Google account is not on the allow list.");
  }
}

export { formatSecret, generateBackupCodes, readSecret, writeSecret };
