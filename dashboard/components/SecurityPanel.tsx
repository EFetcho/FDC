"use client";

import { useState } from "react";

type Start = { secret: string; qr: string };

export default function SecurityPanel() {
  const [codes, setCodes] = useState<string[] | null>(null);
  const [start, setStart] = useState<Start | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");

  async function send(url: string, code: string): Promise<Record<string, unknown>> {
    const response = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ code }),
    });
    const data = (await response.json().catch(() => ({}))) as { error?: string };
    if (!response.ok) throw new Error(data.error || "That did not work.");
    return data;
  }

  return (
    <div>
      <section className="security-block">
        <h2>New backup codes</h2>
        <p className="lead">This replaces the old codes. Enter a current authenticator code first.</p>
        <CodeForm
          busy={busy === "backup"}
          label="Create new codes"
          onSubmit={(code) => {
            setBusy("backup");
            setError("");
            void send("/api/auth/backup", code)
              .then((data) => setCodes(data.codes as string[]))
              .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "Try again."))
              .finally(() => setBusy(""));
          }}
        />
        {codes ? (
          <div className="codes" aria-label="New backup codes">
            {codes.map((code) => (
              <code key={code}>{code}</code>
            ))}
          </div>
        ) : null}
      </section>

      <section className="security-block">
        <h2>Set up a new authenticator</h2>
        <p className="lead">
          Use this if you got a new phone. Enter a current authenticator code or a backup code. The old authenticator
          stops working after you confirm the new one.
        </p>
        {start ? (
          <div>
            <img className="qr" src={start.qr} alt="New authenticator setup code" />
            <p className="manual">{start.secret}</p>
            <CodeForm
              busy={busy === "confirm"}
              label="Confirm new authenticator"
              onSubmit={(code) => {
                setBusy("confirm");
                setError("");
                void send("/api/auth/reenroll/confirm", code)
                  .then((data) => {
                    setCodes(data.codes as string[]);
                    setStart(null);
                  })
                  .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "Try again."))
                  .finally(() => setBusy(""));
              }}
            />
          </div>
        ) : (
          <CodeForm
            busy={busy === "start"}
            label="Show a new setup code"
            allowBackup
            onSubmit={(code) => {
              setBusy("start");
              setError("");
              void send("/api/auth/reenroll/start", code)
                .then((data) => setStart({ secret: String(data.secret), qr: String(data.qr) }))
                .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "Try again."))
                .finally(() => setBusy(""));
            }}
          />
        )}
      </section>
      {error ? <p className="error">{error}</p> : null}
      <p>
        <a href="/">Back to the dashboard</a>
      </p>
    </div>
  );
}

function CodeForm({
  label,
  busy,
  allowBackup,
  onSubmit,
}: {
  label: string;
  busy: boolean;
  allowBackup?: boolean;
  onSubmit: (code: string) => void;
}) {
  const [code, setCode] = useState("");
  return (
    <form
      className="stack"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit(code);
        setCode("");
      }}
    >
      <input
        value={code}
        onChange={(event) => setCode(event.target.value)}
        aria-label={allowBackup ? "Authenticator or backup code" : "Authenticator code"}
        placeholder={allowBackup ? "Authenticator or backup code" : "6-digit code"}
        required
      />
      <button className="primary" type="submit" disabled={busy}>
        {busy ? "Working…" : label}
      </button>
    </form>
  );
}
