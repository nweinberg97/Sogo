import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { Confetti } from './ui';
import { Icon } from './Icon';

interface Toast {
  id: number;
  text: string;
  tone: 'ok' | 'error';
}

export interface Celebration {
  kicker?: string;
  title: string;
  body?: ReactNode;
  tone?: 'blue' | 'sun';
  actions?: { label: string; onClick: () => void; variant?: 'sun' | 'white' | 'ghost-light' | 'ink' }[];
  confetti?: boolean;
}

interface FeedbackCtx {
  toast: (text: string, tone?: 'ok' | 'error') => void;
  celebrate: (c: Celebration) => void;
  burst: (emoji: string, el?: HTMLElement | null) => void;
}

const Ctx = createContext<FeedbackCtx | null>(null);

export function FeedbackProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [cel, setCel] = useState<Celebration | null>(null);
  const [bursts, setBursts] = useState<{ id: number; emoji: string; x: number; y: number; dx: number }[]>([]);

  const toast = useCallback((text: string, tone: 'ok' | 'error' = 'ok') => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t.slice(-2), { id, text, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), tone === 'error' ? 6000 : 3600);
  }, []);

  const burst = useCallback((emoji: string, el?: HTMLElement | null) => {
    const r = el?.getBoundingClientRect();
    const x = r ? r.left + r.width / 2 : window.innerWidth / 2;
    const y = r ? r.top : window.innerHeight / 2;
    const items = Array.from({ length: 5 }, (_, i) => ({ id: Date.now() + i + Math.random(), emoji, x, y, dx: (i - 2) * 26 }));
    setBursts((b) => [...b, ...items]);
    setTimeout(() => setBursts((b) => b.filter((x) => !items.includes(x))), 1200);
  }, []);

  useEffect(() => {
    if (!cel) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setCel(null);
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [cel]);

  return (
    <Ctx.Provider value={{ toast, celebrate: setCel, burst }}>
      {children}
      <div className="toasts" aria-live="polite" aria-atomic="false">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.tone === 'error' ? 'toast--error' : ''}`} role={t.tone === 'error' ? 'alert' : 'status'}>
            <Icon name={t.tone === 'error' ? 'alert' : 'check'} size={18} />
            {t.text}
          </div>
        ))}
      </div>
      {bursts.map((b) => (
        <span key={b.id} className="burst" style={{ left: b.x, top: b.y, ['--dx' as string]: `${b.dx}px` }} aria-hidden>
          {b.emoji}
        </span>
      ))}
      {cel && (
        <div className={`celebrate ${cel.tone === 'sun' ? 'celebrate--sun' : ''} on-dark`} role="dialog" aria-modal="true" aria-label={cel.title}>
          {cel.confetti !== false && <Confetti />}
          <div className="celebrate__inner">
            {cel.kicker && <div className="celebrate__kicker">{cel.kicker}</div>}
            <h2 className="celebrate__title">{cel.title}</h2>
            {cel.body && <div className="celebrate__amount">{cel.body}</div>}
            <div className="celebrate__actions">
              {(cel.actions ?? [{ label: 'Keep going', onClick: () => undefined }]).map((a, i) => (
                <button
                  key={a.label}
                  autoFocus={i === 0}
                  className={`btn btn--lg ${
                    a.variant === 'white' ? 'btn--white' : a.variant === 'ink' ? '' : a.variant === 'ghost-light' ? 'btn--ghost' : 'btn--sun'
                  }`}
                  style={a.variant === 'ghost-light' ? { color: 'inherit', boxShadow: 'inset 0 0 0 2px currentColor' } : undefined}
                  onClick={() => {
                    setCel(null);
                    a.onClick();
                  }}
                >
                  {a.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </Ctx.Provider>
  );
}

export function useFeedback() {
  const c = useContext(Ctx);
  if (!c) throw new Error('useFeedback outside provider');
  return c;
}
