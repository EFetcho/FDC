import { clearAuthCookies, redirectTo } from "../../../../lib/auth-flow";

export const dynamic = "force-dynamic";

async function logout(request: Request) {
  return clearAuthCookies(redirectTo(request, "/login"));
}

export async function GET(request: Request) {
  return logout(request);
}

export async function POST(request: Request) {
  return logout(request);
}
