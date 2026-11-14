import {
  ensurePendingSecret,
  formatSecret,
  generateBackupCodes,
  rememberBackupCodes,
} from "../../../../../lib/auth-flow";
import { setSession } from "../../../../../lib/cookies";
import { errorResponse, json, readJson, requireStage } from "../../../../../lib/guard";
import { saveUser, writeSecret } from "../../../../../lib/user";
import { verifyTotp } from "../../../../../lib/totp";
import { UserFacingError } from "../../../../../lib/errors";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const session = await requireStage("pending");
    const body = await readJson(request);
    const code = typeof body.code === "string" ? body.code : "";
    const { user, secret } = await ensurePendingSecret(session.email);
    if (user.totpSecretEnc) throw new UserFacingError("The authenticator is already set up. Enter the code on the next screen.");
    const step = verifyTotp(secret, code, session.email);
    if (step === null) throw new UserFacingError("That code is not right. Check the authenticator and try the newest code.");
    const codes = generateBackupCodes();
    user.totpSecretEnc = writeSecret(secret);
    delete user.totpPendingEnc;
    user.totpLastStep = step;
    user.enrolledAt = new Date().toISOString();
    rememberBackupCodes(user, codes);
    await saveUser(user);
    await setSession({ email: session.email, name: session.name || user.name, stage: "codes" });
    return json({ ok: true, codes, secret: formatSecret(secret) });
  } catch (error) {
    return errorResponse(error);
  }
}
