export function emailsIn(value: string): string[] {
  const matches = value.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) ?? [];
  return matches.map((email) => email.toLowerCase());
}

export function personFromHeader(from: string): { name: string; email: string } {
  const email = emailsIn(from)[0] ?? "";
  const name = from.replace(/<[^>]+>/g, "").replace(/"/g, "").trim();
  return { name: name || email || "Unknown sender", email };
}

export function safeHttpUrl(value: string | undefined | null): string | null {
  if (!value) return null;
  try {
    const url = new URL(value.trim());
    if (url.protocol === "https:" || url.protocol === "http:") return url.toString();
  } catch {
    return null;
  }
  return null;
}

export function clip(value: string, max: number): string {
  const trimmed = value.trim();
  if (trimmed.length <= max) return trimmed;
  return trimmed.slice(0, max);
}
