import { UserFacingError } from "./errors";
import { dateKey, diffDays } from "./time";
import { clip } from "./text";
import type { TaskItem } from "./types";

const BASE = "https://api.todoist.com/api/v1";

type Due = { date?: string; datetime?: string; string?: string; is_recurring?: boolean } | null;

type RemoteTask = {
  id?: string;
  content?: string;
  description?: string;
  priority?: number;
  due?: Due;
  url?: string;
  checked?: boolean;
  is_deleted?: boolean;
};

function token(): string {
  const value = process.env.TODOIST_API_TOKEN?.trim();
  if (!value) {
    throw new UserFacingError("Todoist is not connected yet. Add TODOIST_API_TOKEN in Vercel, then redeploy.");
  }
  return value;
}

async function todoist(path: string, init?: RequestInit): Promise<Response> {
  const headers = new Headers(init?.headers);
  headers.set("authorization", `Bearer ${token()}`);
  if (init?.body && !headers.has("content-type")) headers.set("content-type", "application/json");
  const response = await fetch(`${BASE}${path}`, { ...init, headers, signal: AbortSignal.timeout(20_000) });
  if (response.status === 401 || response.status === 403) {
    throw new UserFacingError(
      "Todoist did not accept the API token. In Todoist, open Settings → Integrations → Developer, copy the token again, and update TODOIST_API_TOKEN in Vercel.",
    );
  }
  if (!response.ok && response.status !== 204) {
    const detail = await response.text();
    console.error("Todoist error", response.status, detail.slice(0, 300));
    throw new UserFacingError(`Todoist returned an error (${response.status}). Try again in a minute.`);
  }
  return response;
}

function unwrap(data: unknown): RemoteTask[] {
  if (Array.isArray(data)) return data as RemoteTask[];
  if (data && typeof data === "object" && Array.isArray((data as { results?: unknown }).results)) {
    return (data as { results: RemoteTask[] }).results;
  }
  return [];
}

function dueKeyOf(due: Due): string | undefined {
  if (!due) return undefined;
  if (due.datetime) return dateKey(new Date(due.datetime));
  if (due.date) return due.date.slice(0, 10);
  return undefined;
}

function toItem(task: RemoteTask, today: string): TaskItem | null {
  if (!task.id || !task.content || task.checked || task.is_deleted) return null;
  const dueKey = dueKeyOf(task.due ?? null);
  const priority = task.priority ?? 1;
  // Todoist API: 4 is urgent (P1 in the app), 1 is normal.
  const priorityLabel = priority === 4 ? "P1" : priority === 3 ? "P2" : undefined;
  let dueLabel: string | undefined;
  if (task.due?.string) dueLabel = task.due.string;
  else if (dueKey) dueLabel = dueKey;
  return {
    id: task.id,
    content: task.content,
    dueLabel,
    dueKey,
    overdue: Boolean(dueKey && diffDays(dueKey, today) < 0),
    priority,
    priorityLabel,
    url: task.url,
    recurring: Boolean(task.due?.is_recurring),
  };
}

function sortTasks(tasks: TaskItem[]): TaskItem[] {
  return [...tasks].sort((a, b) => {
    if (a.overdue !== b.overdue) return a.overdue ? -1 : 1;
    if (a.dueKey && b.dueKey && a.dueKey !== b.dueKey) return a.dueKey < b.dueKey ? -1 : 1;
    if (a.dueKey && !b.dueKey) return -1;
    if (!a.dueKey && b.dueKey) return 1;
    return b.priority - a.priority;
  });
}

export async function loadTasks(): Promise<TaskItem[]> {
  const today = dateKey(new Date());
  const collected: RemoteTask[] = [];
  let cursor: string | null = null;
  for (let page = 0; page < 3; page++) {
    const params = new URLSearchParams({ limit: "100" });
    if (cursor) params.set("cursor", cursor);
    const response = await todoist(`/tasks?${params}`);
    const json = (await response.json()) as { results?: RemoteTask[]; next_cursor?: string | null } | RemoteTask[];
    collected.push(...unwrap(json));
    cursor = !Array.isArray(json) ? json.next_cursor ?? null : null;
    if (!cursor) break;
  }
  return sortTasks(collected.map((task) => toItem(task, today)).filter((task): task is TaskItem => Boolean(task)));
}

export async function addTask(content: string, due?: string): Promise<TaskItem> {
  const text = clip(content, 500);
  if (!text) throw new UserFacingError("Type a task first.");
  const body: Record<string, string> = { content: text };
  const dueText = due?.trim();
  if (dueText) body.due_string = clip(dueText, 80);
  const response = await todoist("/tasks", { method: "POST", body: JSON.stringify(body) });
  const json = (await response.json()) as RemoteTask;
  const item = toItem(json, dateKey(new Date()));
  if (!item) throw new UserFacingError("Todoist did not return the new task.");
  return item;
}

export async function closeTask(id: string): Promise<void> {
  assertId(id);
  await todoist(`/tasks/${encodeURIComponent(id)}/close`, { method: "POST" });
}

export async function reopenTask(id: string): Promise<void> {
  assertId(id);
  await todoist(`/tasks/${encodeURIComponent(id)}/reopen`, { method: "POST" });
}

function assertId(id: string): void {
  if (!id || id.length > 64 || !/^[\w-]+$/.test(id)) throw new UserFacingError("That task could not be updated.");
}
