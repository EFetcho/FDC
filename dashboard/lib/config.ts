export const DEFAULT_ALLOWED_EMAILS = ["fetcho@fdcav.com", "fetcho@firstduecom.com"];

export const DEFAULT_SHEET_ID = "1fHUpty80AJtD74MCewGC5yipWzvL3sWcYYgIELQmyOc";
export const DEFAULT_SHEET_TAB = "Project Tracker";

export const GOOGLE_SCOPES = [
  "openid",
  "email",
  "profile",
  "https://www.googleapis.com/auth/calendar.readonly",
  "https://www.googleapis.com/auth/gmail.modify",
  "https://www.googleapis.com/auth/spreadsheets",
];

export const LOGO_URL = "https://fdcav.com/wp-content/uploads/2024/11/FDC-EVENT-TECH.png";

const DEMO_SECRET = "demo-only-insecure-secret-do-not-use-in-production";

export function demoMode(): boolean {
  const value = process.env.DEMO_MODE?.trim().toLowerCase();
  return value === "true" || value === "1" || value === "yes";
}

export function allowedEmails(): string[] {
  const raw = process.env.ALLOWED_EMAILS?.trim();
  const source = raw ? raw : DEFAULT_ALLOWED_EMAILS.join(",");
  return source
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export function isAllowedEmail(email: string): boolean {
  return allowedEmails().includes(email.trim().toLowerCase());
}

export function sheetId(): string {
  return process.env.PROJECTS_SHEET_ID?.trim() || DEFAULT_SHEET_ID;
}

export function sheetTab(): string {
  return process.env.PROJECTS_SHEET_TAB?.trim() || DEFAULT_SHEET_TAB;
}

export function sessionSecret(): string | null {
  const secret = process.env.SESSION_SECRET?.trim();
  if (secret && secret.length >= 32 && secret !== DEMO_SECRET) return secret;
  if (demoMode()) return DEMO_SECRET;
  return null;
}

export function appOrigin(request?: Request): string {
  const configured = process.env.APP_URL?.trim();
  if (configured) return configured.replace(/\/$/, "");
  if (request) {
    const url = new URL(request.url);
    return `${url.protocol}//${url.host}`;
  }
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}

export function redisEnv(): { url: string; token: string } | null {
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  if (url && token) return { url, token };
  return null;
}

export type SetupGap = { name: string; plain: string };

export function setupGaps(): SetupGap[] {
  const gaps: SetupGap[] = [];
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    gaps.push({
      name: "GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET",
      plain: "Google sign-in is not connected yet.",
    });
  }
  if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.trim().length < 32) {
    gaps.push({
      name: "SESSION_SECRET",
      plain: "The sign-in secret is missing. Add a long random password (at least 32 characters).",
    });
  }
  if (!redisEnv() && !demoMode()) {
    gaps.push({
      name: "UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN",
      plain: "The data store (Upstash Redis) is not connected.",
    });
  }
  if (!process.env.TODOIST_API_TOKEN?.trim() && !demoMode()) {
    gaps.push({
      name: "TODOIST_API_TOKEN",
      plain: "Todoist is not connected. Tasks will not load until the token is added.",
    });
  }
  return gaps;
}
