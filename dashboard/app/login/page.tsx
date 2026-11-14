import AuthShell from "../../components/AuthShell";
import { demoMode, setupGaps } from "../../lib/config";

export const dynamic = "force-dynamic";

const ERRORS: Record<string, string> = {
  denied: "That Google account cannot open this dashboard. Sign in as fetcho@fdcav.com or fetcho@firstduecom.com.",
  google: "Google sign-in is not set up yet. Finish the steps in SETUP.md, then try again.",
  setup: "The sign-in secret is missing. Add SESSION_SECRET in Vercel.",
  oauth: "Google sign-in did not finish. Try again.",
  refresh: "Google did not allow the dashboard to stay connected. Try again and choose Allow.",
  unverified: "That Google account’s email is not verified.",
  expired: "That sign-in attempt expired. Try again.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;
  const error = params.error ? ERRORS[params.error] : undefined;
  const gaps = setupGaps();
  const demo = demoMode();

  return (
    <AuthShell
      title="Operations"
      lead="Calendar, tasks, drafts, follow-ups, and the project sheet in one place. Sign in with Google, then confirm with your authenticator."
    >
      {error ? <p className="error">{error}</p> : null}
      {demo ? (
        <p className="warn">
          <strong>Sample preview is on.</strong> The button below opens fake data. Leave DEMO_MODE off on the real site.
        </p>
      ) : null}
      {gaps.length > 0 ? (
        <div className="note">
          <strong>Before real data will load</strong>
          <ul>
            {gaps.map((gap) => (
              <li key={gap.name}>{gap.plain}</li>
            ))}
          </ul>
        </div>
      ) : null}
      <div className="stack">
        <a className="google" href="/api/auth/google">
          Sign in with Google
        </a>
        {demo ? (
          <form action="/api/auth/demo" method="post">
            <button className="primary sample" type="submit">
              Preview with sample data
            </button>
          </form>
        ) : null}
      </div>
      <p className="note" style={{ marginTop: 14 }}>
        Only fetcho@fdcav.com and fetcho@firstduecom.com can sign in, unless ALLOWED_EMAILS says otherwise. This
        dashboard never sends email.
      </p>
    </AuthShell>
  );
}
