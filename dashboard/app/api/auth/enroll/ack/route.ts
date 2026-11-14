import { clearBackupPreview } from "../../../../../lib/auth-flow";
import { setSession } from "../../../../../lib/cookies";
import { assertSameOrigin, errorResponse, json, requireStage } from "../../../../../lib/guard";
import { getUser, saveUser } from "../../../../../lib/user";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const session = await requireStage("codes");
    const user = await getUser(session.email);
    clearBackupPreview(user);
    await saveUser(user);
    await setSession({ email: session.email, name: session.name || user.name, stage: "full" });
    return json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
