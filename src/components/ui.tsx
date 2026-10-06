import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { Brand, Milestone, User } from '../lib/types';
import { initials } from '../lib/format';
import { Icon } from './Icon';

export function Wordmark({ size = 28, className = '' }: { size?: number; className?: string }) {
  return (
    <span className={`wordmark ${className}`} style={{ fontSize: size }} aria-label="Sogo">
      sogo<span className="wordmark__ball" aria-hidden />
    </span>
  );
}

export function Avatar({ user, size = 'md' }: { user: Pick<User, 'name' | 'avatar'>; size?: 'sm' | 'md' | 'lg' | 'xl' }) {
  return (
    <span className={`avatar avatar--${user.avatar} ${size !== 'md' ? `avatar--${size}` : ''}`} aria-hidden>
      {initials(user.name)}
    </span>
  );
}

export function BrandTile({ brand, size = 56, label }: { brand: Brand; size?: number; label?: string }) {
  const fs = Math.max(8, Math.min(size * 0.27, 22, (size * 1.45) / Math.max(4, brand.name.length)));
  return (
    <span
      className="brand-tile"
      style={{ ['--brand-bg' as string]: brand.color, ['--brand-ink' as string]: brand.ink, width: size, height: size, fontSize: fs }}
      aria-label={label ?? brand.name}
      role="img"
    >
      {brand.name}
    </span>
  );
}

export function Ticket({
  value,
  label,
  stub,
  stubLabel,
  variant = 'sun',
  bump,
}: {
  value: ReactNode;
  label: ReactNode;
  stub?: ReactNode;
  stubLabel?: ReactNode;
  variant?: 'sun' | 'white' | 'blue';
  bump?: unknown;
}) {
  const [anim, setAnim] = useState(false);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    setAnim(true);
    const t = setTimeout(() => setAnim(false), 650);
    return () => clearTimeout(t);
  }, [bump]);
  return (
    <span className={`ticket ${variant !== 'sun' ? `ticket--${variant}` : ''} ${anim ? 'bump' : ''}`}>
      <span className="ticket__main">
        <span className="ticket__value">{value}</span>
        <span className="ticket__label">{label}</span>
      </span>
      {stub !== undefined && (
        <span className="ticket__stub">
          <span className="ticket__value" style={{ fontSize: 17 }}>
            {stub}
          </span>
          <span className="ticket__label">{stubLabel}</span>
        </span>
      )}
    </span>
  );
}

export function ProgressTrack({
  value,
  target,
  milestones = [],
  variant,
  label,
  thin,
}: {
  value: number;
  target: number;
  milestones?: Pick<Milestone, 'target_value' | 'status' | 'is_final'>[];
  variant?: 'on-blue' | 'green';
  label: string;
  thin?: boolean;
}) {
  const pct = target > 0 ? Math.min(100, (value / target) * 100) : 0;
  const [w, setW] = useState(0);
  useEffect(() => {
    const r = requestAnimationFrame(() => setW(pct));
    return () => cancelAnimationFrame(r);
  }, [pct]);
  return (
    <div
      className={`track ${variant ? `track--${variant}` : ''} ${thin ? 'track--thin' : ''}`}
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(pct)}
    >
      <div className="track__fill" style={{ width: `${w}%` }} />
      {milestones
        .filter((m) => !m.is_final)
        .map((m) => (
          <span
            key={m.target_value}
            className={`track__tick ${m.status === 'reached' ? 'is-reached' : ''}`}
            style={{ left: `${(m.target_value / target) * 100}%` }}
          />
        ))}
    </div>
  );
}

