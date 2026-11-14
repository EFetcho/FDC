"use client";

import { useState } from "react";

export default function VerifyForm() {
  const [code, setCode] = useState("");
  const [backup, setBackup] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  return (
    <form
      className="stack"
      onSubmit={(event) => {
        event.preventDefault();
        setBusy(true);
        setError("");
        void fetch("/api/auth/verify", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ code }),
        })
          .then(async (response) => {
            const data = (await response.json()) as { error?: string; redirect?: string };
            if (response.status === 409 && data.redirect) {
              window.location.href = data.redirect;
              return;
            }
            if (!response.ok) throw new Error(data.error || "That code was not accepted.");
            window.location.href = "/";
          })
          .catch((reason: unknown) => {
            setError(reason instanceof Error ? reason.message : "Try again.");
            setBusy(false);
          });
      }}
    >
      <label>
        {backup ? "Backup code" : "6-digit code"}
        <input
          value={code}
          onChange={(event) => setCode(event.target.value)}
          inputMode={backup ? "text" : "numeric"}
          autoComplete="one-time-code"
          autoFocus
          required
          aria-label={backup ? "Backup code" : "6-digit code"}
        />
      </label>
      {error ? <p className="error">{error}</p> : null}
      <button className="primary" type="submit" disabled={busy}>
        {busy ? "Checking…" : "Continue"}
      </button>
      <button
        className="text-btn"
        type="button"
        onClick={() => {
          setBackup((value) => !value);
          setCode("");
          setError("");
        }}
      >
        {backup ? "Use an authenticator code instead" : "Use a backup code instead"}
      </button>
    </form>
  );
}
