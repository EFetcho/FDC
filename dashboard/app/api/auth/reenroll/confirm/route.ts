import { generateBackupCodes, rememberBackupCodes } from "../../../../../lib/auth-flow";
import { UserFacingError } from "../../../../../lib/errors";
import { errorResponse, json, readJson, requireFullSession } from "../../../../../lib/guard";
import { verifyTotp } from "../../../../../lib/totp";
import { getUser, readSecret, saveUser, writeSecret } from "../../../../../lib/user";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const session = await requireFullSession();
    const body = await readJson(request);
    const code = typeof body.code === "string" ? body.code : "";
    const user = await getUser(session.email);
    const pending = user.totpPendingEnc ? readSecret(user.totpPendingEnc) : null;
    if (!pending) throw new UserFacingError("Start the authenticator setup again.");
    const step = verifyTotp(pending, code, session.email);
    if (step === null) throw new UserFacingError("That code does not match the new authenticator. Scan the new code and try again.");
    const codes = generateBackupCodes();
    user.totpSecretEnc = writeSecret(pending);
    delete user.totpPendingEnc;
    user.totpLastStep = step;
    user.enrolledAt = new Date().toISOString();
    rememberBackupCodes(user, codes);
    await saveUser(user);
    return json({ ok: true, codes });
  } catch (error) {
    return errorResponse(error);
  }
}
