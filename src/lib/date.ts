const DAY_MS = 24 * 60 * 60 * 1000;

export function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

/** Local calendar date key, e.g. 2026-11-07. Never use toISOString() for day keys. */
export function toDateKey(date: Date = new Date()): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

export function fromDateKey(key: string): Date {
  const [year = 1970, month = 1, day = 1] = key.split('-').map(Number);
  return new Date(year, month - 1, day, 12, 0, 0, 0);
}

export function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function addDays(date: Date, amount: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
}

export function addMonths(date: Date, amount: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + amount, 1, 12, 0, 0, 0);
}

export function daysBetweenKeys(fromKey: string, toKey: string): number {
  const from = startOfDay(fromDateKey(fromKey)).getTime();
  const to = startOfDay(fromDateKey(toKey)).getTime();
  return Math.round((to - from) / DAY_MS);
}

export function diffCalendarDays(fromKey: string, toKey: string): number {
  return daysBetweenKeys(fromKey, toKey);
}

/** Monday-first week containing `date`. */
export function getWeekDays(date: Date = new Date()): Date[] {
  const day = date.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const monday = addDays(startOfDay(date), mondayOffset);
  return Array.from({ length: 7 }, (_, index) => addDays(monday, index));
}

export const WEEK_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'] as const;
export const WEEKDAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;

export function formatTime(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

export function formatLongDate(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

export function formatMediumDate(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function formatMonthYear(date: Date): string {
  return date.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}

/** A date written the way a person would read it aloud, for screen readers. */
export function formatSpokenDate(date: Date): string {
  return date.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
}

export function formatStampDate(date: Date = new Date()): string {
  return date
    .toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
    .toUpperCase();
}

export function formatCoordinates(latitude: number | null, longitude: number | null): string {
  if (latitude == null || longitude == null) return 'NO COORDINATES';
  return `${Math.abs(latitude).toFixed(3)}° ${latitude >= 0 ? 'N' : 'S'} · ${Math.abs(
    longitude
  ).toFixed(3)}° ${longitude >= 0 ? 'E' : 'W'}`;
}

export function getMonthGrid(month: Date): (Date | null)[] {
  const first = new Date(month.getFullYear(), month.getMonth(), 1, 12);
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const mondayFirstOffset = (first.getDay() + 6) % 7;
  const cells: (Date | null)[] = Array.from({ length: mondayFirstOffset }, () => null);
  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push(new Date(month.getFullYear(), month.getMonth(), day, 12));
  }
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

export function greetingForHour(hour: number = new Date().getHours()): string {
  if (hour < 5) return 'Still awake?';
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  if (hour < 22) return 'Good evening';
  return 'Cozy night';
}
