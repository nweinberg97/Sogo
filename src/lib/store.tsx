import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import type { DB } from './types';
import { createSeed, DB_VERSION } from './seed';

const KEY = 'sogo:v1';

function load(): DB {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as DB;
      if (parsed.version === DB_VERSION) return parsed;
    }
  } catch {
    /* fall through to a fresh seed */
  }
  return createSeed({ kind: 'demo' });
}

let saveWarned = false;
function save(db: DB) {
  try {
    localStorage.setItem(KEY, JSON.stringify(db));
  } catch (e) {
    if (!saveWarned) {
      saveWarned = true;
      console.warn('Sogo: could not persist state (storage full or unavailable). Changes last until reload.', e);
    }
  }
}

interface StoreCtx {
  db: DB;
  /** Clone → mutate → commit. Returns whatever the mutator returns. */
  update: <R>(fn: (draft: DB) => R) => R;
  replace: (next: DB) => void;
}

const Ctx = createContext<StoreCtx | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [db, setDb] = useState<DB>(load);
  const ref = useRef(db);

  const update = useCallback(<R,>(fn: (draft: DB) => R): R => {
    const draft = structuredClone(ref.current);
    const result = fn(draft);
    ref.current = draft;
    setDb(draft);
    save(draft);
    return result;
  }, []);

  const replace = useCallback((next: DB) => {
    ref.current = next;
    setDb(next);
    save(next);
  }, []);

  return <Ctx.Provider value={{ db, update, replace }}>{children}</Ctx.Provider>;
}

export function useStore() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useStore outside StoreProvider');
  return ctx;
}

export function signIn(
  replace: (db: DB) => void,
  persona: { kind: 'demo' } | { kind: 'fresh'; name: string; email?: string },
  provider: 'demo' | 'google' | 'apple' = 'demo',
) {
  const db = createSeed(persona);
  db.session = { user_id: 'u_me', provider, onboarded: persona.kind === 'demo', motivations: [] };
  replace(db);
}

export function signOut(replace: (db: DB) => void) {
  replace(createSeed({ kind: 'demo' }));
}
