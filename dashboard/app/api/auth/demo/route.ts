import { attachSession, redirectTo } from "../../../../lib/auth-flow";
import { demoMode } from "../../../../lib/config";
import { assertSameOrigin } from "../../../../lib/guard";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!demoMode()) {
    return Response.json({ error: "Demo mode is turned off." }, { status: 404 });
  }
  try {
    assertSameOrigin(request);
  } catch {
    return Response.json({ error: "Blocked request." }, { status: 403 });
  }
  return attachSession(redirectTo(request, "/"), {
    email: "demo@fdcav.com",
    name: "Eric",
    stage: "full",
    demo: true,
  });
}
