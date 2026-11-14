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
      <section className={`auth-card${wide ? " wide-auth" : ""}`}>
        {/* The logo is fetched from fdcav.com by /brand/logo, with a saved copy if the site is down. */}
        <img className="logo" src="/brand/logo" alt="FDC Event Technology" />
        <h1>{title}</h1>
        {lead ? <p className="lead">{lead}</p> : null}
        {children}
      </section>
    </main>
  );
}
