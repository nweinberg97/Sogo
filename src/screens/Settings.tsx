import { useState } from 'react';
import { useStore, signIn, signOut } from '../lib/store';
import { navigate } from '../lib/router';
import { me } from '../lib/selectors';
import { SOURCE_NAMES } from '../lib/commands';
import type { DataSource, Settings as S, Visibility } from '../lib/types';
import { Switch } from '../components/ui';
import { useFeedback } from '../components/feedback';
import { ME } from '../lib/seed';

const SOURCES: DataSource[] = ['apple_health', 'strava', 'garmin', 'fitbit', 'health_connect'];

const REVIEW = [
  'Contest and sweepstakes laws',
  'Skill-based competition laws',
  'Gambling regulations',
  'Payment and money-transmission rules',
  'Gift-card regulations',
  'Consumer protection',
  'Financial custody of committed funds',
  'KYC / AML where applicable',
  'Age restrictions',
  'Responsible-use policies',
  'Jurisdiction-specific requirements',
  'Promotional and advertising rules',
  'Sponsored challenge disclosures',
];

export function Settings() {
  const { db, update, replace } = useStore();
  const { toast } = useFeedback();
  const user = me(db);
  const [name, setName] = useState(user.name);
  const [bio, setBio] = useState(user.bio);

  const set = <K extends keyof S>(k: K, v: S[K]) => update((d) => void (d.settings[k] = v));

  return (
    <div className="page page--narrow settings">
      <header className="page__head">
        <h1 className="page__title">Settings</h1>
        <p className="page__sub">
          Signed in with {db.session?.provider === 'demo' ? 'demo mode' : db.session?.provider}. {user.email}
        </p>
      </header>

      <section className="settings__group" aria-labelledby="s-profile">
        <h2 id="s-profile" className="settings__h">
          Profile
        </h2>
        <div className="field">
          <label className="label" htmlFor="s-name">
            Name
          </label>
          <input id="s-name" className="input" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="field">
          <label className="label" htmlFor="s-bio">
            Bio
          </label>
          <input id="s-bio" className="input" value={bio} maxLength={80} placeholder="What are you becoming?" onChange={(e) => setBio(e.target.value)} />
        </div>
        <button
          className="btn btn--sm"
          style={{ marginTop: 14 }}
          onClick={() => {
            if (!name.trim()) return toast('Name can’t be empty', 'error');
            update((d) => {
              const u = d.users.find((x) => x.id === ME)!;
              u.name = name.trim();
              u.bio = bio.trim();
            });
            toast('Profile saved');
          }}
        >
          Save profile
        </button>
      </section>

      <section className="settings__group" aria-labelledby="s-privacy">
        <h2 id="s-privacy" className="settings__h">
          Privacy
        </h2>
        <div className="settings__row">
          <div>
            <strong>Default visibility for new goals</strong>
            <p className="muted small">You can change it on any goal.</p>
          </div>
          <div className="segmented" role="group" aria-label="Default visibility">
            {(['private', 'friends', 'public'] as Visibility[]).map((v) => (
              <button key={v} aria-pressed={db.settings.default_visibility === v} onClick={() => set('default_visibility', v)}>
                {v === 'private' ? 'Only me' : v === 'friends' ? 'Friends' : 'Everyone'}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="settings__group" aria-labelledby="s-data">
        <h2 id="s-data" className="settings__h">
          Connected data
        </h2>
        <p className="muted small">Simulated integrations. In production these use each platform's official API with your permission.</p>
        {SOURCES.map((s) => (
          <div key={s} className="settings__row">
            <strong>{SOURCE_NAMES[s]}</strong>
            <Switch
              checked={db.settings.connected_sources[s]}
              label={`${SOURCE_NAMES[s]} connected`}
              onChange={(v) =>
                update((d) => {
                  d.settings.connected_sources[s] = v;
                })
              }
            />
          </div>
        ))}
      </section>

      <section className="settings__group" aria-labelledby="s-notif">
        <h2 id="s-notif" className="settings__h">
          Notifications
        </h2>
        <p className="muted small">Sparse by design. No streak guilt, no 9pm nags.</p>
        {(
          [
            ['notify_props', 'Props from friends'],
            ['notify_backing', 'When someone backs you'],
            ['notify_reminders', 'Deadline reminders (5 days and 1 day out)'],
          ] as const
        ).map(([k, label]) => (
          <div key={k} className="settings__row">
            <span>{label}</span>
            <Switch checked={db.settings[k]} label={label} onChange={(v) => set(k, v)} />
          </div>
        ))}
      </section>

      <section className="settings__group" aria-labelledby="s-demo">
        <h2 id="s-demo" className="settings__h">
          Demo controls
        </h2>
        <div className="settings__row">
          <div>
            <strong>Simulate payment failure</strong>
            <p className="muted small">The next commitment will be declined, so you can see the error state.</p>
          </div>
          <Switch checked={db.settings.simulate_payment_failure} label="Simulate payment failure" onChange={(v) => set('simulate_payment_failure', v)} />
        </div>
        <div className="settings__row">
          <div>
            <strong>Reduce motion</strong>
            <p className="muted small">Also follows your system setting.</p>
          </div>
          <Switch checked={db.settings.reduced_motion} label="Reduce motion" onChange={(v) => set('reduced_motion', v)} />
        </div>
        <div className="settings__row">
          <div>
            <strong>Reset the demo</strong>
            <p className="muted small">Back to Mark at 34.2 km with everything re-seeded.</p>
          </div>
          <button
            className="btn btn--soft btn--sm"
            onClick={() => {
              signIn(replace, { kind: 'demo' });
              toast('Demo reset');
              navigate('/home');
            }}
          >
            Reset
          </button>
        </div>
      </section>

      <section className="settings__group" aria-labelledby="s-legal">
        <h2 id="s-legal" className="settings__h">
          About this prototype
        </h2>
        <p className="small">
          Sogo is a product prototype. Payment flows are simulated and no real money is processed. Brand names shown are illustrative examples only
          and do not imply sponsorship, endorsement, partnership or affiliation.
        </p>
        <details className="explain" style={{ marginTop: 10 }}>
          <summary>What a real launch needs reviewed</summary>
          <ul>
            {REVIEW.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
          <p className="tiny muted">Sogo makes no claim to be compliant, or legally distinct from gambling, in any jurisdiction until that review is done.</p>
        </details>
      </section>

      <button
        className="btn btn--ghost btn--block"
        onClick={() => {
          signOut(replace);
          navigate('/');
        }}
      >
        Sign out
      </button>
    </div>
  );
}
