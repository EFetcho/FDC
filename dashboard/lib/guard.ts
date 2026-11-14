import { NextResponse } from "next/server";
import { isAllowedEmail } from "./config";
import { currentSession } from "./cookies";
import { UserFacingError } from "./errors";
import type { Session, SessionStage } from "./types";

export async function requireStage(...stages: SessionStage[]): Promise<Session> {
  const session = await currentSession();
  if (!session || !stages.includes(session.stage)) {
    throw new UserFacingError("Sign in required.", 401);
  }
  if (!session.demo && !isAllowedEmail(session.email)) {
    throw new UserFacingError("This Google account is not allowed to use the dashboard.", 403);
  }
  return session;
}

export async function requireFullSession(): Promise<Session> {
  return requireStage("full");
}

export function assertSameOrigin(request: Request): void {
  const origin = request.headers.get("origin");
  // Some browsers send Origin: null when Referrer-Policy hides the source.
  // The session cookie is SameSite=Lax, so a cross-site POST cannot use it.
  if (!origin || origin === "null") return;
  const host = request.headers.get("host");
  let originHost = "";
  try {
    originHost = new URL(origin).host;
  } catch {
    throw new UserFacingError("Blocked request.", 403);
  }
  if (!host || originHost !== host) throw new UserFacingError("Blocked request.", 403);
}

export async function readJson(request: Request): Promise<Record<string, unknown>> {
  assertSameOrigin(request);
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw new UserFacingError("The request was empty.");
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new UserFacingError("The request was not valid.");
  return body as Record<string, unknown>;
}

export function json(data: unknown, status = 200): NextResponse {
  return NextResponse.json(data, { status });
}

export function errorResponse(error: unknown): Response {
  if (error instanceof UserFacingError) return json({ error: error.message }, error.status);
  console.error(error instanceof Error ? error.message : error);
  return json({ error: "Something went wrong. Try again." }, 500);
}
