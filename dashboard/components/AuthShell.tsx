import ThemeToggle from "./ThemeToggle";

export default function AuthShell({
  title,
  lead,
  wide,
  children,
}: {
  title: string;
  lead?: string;
  wide?: boolean;
  children: React.ReactNode;
}) {
  return (
    <main className="auth-wrap">
      <div className={`auth-frame${wide ? " wide-auth" : ""}`}>
        <div className="auth-bar">
          <span>FDC Operations</span>
          <ThemeToggle />
        </div>
        <section className="auth-card">
        {/* Same-origin proxy of the fdcav.com logo, with a saved copy if the site is down. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="logo" src="/brand/logo" alt="FDC Event Technology" />
        <h1>{title}</h1>
        {lead ? <p className="lead">{lead}</p> : null}
        {children}
        </section>
      </div>
    </main>
  );
}
