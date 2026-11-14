import { groupEvents } from "./calendar";
import { UserFacingError } from "./errors";
import { addDays, dateKey, formatDayLabel, formatLongDate, formatUpdated, formatWhen, zonedDateTime } from "./time";
import { safeHttpUrl } from "./text";
import type { CalendarEvent, DashboardData, DraftItem, FollowUpItem, ProjectItem, TaskItem } from "./types";

type DemoDb = {
  events: CalendarEvent[];
  tasks: TaskItem[];
  closedTasks: TaskItem[];
  drafts: DraftItem[];
  hiddenDrafts: Set<string>;
  deletedDrafts: Set<string>;
  followups: FollowUpItem[];
  doneFollowups: FollowUpItem[];
  projects: ProjectItem[];
  nextTask: number;
  nextRow: number;
};

const globalDemo = globalThis as unknown as { __fdcDemo?: DemoDb };

function at(key: string, hour: number, minute = 0): string {
  return zonedDateTime(key, hour, minute).toISOString();
}

function seed(): DemoDb {
  const today = dateKey(new Date());
  const day = (offset: number) => addDays(today, offset);
  const yesterday = day(-1);

  const events: CalendarEvent[] = [
    {
      id: "demo-ev-1",
      title: "Load-in · convention center",
      start: at(today, 8),
      end: at(today, 11),
      allDay: false,
      location: "Grand Wayne Convention Center, Fort Wayne",
      calendar: "",
      link: "https://calendar.google.com",
    },
    {
      id: "demo-ev-2",
      title: "Site walk with hotel AV",
      start: at(today, 13, 30),
      end: at(today, 14, 15),
      allDay: false,
      location: "Hotel ballroom",
      calendar: "",
    },
    {
      id: "demo-ev-3",
      title: "Client call · leadership summit",
      start: at(day(1), 10),
      end: at(day(1), 10, 30),
      allDay: false,
      calendar: "",
    },
    {
      id: "demo-ev-4",
      title: "Shop day · projector package",
      start: day(3),
      end: day(4),
      allDay: true,
      location: "FDC shop, 520 Spring Street",
      calendar: "Shop",
    },
    {
      id: "demo-ev-5",
      title: "Advance · hybrid keynote",
      start: at(day(4), 15),
      end: at(day(4), 16),
      allDay: false,
      calendar: "",
    },
    {
      id: "demo-ev-6",
      title: "On site · board retreat",
      start: at(day(7), 7),
      end: at(day(7), 18),
      allDay: false,
      location: "Indianapolis",
      calendar: "",
    },
    {
      id: "demo-ev-7",
      title: "Internal quote review",
      start: at(day(9), 11),
      end: at(day(9), 11, 45),
      allDay: false,
      calendar: "FDC",
    },
    {
      id: "demo-ev-8",
      title: "Venue pickup",
      start: at(day(12), 16),
      end: at(day(12), 17),
      allDay: false,
      location: "Convention center dock",
      calendar: "",
    },
  ];

  const tasks: TaskItem[] = [
    {
      id: "demo-task-1",
      content: "Confirm wireless handheld count for the convention center",
      dueLabel: "today",
      dueKey: today,
      overdue: false,
      priority: 4,
      priorityLabel: "P1",
      url: "https://app.todoist.com",
    },
    {
      id: "demo-task-2",
      content: "Call the hotel about the power drop",
      dueLabel: "yesterday",
      dueKey: yesterday,
      overdue: true,
      priority: 4,
      priorityLabel: "P1",
    },
    {
      id: "demo-task-3",
      content: "Send the stage plot to the venue",
      dueLabel: "tomorrow",
      dueKey: day(1),
      overdue: false,
      priority: 3,
      priorityLabel: "P2",
    },
    {
      id: "demo-task-4",
      content: "Order spare HDMI and SDI",
      dueLabel: formatDayLabel(day(3), today).replace(/^.*?·\s*/, ""),
      dueKey: day(3),
      overdue: false,
      priority: 1,
    },
    {
      id: "demo-task-5",
      content: "Book crew for the board retreat: 2 audio, 1 video",
      dueLabel: "in 4 days",
      dueKey: day(4),
      overdue: false,
      priority: 4,
      priorityLabel: "P1",
    },
    {
      id: "demo-task-6",
      content: "Update the rental pricing sheet",
      overdue: false,
      priority: 1,
    },
  ];

  const drafts: DraftItem[] = [
    {
      id: "demo-draft-1",
      subject: "Load-in schedule and dock access",
      to: "events@example.com",
      dateLabel: formatWhen(zonedDateTime(today, 9, 10), today),
      link: "https://mail.google.com/mail/u/0/#drafts",
    },
    {
      id: "demo-draft-2",
      subject: "Revised AV quote — leadership summit",
      to: "planner@example.com",
      dateLabel: formatWhen(zonedDateTime(yesterday, 16, 40), today),
      link: "https://mail.google.com/mail/u/0/#drafts",
    },
    {
      id: "demo-draft-3",
      subject: "Hybrid streaming diagram",
      to: "av@example.com",
      dateLabel: formatWhen(zonedDateTime(day(-2), 11, 5), today),
      link: "https://mail.google.com/mail/u/0/#drafts",
    },
  ];

  const followups: FollowUpItem[] = [
    {
      id: "demo-fu-1",
      from: "Summit planner",
      email: "planner@example.com",
      subject: "Confidence monitors",
      snippet: "Can you confirm the confidence monitor count before we lock the stage plot?",
      dateLabel: formatWhen(zonedDateTime(today, 8, 12), today),
      link: "https://mail.google.com/mail/u/0/#inbox/demo-fu-1",
    },
    {
      id: "demo-fu-2",
      from: "Convention center events",
      email: "events@example.com",
      subject: "Dock reservation",
      snippet: "The dock reservation needs a revised arrival time. What should we put on the form?",
      dateLabel: formatWhen(zonedDateTime(yesterday, 15, 2), today),
      link: "https://mail.google.com/mail/u/0/#inbox/demo-fu-2",
    },
    {
      id: "demo-fu-3",
      from: "Hotel AV manager",
      email: "av@example.com",
      subject: "Ballroom power",
      snippet: "Power in the ballroom is a 100A service. Is that enough for your lighting package?",
      dateLabel: formatWhen(zonedDateTime(day(-3), 10, 20), today),
      link: "https://mail.google.com/mail/u/0/#inbox/demo-fu-3",
    },
  ];

  const projects: ProjectItem[] = [
    {
      row: 2,
      name: "Leadership summit",
      started: "Oct 2, 2026",
      status: "open",
      chatUrl: "https://example.com/chat/summit",
    },
    {
      row: 3,
      name: "Convention center hybrid keynote",
      started: "Oct 18, 2026",
      status: "open",
      chatUrl: "https://example.com/chat/keynote",
    },
    {
      row: 4,
      name: "Indianapolis board retreat",
      started: "Nov 1, 2026",
      status: "open",
    },
    {
      row: 5,
      name: "Fort Wayne product launch",
      started: "Nov 8, 2026",
      status: "open",
      chatUrl: "https://example.com/chat/launch",
    },
    {
      row: 6,
      name: "Closed sample · holiday party",
      started: "Sep 1, 2026",
      status: "closed",
    },
  ];

  return {
    events,
    tasks,
    closedTasks: [],
    drafts,
    hiddenDrafts: new Set(),
    deletedDrafts: new Set(),
    followups,
    doneFollowups: [],
    projects,
    nextTask: 100,
    nextRow: 7,
  };
}

