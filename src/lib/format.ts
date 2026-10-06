export function money(n: number, opts: { cents?: boolean } = {}): string {
  const cents = opts.cents ?? !Number.isInteger(n);
  return `$${n.toLocaleString(undefined, {
    minimumFractionDigits: cents ? 2 : 0,
    maximumFractionDigits: cents ? 2 : 0,
  })}`;
}

export function num(n: number, digits?: number): string {
  const d = digits ?? (Number.isInteger(n) ? 0 : 1);
  return n.toLocaleString(undefined, { minimumFractionDigits: d, maximumFractionDigits: d });
}

/** Value + unit formatted like a score: 34.2 km, 16 workouts. */
export function metric(n: number, unit: string): string {
  const isDistance = unit === 'km' || unit === 'mi';
  const u = n === 1 && !isDistance && unit.endsWith('s') && unit !== 'steps' ? unit.slice(0, -1) : unit;
  return `${num(n, isDistance ? (Number.isInteger(n) ? 0 : 1) : 0)} ${u}`;
}

export function pct(n: number): string {
  return `${Math.floor(n)}%`;
}

export function plural(n: number, one: string, many = `${one}s`): string {
  return `${n.toLocaleString()} ${n === 1 ? one : many}`;
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join('');
}

export function firstName(name: string): string {
  return name.split(/\s+/)[0] ?? name;
}

export function uid(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}${Date.now().toString(36).slice(-3)}`;
}
