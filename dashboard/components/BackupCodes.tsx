"use client";

import { useState } from "react";

export default function BackupCodes({ codes, continueHref = "/" }: { codes: string[]; continueHref?: string }) {
  const [saved, setSaved] = useState(codes.length === 0);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function finish() {
    setBusy(true);
    setError("");
    const response = await fetch("/api/auth/enroll/ack", { method: "POST" });
    if (response.ok) {
      window.location.href = continueHref;
      return;
    }
    const data = (await response.json().catch(() => ({}))) as { error?: string };
    setError(data.error || "Could not continue.");
    setBusy(false);
  }

  return (
    <div>
      {codes.length > 0 ? (
        <>
          <div className="codes" aria-label="Backup codes">
            {codes.map((code) => (
              <code key={code}>{code}</code>
            ))}
          </div>
          <button
            className="text-btn"
            type="button"
            onClick={() => {
              void navigator.clipboard.writeText(codes.join("\n")).then(() => setCopied(true));
            }}
          >
            {copied ? "Copied" : "Copy codes"}
          </button>
          <label className="checkline">
            <input type="checkbox" checked={saved} onChange={(event) => setSaved(event.target.checked)} />
            <span>I stored these codes in a safe place that is not my phone.</span>
          </label>
        </>
      ) : null}
      {error ? <p className="error">{error}</p> : null}
      <button className="primary" type="button" disabled={!saved || busy} onClick={() => void finish()}>
        {busy ? "Continuing…" : "Continue to the dashboard"}
      </button>
    </div>
  );
}
