import { demoMode, sessionSecret } from "./config";
import type { Session, SessionStage } from "./types";

const STAGE_TTL_MS: Record<SessionStage, number> = {
  pending: 15 * 60 * 1000,
  verify: 15 * 60 * 1000,
  codes: 20 * 60 * 1000,
  full: 18 * 60 * 60 * 1000,
};

function bytesToB64url(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function b64urlToBytes(value: string): Uint8Array {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((value.length + 3) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function hmac(secret: string, data: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data));
  return bytesToB64url(new Uint8Array(sig));
}

function safeEqual(a: string, b: string): boolean {
  try {
    const left = b64urlToBytes(a);
    const right = b64urlToBytes(b);
    if (left.length !== right.length) return false;
    let diff = 0;
    for (let i = 0; i < left.length; i++) diff |= left[i] ^ right[i];
    return diff === 0;
  } catch {
    return false;
  }
}

export function stageExpiry(stage: SessionStage, now = Date.now()): number {
  return now + STAGE_TTL_MS[stage];
}

export async function createSession(session: Session): Promise<string> {
  const secret = sessionSecret();
  if (!secret) throw new Error("SESSION_SECRET is not set");
  const body = bytesToB64url(new TextEncoder().encode(JSON.stringify(session)));
  const sig = await hmac(secret, body);
  return `${body}.${sig}`;
}

export async function readSession(token: string | undefined | null): Promise<Session | null> {
  if (!token) return null;
  const secret = sessionSecret();
  if (!secret) return null;
  const dot = token.lastIndexOf(".");
  if (dot <= 0) return null;
  const body = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  let expected = "";
  try {
    expected = await hmac(secret, body);
  } catch {
    return null;
  }
  if (!safeEqual(sig, expected)) return null;
  try {
    const json = JSON.parse(new TextDecoder().decode(b64urlToBytes(body))) as Session;
    if (!json?.email || !json.stage || typeof json.exp !== "number") return null;
    if (json.exp < Date.now()) return null;
    if (json.demo && !demoMode()) return null;
    if (!json.demo && demoMode() === false && json.email === "demo@fdcav.com") return null;
    return json;
  } catch {
    return null;
  }
}

export function secureCookie(): boolean {
  return process.env.VERCEL === "1";
}
