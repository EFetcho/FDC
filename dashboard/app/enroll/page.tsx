import { redirect } from "next/navigation";
import AuthShell from "../../components/AuthShell";
import BackupCodes from "../../components/BackupCodes";
import EnrollForm from "../../components/EnrollForm";
import { ensurePendingSecret, formatSecret, previewBackupCodes, qrDataUrl } from "../../lib/auth-flow";
import { currentSession } from "../../lib/cookies";
import { getUser } from "../../lib/user";

export const dynamic = "force-dynamic";

export default async function EnrollPage() {
  const session = await currentSession();
  if (!session) redirect("/login");
  if (session.stage === "full") redirect("/");
  if (session.stage === "verify") redirect("/verify");

  if (session.stage === "codes") {
    const user = await getUser(session.email);
    const codes = previewBackupCodes(user) ?? [];
    return (
      <AuthShell
        wide
        title="Save your backup codes"
        lead="Each code works once if you do not have your authenticator. Store them somewhere that is not your phone."
      >
        {codes.length > 0 ? (
          <BackupCodes codes={codes} />
        ) : (
          <>
            <p className="warn">
              Those codes are no longer on this page. Continue, then open Security and create a new set.
            </p>
            <BackupCodes codes={[]} continueHref="/" />
          </>
        )}
      </AuthShell>
    );
  }

  const { secret } = await ensurePendingSecret(session.email);
  const qr = await qrDataUrl(secret, session.email);
  return (
    <AuthShell
      title="Set up your authenticator"
      lead="This second step keeps the dashboard locked even if someone has your Google password."
    >
      <ol className="steps">
        <li>Open an authenticator app. Google Authenticator, Microsoft Authenticator, 1Password, and Authy all work.</li>
        <li>Add an account and scan the code.</li>
        <li>Type the 6-digit code it shows.</li>
      </ol>
      <img className="qr" src={qr} alt="Authenticator setup code" />
      <p className="quiet">Can’t scan? Enter this key by hand:</p>
      <p className="manual">{formatSecret(secret)}</p>
      <EnrollForm />
      <form action="/api/auth/logout" method="post">
        <button className="text-btn" type="submit">
          Use a different Google account
        </button>
      </form>
    </AuthShell>
  );
}