/** Animated number for prize pools and scores. */
export function CountUp({ value, format = (n) => String(n), duration = 700 }: { value: number; format?: (n: number) => string; duration?: number }) {
  const [shown, setShown] = useState(value);
  const from = useRef(value);
  useEffect(() => {
    const start = performance.now();
    const a = from.current;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce || a === value) {
      setShown(value);
      from.current = value;
      return;
    }
    let raf = 0;
    const tick = (t: number) => {
      const k = Math.min(1, (t - start) / duration);
      const eased = 1 - Math.pow(1 - k, 3);
      setShown(a + (value - a) * eased);
      if (k < 1) raf = requestAnimationFrame(tick);
      else from.current = value;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);
  const decimals = Number.isInteger(value) ? 0 : 1;
  return <>{format(Number(shown.toFixed(decimals)))}</>;
}

export function Sheet({
  open,
  onClose,
  title,
  sub,
  children,
  wide,
  labelledBy,
}: {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  sub?: ReactNode;
  children: ReactNode;
  wide?: boolean;
  labelledBy?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const id = useRef(`sheet-${Math.random().toString(36).slice(2, 8)}`).current;
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    const el = ref.current;
    const focusables = () =>
      Array.from(el?.querySelectorAll<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])') ?? []).filter(
        (x) => !x.hasAttribute('disabled'),
      );
    setTimeout(() => (focusables()[1] ?? focusables()[0])?.focus(), 30);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'Tab') {
        const f = focusables();
        if (!f.length) return;
        const first = f[0];
        const last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
      prev?.focus?.();
    };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={ref} className={`sheet ${wide ? 'sheet--wide' : ''}`} role="dialog" aria-modal="true" aria-labelledby={labelledBy ?? id}>
        <button className="icon-btn sheet__close" onClick={onClose} aria-label="Close">
          <Icon name="x" />
        </button>
        {title && (
          <h2 className="sheet__title" id={id}>
            {title}
          </h2>
        )}
        {sub && <p className="sheet__sub">{sub}</p>}
        {children}
      </div>
    </div>
  );
}

export function Empty({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="empty">
      <div className="empty__title">{title}</div>
      {children && <p>{children}</p>}
      {action}
    </div>
  );
}

export function Notice({ tone = 'info', children, icon }: { tone?: 'info' | 'warn' | 'error' | 'ok' | 'blue'; children: ReactNode; icon?: string }) {
  const ic = icon ?? (tone === 'error' || tone === 'warn' ? 'alert' : tone === 'ok' ? 'check' : 'info');
  return (
    <div className={`notice ${tone !== 'info' ? `notice--${tone}` : ''}`} role={tone === 'error' ? 'alert' : undefined}>
      <Icon name={ic} />
      <div>{children}</div>
    </div>
  );
}

export function ConceptTag({ light }: { light?: boolean }) {
  return (
    <span className="concept-tag" style={light ? { color: 'inherit' } : undefined} title="Illustrative brand concept. Not an actual partnership.">
      <Icon name="info" size={13} />
      Concept partner · not affiliated
    </span>
  );
}

export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return <button type="button" role="switch" aria-checked={checked} aria-label={label} className="switch" onClick={() => onChange(!checked)} />;
}

export function Confetti({ count = 70 }: { count?: number }) {
  const [pieces] = useState(() =>
    Array.from({ length: count }, (_, i) => ({
      left: Math.random() * 100,
      color: ['#FFD23F', '#FFFFFF', '#FF4F87', '#2340FF', '#111216'][i % 5],
      dur: 2 + Math.random() * 1.8,
      delay: Math.random() * 0.5,
      dx: (Math.random() - 0.5) * 220,
      rot: (Math.random() - 0.5) * 1440,
      w: 6 + Math.random() * 8,
    })),
  );
  return (
    <div className="confetti" aria-hidden>
      {pieces.map((p, i) => (
        <i
          key={i}
          style={{
            left: `${p.left}%`,
            background: p.color,
            width: p.w,
            ['--dur' as string]: `${p.dur}s`,
            ['--delay' as string]: `${p.delay}s`,
            ['--dx' as string]: `${p.dx}px`,
            ['--rot' as string]: `${p.rot}deg`,
          }}
        />
      ))}
    </div>
  );
}

export function BackButton({ onClick, label = 'Back' }: { onClick: () => void; label?: string }) {
  return (
    <button className="icon-btn" onClick={onClick} aria-label={label}>
      <Icon name="back" />
    </button>
  );
}