function db(): DemoDb {
  if (!globalDemo.__fdcDemo) globalDemo.__fdcDemo = seed();
  return globalDemo.__fdcDemo;
}

export function demoDashboard(name: string): DashboardData {
  const data = db();
  const now = new Date();
  const days = groupEvents(data.events, now);
  return {
    demo: true,
    email: "demo@fdcav.com",
    name,
    todayKey: dateKey(now),
    todayLabel: formatLongDate(now),
    updatedLabel: formatUpdated(now),
    calendar: { days, count: days.reduce((sum, day) => sum + day.events.length, 0) },
    tasks: { items: data.tasks.filter((task) => task.id) },
    drafts: { items: data.drafts.filter((draft) => !data.hiddenDrafts.has(draft.id) && !data.deletedDrafts.has(draft.id)) },
    followups: { items: data.followups },
    projects: { items: data.projects.filter((project) => project.status.toLowerCase() === "open") },
  };
}

export function demoAddTask(content: string, due?: string): TaskItem {
  const text = content.trim();
  if (!text) throw new UserFacingError("Type a task first.");
  const data = db();
  const task: TaskItem = {
    id: `demo-task-${data.nextTask++}`,
    content: text.slice(0, 500),
    dueLabel: due?.trim() || undefined,
    overdue: false,
    priority: 1,
  };
  data.tasks.unshift(task);
  return task;
}

export function demoCloseTask(id: string): void {
  const data = db();
  const index = data.tasks.findIndex((task) => task.id === id);
  if (index < 0) return;
  const [task] = data.tasks.splice(index, 1);
  data.closedTasks.unshift(task);
}

export function demoReopenTask(id: string): void {
  const data = db();
  const index = data.closedTasks.findIndex((task) => task.id === id);
  if (index < 0) return;
  const [task] = data.closedTasks.splice(index, 1);
  data.tasks.unshift(task);
}

export function demoDismissDraft(id: string): void {
  db().hiddenDrafts.add(id);
}

export function demoRestoreDraft(id: string): void {
  db().hiddenDrafts.delete(id);
}

export function demoDeleteDraft(id: string): void {
  const data = db();
  data.deletedDrafts.add(id);
  data.hiddenDrafts.add(id);
}

export function demoDoneFollowUp(id: string): void {
  const data = db();
  const index = data.followups.findIndex((item) => item.id === id);
  if (index < 0) return;
  const [item] = data.followups.splice(index, 1);
  data.doneFollowups.unshift(item);
}

export function demoUndoFollowUp(id: string): void {
  const data = db();
  const index = data.doneFollowups.findIndex((item) => item.id === id);
  if (index < 0) return;
  const [item] = data.doneFollowups.splice(index, 1);
  data.followups.unshift(item);
}

export function demoAddProject(input: { name: string; dateStarted?: string; chatLink?: string }): ProjectItem {
  const name = input.name.trim();
  if (!name) throw new UserFacingError("Type a project name first.");
  const chat = input.chatLink?.trim() ?? "";
  if (chat && !safeHttpUrl(chat)) throw new UserFacingError("The chat link must start with http:// or https://.");
  const data = db();
  const project: ProjectItem = {
    row: data.nextRow++,
    name: name.slice(0, 200),
    started: input.dateStarted?.trim() || dateKey(new Date()),
    status: "open",
    chatUrl: safeHttpUrl(chat) ?? undefined,
  };
  data.projects.push(project);
  return project;
}

export function demoCloseProject(row: number): void {
  const project = db().projects.find((item) => item.row === row);
  if (project) project.status = "closed";
}

export function demoReopenProject(row: number): void {
  const project = db().projects.find((item) => item.row === row);
  if (project) project.status = "open";
}
