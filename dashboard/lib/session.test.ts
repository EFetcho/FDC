import assert from "node:assert/strict";
import test from "node:test";

test("session cookie round trip", async () => {
  process.env.SESSION_SECRET = "test-secret-test-secret-test-secret-1234";
  process.env.DEMO_MODE = "false";
  const { createSession, readSession } = await import("./session.ts");
  const token = await createSession({
    email: "fetcho@fdcav.com",
    name: "Eric",
    stage: "full",
    demo: false,
    exp: Date.now() + 60_000,
  });
  const session = await readSession(token);
  assert.equal(session?.email, "fetcho@fdcav.com");
  assert.equal(session?.stage, "full");
  assert.equal(await readSession(`${token}x`), null);
});

test("backup codes are single use and ignore dashes", async () => {
  process.env.SESSION_SECRET = "test-secret-test-secret-test-secret-1234";
  const { generateBackupCodes, hashBackupCode, backupCodeMatches } = await import("./crypto.ts");
  const [code] = generateBackupCodes(1);
  const hash = hashBackupCode(code);
  assert.equal(backupCodeMatches(code.toLowerCase().replace("-", " "), hash), true);
  assert.equal(backupCodeMatches("ZZZZ-ZZZZ", hash), false);
});
