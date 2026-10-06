// Tiny hash router. Hash routing keeps deep links (shared challenge invites) working on any static
// host without server rewrites. Swap for a framework router when Sogo gets a server.
import { useSyncExternalStore, type AnchorHTMLAttributes, type MouseEvent, type ReactNode } from 'react';

function subscribe(cb: () => void) {
  window.addEventListener('hashchange', cb);
  return () => window.removeEventListener('hashchange', cb);
}
const getHash = () => window.location.hash.slice(1) || '/';

export function useLocation() {
  const raw = useSyncExternalStore(subscribe, getHash, () => '/');
  const [path, qs = ''] = raw.split('?');
  return { path: path || '/', query: new URLSearchParams(qs), raw };
}

export function navigate(to: string, opts: { replace?: boolean } = {}) {
  const target = `#${to}`;
  if (opts.replace) {
    window.history.replaceState(null, '', target);
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  } else {
    window.location.hash = to;
  }
  window.scrollTo({ top: 0 });
}

export function back(fallback = '/home') {
  if (window.history.length > 1) window.history.back();
  else navigate(fallback);
}

export function match(pattern: string, path: string): Record<string, string> | null {
  const p = pattern.split('/').filter(Boolean);
  const a = path.split('/').filter(Boolean);
  if (p.length !== a.length) return null;
  const params: Record<string, string> = {};
  for (let i = 0; i < p.length; i++) {
    if (p[i].startsWith(':')) params[p[i].slice(1)] = decodeURIComponent(a[i]);
    else if (p[i] !== a[i]) return null;
  }
  return params;
}

export function href(to: string) {
  return `#${to}`;
}

/** Absolute shareable URL for a route. */
export function shareUrl(to: string) {
  const base = (import.meta.env.VITE_PUBLIC_URL as string | undefined) || `${window.location.origin}${window.location.pathname}`;
  return `${base.replace(/\/$/, '')}/#${to}`;
}

export function Link({ to, children, onClick, ...rest }: { to: string; children: ReactNode } & AnchorHTMLAttributes<HTMLAnchorElement>) {
  return (
    <a
      href={href(to)}
      onClick={(e: MouseEvent<HTMLAnchorElement>) => {
        onClick?.(e);
        if (!e.defaultPrevented) window.scrollTo({ top: 0 });
      }}
      {...rest}
    >
      {children}
    </a>
  );
}
