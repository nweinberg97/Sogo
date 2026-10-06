import { useMemo, useRef, useState } from 'react';
import { useStore } from '../lib/store';
import { back, navigate, useLocation } from '../lib/router';
import { createGoal, sponsorAvailable, SOURCE_NAMES, type GoalDraft } from '../lib/commands';
import { brandById, featuredRewards, standardRewards } from '../lib/selectors';
import { COMMITMENT_OPTIONS, MAX_COMMITMENT, defaultMilestones, sponsorMatchFor } from '../lib/economics';
import { fromDateInput, dateInputValue, daysFromNow, longDate } from '../lib/time';
import { metric, money, num } from '../lib/format';
import type { DataSource, GoalCategory, VerificationMethod, Visibility } from '../lib/types';
import { BrandTile, Notice, Ticket, Wordmark, BackButton } from '../components/ui';
import { Icon } from '../components/Icon';
import { PaymentSheet } from '../components/PaymentSheet';
import { useFeedback } from '../components/feedback';

interface Template {
  key: string;
  title: string;
  verb: string;
  target: number;
  unit: string;
  metric: GoalDraft['metric_type'];
  days: number;
  emoji: string;
}

const CATEGORIES: { id: GoalCategory; label: string; emoji: string; templates: Template[]; verify: VerificationMethod }[] = [
  {
    id: 'run', label: 'Run', emoji: '🏃', verify: 'connected',
    templates: [
      { key: 'run50', title: 'Run 50 km', verb: 'Run', target: 50, unit: 'km', metric: 'distance', days: 30, emoji: '🏃' },
      { key: 'run100', title: 'Run 100 km', verb: 'Run', target: 100, unit: 'km', metric: 'distance', days: 45, emoji: '🏃' },
      { key: 'run10k', title: 'Train for a 10K: run 60 km', verb: 'Run', target: 60, unit: 'km', metric: 'distance', days: 42, emoji: '🏁' },
    ],
  },
  {
    id: 'walk', label: 'Walk', emoji: '🚶', verify: 'connected',
    templates: [
      { key: 'steps', title: 'Walk 100,000 steps', verb: 'Walk', target: 100000, unit: 'steps', metric: 'count', days: 14, emoji: '🚶' },
      { key: 'steps300', title: 'Walk 300,000 steps', verb: 'Walk', target: 300000, unit: 'steps', metric: 'count', days: 30, emoji: '🚶' },
    ],
  },
  {
    id: 'strength', label: 'Get stronger', emoji: '🏋️', verify: 'photo',
    templates: [
      { key: 'workouts', title: 'Complete 12 workouts', verb: 'Complete', target: 12, unit: 'workouts', metric: 'sessions', days: 30, emoji: '🏋️' },
      { key: 'pushups', title: 'Do 1,000 push-ups', verb: 'Do', target: 1000, unit: 'push-ups', metric: 'count', days: 30, emoji: '💪' },
    ],
  },
  {
    id: 'cycle', label: 'Cycle', emoji: '🚴', verify: 'connected',
    templates: [
      { key: 'cycle100', title: 'Cycle 100 km', verb: 'Cycle', target: 100, unit: 'km', metric: 'distance', days: 21, emoji: '🚴' },
      { key: 'cycle200', title: 'Cycle 200 km', verb: 'Cycle', target: 200, unit: 'km', metric: 'distance', days: 30, emoji: '🚴' },
    ],
  },
  {
    id: 'sport', label: 'Sport', emoji: '🏀', verify: 'photo',
    templates: [
      { key: 'hoops', title: 'Practice basketball 12 times', verb: 'Practice basketball', target: 12, unit: 'sessions', metric: 'sessions', days: 30, emoji: '🏀' },
      { key: 'ft', title: 'Make 500 free throws', verb: 'Make', target: 500, unit: 'free throws', metric: 'count', days: 30, emoji: '🏀' },
      { key: 'tennis', title: 'Play tennis 10 times', verb: 'Play tennis', target: 10, unit: 'sessions', metric: 'sessions', days: 30, emoji: '🎾' },
    ],
  },
  {
    id: 'recovery', label: 'Recovery', emoji: '🌙', verify: 'self',
    templates: [
      { key: 'sleep', title: 'Sleep 7+ hours for 20 nights', verb: 'Sleep 7+ hours for', target: 20, unit: 'nights', metric: 'days', days: 30, emoji: '🌙' },
      { key: 'meditate', title: 'Meditate 15 times', verb: 'Meditate', target: 15, unit: 'sessions', metric: 'sessions', days: 30, emoji: '🧘' },
      { key: 'mobility', title: 'Do a mobility routine 20 times', verb: 'Mobility routine', target: 20, unit: 'sessions', metric: 'sessions', days: 30, emoji: '🤸' },
    ],
  },
  {
    id: 'habit', label: 'Healthy habit', emoji: '📆', verify: 'self',
    templates: [
      { key: 'water', title: 'Drink 2 L of water on 25 days', verb: 'Drink 2 L of water on', target: 25, unit: 'days', metric: 'days', days: 30, emoji: '💧' },
      { key: 'bedtime', title: 'In bed by 11 for 20 nights', verb: 'In bed by 11 for', target: 20, unit: 'nights', metric: 'days', days: 30, emoji: '🛏️' },
      { key: 'move', title: 'Move 30 minutes on 20 days', verb: 'Move 30 minutes on', target: 20, unit: 'days', metric: 'days', days: 30, emoji: '⚡' },
    ],
  },
];

