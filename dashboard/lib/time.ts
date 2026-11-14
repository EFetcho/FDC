export const TIME_ZONE = "America/Indianapolis";

type Parts = {
  year: string;
  month: string;
  day: string;
  hour: string;
  minute: string;
  second: string;
  weekday: string;
};

export function zonedParts(date: Date, timeZone = TIME_ZONE): Parts {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    weekday: "short",
  });
  const bag: Record<string, string> = {};
  for (const part of fmt.formatToParts(date)) {
    if (part.type !== "literal") bag[part.type] = part.value;
  }
  if (bag.hour === "24") bag.hour = "00";
  return {
    year: bag.year,
    month: bag.month,
    day: bag.day,
    hour: bag.hour,
    minute: bag.minute,
    second: bag.second,
    weekday: bag.weekday,
  };
}

export function dateKey(date: Date, timeZone = TIME_ZONE): string {
  const parts = zonedParts(date, timeZone);
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function addDays(key: string, days: number): string {
  const [year, month, day] = key.split("-").map(Number);
  const utc = new Date(Date.UTC(year, month - 1, day + days));
  const y = utc.getUTCFullYear();
  const m = String(utc.getUTCMonth() + 1).padStart(2, "0");
  const d = String(utc.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function diffDays(later: string, earlier: string): number {
  const [ay, am, ad] = later.split("-").map(Number);
  const [by, bm, bd] = earlier.split("-").map(Number);
  const a = Date.UTC(ay, am - 1, ad);
  const b = Date.UTC(by, bm - 1, bd);
  return Math.round((a - b) / 86_400_000);
}

function tzOffsetMs(date: Date, timeZone: string): number {
  const parts = zonedParts(date, timeZone);
  const asUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second),
  );
  return asUtc - date.getTime();
}

/** UTC instant for a civil date and time in Indianapolis. */
export function zonedDateTime(key: string, hour = 0, minute = 0, timeZone = TIME_ZONE): Date {
  const [year, month, day] = key.split("-").map(Number);
  const guess = Date.UTC(year, month - 1, day, hour, minute, 0);
  let instant = guess;
  for (let i = 0; i < 3; i++) {
    instant = guess - tzOffsetMs(new Date(instant), timeZone);
  }
  return new Date(instant);
}

export function formatDayLabel(key: string, todayKey: string): string {
  const pretty = new Intl.DateTimeFormat("en-US", {
    timeZone: TIME_ZONE,
    weekday: "long",
    month: "short",
    day: "numeric",
  }).format(zonedDateTime(key, 12));
  const delta = diffDays(key, todayKey);
  if (delta === 0) return `Today · ${pretty}`;
  if (delta === 1) return `Tomorrow · ${pretty}`;
  if (delta === -1) return `Yesterday · ${pretty}`;
  return pretty;
}

export function formatClock(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: TIME_ZONE,
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export function formatWhen(date: Date, todayKey = dateKey(new Date())): string {
  const key = dateKey(date);
  const clock = formatClock(date);
  const delta = diffDays(key, todayKey);
  if (delta === 0) return `Today, ${clock}`;
  if (delta === -1) return `Yesterday, ${clock}`;
  const day = new Intl.DateTimeFormat("en-US", {
    timeZone: TIME_ZONE,
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(date);
  return `${day}, ${clock}`;
}

export function formatLongDate(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: TIME_ZONE,
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(date);
}

export function formatUpdated(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: TIME_ZONE,
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export function eventTimeLabel(startIso: string, endIso: string, allDay: boolean): string {
  if (allDay) {
    const startKey = startIso.slice(0, 10);
    const endKey = endIso.slice(0, 10);
    const lastDay = addDays(endKey, -1);
    if (lastDay > startKey) {
      const endPretty = new Intl.DateTimeFormat("en-US", {
        timeZone: TIME_ZONE,
        month: "short",
        day: "numeric",
      }).format(zonedDateTime(lastDay, 12));
      return `All day · through ${endPretty}`;
    }
    return "All day";
  }
  const start = new Date(startIso);
  const end = new Date(endIso);
  if (Number.isNaN(start.getTime())) return "";
  if (Number.isNaN(end.getTime())) return formatClock(start);
  return `${formatClock(start)} – ${formatClock(end)}`;
}
