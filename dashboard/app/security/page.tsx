import { redirect } from "next/navigation";
import AuthShell from "../../components/AuthShell";
import SecurityPanel from "../../components/SecurityPanel";
import { currentSession } from "../../lib/cookies";

export const dynamic = "force-dynamic";

export default async function SecurityPage() {
  const session = await currentSession();
  if (!session || session.stage !== "full" || session.demo) redirect("/");

  return (
    <AuthShell
      wide
      title="Security"
      lead="Backup codes and a replacement authenticator. You will need a current code to change either one."
    >
      <SecurityPanel />
    </AuthShell>
  );
}
