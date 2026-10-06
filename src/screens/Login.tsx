import { useEffect, useState, type FormEvent } from 'react';
import { navigate, useLocation, Link } from '../lib/router';
import { useStore, signIn } from '../lib/store';
import { authConfig, handleOAuthCallback, isConfigured, startOAuth, type OAuthProvider } from '../lib/auth';
import { Notice, Wordmark } from '../components/ui';
import { Icon } from '../components/Icon';

function ProviderButton({ provider, label }: { provider: OAuthProvider; label: string }) {
  const ok = isConfigured(provider);
  return (
    <div className="provider">
      <button className="btn btn--ghost btn--lg btn--block" disabled={!ok} aria-describedby={ok ? undefined : `${provider}-off`} onClick={() => startOAuth(provider)}>
        <span className="provider__glyph" aria-hidden>
          {provider === 'google' ? 'G' : ''}
        </span>
        {label}
      </button>
      {!ok && (
        <span id={`${provider}-off`} className="tiny muted">
          Not configured here. Set VITE_{provider.toUpperCase()}_CLIENT_ID to enable.
        </span>
      )}
    </div>
  );
}

export function Login() {
  const { replace } = useStore();
  const { query } = useLocation();
  const next = query.get('next');
  const [name, setName] = useState('');
  const [fresh, setFresh] = useState(false);
  const [err, setErr] = useState('');
  const [oauthErr, setOauthErr] = useState('');

  useEffect(() => {
    handleOAuthCallback().then((r) => {
      if (r.kind === 'error') setOauthErr(r.message);
      if (r.kind === 'session') {
        signIn(replace, { kind: 'fresh', name: r.name, email: r.email }, r.provider);
        navigate('/onboarding', { replace: true });
      }
    });
  }, [replace]);

  const demo = () => {
    signIn(replace, { kind: 'demo' });
    navigate(next && next !== '/login' ? next : '/home', { replace: true });
  };

  const startFresh = (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setErr('Tell us what to call you.');
      return;
    }
    signIn(replace, { kind: 'fresh', name: name.trim() });
    navigate('/onboarding', { replace: true });
  };

  return (
    <div className="auth">
      <div className="auth__panel">
        <Link to="/" aria-label="Back to the Sogo homepage">
          <Wordmark size={40} />
        </Link>
        <h1 className="auth__title">Put something on it.</h1>
        <p className="muted">Sign in to start your first goal, or explore the full product as Mark.</p>

        {oauthErr && <Notice tone="error">{oauthErr}</Notice>}

        <div className="auth__providers">
          <ProviderButton provider="google" label="Continue with Google" />
          <ProviderButton provider="apple" label="Continue with Apple" />
          {(isConfigured('google') || isConfigured('apple')) && !authConfig.apiUrl && (
            <span className="tiny muted">OAuth redirect is live, but VITE_AUTH_API_URL is needed to finish sign-in.</span>
          )}
        </div>

        <div className="auth__or">
          <span>or</span>
        </div>

        <button className="btn btn--blue btn--lg btn--block" onClick={demo}>
          <Icon name="sparkle" size={18} /> Explore the demo as Mark
        </button>
        <p className="tiny muted" style={{ textAlign: 'center' }}>
          Mark is mid-way through a 50 km run goal with friends, challenges and rewards already set up.
        </p>

        {!fresh ? (
          <button className="link-btn" style={{ justifySelf: 'center' }} onClick={() => setFresh(true)}>
            Start fresh with your own name instead
          </button>
        ) : (
          <form onSubmit={startFresh} className="auth__fresh" noValidate>
            <div className="field">
              <label htmlFor="name" className="label">
                What should we call you?
              </label>
              <input
                id="name"
                className="input"
                value={name}
                autoFocus
                autoComplete="given-name"
                onChange={(e) => {
                  setName(e.target.value);
                  setErr('');
                }}
                aria-invalid={Boolean(err)}
                aria-describedby={err ? 'name-err' : undefined}
              />
              {err && (
                <span id="name-err" className="error-text">
                  {err}
                </span>
              )}
            </div>
            <button className="btn btn--lg btn--block" type="submit">
              Continue in demo mode
            </button>
          </form>
        )}
        <p className="tiny muted" style={{ textAlign: 'center' }}>
          Demo mode stores everything in this browser. No real money moves.
        </p>
      </div>
      <div className="auth__art on-dark" aria-hidden>
        <span className="auth__art-line">Bet on</span>
        <span className="auth__art-line">your</span>
        <span className="auth__art-line">potential.</span>
      </div>
    </div>
  );
}
