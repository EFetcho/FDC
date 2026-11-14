import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { isEmergencyServicesQuickBooks, isNewsletter, isPublicSafetyCustomer } from "./followups.ts";

test("skips newsletter headers", () => {
  assert.equal(isNewsletter({ "list-unsubscribe": "<mailto:bye@example.com>" }), true);
  assert.equal(isNewsletter({ "list-id": "news.example.com" }), true);
  assert.equal(isNewsletter({ precedence: "bulk" }), true);
  assert.equal(isNewsletter({ from: "Planner <planner@example.com>", subject: "Dock time" }), false);
});

test("skips fire and police QuickBooks documents only", () => {
  assert.equal(
    isEmergencyServicesQuickBooks(
      "From: quickbooks@notification.intuit.com\nSubject: Invoice 1042 for Allen County Fire Department",
    ),
    true,
  );
  assert.equal(
    isEmergencyServicesQuickBooks("QuickBooks estimate for Fort Wayne Police Department"),
    true,
  );
  assert.equal(
    isEmergencyServicesQuickBooks("intuit.com sales receipt · Pleasant Township Fire"),
    true,
  );
  assert.equal(isPublicSafetyCustomer("sheriff's office estimate"), true);
  assert.equal(
    isEmergencyServicesQuickBooks(
      "From: quickbooks@notification.intuit.com\nSubject: Invoice 100 for the annual meeting, Acme Corp",
    ),
    false,
  );
  assert.equal(
    isEmergencyServicesQuickBooks("quickbooks invoice for the Fire and Ice gala"),
    false,
  );
  assert.equal(
    isEmergencyServicesQuickBooks("Please send the revised quote for the leadership summit"),
    false,
  );
});

test("gmail client never sends mail", () => {
  const source = readFileSync(new URL("./gmail.ts", import.meta.url), "utf8");
  assert.doesNotMatch(source, /messages\/send|drafts\/send|gmail\.send/);
  assert.match(source, /Sending email is turned off/);
});
