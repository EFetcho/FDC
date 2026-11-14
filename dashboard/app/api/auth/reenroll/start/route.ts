import { checkSecondFactor, formatSecret, qrDataUrl } from "../../../../../lib/auth-flow";
import { errorResponse, json, readJson, requireFullSession } from "../../../../../lib/guard";
import { createTotpSecret } from "../../../../../lib/totp";
import { getUser, saveUser, writeSecret } from "../../../../../lib/user";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const session = await requireFullSession();
    const body = await readJson(request);
    const code = typeof body.code === "string" ? body.code : "";
    const user = await getUser(session.email);
    await checkSecondFactor(user, code);
    const fresh = await getUser(session.email);
    const secret = createTotpSecret();
    fresh.totpPendingEnc = writeSecret(secret);
    await saveUser(fresh);
    return json({
      ok: true,
      secret: formatSecret(secret),
      qr: await qrDataUrl(secret, session.email),
    });
  } catch (error) {
    return errorResponse(error);
  }
}
