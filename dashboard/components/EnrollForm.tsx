"use client";

import { useState } from "react";
import BackupCodes from "./BackupCodes";

export default function EnrollForm() {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [codes, setCodes] = useState<string[] | null>(null);

  if (codes) {
    return (
      <div>
        <h2 style={{ fontFamily: "var(--font-display), sans-serif", fontSize: 22 }}>Save your backup codes</h2>
        <p className="lead">Each code works once if you do not have your authenticator. Store them somewhere that is not your phone.</p>
        <BackupCodes codes={codes} />
      </div>
    );
  }

  return (
    <form
      className="stack"
      onSubmit={(event) => {
        event.preventDefault();
        setBusy(true);
        setError("");
        void fetch("/api/auth/enroll/confirm", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ code }),
        })
          .then(async (response) => {
            const data = (await response.json()) as { error?: string; codes?: string[] };
            if (!response.ok || !data.codes) throw new Error(data.error || "That code was not accepted.");
            setCodes(data.codes);
          })
          .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "Try again."))
          .finally(() => setBusy(false));
      }}
    >
      <label>
        6-digit code
        <input
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9 ]{6,8}"
          value={code}
          onChange={(event) => setCode(event.target.value)}
          required
          aria-label="6-digit code"
        />
      </label>
      {error ? <p className="error">{error}</p> : null}
      <button className="primary" type="submit" disabled={busy}>
        {busy ? "Checking…" : "Confirm and continue"}
      </button>
    </form>
  );
}
