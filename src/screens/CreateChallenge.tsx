import { useRef, useState } from 'react';
import { useStore } from '../lib/store';
import { back, navigate, useLocation } from '../lib/router';
import { createChallenge, type ChallengeDraft } from '../lib/commands';
import { friends } from '../lib/selectors';
import { money, num } from '../lib/format';
import type { Challenge, VerificationMethod } from '../lib/types';
import { Avatar, BackButton, Notice, Ticket } from '../components/ui';
import { PaymentSheet } from '../components/PaymentSheet';
import { useFeedback } from '../components/feedback';

const CATS: { id: Challenge['category']; label: string; emoji: string; unit: string; metric: string; target: number }[] = [
  { id: 'running', label: 'Running', emoji: '🏃', unit: 'km', metric: 'km run', target: 50 },
  { id: 'basketball', label: 'Basketball', emoji: '🏀', unit: 'makes', metric: 'free throws made', target: 200 },
  { id: 'strength', label: 'Strength', emoji: '💪', unit: 'push-ups', metric: 'push-ups', target: 1000 },
  { id: 'walking', label: 'Walking', emoji: '👟', unit: 'steps', metric: 'steps', target: 150000 },
  { id: 'cycling', label: 'Cycling', emoji: '🚴', unit: 'km', metric: 'km ridden', target: 150 },
  { id: 'wellness', label: 'Wellness', emoji: '🧘', unit: 'sessions', metric: 'sessions', target: 15 },
];

const FORMATS: { id: Challenge['format']; label: string; sub: string }[] = [
  { id: 'individual', label: 'Hit a target', sub: 'Everyone who reaches it earns the reward' },
  { id: 'ranked', label: 'Most wins', sub: 'Top 3 split the pool' },
  { id: 'team', label: 'Team game', sub: 'Two teams. Winners split the pool' },
];

