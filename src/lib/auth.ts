// Authentication is structured for Google and Apple OAuth.
//
// If a provider's client ID is configured, "Continue with Google/Apple" performs the real
// authorization-code redirect to the provider. The code is then exchanged for a session by the
// backend at VITE_AUTH_API_URL — a secret-holding step that must never happen in the browser.
//
// If a provider isn't configured, its button is shown as unavailable. We never pretend an OAuth
// sign-in succeeded. Demo mode is the explicit development fallback.

export type OAuthProvider = 'google' | 'apple';

const env = import.meta.env as Record<string, string | undefined>;

export const authConfig = {
  google: { clientId: env.VITE_GOOGLE_CLIENT_ID || '' },
  apple: { clientId: env.VITE_APPLE_CLIENT_ID || '' },
  apiUrl: env.VITE_AUTH_API_URL || '',
};

export function isConfigured(p: OAuthProvider): boolean {
  return Boolean(authConfig[p].clientId);
}

function redirectUri(): string {
  return `${window.location.origin}${window.location.pathname}`;
}

function randomState(): string {
  const a = new Uint8Array(16);
  crypto.getRandomValues(a);
  return Array.from(a, (b) => b.toString(16).padStart(2, '0')).join('');
}

export function startOAuth(p: OAuthProvider): void {
  if (!isConfigured(p)) throw new Error(`${p} OAuth is not configured`);
  const state = randomState();
  try {
    sessionStorage.setItem('sogo:oauth_state', JSON.stringify({ state, provider: p }));
  } catch {
    /* storage unavailable — the callback will reject the state */
  }
  const params = new URLSearchParams({
    client_id: authConfig[p].clientId,
    redirect_uri: redirectUri(),
    response_type: 'code',
    state,
    scope: p === 'google' ? 'openid email profile' : 'name email',
  });
  if (p === 'apple') params.set('response_mode', 'query');
  const base = p === 'google' ? 'https://accounts.google.com/o/oauth2/v2/auth' : 'https://appleid.apple.com/auth/authorize';
  window.location.assign(`${base}?${params.toString()}`);
}

export type CallbackResult =
  | { kind: 'none' }
  | { kind: 'error'; message: string }
  | { kind: 'session'; name: string; email: string; provider: OAuthProvider };

/** Handles ?code=&state= on return from a provider. */
export async function handleOAuthCallback(): Promise<CallbackResult> {
  const q = new URLSearchParams(window.location.search);
  const code = q.get('code');
  const state = q.get('state');
  const err = q.get('error');
  if (!code && !err) return { kind: 'none' };
  window.history.replaceState(null, '', window.location.pathname + window.location.hash);
  if (err) return { kind: 'error', message: `Sign-in was cancelled or refused (${err}).` };
  let saved: { state: string; provider: OAuthProvider } | null = null;
  try {
    saved = JSON.parse(sessionStorage.getItem('sogo:oauth_state') || 'null');
  } catch {
    saved = null;
  }
  if (!saved || saved.state !== state) return { kind: 'error', message: 'Sign-in state did not match. Please try again.' };
  if (!authConfig.apiUrl) {
    return {
      kind: 'error',
      message: 'The provider returned an authorization code, but VITE_AUTH_API_URL is not set, so it cannot be exchanged for a session. Add the auth backend or use demo mode.',
    };
  }
  try {
    const res = await fetch(`${authConfig.apiUrl}/oauth/${saved.provider}/exchange`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ code, redirect_uri: redirectUri() }),
      credentials: 'include',
    });
    if (!res.ok) return { kind: 'error', message: `Sign-in failed (${res.status}).` };
    const data = (await res.json()) as { name: string; email: string };
    return { kind: 'session', name: data.name, email: data.email, provider: saved.provider };
  } catch {
    return { kind: 'error', message: 'Could not reach the sign-in server.' };
  }
}
