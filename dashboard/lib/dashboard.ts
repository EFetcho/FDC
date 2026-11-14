import { loadCalendar } from "./calendar";
import { demoDashboard } from "./demo";
import { friendlyError } from "./errors";
import { loadDrafts, loadFollowUps } from "./gmail";
import { loadProjects } from "./sheets";
import { dateKey, formatLongDate, formatUpdated } from "./time";
import { loadTasks } from "./todoist";
import type { DashboardData, Session } from "./types";

function section<T extends object>(label: string, fallback: string, fn: () => Promise<T>): Promise<T & { error?: string }> {
  const blank = label === "calendar" ? { days: [], count: 0 } : { items: [] };
  return fn().then(
    (data) => data as T & { error?: string },
    (error: unknown) =>
      ({ ...blank, error: friendlyError(error, fallback) }) as unknown as T & { error?: string },
  );
}

export async function loadDashboard(session: Session): Promise<DashboardData> {
  if (session.demo) return demoDashboard(session.name || "Eric");
  const email = session.email;
  const now = new Date();
  const [calendar, tasks, drafts, followups, projects] = await Promise.all([
    section("calendar", "Calendar could not be loaded.", () => loadCalendar(email)),
    section("tasks", "Tasks could not be loaded.", async () => ({ items: await loadTasks() })),
    section("drafts", "Drafts could not be loaded.", async () => ({ items: await loadDrafts(email) })),
    section("followups", "Follow-ups could not be loaded.", async () => ({ items: await loadFollowUps(email) })),
    section("projects", "Projects could not be loaded.", async () => ({ items: await loadProjects(email) })),
  ]);
  return {
    demo: false,
    email,
    name: session.name || email,
    todayKey: dateKey(now),
    todayLabel: formatLongDate(now),
    updatedLabel: formatUpdated(now),
    calendar,
    tasks,
    drafts,
    followups,
    projects,
  };
}
