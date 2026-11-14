import { checkSecondFactor } from "../../../../lib/auth-flow";
import { setSession } from "../../../../lib/cookies";
import { errorResponse, json, readJson, requireStage } from "../../../../lib/guard";
import { getUser } from "../../../../lib/user";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const session = await requireStage("verify");
    const body = await readJson(request);
    const code = typeof body.code === "string" ? body.code : "";
    const user = await getUser(session.email);
    if (!user.totpSecretEnc) {
      await setSession({ email: session.email, name: session.name, stage: "pending" });
      return json({ error: "Set up the authenticator first.", redirect: "/enroll" }, 409);
    }
    await checkSecondFactor(user, code);
    await setSession({ email: session.email, name: user.name || session.name, stage: "full" });
    return json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
