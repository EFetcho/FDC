import { checkSecondFactor, generateBackupCodes, rememberBackupCodes } from "../../../../lib/auth-flow";
import { errorResponse, json, readJson, requireFullSession } from "../../../../lib/guard";
import { getUser, saveUser } from "../../../../lib/user";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const session = await requireFullSession();
    const body = await readJson(request);
    const code = typeof body.code === "string" ? body.code : "";
    const user = await getUser(session.email);
    await checkSecondFactor(user, code);
    const fresh = await getUser(session.email);
    const codes = generateBackupCodes();
    rememberBackupCodes(fresh, codes);
    await saveUser(fresh);
    return json({ ok: true, codes });
  } catch (error) {
    return errorResponse(error);
  }
}
