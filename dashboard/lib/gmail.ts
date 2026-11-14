import { allowedEmails } from "./config";
import { UserFacingError } from "./errors";
import {
  headerBag,
  isAutomatedNotice,
  isEmergencyServicesQuickBooks,
  isNewsletter,
  looksLikeQuickBooks,
} from "./followups";
import { googleFetch } from "./google";
import { dateKey, formatWhen } from "./time";
import { emailsIn, personFromHeader } from "./text";
import type { DraftItem, FollowUpItem } from "./types";
import { hiddenDrafts, hideDraft, unhideDraft } from "./user";

/**
 * Gmail access for drafts and follow-ups.
 * This module never sends mail. There is no call to messages.send or drafts.send.
 */

const SEND_BLOCK = /\/(messages|drafts)\/send\b/;

type GmailHeader = { name?: string; value?: string };
type GmailMessage = {
  id?: string;
  threadId?: string;
  labelIds?: string[];
  snippet?: string;
  internalDate?: string;
  payload?: { headers?: GmailHeader[]; mimeType?: string; body?: { data?: string }; parts?: GmailPart[] };
};
type GmailPart = { mimeType?: string; body?: { data?: string }; parts?: GmailPart[] };
type GmailThread = { id?: string; snippet?: string; messages?: GmailMessage[] };
type GmailDraft = { id?: string; message?: GmailMessage };

async function gmail(email: string, path: string, init?: RequestInit): Promise<Response> {
  if (SEND_BLOCK.test(path)) {
    throw new UserFacingError("Sending email is turned off in this dashboard.", 403);
  }
  const url = path.startsWith("https://") ? path : `https://gmail.googleapis.com/gmail/v1/users/me${path}`;
  return googleFetch(email, url, init);
}

async function gmailJson<T>(email: string, path: string, init?: RequestInit): Promise<T> {
  const response = await gmail(email, path, init);
  return (await response.json()) as T;
}

function decodeB64(data: string): string {
  const padded = data.replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(padded, "base64").toString("utf8");
}

function plainText(part: GmailPart | undefined, depth = 0): string {
  if (!part || depth > 6) return "";
  if (part.mimeType === "text/plain" && part.body?.data) return decodeB64(part.body.data);
  for (const child of part.parts ?? []) {
    const text = plainText(child, depth + 1);
    if (text) return text;
  }
  return "";
}

function messageTime(message: GmailMessage): Date | null {
  if (message.internalDate) {
    const date = new Date(Number(message.internalDate));
    if (!Number.isNaN(date.getTime())) return date;
  }
  const raw = headerBag(message.payload?.headers).date;
  if (!raw) return null;
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date;
}

function ericAddresses(signedInEmail: string): Set<string> {
  return new Set([...allowedEmails(), signedInEmail.toLowerCase()]);
}

function isFromEric(from: string, eric: Set<string>): boolean {
  return emailsIn(from).some((address) => eric.has(address));
}

export async function loadDrafts(email: string): Promise<DraftItem[]> {
  const hidden = await hiddenDrafts(email);
  const list = await gmailJson<{ drafts?: GmailDraft[]; nextPageToken?: string }>(
    email,
    "/drafts?maxResults=30",
  );
  const drafts = (list.drafts ?? []).filter((draft) => draft.id && !hidden.has(draft.id));
  const detailed = await mapPool(drafts, 5, async (draft) => {
    try {
      return await gmailJson<GmailDraft>(
        email,
        `/drafts/${encodeURIComponent(draft.id!)}?format=metadata&metadataHeaders=Subject&metadataHeaders=To&metadataHeaders=Date`,
      );
    } catch {
      return draft;
    }
  });
  const today = dateKey(new Date());
  return detailed
    .filter((draft) => draft.id && !hidden.has(draft.id))
    .map((draft) => {
      const headers = headerBag(draft.message?.payload?.headers);
      const when = messageTime(draft.message ?? {}) ?? new Date();
      const messageId = draft.message?.id;
      return {
        id: draft.id!,
        subject: headers.subject?.trim() || "(no subject)",
        to: headers.to?.trim() || "(no recipient)",
        dateLabel: formatWhen(when, today),
        link: messageId ? `https://mail.google.com/mail/u/0/#drafts?compose=${messageId}` : "https://mail.google.com/mail/u/0/#drafts",
      };
    });
}

export async function dismissDraft(email: string, id: string): Promise<void> {
  if (!id || id.length > 128) throw new UserFacingError("That draft could not be hidden.");
  await hideDraft(email, id);
}

export async function restoreDraft(email: string, id: string): Promise<void> {
  await unhideDraft(email, id);
}

export async function deleteDraft(email: string, id: string): Promise<void> {
  if (!id || id.length > 128) throw new UserFacingError("That draft could not be deleted.");
  await gmail(email, `/drafts/${encodeURIComponent(id)}`, { method: "DELETE" });
  await hideDraft(email, id);
}

const DONE_LABEL = "Dashboard/Done";

