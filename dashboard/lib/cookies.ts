import { cookies } from "next/headers";
import { secureCookie, createSession, readSession, stageExpiry } from "./session";
import type { Session, SessionStage } from "./types";

const SESSION = "fdc_session";

function baseOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    path: "/",
    secure: secureCookie(),
  };
}

export async function currentSession(): Promise<Session | null> {
  const jar = await cookies();
  return readSession(jar.get(SESSION)?.value);
}

export async function setSession(input: { email: string; name: string; stage: SessionStage; demo?: boolean }): Promise<void> {
  const session: Session = {
    email: input.email.toLowerCase(),
    name: input.name.slice(0, 80),
    stage: input.stage,
    demo: Boolean(input.demo),
    exp: stageExpiry(input.stage),
  };
  const jar = await cookies();
  jar.set(SESSION, await createSession(session), {
    ...baseOptions(),
    maxAge: Math.max(60, Math.floor((session.exp - Date.now()) / 1000)),
  });
}

export async function clearSession(): Promise<void> {
  const jar = await cookies();
  jar.set(SESSION, "", { ...baseOptions(), maxAge: 0 });
}

export async function setTempCookie(name: string, value: string, maxAgeSeconds: number): Promise<void> {
  const jar = await cookies();
  jar.set(name, value, { ...baseOptions(), maxAge: maxAgeSeconds });
}

export async function readTempCookie(name: string): Promise<string | undefined> {
  const jar = await cookies();
  return jar.get(name)?.value;
}

export async function clearTempCookie(name: string): Promise<void> {
  const jar = await cookies();
  jar.set(name, "", { ...baseOptions(), maxAge: 0 });
}
