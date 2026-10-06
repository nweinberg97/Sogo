const DAY = 86_400_000;

export const now = () => Date.now();
export const iso = (t: number) => new Date(t).toISOString();
export const daysFromNow = (d: number, hour = 12) => {
  const t = new Date(now() + d * DAY);
  t.setHours(hour, 0, 0, 0);
  return t.toISOString();
};
export const hoursAgo = (h: number) => iso(now() - h * 3_600_000);

export function daysLeft(end: string): number {
  return Math.ceil((new Date(end).getTime() - now()) / DAY);
}

export function isPast(end: string): boolean {
  return new Date(end).getTime() <= now();
}

export function daysBetween(a: string, b: string): number {
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / DAY);
}

export function elapsedFraction(start: string, end: string): number {
  const s = new Date(start).getTime();
  const e = new Date(end).getTime();
  if (e <= s) return 1;
  return Math.max(0, Math.min(1, (now() - s) / (e - s)));
}

export function relTime(when: string): string {
  const diff = now() - new Date(when).getTime();
  const m = Math.round(diff / 60_000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  if (d === 1) return 'yesterday';
  if (d < 7) return `${d}d ago`;
  return new Date(when).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function shortDate(when: string): string {
  return new Date(when).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function longDate(when: string): string {
  return new Date(when).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
}

export function dateInputValue(when: string): string {
  const d = new Date(when);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function fromDateInput(v: string): string {
  const [y, m, d] = v.split('-').map(Number);
  return new Date(y, m - 1, d, 23, 59, 0).toISOString();
}

export function greeting(): string {
  const h = new Date().getHours();
  if (h < 5) return 'Up late';
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

export function daysLeftLabel(end: string): string {
  const d = daysLeft(end);
  if (d < 0) return 'Ended';
  if (d === 0) return 'Ends today';
  if (d === 1) return '1 day left';
  return `${d} days left`;
}

export function nextWeekday(target: number, hour: number): string {
  const t = new Date(now());
  const delta = (target - t.getDay() + 7) % 7 || 7;
  t.setDate(t.getDate() + delta);
  t.setHours(hour, 0, 0, 0);
  return t.toISOString();
}
