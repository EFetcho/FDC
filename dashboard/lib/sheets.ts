import { sheetId, sheetTab } from "./config";
import { UserFacingError } from "./errors";
import { googleFetch } from "./google";
import { dateKey } from "./time";
import { clip, safeHttpUrl } from "./text";
import type { ProjectItem } from "./types";

function tabName(): string {
  return sheetTab().replace(/'/g, "''");
}

function range(a1: string): string {
  return `'${tabName()}'!${a1}`;
}

async function sheets(email: string, path: string, init?: RequestInit): Promise<Response> {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(sheetId())}${path}`;
  return googleFetch(email, url, init);
}

function isOpen(status: string): boolean {
  const value = status.trim().toLowerCase();
  return value === "" || value === "open";
}

export async function loadProjects(email: string): Promise<ProjectItem[]> {
  const encoded = encodeURIComponent(range("A:D"));
  const response = await sheets(email, `/values/${encoded}?valueRenderOption=FORMATTED_VALUE`);
  const json = (await response.json()) as { values?: string[][] };
  const rows = json.values ?? [];
  const projects: ProjectItem[] = [];
  rows.forEach((row, index) => {
    if (index === 0) return;
    const name = (row[0] ?? "").trim();
    const started = (row[1] ?? "").trim();
    const status = (row[2] ?? "").trim();
    const chat = (row[3] ?? "").trim();
    if (!name && !started && !status && !chat) return;
    if (!isOpen(status)) return;
    projects.push({
      row: index + 1,
      name: name || "(untitled project)",
      started,
      status: status || "open",
      chatUrl: safeHttpUrl(chat) ?? undefined,
    });
  });
  return projects;
}

function assertRow(row: number): void {
  if (!Number.isInteger(row) || row < 2 || row > 5000) {
    throw new UserFacingError("That project row is not on the sheet.");
  }
}

async function writeStatus(email: string, row: number, status: "open" | "closed"): Promise<void> {
  assertRow(row);
  const a1 = range(`C${row}`);
  await sheets(email, `/values/${encodeURIComponent(a1)}?valueInputOption=USER_ENTERED`, {
    method: "PUT",
    body: JSON.stringify({ range: a1, majorDimension: "ROWS", values: [[status]] }),
  });
}

export async function closeProject(email: string, row: number): Promise<void> {
  await writeStatus(email, row, "closed");
}

export async function reopenProject(email: string, row: number): Promise<void> {
  await writeStatus(email, row, "open");
}

export async function addProject(
  email: string,
  input: { name: string; dateStarted?: string; chatLink?: string },
): Promise<ProjectItem> {
  const name = clip(input.name ?? "", 200);
  if (!name) throw new UserFacingError("Type a project name first.");
  let started = (input.dateStarted ?? "").trim();
  if (started && !/^\d{4}-\d{2}-\d{2}$/.test(started)) {
    throw new UserFacingError("Use a start date like 2026-11-14.");
  }
  if (!started) started = dateKey(new Date());
  const chat = (input.chatLink ?? "").trim();
  if (chat && !safeHttpUrl(chat)) throw new UserFacingError("The chat link must start with http:// or https://.");
  const a1 = range("A:D");
  const response = await sheets(
    email,
    `/values/${encodeURIComponent(a1)}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
    {
      method: "POST",
      body: JSON.stringify({
        range: a1,
        majorDimension: "ROWS",
        values: [[name, started, "open", chat]],
      }),
    },
  );
  const json = (await response.json()) as { updates?: { updatedRange?: string } };
  const updated = json.updates?.updatedRange ?? "";
  const match = updated.match(/![A-Z]+(\d+)/i);
  const row = match ? Number(match[1]) : 0;
  return {
    row: row || 0,
    name,
    started,
    status: "open",
    chatUrl: safeHttpUrl(chat) ?? undefined,
  };
}
