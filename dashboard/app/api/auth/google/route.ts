import { NextResponse } from "next/server";
import { cookieBase, googleAuthUrl, randomToken } from "../../../../lib/auth-flow";
import { appOrigin } from "../../../../lib/config";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    return NextResponse.redirect(new URL("/login?error=google", appOrigin(request)));
  }
  const state = randomToken(24);
  const verifier = randomToken(32);
  const response = NextResponse.redirect(googleAuthUrl(appOrigin(request), state, verifier));
  response.cookies.set("fdc_oauth_state", state, { ...cookieBase(), maxAge: 600 });
  response.cookies.set("fdc_oauth_verifier", verifier, { ...cookieBase(), maxAge: 600 });
  return response;
}