const FOCUS_TO_CAT: Record<string, GoalCategory> = {
  move: 'walk', strength: 'strength', run: 'run', sport: 'sport', sleep: 'recovery', consistency: 'habit', train: 'run', other: 'habit',
};

const STEPS = ['Goal', 'Deadline', 'Milestones', 'Stake', 'Prize', 'Proof', 'Review'] as const;

const VERIFY: { id: VerificationMethod; title: string; sub: string; icon: string }[] = [
  { id: 'connected', title: 'Connected data', sub: 'Sogo reads it from your watch or app. Strongest proof.', icon: 'sync' },
  { id: 'photo', title: 'Photo proof', sub: 'Snap a photo after each session.', icon: 'camera' },
  { id: 'self', title: 'Self-report', sub: 'You mark it done. Honour system.', icon: 'hand' },
  { id: 'human', title: 'Human review', sub: 'A Sogo reviewer checks each submission.', icon: 'shield' },
];

const SOURCES: DataSource[] = ['apple_health', 'strava', 'garmin', 'fitbit', 'health_connect'];

export function CreateGoal() {
  const { db, update } = useStore();
  const { celebrate } = useFeedback();
  const { query } = useLocation();
  const first = query.get('first') === '1';

  const initialTemplate = useMemo(() => {
    const key = query.get('template');
    for (const c of CATEGORIES) {
      const t = c.templates.find((x) => x.key === key);
      if (t) return { cat: c.id, t };
    }
    const focus = query.get('focus');
    const cat = focus ? FOCUS_TO_CAT[focus] : undefined;
    if (cat) return { cat, t: CATEGORIES.find((c) => c.id === cat)!.templates[0] };
    return { cat: 'run' as GoalCategory, t: CATEGORIES[0].templates[0] };
  }, [query]);

  const [step, setStep] = useState(0);
  const [cat, setCat] = useState<GoalCategory>(initialTemplate.cat);
  const [tplKey, setTplKey] = useState<string>(initialTemplate.t.key);
  const [target, setTarget] = useState<number>(initialTemplate.t.target);
  const [endDate, setEndDate] = useState<string>(daysFromNow(initialTemplate.t.days, 23));
  const [commitment, setCommitment] = useState<number>(15);
  const [custom, setCustom] = useState('');
  const [brandId, setBrandId] = useState<string>(cat === 'run' || cat === 'sport' ? 'nike' : cat === 'walk' ? 'spotify' : 'lululemon');
  const [method, setMethod] = useState<VerificationMethod>(CATEGORIES.find((c) => c.id === initialTemplate.cat)!.verify);
  const [source, setSource] = useState<DataSource>('apple_health');
  const [visibility, setVisibility] = useState<Visibility>(db.settings.default_visibility);
  const [partials, setPartials] = useState(true);
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState('');

  const category = CATEGORIES.find((c) => c.id === cat)!;
  const tpl = category.templates.find((t) => t.key === tplKey) ?? category.templates[0];
  const title = target === tpl.target ? tpl.title : `${tpl.verb} ${num(target)} ${tpl.unit}`;
  const brand = brandById(db, brandId)!;
  const hasMatch = sponsorAvailable(db, brandId, commitment);
  const match = sponsorMatchFor(commitment, hasMatch);
  const total = commitment + match;
  const milestones = defaultMilestones(target, commitment, match).map((m) => (partials || m.is_final ? m : { ...m, reward_amount: 0 }));
  const days = Math.max(1, Math.round((new Date(endDate).getTime() - Date.now()) / 86_400_000));
  const rewards = [...featuredRewards(db), ...standardRewards(db)];

  const pickCategory = (id: GoalCategory) => {
    const c = CATEGORIES.find((x) => x.id === id)!;
    setCat(id);
    setTplKey(c.templates[0].key);
    setTarget(c.templates[0].target);
    setEndDate(daysFromNow(c.templates[0].days, 23));
    setMethod(c.verify);
  };

  const next = () => {
    setError('');
    if (step === 0 && (!target || target <= 0)) return setError('Set a target above zero.');
    if (step === 1 && days < 3) return setError('Give yourself at least 3 days.');
    if (step === 3 && (!commitment || commitment < 1 || commitment > MAX_COMMITMENT)) return setError(`Commit between $1 and $${MAX_COMMITMENT}.`);
    if (step === 5 && method === 'connected' && !db.settings.connected_sources[source])
      return setError(`${SOURCE_NAMES[source]} isn't connected yet. Connect it below, or pick another source.`);
    setStep((s) => Math.min(STEPS.length - 1, s + 1));
    window.scrollTo({ top: 0 });
  };

  const draft = (): GoalDraft => ({
    title,
    description: '',
    category: cat,
    metric_type: tpl.metric,
    target_value: target,
    unit: tpl.unit,
    end_date: endDate,
    milestones,
    commitment_amount: commitment,
    reward_brand_id: brandId,
    verification_method: method,
    data_source: method === 'connected' ? source : undefined,
    visibility,
    emoji: tpl.emoji,
  });

  const createdId = useRef('');

  return (
    <div className="create">
      <header className="create__bar">
        <BackButton onClick={() => (step === 0 ? back('/home') : setStep(step - 1))} label={step === 0 ? 'Cancel' : 'Previous step'} />
        <Wordmark size={22} />
        <span className="create__count tnum" aria-live="polite">
          {step + 1} / {STEPS.length}
        </span>
      </header>
      <div className="create__progress" aria-hidden>
        <span style={{ width: `${((step + 1) / STEPS.length) * 100}%` }} />
      </div>

      <div className="create__layout">
        <section className="create__step" aria-labelledby="step-q">
          {step === 0 && (
            <>
              {first && <p className="create__hint">Let's make your first one count.</p>}
              <h1 id="step-q" className="create__q">
                What are you going after?
              </h1>
              <div className="cat-pills" role="radiogroup" aria-label="Category">
                {CATEGORIES.map((c) => (
                  <button key={c.id} role="radio" aria-checked={cat === c.id} className="pill-choice" onClick={() => pickCategory(c.id)}>
                    <span aria-hidden>{c.emoji}</span> {c.label}
                  </button>
                ))}
              </div>
              <div className="choices" role="radiogroup" aria-label="Goal" style={{ marginTop: 18 }}>
                {category.templates.map((t) => (
                  <button
                    key={t.key}
                    role="radio"
                    aria-checked={tplKey === t.key}
                    className="choice"
                    onClick={() => {
                      setTplKey(t.key);
                      setTarget(t.target);
                      setEndDate(daysFromNow(t.days, 23));
                    }}
                  >
                    <span className="choice__emoji" aria-hidden>
                      {t.emoji}
                    </span>
                    <span className="choice__title">{t.title}</span>
                    <span className="choice__sub">in {t.days} days</span>
                  </button>
                ))}
              </div>
              <div className="field" style={{ marginTop: 22 }}>
                <label className="label" htmlFor="target">
                  Make it yours
                </label>
                <div className="target-input">
                  <span className="target-input__verb">{tpl.verb}</span>
                  <input
                    id="target"
                    className="input input--big"
                    type="number"
                    inputMode="decimal"
                    min={1}
                    value={target || ''}
                    onChange={(e) => setTarget(Number(e.target.value))}
                    aria-describedby="target-unit"
                  />
                  <span id="target-unit" className="target-input__unit">
                    {tpl.unit}
                  </span>
                </div>
                <span className="hint">Specific and measurable. That's what makes it a bet.</span>
              </div>
            </>
          )}

          {step === 1 && (
            <>
              <h1 id="step-q" className="create__q">
                By when?
              </h1>
              <div className="choices" role="radiogroup" aria-label="Deadline">
                {[7, 14, 21, 30, 45].map((d) => {
                  const iso = daysFromNow(d, 23);
                  const on = dateInputValue(iso) === dateInputValue(endDate);
                  return (
                    <button key={d} role="radio" aria-checked={on} className="choice" onClick={() => setEndDate(iso)}>
                      <span className="choice__title">{d} days</span>
                      <span className="choice__sub">{longDate(iso)}</span>
                    </button>
                  );
                })}
              </div>
              <div className="field" style={{ marginTop: 20 }}>
                <label htmlFor="enddate" className="label">
                  Or pick a date
                </label>
                <input
                  id="enddate"
                  type="date"
                  className="input"
                  min={dateInputValue(daysFromNow(3))}
                  value={dateInputValue(endDate)}
                  onChange={(e) => e.target.value && setEndDate(fromDateInput(e.target.value))}
                />
              </div>
              <p className="hint" style={{ marginTop: 10 }}>
                {metric(target, tpl.unit)} in {days} days is about {metric(Math.round((target / days) * 10) / 10, tpl.unit)} a day.
              </p>
            </>
          )}

          {step === 2 && (
            <>
              <h1 id="step-q" className="create__q">
                Reward the progress, not just the finish.
              </h1>
              <p className="muted">Sogo sets milestones along the way. Hit halfway and part of the prize is yours, whatever happens next.</p>
              <ol className="ms-ladder">
                {milestones.map((m) => (
                  <li key={m.title} className={m.is_final ? 'is-final' : ''}>
                    <span className="ms-ladder__dot" aria-hidden />
                    <span className="ms-ladder__val score">{metric(m.target_value, tpl.unit)}</span>
                    <span className="ms-ladder__title">{m.title}</span>
                    <span className="ms-ladder__reward">
                      {m.is_final ? `${money(total)}+ reward` : m.reward_amount > 0 ? `${money(m.reward_amount)} secured` : 'Badge'}
                    </span>
                  </li>
                ))}
              </ol>
              <label className="toggle-row">
                <span>
                  <strong>Partial rewards</strong>
                  <span className="muted small" style={{ display: 'block' }}>
                    Secure half the base prize at the halfway milestone.
                  </span>
                </span>
                <input type="checkbox" checked={partials} onChange={(e) => setPartials(e.target.checked)} className="native-switch" />
              </label>
            </>
          )}

          {step === 3 && (
            <>
              <h1 id="step-q" className="create__q">
                Put something behind it.
              </h1>
              <p className="muted">Your commitment is matched by the reward sponsor. Finish, and it all comes back as a prize.</p>
              <div className="amounts" role="group" aria-label="Commitment amount" style={{ marginTop: 18 }}>
                {COMMITMENT_OPTIONS.map((a) => (
                  <button
                    key={a}
                    className="amount"
                    aria-pressed={commitment === a && !custom}
                    onClick={() => {
                      setCommitment(a);
                      setCustom('');
                    }}
                  >
                    ${a}
                  </button>
                ))}
                <div className="input-suffix" style={{ width: 130 }}>
                  <input
                    className="input amount-custom"
                    type="number"
                    inputMode="numeric"
                    placeholder="Other"
                    aria-label="Other amount in dollars"
                    min={1}
                    max={MAX_COMMITMENT}
                    value={custom}
                    onChange={(e) => {
                      setCustom(e.target.value);
                      setCommitment(Math.round(Number(e.target.value)));
                    }}
                  />
                  <span>$</span>
                </div>
              </div>
              <div className="stake-math" aria-live="polite">
                <div>
                  <span className="score">{money(commitment || 0)}</span>
                  <span className="muted small">you</span>
                </div>
                <span className="stake-math__op">+</span>
                <div>
                  <span className="score">{money(match)}</span>
                  <span className="muted small">sponsor</span>
                </div>
                <span className="stake-math__op">=</span>
                <Ticket value={money(total || 0)} label="potential reward" />
              </div>
              <p className="hint">Demo mode: nothing is charged. In production this would be a hold through a payments provider.</p>
            </>
          )}

          {step === 4 && (
            <>
              <h1 id="step-q" className="create__q">
                What would you like to earn?
              </h1>
              <p className="muted">The brand you pick funds your sponsor match. You can switch prizes when you claim.</p>
              <div className="brand-picks" role="radiogroup" aria-label="Reward brand">
                {rewards.map((r) => {
                  const b = brandById(db, r.brand_id)!;
                  const ok = r.availability !== 'unavailable';
                  return (
                    <button
                      key={r.id}
                      role="radio"
                      aria-checked={brandId === b.id}
                      className="brand-pick"
                      disabled={!ok}
                      onClick={() => setBrandId(b.id)}
                    >
                      <BrandTile brand={b} size={52} />
                      <span className="brand-pick__name">{b.name}</span>
                      <span className="brand-pick__sub">
                        {!ok ? r.tagline : r.placement_tier === 'featured' ? 'Featured reward' : r.availability === 'limited' ? 'Limited match left' : r.tagline}
                      </span>
                    </button>
                  );
                })}
              </div>
              {!hasMatch && (
                <Notice tone="warn">
                  {brand.name}'s sponsor match budget can't cover {money(commitment)} right now. You can still go, but there's no match. Pick another
                  brand to get the full {money(commitment * 2)}.
                </Notice>
              )}
              <p className="tiny muted" style={{ marginTop: 12 }}>
                Brands are illustrative concept partners and are not affiliated with Sogo.
              </p>
            </>
          )}

          {step === 5 && (
            <>
              <h1 id="step-q" className="create__q">
                How will Sogo verify it?
              </h1>
              <div className="verify-list" role="radiogroup" aria-label="Verification method">
                {VERIFY.map((v) => (
                  <button key={v.id} role="radio" aria-checked={method === v.id} className="choice verify-choice" onClick={() => setMethod(v.id)}>
                    <Icon name={v.icon} />
                    <span>
                      <span className="choice__title">
                        {v.title} {v.id === category.verify && <span className="chip chip--blue">Recommended</span>}
                      </span>
                      <span className="choice__sub" style={{ display: 'block' }}>
                        {v.sub}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
              {method === 'connected' && (
                <div className="field" style={{ marginTop: 20 }}>
                  <span className="label" id="src-l">
                    Data source
                  </span>
                  <div className="sources" role="radiogroup" aria-labelledby="src-l">
                    {SOURCES.map((s) => {
                      const connected = db.settings.connected_sources[s];
                      return (
                        <div key={s} className={`source ${source === s ? 'is-on' : ''}`}>
                          <button role="radio" aria-checked={source === s} className="source__pick" onClick={() => setSource(s)}>
                            <strong>{SOURCE_NAMES[s]}</strong>
                            <span className={`small ${connected ? '' : 'muted'}`}>{connected ? 'Connected' : 'Not connected'}</span>
                          </button>
                          {!connected && (
                            <button
                              className="btn btn--soft btn--sm"
                              onClick={() => {
                                update((d) => {
                                  d.settings.connected_sources[s] = true;
                                });
                                setSource(s);
                                setError('');
                              }}
                            >
                              Connect
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  <span className="hint">Simulated in this prototype. You don't tell Sogo you did it. Sogo knows.</span>
                </div>
              )}
              {method === 'self' && <Notice>Self-reported goals are marked as such on your profile and share cards.</Notice>}
              {method === 'human' && <Notice>Human review is a preview of Sogo's verification team. In demo mode you can approve your own submissions.</Notice>}
            </>
          )}

          {step === 6 && (
            <>
              <h1 id="step-q" className="create__q">
                Your challenge
              </h1>
              <div className="review-slip">
                <div className="review-slip__head">
                  <span aria-hidden className="review-slip__emoji">
                    {tpl.emoji}
                  </span>
                  <div>
                    <div className="review-slip__goal score">{metric(target, tpl.unit)}</div>
                    <div className="muted">
                      {title} · by {longDate(endDate)}
                    </div>
                  </div>
                </div>
                <dl className="kv">
                  <dt>Your commitment</dt>
                  <dd>{money(commitment)}</dd>
                  <dt>{brand.name} sponsor contribution</dt>
                  <dd>+{money(match)}</dd>
                  <dt>Halfway reward</dt>
                  <dd>{milestones[1].reward_amount ? money(milestones[1].reward_amount) : 'Off'}</dd>
                  <dt>Verified by</dt>
                  <dd>{method === 'connected' ? SOURCE_NAMES[source] : VERIFY.find((v) => v.id === method)!.title}</dd>
                </dl>
                <div className="review-slip__total">
                  <span>Potential reward</span>
                  <Ticket value={money(total)} label={`${brand.name} reward`} />
                </div>
              </div>
              <div className="field" style={{ marginTop: 22 }}>
                <span className="label" id="vis-l">
                  Who can see it?
                </span>
                <div className="segmented" role="group" aria-labelledby="vis-l">
                  {(['private', 'friends', 'public'] as Visibility[]).map((v) => (
                    <button key={v} aria-pressed={visibility === v} onClick={() => setVisibility(v)}>
                      {v === 'private' ? 'Only me' : v === 'friends' ? 'Friends' : 'Everyone'}
                    </button>
                  ))}
                </div>
                <span className="hint">
                  {visibility === 'private'
                    ? 'Friends can’t see or back a private goal.'
                    : visibility === 'friends'
                      ? 'Friends can give Props and back you.'
                      : 'Anyone on Sogo can find it and back you.'}
                </span>
              </div>
            </>
          )}

          {error && (
            <p className="error-text" role="alert" style={{ marginTop: 14 }}>
              {error}
            </p>
          )}

          <div className="create__actions">
            {step < STEPS.length - 1 ? (
              <button className="btn btn--lg btn--block" onClick={next}>
                {step === 3 ? `Commit ${money(commitment || 0)}` : 'Continue'}
              </button>
            ) : (
              <button className="btn btn--sun btn--lg btn--block btn--commit" onClick={() => setPaying(true)}>
                Start betting on yourself
              </button>
            )}
          </div>
        </section>

        <aside className="create__aside" aria-label="Summary">
          <div className="mini-slip">
            <span className="mini-slip__label">Your slip</span>
            <strong className="mini-slip__title">{title}</strong>
            <span className="muted small">by {longDate(endDate)}</span>
            <dl className="kv" style={{ marginTop: 14 }}>
              <dt>Stake</dt>
              <dd>{money(commitment || 0)}</dd>
              <dt>Sponsor</dt>
              <dd>+{money(match)}</dd>
            </dl>
            <div style={{ marginTop: 14 }}>
              <Ticket value={money(total || 0)} label={`${brand.name} reward`} />
            </div>
          </div>
        </aside>
      </div>

      <PaymentSheet
        open={paying}
        onClose={() => setPaying(false)}
        request={{ amount: commitment, purpose: 'goal_commitment', referenceId: 'new', description: title }}
        title={`Commit ${money(commitment)}`}
        processingText={`Your ${money(commitment)} commitment is being placed into your Sogo challenge.`}
        breakdown={[
          { label: 'Your commitment', value: money(commitment) },
          { label: `Sponsor contribution (${brand.name})`, value: `+${money(match)}` },
          { label: 'Potential reward', value: money(total), strong: true },
        ]}
        doneTitle={`${money(commitment)} committed.`}
        doneBody={
          <p className="muted">
            Sponsor contribution: +{money(match)}. {metric(target, tpl.unit)} by {longDate(endDate)}.
          </p>
        }
        onCommitted={() => {
          createdId.current = update((d) => createGoal(d, draft()));
        }}
        onDone={() => {
          setPaying(false);
          const id = createdId.current;
          navigate(`/goal/${id}`, { replace: true });
          celebrate({
            kicker: title,
            title: 'Put something on it.',
            body: <Ticket value={money(total)} label="on the line" />,
            actions: [
              { label: 'Share your goal', onClick: () => navigate(`/share/goal_started/${id}`) },
              { label: 'Go', onClick: () => undefined, variant: 'ghost-light' },
            ],
          });
        }}
      />
    </div>
  );
}