async function doneLabelId(email: string): Promise<string> {
  const list = await gmailJson<{ labels?: { id?: string; name?: string }[] }>(email, "/labels");
  const existing = (list.labels ?? []).find((label) => label.name === DONE_LABEL);
  if (existing?.id) return existing.id;
  const created = await gmailJson<{ id?: string }>(email, "/labels", {
    method: "POST",
    body: JSON.stringify({
      name: DONE_LABEL,
      labelListVisibility: "labelShow",
      messageListVisibility: "show",
    }),
  });
  if (!created.id) throw new UserFacingError("Gmail did not create the Dashboard/Done label.");
  return created.id;
}

export async function loadFollowUps(email: string): Promise<FollowUpItem[]> {
  const query = encodeURIComponent(
    'in:inbox newer_than:14d -category:promotions -category:social -category:forums -label:"dashboard/done"',
  );
  const list = await gmailJson<{ threads?: { id?: string }[] }>(email, `/threads?maxResults=25&q=${query}`);
  const threads = (list.threads ?? []).filter((thread) => thread.id);
  const eric = ericAddresses(email);
  const today = dateKey(new Date());
  const loaded = await mapPool(threads, 4, async (thread) => {
    try {
      const full = await gmailJson<GmailThread>(
        email,
        `/threads/${encodeURIComponent(thread.id!)}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date&metadataHeaders=List-Unsubscribe&metadataHeaders=List-Id&metadataHeaders=Precedence`,
      );
      return await classifyThread(email, full, eric, today);
    } catch (error) {
      console.error("Skipped a Gmail thread", error instanceof Error ? error.message : error);
      return null;
    }
  });
  return loaded.filter((item): item is FollowUpItem => Boolean(item));
}

async function classifyThread(
  email: string,
  thread: GmailThread,
  eric: Set<string>,
  today: string,
): Promise<FollowUpItem | null> {
  const messages = thread.messages ?? [];
  if (!thread.id || messages.length === 0) return null;
  const last = messages[messages.length - 1];
  const lastHeaders = headerBag(last.payload?.headers);
  if (isFromEric(lastHeaders.from ?? "", eric)) return null;
  if (messages.some((message) => isNewsletter(headerBag(message.payload?.headers)))) return null;
  if (isAutomatedNotice(lastHeaders)) return null;
  if ((last.labelIds ?? []).some((label) => label === "CATEGORY_PROMOTIONS" || label === "CATEGORY_SOCIAL")) {
    return null;
  }

  const subject = messages.map((message) => headerBag(message.payload?.headers).subject ?? "").join("\n");
  const froms = messages.map((message) => headerBag(message.payload?.headers).from ?? "").join("\n");
  let blob = `${froms}\n${subject}\n${thread.snippet ?? ""}`;
  if (looksLikeQuickBooks(blob) && !isEmergencyServicesQuickBooks(blob)) {
    const body = await threadBody(email, thread.id);
    blob = `${blob}\n${body}`;
  }
  if (isEmergencyServicesQuickBooks(blob)) return null;

  const person = personFromHeader(lastHeaders.from ?? "");
  const when = messageTime(last) ?? new Date();
  const subjectLine =
    headerBag(messages[0]?.payload?.headers).subject?.trim() || lastHeaders.subject?.trim() || "(no subject)";
  return {
    id: thread.id,
    from: person.name,
    email: person.email,
    subject: subjectLine,
    snippet: (thread.snippet ?? "").trim(),
    dateLabel: formatWhen(when, today),
    link: `https://mail.google.com/mail/u/0/#inbox/${thread.id}`,
  };
}

async function threadBody(email: string, threadId: string): Promise<string> {
  try {
    const thread = await gmailJson<GmailThread>(email, `/threads/${encodeURIComponent(threadId)}?format=full`);
    return (thread.messages ?? [])
      .map((message) => plainText(message.payload).slice(0, 4000))
      .join("\n")
      .slice(0, 12_000);
  } catch {
    return "";
  }
}

export async function markFollowUpDone(email: string, id: string): Promise<void> {
  if (!id || id.length > 128) throw new UserFacingError("That thread could not be updated.");
  const labelId = await doneLabelId(email);
  await gmail(email, `/threads/${encodeURIComponent(id)}/modify`, {
    method: "POST",
    body: JSON.stringify({ addLabelIds: [labelId] }),
  });
}

export async function undoFollowUp(email: string, id: string): Promise<void> {
  if (!id || id.length > 128) throw new UserFacingError("That thread could not be updated.");
  const labelId = await doneLabelId(email);
  await gmail(email, `/threads/${encodeURIComponent(id)}/modify`, {
    method: "POST",
    body: JSON.stringify({ removeLabelIds: [labelId] }),
  });
}

export async function mapPool<T, R>(items: T[], size: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let index = 0;
  async function worker() {
    while (index < items.length) {
      const current = index++;
      results[current] = await fn(items[current]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(size, items.length) }, () => worker()));
  return results;
}
