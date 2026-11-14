import { decryptString, encryptString } from "./crypto";
import { UserFacingError } from "./errors";
import { store } from "./store";

export type BackupCodeRecord = { hash: string; used: boolean };

export type UserRecord = {
  email: string;
  name: string;
  googleSub: string;
  refreshTokenEnc?: string;
  totpSecretEnc?: string;
  totpPendingEnc?: string;
  totpLastStep?: number;
  backupCodes?: BackupCodeRecord[];
  backupPreviewEnc?: string;
  backupPreviewExp?: number;
  enrolledAt?: string;
};

function userKey(email: string): string {
  return `user:${email.toLowerCase()}`;
}

export function emptyUser(email: string): UserRecord {
  return { email: email.toLowerCase(), name: "", googleSub: "" };
}

export async function getUser(email: string): Promise<UserRecord> {
  const raw = await store.get(userKey(email));
  if (!raw) return emptyUser(email);
  try {
    const parsed = JSON.parse(raw) as UserRecord;
    return { ...emptyUser(email), ...parsed, email: email.toLowerCase() };
  } catch {
    return emptyUser(email);
  }
}

export async function saveUser(user: UserRecord): Promise<void> {
  const email = user.email.toLowerCase();
  await store.set(userKey(email), JSON.stringify({ ...user, email }));
}

export function readSecret(enc: string | undefined): string | null {
  if (!enc) return null;
  return decryptString(enc);
}

export function writeSecret(value: string): string {
  return encryptString(value);
}

export async function hiddenDrafts(email: string): Promise<Set<string>> {
  const members = await store.smembers(`drafts:hidden:${email.toLowerCase()}`);
  return new Set(members);
}

export async function hideDraft(email: string, id: string): Promise<void> {
  await store.sadd(`drafts:hidden:${email.toLowerCase()}`, id);
}

export async function unhideDraft(email: string, id: string): Promise<void> {
  await store.srem(`drafts:hidden:${email.toLowerCase()}`, id);
}

const FAIL_LIMIT = 8;
const FAIL_WINDOW_SECONDS = 15 * 60;

export async function registerAuthFailure(email: string): Promise<void> {
  await store.incr(`auth:fail:${email.toLowerCase()}`, FAIL_WINDOW_SECONDS);
}

export async function assertAuthNotLocked(email: string): Promise<void> {
  const raw = await store.get(`auth:fail:${email.toLowerCase()}`);
  if (Number(raw ?? "0") >= FAIL_LIMIT) throw new UserFacingError(lockMessage(), 429);
}

export async function clearAuthFailures(email: string): Promise<void> {
  await store.del(`auth:fail:${email.toLowerCase()}`);
}

export function lockMessage(): string {
  return "Too many wrong codes. Wait 15 minutes, then try again.";
}
