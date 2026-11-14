export type CalendarEvent = {
  id: string;
  title: string;
  start: string;
  end: string;
  allDay: boolean;
  location?: string;
  calendar: string;
  link?: string;
};

export type DayGroup = {
  date: string;
  label: string;
  events: CalendarEvent[];
};

export type TaskItem = {
  id: string;
  content: string;
  dueLabel?: string;
  dueKey?: string;
  overdue: boolean;
  priority: number;
  priorityLabel?: string;
  url?: string;
  recurring?: boolean;
};

export type DraftItem = {
  id: string;
  subject: string;
  to: string;
  dateLabel: string;
  link?: string;
};

export type FollowUpItem = {
  id: string;
  from: string;
  email: string;
  subject: string;
  snippet: string;
  dateLabel: string;
  link: string;
};

export type ProjectItem = {
  row: number;
  name: string;
  started: string;
  status: string;
  chatUrl?: string;
};

export type DashboardData = {
  demo: boolean;
  email: string;
  name: string;
  todayKey: string;
  todayLabel: string;
  updatedLabel: string;
  calendar: { days: DayGroup[]; count: number; error?: string };
  tasks: { items: TaskItem[]; error?: string };
  drafts: { items: DraftItem[]; error?: string };
  followups: { items: FollowUpItem[]; error?: string };
  projects: { items: ProjectItem[]; error?: string };
};

export type SessionStage = "pending" | "verify" | "codes" | "full";

export type Session = {
  email: string;
  name: string;
  stage: SessionStage;
  demo: boolean;
  exp: number;
};
