import { cookies } from "next/headers";
import { attachSession, clearAuthCookies, redirectTo } from "../../../../lib/auth-flow";
import { appOrigin } from "../../../../lib/config";
import { exchangeCode, fetchGoogleProfile } from "../../../../lib/google";
import { getUser, readSecret, saveUser, writeSecret } from "../../../../lib/user";
import { isAllowedEmail } from "../../../../lib/config";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const oauthError = url.searchParams.get("error");
  if (oauthError) return redirectTo(request, "/login?error=oauth");
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const jar = await cookies();
  const expected = jar.get("fdc_oauth_state")?.value;
  const verifier = jar.get("fdc_oauth_verifier")?.value;
  if (!code || !state || !expected || !verifier || state !== expected) {
    return redirectTo(request, "/login?error=expired");
  }

  try {
    const tokens = await exchangeCode({
      code,
      redirectUri: `${appOrigin(request)}/api/auth/callback`,
      codeVerifier: verifier,
    });
    const profile = await fetchGoogleProfile(tokens.accessToken);
    if (profile.emailVerified === false) return fail(request, "unverified");
    if (!isAllowedEmail(profile.email)) return fail(request, "denied");

    const user = await getUser(profile.email);
    user.name = profile.name;
    user.googleSub = profile.sub;
    if (tokens.refreshToken) user.refreshTokenEnc = writeSecret(tokens.refreshToken);
    else if (!user.refreshTokenEnc || !readSecret(user.refreshTokenEnc)) return fail(request, "refresh");
    await saveUser(user);

    const stage = user.totpSecretEnc ? "verify" : "pending";
    const response = await attachSession(redirectTo(request, stage === "verify" ? "/verify" : "/enroll"), {
      email: profile.email,
      name: profile.name,
      stage,
    });
    response.cookies.set("fdc_oauth_state", "", { path: "/", maxAge: 0 });
    response.cookies.set("fdc_oauth_verifier", "", { path: "/", maxAge: 0 });
    return response;
  } catch (error) {
    console.error("OAuth callback failed", error instanceof Error ? error.message : error);
    return fail(request, "oauth");
  }
}

function fail(request: Request, code: string) {
  return clearAuthCookies(redirectTo(request, `/login?error=${code}`));
}
