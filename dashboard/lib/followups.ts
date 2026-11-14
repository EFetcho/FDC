/**
 * Decides which inbox threads are real follow-ups.
 * Marketing mail and emergency-services QuickBooks estimates/invoices are skipped.
 * Event-division QuickBooks mail is kept.
 */

export type HeaderBag = Record<string, string>;

export function headerBag(headers: { name?: string; value?: string }[] | undefined): HeaderBag {
  const bag: HeaderBag = {};
  for (const header of headers ?? []) {
    if (!header.name) continue;
    bag[header.name.toLowerCase()] = header.value ?? "";
  }
  return bag;
}

export function isNewsletter(headers: HeaderBag): boolean {
  if (headers["list-unsubscribe"] || headers["list-id"]) return true;
  const precedence = (headers.precedence ?? "").toLowerCase();
  if (/\b(bulk|list|junk)\b/.test(precedence)) return true;
  return false;
}

export function isAutomatedNotice(headers: HeaderBag): boolean {
  const from = (headers.from ?? "").toLowerCase();
  if (from.includes("calendar-notification@google.com")) return true;
  if (from.includes("mailer-daemon") || from.includes("postmaster@")) return true;
  return false;
}

/** Fire, police, or sheriff customers. Word boundaries avoid matching unrelated words. */
export function isPublicSafetyCustomer(text: string): boolean {
  const value = text.toLowerCase();
  return (
    /\bfire\s+(department|dept\.?|district|protection|company)\b/.test(value) ||
    /\b(volunteer|township|county|city|village|metro)\s+fire\b/.test(value) ||
    /\bpolice\s+(department|dept\.?)\b/.test(value) ||
    /\bsheriff(\b|'s)\b/.test(value) ||
    /\b(fire|police)\s*&\s*ems\b/.test(value) ||
    /\bems\s+(department|dept\.?|agency)\b/.test(value)
  );
}

export function isQuickBooksDocument(text: string): boolean {
  const value = text.toLowerCase();
  const fromQuickBooks = /quickbooks|intuit\.com|\bintuit\b/.test(value);
  if (!fromQuickBooks) return false;
  return /\b(estimate|invoice|sales receipt)\b/.test(value);
}

/** Skip only emergency-services division estimates and invoices, not event clients. */
export function isEmergencyServicesQuickBooks(text: string): boolean {
  return isQuickBooksDocument(text) && isPublicSafetyCustomer(text);
}

export function looksLikeQuickBooks(text: string): boolean {
  return /quickbooks|intuit\.com|\bintuit\b/i.test(text);
}
