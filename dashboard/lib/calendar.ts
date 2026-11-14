import { googleFetch } from "./google";
import { addDays, dateKey, eventTimeLabel, formatDayLabel, zonedDateTime } from "./time";
import type { CalendarEvent, DayGroup } from "./types";

type GCalEvent = {
  id?: string;
  status?: string;
  summary?: string;
  location?: string;
  htmlLink?: string;
  start?: { date?: string; dateTime?: string };
  end?: { date?: string; dateTime?: string };
};

type GCalList = { items?: { id?: string; summary?: string; primary?: boolean; selected?: boolean }[] };

export function groupEvents(events: CalendarEvent[], now = new Date()): DayGroup[] {
  const today = dateKey(now);
  const end = addDays(today, 13);
  const buckets = new Map<string, CalendarEvent[]>();
  for (const event of events) {
    const key = event.allDay ? event.start.slice(0, 10) : dateKey(new Date(event.start));
    if (key < today || key > end) continue;
    const list = buckets.get(key) ?? [];
    list.push(event);
    buckets.set(key, list);
  }
  return [...buckets.keys()]
    .sort()
    .map((key) => ({
      date: key,
      label: formatDayLabel(key, today),
      events: (buckets.get(key) ?? []).sort((a, b) => {
        if (a.allDay !== b.allDay) return a.allDay ? -1 : 1;
        return a.start.localeCompare(b.start);
      }),
    }));
}

export async function loadCalendar(email: string): Promise<{ days: DayGroup[]; count: number }> {
  const now = new Date();
  const today = dateKey(now);
  const timeMin = zonedDateTime(today, 0).toISOString();
  const timeMax = zonedDateTime(addDays(today, 14), 0).toISOString();
  const calendars = await listCalendars(email);
  const batches = await Promise.all(
    calendars.map(async (calendar) => {
      const params = new URLSearchParams({
        timeMin,
        timeMax,
        singleEvents: "true",
        orderBy: "startTime",
        maxResults: "80",
        timeZone: "America/Indianapolis",
      });
      const response = await googleFetch(
        email,
        `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendar.id)}/events?${params}`,
        { method: "GET" },
      );
      const json = (await response.json()) as { items?: GCalEvent[] };
      return (json.items ?? [])
        .filter((event) => event.status !== "cancelled" && event.id)
        .map((event) => toEvent(event, calendar.name, calendar.primary));
    }),
  );
  const events = batches.flat();
  const days = groupEvents(events, now);
  const count = days.reduce((sum, day) => sum + day.events.length, 0);
  return { days, count };
}

async function listCalendars(email: string): Promise<{ id: string; name: string; primary: boolean }[]> {
  const response = await googleFetch(
    email,
    "https://www.googleapis.com/calendar/v3/users/me/calendarList?maxResults=20",
    { method: "GET" },
  );
  const json = (await response.json()) as GCalList;
  const items = (json.items ?? [])
    .filter((calendar) => calendar.id && calendar.selected !== false)
    .filter((calendar) => !/holiday|birthdays/i.test(`${calendar.id} ${calendar.summary ?? ""}`))
    .slice(0, 8)
    .map((calendar) => ({
      id: calendar.id!,
      name: calendar.summary || "Calendar",
      primary: Boolean(calendar.primary),
    }));
  if (items.length === 0) return [{ id: "primary", name: "Calendar", primary: true }];
  return items;
}

function toEvent(event: GCalEvent, calendarName: string, primary: boolean): CalendarEvent {
  const allDay = Boolean(event.start?.date && !event.start?.dateTime);
  const start = event.start?.dateTime || event.start?.date || "";
  const end = event.end?.dateTime || event.end?.date || start;
  return {
    id: event.id!,
    title: event.summary?.trim() || "(no title)",
    start,
    end,
    allDay,
    location: event.location?.trim() || undefined,
    calendar: primary ? "" : calendarName,
    link: event.htmlLink,
  };
}

export { eventTimeLabel };
