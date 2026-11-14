import { UserFacingError } from "./errors";
import { getUser, readSecret, saveUser, writeSecret } from "./user";

type CachedToken = { token: string; exp: number };

const cache = globalThis as unknown as { __fdcAccess?: Map<string, CachedToken> };

function tokens(): Map<string, CachedToken> {
  if (!cache.__fdcAccess) cache.__fdcAccess = new Map();
  return cache.__fdcAccess;
}

function clientId(): string {
  const id = process.env.GOOGLE_CLIENT_ID?.trim();
  if (!id) throw new UserFacingError("Google sign-in is not set up yet (GOOGLE_CLIENT_ID).", 500);
  return id;
}

function clientSecret(): string {
  const secret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  if (!secret) throw new UserFacingError("Google sign-in is not set up yet (GOOGLE_CLIENT_SECRET).", 500);
  return secret;
}

export async function exchangeCode(input: {
  code: string;
  redirectUri: string;
  codeVerifier: string;
}): Promise<{ refreshToken?: string; accessToken: string; expiresIn: number; idToken?: string }> {
  const body = new URLSearchParams({
    code: input.code,
    client_id: clientId(),
    client_secret: clientSecret(),
    redirect_uri: input.redirectUri,
    grant_type: "authorization_code",
    code_verifier: input.codeVerifier,
  });
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
    signal: AbortSignal.timeout(20_000),
  });
  const json = (await response.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    id_token?: string;
    error?: string;
  };
  if (!response.ok || !json.access_token) {
    throw new UserFacingError("Google did not finish sign-in. Go back and try again.", 400);
  }
  return {
    refreshToken: json.refresh_token,
    accessToken: json.access_token,
    expiresIn: json.expires_in ?? 3600,
    idToken: json.id_token,
  };
}

export async function fetchGoogleProfile(accessToken: string): Promise<{
  email: string;
  emailVerified: boolean;
  name: string;
  sub: string;
}> {
  const response = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
    headers: { authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) throw new UserFacingError("Google did not share the account email.", 400);
  const json = (await response.json()) as {
    email?: string;
    email_verified?: boolean;
    name?: string;
    sub?: string;
  };
  if (!json.email || !json.sub) throw new UserFacingError("Google did not share the account email.", 400);
  return {
    email: json.email.toLowerCase(),
    emailVerified: json.email_verified !== false,
    name: json.name?.trim() || json.email,
    sub: json.sub,
  };
}

async function refreshAccessToken(email: string): Promise<string> {
  const user = await getUser(email);
  const refresh = user.refreshTokenEnc ? readSecret(user.refreshTokenEnc) : null;
  if (!refresh) {
    throw new UserFacingError("Google is not connected. Sign out, then sign in again and allow Calendar, Gmail, and Sheets.");
  }
  const body = new URLSearchParams({
    client_id: clientId(),
    client_secret: clientSecret(),
    refresh_token: refresh,
    grant_type: "refresh_token",
  });
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
    signal: AbortSignal.timeout(20_000),
  });
  const json = (await response.json()) as {
    access_token?: string;
    expires_in?: number;
    refresh_token?: string;
    error?: string;
  };
  if (!response.ok || !json.access_token) {
    if (json.error === "invalid_grant") {
      throw new UserFacingError(
        "Google access expired. Sign out and sign in again. If the Google app is still in Testing, this happens about every 7 days.",
      );
    }
    throw new UserFacingError("Could not reach Google. Try again in a minute.");
  }
  if (json.refresh_token) {
    user.refreshTokenEnc = writeSecret(json.refresh_token);
    await saveUser(user);
  }
  const token = json.access_token;
  tokens().set(email, { token, exp: Date.now() + (json.expires_in ?? 3600) * 1000 });
  return token;
}

export async function getAccessToken(email: string): Promise<string> {
  const cached = tokens().get(email);
  if (cached && cached.exp > Date.now() + 60_000) return cached.token;
  return refreshAccessToken(email);
}

export function forgetAccessToken(email: string): void {
  tokens().delete(email);
}

async function readGoogleError(response: Response): Promise<never> {
  const text = await response.text();
  console.error("Google API error", response.status, text.slice(0, 500));
  if (response.status === 401 || text.includes("invalid_grant")) {
    throw new UserFacingError(
      "Google access expired. Sign out and sign in again. If the Google app is still in Testing, this happens about every 7 days.",
    );
  }
  if (response.status === 403) {
    throw new UserFacingError(
      "Google blocked this. Sign out, sign in again, and allow Calendar, Gmail, and Sheets. The project sheet must be shared with that same Google account as an editor.",
    );
  }
  if (response.status === 404) {
    throw new UserFacingError("Google could not find that item. It may have been deleted already.");
  }
  throw new UserFacingError(`Google returned an error (${response.status}). Try again in a minute.`);
}

export async function googleFetch(email: string, url: string, init: RequestInit = {}): Promise<Response> {
  const run = async (token: string) => {
    const headers = new Headers(init.headers);
    headers.set("authorization", `Bearer ${token}`);
    if (init.body && !headers.has("content-type")) headers.set("content-type", "application/json");
    return fetch(url, { ...init, headers, signal: AbortSignal.timeout(25_000) });
  };
  let token = await getAccessToken(email);
  let response = await run(token);
  if (response.status === 401) {
    forgetAccessToken(email);
    token = await refreshAccessToken(email);
    response = await run(token);
  }
  if (!response.ok) await readGoogleError(response);
  return response;
}