export function CreateChallenge() {
  const { db, update } = useStore();
  const { celebrate } = useFeedback();
  const { query } = useLocation();
  const [cat, setCat] = useState(CATS[0]);
  const [format, setFormat] = useState<Challenge['format']>((query.get('format') as Challenge['format']) || 'individual');
  const [target, setTarget] = useState<number>(format === 'team' ? 3 : CATS[0].target);
  const [days, setDays] = useState(format === 'team' ? 1 : 30);
  const [commitment, setCommitment] = useState(15);
  const [capacity, setCapacity] = useState(format === 'team' ? 8 : 10);
  const [verify, setVerify] = useState<VerificationMethod>(format === 'team' ? 'human' : 'connected');
  const [name, setName] = useState('');
  const [invite, setInvite] = useState<string[]>([]);
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState('');
  const created = useRef('');

  const isTeam = format === 'team';
  const unit = isTeam ? 'games' : cat.unit;
  const description = isTeam
    ? `First team to win ${target} games takes the pool.`
    : format === 'ranked'
      ? `Most ${cat.metric} in ${days} days.`
      : `${cat.id === 'running' ? 'Run' : cat.id === 'cycling' ? 'Ride' : cat.id === 'walking' ? 'Walk' : cat.id === 'basketball' ? 'Make' : 'Complete'} ${num(target)} ${cat.id === 'basketball' ? 'free throws' : cat.unit} in ${days} days.`;
  const title = name.trim() || (isTeam ? `${cat.label} night` : `${num(target)} ${cat.unit} in ${days} days`);
  const sponsor = isTeam ? 0 : commitment;
  const pool = capacity * (commitment + sponsor);

  const submit = () => {
    if (!target || target <= 0) return setError('Set a measurable target.');
    if (capacity < 2) return setError('A challenge needs at least 2 people.');
    if (isTeam && capacity % 2) return setError('Team games need an even number of players.');
    setError('');
    setPaying(true);
  };

  const draft = (): ChallengeDraft => ({
    title,
    description,
    category: cat.id,
    format,
    goal_metric: isTeam ? 'games won' : cat.metric,
    unit,
    target_value: target,
    days,
    commitment,
    capacity,
    verification_method: verify,
    invite,
  });

  return (
    <div className="page page--narrow">
      <div className="page__bar">
        <BackButton onClick={() => back('/discover')} />
      </div>
      <header className="page__head">
        <h1 className="page__title">{isTeam ? 'Make the game matter.' : 'Start a group challenge'}</h1>
        <p className="page__sub">Every Sogo challenge has a finish line you can measure. No vague ones.</p>
      </header>

      <div className="field">
        <span className="label" id="fmt-l">
          Format
        </span>
        <div className="choices" role="radiogroup" aria-labelledby="fmt-l">
          {FORMATS.map((f) => (
            <button
              key={f.id}
              role="radio"
              aria-checked={format === f.id}
              className="choice"
              onClick={() => {
                setFormat(f.id);
                if (f.id === 'team') {
                  setTarget(3);
                  setDays(1);
                  setCapacity(8);
                  setVerify('human');
                } else {
                  setTarget(cat.target);
                  setDays(30);
                  setCapacity(10);
                  setVerify('connected');
                }
              }}
            >
              <span className="choice__title">{f.label}</span>
              <span className="choice__sub">{f.sub}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="field">
        <span className="label" id="cat-l">
          Sport
        </span>
        <div className="cat-pills" role="radiogroup" aria-labelledby="cat-l">
          {CATS.map((c) => (
            <button
              key={c.id}
              role="radio"
              aria-checked={cat.id === c.id}
              className="pill-choice"
              onClick={() => {
                setCat(c);
                if (!isTeam) setTarget(c.target);
              }}
            >
              <span aria-hidden>{c.emoji}</span> {c.label}
            </button>
          ))}
        </div>
      </div>

      <div className="form-grid">
        <div className="field">
          <label className="label" htmlFor="cc-target">
            {isTeam ? 'Games to win' : format === 'ranked' ? 'Benchmark' : 'Target'}
          </label>
          <div className="input-suffix">
            <input id="cc-target" className="input" type="number" min={1} value={target || ''} onChange={(e) => setTarget(Number(e.target.value))} />
            <span>{unit}</span>
          </div>
        </div>
        <div className="field">
          <label className="label" htmlFor="cc-days">
            Length
          </label>
          <div className="input-suffix">
            <input id="cc-days" className="input" type="number" min={1} max={90} value={days} onChange={(e) => setDays(Math.max(1, Number(e.target.value)))} />
            <span>days</span>
          </div>
        </div>
        <div className="field">
          <label className="label" htmlFor="cc-commit">
            Commitment each
          </label>
          <div className="input-suffix">
            <input id="cc-commit" className="input" type="number" min={1} max={100} value={commitment} onChange={(e) => setCommitment(Math.max(1, Number(e.target.value)))} />
            <span>$</span>
          </div>
        </div>
        <div className="field">
          <label className="label" htmlFor="cc-cap">
            {isTeam ? 'Players' : 'Spots'}
          </label>
          <input id="cc-cap" className="input" type="number" min={2} max={500} value={capacity} onChange={(e) => setCapacity(Number(e.target.value))} />
        </div>
      </div>

      <div className="field">
        <span className="label" id="ver-l">
          Verified by
        </span>
        <div className="segmented" role="group" aria-labelledby="ver-l">
          {(['connected', 'photo', 'human', 'self'] as VerificationMethod[]).map((m) => (
            <button key={m} aria-pressed={verify === m} onClick={() => setVerify(m)}>
              {m === 'connected' ? 'Connected data' : m === 'photo' ? 'Photo / video' : m === 'human' ? 'Captains / review' : 'Self-report'}
            </button>
          ))}
        </div>
      </div>

      <div className="field">
        <label className="label" htmlFor="cc-name">
          Name <span className="muted" style={{ fontWeight: 500 }}>(optional)</span>
        </label>
        <input id="cc-name" className="input" placeholder={title} value={name} onChange={(e) => setName(e.target.value)} maxLength={50} />
      </div>

      {friends(db).length > 0 && (
        <div className="field">
          <span className="label" id="inv-l">
            Invite friends
          </span>
          <div className="invite-picks" role="group" aria-labelledby="inv-l">
            {friends(db).map((u) => {
              const on = invite.includes(u.id);
              return (
                <button key={u.id} aria-pressed={on} className="invite-pick" onClick={() => setInvite((x) => (on ? x.filter((y) => y !== u.id) : [...x, u.id]))}>
                  <Avatar user={u} size="sm" /> {u.name.split(' ')[0]}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <section className="cc-preview" aria-label="Preview">
        <span className="cc-preview__emoji" aria-hidden>
          {cat.emoji}
        </span>
        <div className="cc-preview__main">
          <strong className="cc-preview__title">{title}</strong>
          <span>{description}</span>
          <span className="muted small">
            {capacity} × {money(commitment)}
            {sponsor ? ` + ${money(sponsor)} sponsor match each` : ' · players fund the pool'}
          </span>
        </div>
        <Ticket value={money(pool)} label="prize pool if full" />
      </section>
      {!isTeam && <Notice tone="blue">Sponsor matches on group challenges come from Sogo's reward partners (simulated).</Notice>}

      {error && (
        <p className="error-text" role="alert" style={{ marginTop: 12 }}>
          {error}
        </p>
      )}
      <div style={{ marginTop: 20 }}>
        <button className="btn btn--sun btn--lg btn--block btn--commit" onClick={submit}>
          Create and commit {money(commitment)}
        </button>
      </div>

      <PaymentSheet
        open={paying}
        onClose={() => setPaying(false)}
        request={{ amount: commitment, purpose: 'challenge_commitment', referenceId: 'new', description: title }}
        title={`Commit ${money(commitment)}`}
        processingText={`Setting up ${title} and placing your ${money(commitment)}…`}
        breakdown={[
          { label: 'Your commitment', value: money(commitment) },
          ...(sponsor ? [{ label: 'Sponsor match', value: `+${money(sponsor)}` }] : []),
          { label: isTeam ? 'Your share if you win' : 'Your potential reward', value: money(isTeam ? (pool / capacity) * 2 : commitment + sponsor), strong: true },
        ]}
        doneTitle="Challenge created."
        doneBody={<p className="muted">{invite.length ? `${invite.length} invite${invite.length > 1 ? 's' : ''} sent.` : 'Now bring people in.'}</p>}
        onCommitted={() => {
          created.current = update((d) => createChallenge(d, draft()));
        }}
        onDone={() => {
          setPaying(false);
          navigate(`/c/${created.current}`, { replace: true });
          celebrate({
            title: 'Game on.',
            kicker: title,
            confetti: false,
            body: <p>{description}</p>,
            actions: [
              { label: 'Challenge your friends', onClick: () => navigate(`/share/challenge_invite/${created.current}`) },
              { label: 'Later', onClick: () => undefined, variant: 'ghost-light' },
            ],
          });
        }}
      />
    </div>
  );
}
