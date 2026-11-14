import { redirect } from "next/navigation";
import AuthShell from "../../components/AuthShell";
import VerifyForm from "../../components/VerifyForm";
import { currentSession } from "../../lib/cookies";

export const dynamic = "force-dynamic";

export default async function VerifyPage() {
  const session = await currentSession();
  if (!session) redirect("/login");
  if (session.stage === "full") redirect("/");
  if (session.stage === "pending" || session.stage === "codes") redirect("/enroll");

  return (
    <AuthShell
      title="Enter your code"
      lead={`Signed in as ${session.email}. Open your authenticator app and type the 6-digit code for FDC Dashboard.`}
    >
      <VerifyForm />
      <form action="/api/auth/logout" method="post">
        <button className="text-btn" type="submit">
          Use a different Google account
        </button>
      </form>
    </AuthShell>
  );
}
