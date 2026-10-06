import { useEffect, useRef, useState } from 'react';
import { useStore } from '../lib/store';
import { Link, back, navigate } from '../lib/router';
import { canSeeGoal, goalView, rewardForBrand, featuredRewards, standardRewards, brandById, type GoalView } from '../lib/selectors';
import {
  addProgress,
  editGoal,
  markMoment,
  reviewVerification,
  settle,
  submitVerification,
  syncConnected,
  SOURCE_NAMES,
  PROP_TYPES,
} from '../lib/commands';
import { BACKER_RETURN_RATE, backerReturn, percent } from '../lib/economics';
import { firstName, metric, money, num, pct } from '../lib/format';
import { daysLeftLabel, longDate, relTime, shortDate } from '../lib/time';
import type { Goal, Visibility } from '../lib/types';
import { ME } from '../lib/seed';
import { Avatar, BackButton, BrandTile, CountUp, Empty, Notice, ProgressTrack, Sheet, Ticket } from '../components/ui';
import { Icon } from '../components/Icon';
import { encouragement } from '../components/GoalCards';
import { BackSheet, PropsSheet } from '../components/SocialSheets';
import { useFeedback } from '../components/feedback';
import { NotFound } from './NotFound';

const METHOD_LABEL = { connected: 'Connected data', photo: 'Photo proof', self: 'Self-reported', human: 'Human review' } as const;

async function downscale(file: File, max = 900): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = rej;
      i.src = url;
    });
    const k = Math.min(1, max / Math.max(img.width, img.height));
    const c = document.createElement('canvas');
    c.width = Math.round(img.width * k);
    c.height = Math.round(img.height * k);
    c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL('image/jpeg', 0.78);
  } finally {
    URL.revokeObjectURL(url);
  }
}

function useGoalMoments(v: GoalView | null) {
  const { db, update } = useStore();
  const { celebrate } = useFeedback();
  useEffect(() => {
    if (!v || v.goal.user_id !== ME) return;
    const g = v.goal;
    const seen = (m: string) => g.seen_moments.includes(m);
    if (g.status === 'completed' && !seen('completed')) {
      update((d) => markMoment(d, g.id, 'completed'));
      celebrate({
        kicker: `${metric(g.target_value, g.unit)} complete`,
        title: 'You did it.',
        body: (
          <div style={{ display: 'grid', gap: 10, justifyItems: 'center' }}>
            <Ticket value={money(g.settled_payout ?? v.pool.total)} label="reward earned" variant="white" />
            {v.backings.length > 0 && (
              <span className="small" style={{ opacity: 0.85 }}>
                {v.backings.map((b) => firstName(db.users.find((u) => u.id === b.investor_id)?.name ?? '')).join(', ')} backed you. They get their stake back +{' '}
                {Math.round(BACKER_RETURN_RATE * 100)}%.
              </span>
            )}
          </div>
        ),
        actions: [
          { label: 'Choose your prize', onClick: () => navigate(`/claim/goal/${g.id}`) },
          { label: 'Share your win', onClick: () => navigate(`/share/completed/${g.id}`), variant: 'ghost-light' },
        ],
      });
      return;
    }
    if (g.status !== 'active') return;
    const b = v.backings.find((x) => x.investor_id !== ME && !seen(`backing:${x.id}`));
    if (b) {
      const who = firstName(db.users.find((u) => u.id === b.investor_id)?.name ?? 'Someone');
      const before = v.pool.total - b.amount - b.sponsor_match;
      update((d) => markMoment(d, g.id, `backing:${b.id}`));
      celebrate({
        tone: 'sun',
        kicker: `${who} invested ${money(b.amount)} · sponsor matched ${money(b.sponsor_match)}`,
        title: `${who} is backing you.`,
        body: (
          <div style={{ display: 'grid', gap: 12, justifyItems: 'center' }}>
            <div className="pool-jump">
              <span className="score pool-jump__from">{money(before)}</span>
              <span aria-hidden>→</span>
              <span className="score pool-jump__to">
                <CountUp value={v.pool.total} format={(n) => money(n)} duration={1400} />
              </span>
            </div>
            {b.message && <p className="pool-jump__msg">“{b.message}”</p>}
          </div>
        ),
        actions: [
          { label: 'Share', onClick: () => navigate(`/share/backed/${g.id}`), variant: 'ink' },
          { label: 'Keep going', onClick: () => undefined, variant: 'ghost-light' },
        ],
      });
      return;
    }
    const m = v.milestones.find((x) => x.status === 'reached' && !x.is_final && x.reward_amount > 0 && !seen(`milestone:${x.id}`));
    if (m) {
      update((d) => markMoment(d, g.id, `milestone:${m.id}`));
      celebrate({
        kicker: `${m.title} milestone`,
        title: `${metric(m.target_value, g.unit)} down.`,
        body: <Ticket value={money(m.reward_amount)} label="secured, whatever happens next" variant="white" />,
        actions: [
          { label: 'Share milestone', onClick: () => navigate(`/share/milestone/${g.id}`) },
          { label: 'Keep going', onClick: () => undefined, variant: 'ghost-light' },
        ],
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [v?.goal.status, v?.backings.length, v?.milestones.filter((m) => m.status === 'reached').length, v?.goal.id]);
}

export function GoalDetail({ id }: { id: string }) {
  const { db } = useStore();
  const goal = db.goals.find((g) => g.id === id);
  const v = goal && canSeeGoal(db, goal) ? goalView(db, goal) : null;
  useGoalMoments(v);

  if (!goal) return <NotFound />;
  if (!v)
    return (
      <div className="page">
        <Empty title="This goal is private" action={<button className="btn btn--sm" onClick={() => back('/people')}>Go back</button>}>
          Only its owner can see it.
        </Empty>
      </div>
    );
  return <GoalPage v={v} />;
}

function GoalPage({ v }: { v: GoalView }) {
  const { db, update } = useStore();
  const { toast } = useFeedback();
  const g = v.goal;
  const mine = g.user_id === ME;
  const [sheet, setSheet] = useState<'log' | 'proof' | 'edit' | 'props' | 'back' | 'end' | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState('');
  const owner = firstName(v.owner.name);
  const sourceName = SOURCE_NAMES[g.data_source ?? 'apple_health'];

  const sync = async () => {
    setSyncing(true);
    setSyncError('');
    await new Promise((r) => setTimeout(r, 900));
    const res = update((d) => {
      const s = syncConnected(d, g.id);
      if (!s.ok) return s;
      if (s.amount > 0) addProgress(d, g.id, s.amount);
      return s;
    });
    setSyncing(false);
    if (!res.ok) setSyncError(res.reason);
    else if (res.amount === 0) toast(`Up to date with ${sourceName}`);
    else toast(`+${metric(res.amount, g.unit)} from ${sourceName}`);
  };

  return (
    <div className="page page--goal">
      <div className="page__bar">
        <BackButton onClick={() => back(mine ? '/home' : '/people')} />
        <div className="page__bar-actions">
          {mine && g.status === 'active' && (
            <button className="btn btn--soft btn--sm" onClick={() => setSheet('edit')}>
              <Icon name="edit" size={16} /> Edit
            </button>
          )}
          {mine && g.visibility !== 'private' && (
            <Link to={`/share/${g.status === 'completed' ? 'completed' : v.pct >= 90 ? 'progress' : g.current_value === 0 ? 'goal_started' : 'progress'}/${g.id}`} className="btn btn--soft btn--sm">
              <Icon name="share" size={16} /> Share
            </Link>
          )}
        </div>
      </div>

      {!mine && (
        <Link to={`/u/${g.user_id}`} className="goal-owner">
          <Avatar user={v.owner} size="sm" /> <strong>{v.owner.name}</strong>
        </Link>
      )}

      {g.status === 'active' && !v.overdue && <ActiveHero v={v} />}
      {g.status === 'active' && v.overdue && (
        <section className="state-panel state-panel--sun">
          <h1 className="state-panel__title">Time's up.</h1>
          <p>
            The deadline was {longDate(g.end_date)}. You reached {metric(g.current_value, g.unit)} of {metric(g.target_value, g.unit)}
            {v.secured > 0 ? ` and secured ${money(v.secured)}.` : '.'}
          </p>
          {mine && (
            <button className="btn btn--lg" onClick={() => update((d) => settle(d, g.id, false))}>
              Close out this goal
            </button>
          )}
        </section>
      )}
      {g.status === 'completed' && <CompletedPanel v={v} />}
      {g.status === 'failed' && <FailedPanel v={v} />}

      {mine && g.status === 'active' && !v.overdue && (
        <section className="actions-panel" aria-label="Log progress">
          {g.verification_method === 'connected' && (
            <>
              <div className="actions-panel__row">
                <div>
                  <strong>
                    <Icon name="sync" size={16} className="inline-icon" /> Connected to {sourceName}
                  </strong>
                  <span className="muted small" style={{ display: 'block' }}>
                    Sogo pulls your activity automatically. Simulated in this prototype.
                  </span>
                </div>
                <button className="btn btn--blue" onClick={sync} disabled={syncing} aria-busy={syncing}>
                  {syncing ? 'Syncing…' : 'Sync now'}
                </button>
              </div>
              {syncError && (
                <Notice tone="error">
                  {syncError}{' '}
                  <Link to="/settings" className="link-btn">
                    Open settings
                  </Link>
                </Notice>
              )}
            </>
          )}
          {(g.verification_method === 'photo' || g.verification_method === 'human') && (
            <div className="actions-panel__row">
              <div>
                <strong>{g.verification_method === 'photo' ? 'Photo proof' : 'Human review'}</strong>
                <span className="muted small" style={{ display: 'block' }}>
                  Each upload counts once it's verified.
                </span>
              </div>
              <button className="btn btn--blue" onClick={() => setSheet('proof')}>
                <Icon name="camera" size={18} /> Upload proof
              </button>
            </div>
          )}
          {g.verification_method === 'self' && (
            <div className="actions-panel__row">
              <div>
                <strong>Self-reported</strong>
                <span className="muted small" style={{ display: 'block' }}>
                  Honour system. Marked as self-reported on your profile.
                </span>
              </div>
              <button className="btn btn--blue" onClick={() => setSheet('log')}>
                <Icon name="plus" size={18} /> Log progress
              </button>
            </div>
          )}
          <Verifications goal={g} />
        </section>
      )}

      {!mine && g.status === 'active' && (
        <section className="friend-actions">
          <button className="btn btn--pink btn--lg" onClick={() => setSheet('props')}>
            Give Props
          </button>
          <button className="btn btn--blue btn--lg" onClick={() => setSheet('back')}>
            Back {owner}
          </button>
        </section>
      )}

      {mine && g.status === 'active' && !v.overdue && v.pct >= 90 && v.pct < 100 && (
        <section className="share-prompt">
          <div>
            <strong className="share-prompt__title">You're {pct(v.pct)} there.</strong>
            <span className="muted small">Let your people see the finish.</span>
          </div>
          <Link to={`/share/progress/${g.id}`} className="btn btn--sm">
            Share progress
          </Link>
        </section>
      )}
      {mine && g.status === 'active' && g.current_value === 0 && (
        <section className="share-prompt">
          <div>
            <strong className="share-prompt__title">Put something on it. Out loud.</strong>
            <span className="muted small">Goals you share are goals you finish.</span>
          </div>
          <Link to={`/share/goal_started/${g.id}`} className="btn btn--sm">
            Share your goal
          </Link>
        </section>
      )}

      <div className="goal-cols">
        <PrizePanel v={v} />
        <Milestones v={v} />
      </div>

      <section className="section" aria-labelledby="props-h">
        <div className="section__head">
          <h2 id="props-h" className="section__title">
            Props
          </h2>
          {!mine && g.status === 'active' && (
            <button className="link-btn" onClick={() => setSheet('props')}>
              Give Props
            </button>
          )}
        </div>
        {v.props.length === 0 ? (
          <p className="muted">{mine ? 'No Props yet. Share your goal and your people will show up.' : `Be the first to give ${owner} Props.`}</p>
        ) : (
          <ul className="list">
            {v.props.slice(0, 8).map((p) => {
              const from = db.users.find((u) => u.id === p.sender_id)!;
              const t = PROP_TYPES.find((x) => x.type === p.type)!;
              return (
                <li key={p.id} className="row">
                  <Avatar user={from} size="sm" />
                  <div className="row__main">
                    <div className="row__title">
                      {p.sender_id === ME ? 'You' : firstName(from.name)} <span aria-hidden>{t.emoji}</span> {t.label}
                    </div>
                    {p.message && <div className="row__meta">“{p.message}”</div>}
                  </div>
                  <span className="tiny muted">{relTime(p.created_at)}</span>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {mine && g.status === 'active' && (
        <section className="section">
          <button className="link-btn" style={{ color: 'var(--muted)' }} onClick={() => setSheet('end')}>
            End this goal early
          </button>
        </section>
      )}

      {sheet === 'log' && <LogSheet goal={g} onClose={() => setSheet(null)} />}
      {sheet === 'proof' && <ProofSheet goal={g} onClose={() => setSheet(null)} />}
      {sheet === 'edit' && <EditSheet goal={g} onClose={() => setSheet(null)} />}
      {sheet === 'props' && <PropsSheet goal={g} open onClose={() => setSheet(null)} />}
      {sheet === 'back' && <BackSheet goal={g} open onClose={() => setSheet(null)} />}
      <Sheet
        open={sheet === 'end'}
        onClose={() => setSheet(null)}
        title="End this goal now?"
        sub={`You'll keep ${money(v.secured)} you've secured. The rest of your ${money(g.commitment_amount)} commitment${v.backings.length ? ' and your backers’ stakes' : ''} goes to the community pool that funds future rewards.`}
      >
        <div className="sheet__actions">
          <button className="btn btn--ghost" onClick={() => setSheet(null)}>
            Keep going
          </button>
          <button
            className="btn btn--danger"
            onClick={() => {
              update((d) => settle(d, g.id, false));
              setSheet(null);
            }}
          >
            End goal
          </button>
        </div>
      </Sheet>
    </div>
  );
}

function ActiveHero({ v }: { v: GoalView }) {
  const g = v.goal;
  const perDay = v.daysLeft > 0 ? v.remaining / v.daysLeft : v.remaining;
  return (
    <section className="detail-hero on-dark" aria-labelledby="goal-title">
      <div className="detail-hero__top">
        <span className="goal-hero__emoji" aria-hidden>
          {g.emoji}
        </span>
        <h1 id="goal-title" className="detail-hero__title">
          {g.title}
        </h1>
        {g.visibility === 'private' && (
          <span className="chip chip--outline">
            <Icon name="lock" /> Only you
          </span>
        )}
      </div>
      <div className="goal-hero__score">
        <span className="score detail-hero__big">
          <CountUp value={g.current_value} format={(n) => (g.unit === 'km' ? n.toFixed(1) : num(n, 0))} />
        </span>
        <span className="goal-hero__of">
          / {num(g.target_value)} {g.unit}
        </span>
      </div>
      <p className="goal-hero__line">{encouragement(v)}</p>
      <ProgressTrack value={g.current_value} target={g.target_value} milestones={v.milestones} variant="on-blue" label={`${pct(v.pct)} complete`} />
      <div className="detail-hero__stats">
        <div>
          <span className="detail-hero__k">To go</span>
          <span className="detail-hero__v">{metric(v.remaining, g.unit)}</span>
        </div>
        <div>
          <span className="detail-hero__k">Time</span>
          <span className="detail-hero__v">{daysLeftLabel(g.end_date)}</span>
        </div>
        <div>
          <span className="detail-hero__k">Pace</span>
          <span className="detail-hero__v">
            {v.remaining === 0 ? 'Done' : `${metric(Math.round(perDay * 10) / 10, g.unit)}/day`}
            {v.remaining > 0 && <span className={`pace ${v.onPace ? 'pace--ok' : ''}`}>{v.onPace ? 'On pace' : 'Behind'}</span>}
          </span>
        </div>
      </div>
      <div className="detail-hero__prize">
        <Ticket
          value={<CountUp value={v.pool.total} format={(n) => money(n)} />}
          label="potential reward"
          stub={v.secured > 0 ? money(v.secured) : undefined}
          stubLabel="secured"
          bump={v.pool.total}
        />
        {v.brand && (
          <span className="detail-hero__brand">
            <BrandTile brand={v.brand} size={34} /> {v.brand.name} reward
          </span>
        )}
      </div>
    </section>
  );
}

function CompletedPanel({ v }: { v: GoalView }) {
  const g = v.goal;
  const mine = g.user_id === ME;
  return (
    <section className="state-panel state-panel--sun" aria-labelledby="goal-title">
      <span className="state-panel__kicker">
        {g.emoji} {g.title}
      </span>
      <h1 id="goal-title" className="state-panel__title">
        {mine ? 'You did it.' : `${firstName(v.owner.name)} did it.`}
      </h1>
      <p className="state-panel__line">
        {metric(g.target_value, g.unit)} complete · {money(g.settled_payout ?? v.pool.total)} reward
      </p>
      {mine && v.claimedReward ? (
        <div className="unlocked">
          <BrandTile brand={v.claimedReward.brand} size={56} />
          <div>
            <strong>Reward unlocked</strong>
            <div className="small">
              {money(v.claimedReward.value)} {v.claimedReward.reward.title}. Simulated — no real gift card is issued in this prototype.
            </div>
          </div>
        </div>
      ) : null}
      {mine && (
        <div className="state-panel__actions">
          {!v.claimedReward && (
            <Link to={`/claim/goal/${g.id}`} className="btn btn--lg">
              Choose your prize
            </Link>
          )}
          {g.visibility !== 'private' && (
            <Link to={`/share/${v.claimedReward ? 'reward' : 'completed'}/${g.id}`} className="btn btn--lg btn--white">
              Share your win
            </Link>
          )}
          {v.claimedReward && (
            <Link to="/new" className="btn btn--lg btn--blue">
              Start the next goal
            </Link>
          )}
        </div>
      )}
    </section>
  );
}

function FailedPanel({ v }: { v: GoalView }) {
  const { db } = useStore();
  const g = v.goal;
  const mine = g.user_id === ME;
  const kept = g.settled_payout ?? 0;
  const claimed = db.goal_rewards.some((r) => r.goal_id === g.id);
  if (!mine) {
    return (
      <section className="state-panel">
        <h1 className="state-panel__title">{g.title}</h1>
        <p>This one is closed.</p>
      </section>
    );
  }
  return (
    <section className="state-panel state-panel--mist" aria-labelledby="goal-title">
      <span className="state-panel__kicker">
        {g.emoji} {g.title} · {pct(percent(g.current_value, g.target_value))} of the way
      </span>
      <h1 id="goal-title" className="state-panel__title">
        You didn't hit this one.
      </h1>
      <p className="state-panel__line">
        That's okay. {metric(g.current_value, g.unit)} is {metric(g.current_value, g.unit)} more than zero.
        {kept > 0 ? ` You secured ${money(kept)} along the way — that's yours.` : ''} Your commitment helps fund future Sogo rewards for people
        who follow through. Next time, that could be you.
      </p>
      <div className="state-panel__actions">
        {kept > 0 && !claimed && (
          <Link to={`/claim/goal/${g.id}`} className="btn btn--lg btn--sun">
            Claim your {money(kept)}
          </Link>
        )}
        <Link to={`/new?template=${templateFor(g)}`} className="btn btn--lg">
          Ready for another shot?
        </Link>
      </div>
      <p className="tiny muted" style={{ marginTop: 12 }}>
        Tip: a slightly smaller target or a longer timeframe makes the next one land. Progress is the point.
      </p>
    </section>
  );
}

function templateFor(g: Goal): string {
  if (g.unit === 'km') return g.category === 'cycle' ? 'cycle100' : 'run50';
  if (g.unit === 'steps') return 'steps';
  if (g.category === 'recovery') return g.title.toLowerCase().includes('meditate') ? 'meditate' : 'sleep';
  if (g.category === 'strength') return 'workouts';
  if (g.category === 'sport') return 'hoops';
  return 'move';
}

function PrizePanel({ v }: { v: GoalView }) {
  const { db } = useStore();
  const g = v.goal;
  const p = v.pool;
  const parts = [
    { k: 'you', label: g.user_id === ME ? 'Your commitment' : `${firstName(v.owner.name)}'s commitment`, value: p.participant, color: 'var(--ink)' },
    { k: 'sp', label: `${v.brand?.name ?? 'Sponsor'} match`, value: p.sponsorBase, color: 'var(--sun)' },
    { k: 'bk', label: 'Backers', value: p.backers, color: 'var(--blue)' },
    { k: 'spb', label: 'Sponsor match on backers', value: p.sponsorBackers, color: '#ffe48a' },
  ].filter((x) => x.value > 0);
  return (
    <section className="panel prize-panel" aria-labelledby="prize-h">
      <h2 id="prize-h" className="section__title" style={{ marginBottom: 4 }}>
        What's at stake
      </h2>
      <p className="muted small">The prize pool and where every dollar comes from.</p>
      <div className="pool-bar" role="img" aria-label={parts.map((x) => `${x.label} ${money(x.value)}`).join(', ')}>
        {parts.map((x) => (
          <span key={x.k} style={{ flex: x.value, background: x.color }} />
        ))}
      </div>
      <dl className="kv" style={{ marginTop: 14 }}>
        {parts.map((x) => (
          <div key={x.k} style={{ display: 'contents' }}>
            <dt>
              <span className="swatch" style={{ background: x.color }} aria-hidden /> {x.label}
            </dt>
            <dd>{money(x.value)}</dd>
          </div>
        ))}
        <dt style={{ color: 'var(--ink)', fontWeight: 700 }}>Prize pool</dt>
        <dd className="kv__total">
          <CountUp value={p.total} format={(n) => money(n)} />
        </dd>
      </dl>

      {v.backings.length > 0 && (
        <>
          <h3 className="prize-panel__h3">Backed by</h3>
          <ul className="list">
            {v.backings.map((b) => {
              const u = db.users.find((x) => x.id === b.investor_id)!;
              return (
                <li key={b.id} className="row">
                  <Avatar user={u} size="sm" />
                  <div className="row__main">
                    <div className="row__title">
                      {b.investor_id === ME ? 'You' : firstName(u.name)} · {money(b.amount)}
                      {b.sponsor_match > 0 && <span className="muted"> + {money(b.sponsor_match)} match</span>}
                    </div>
                    {b.message && <div className="row__meta">“{b.message}”</div>}
                  </div>
                  <span className={`chip ${b.status === 'returned' ? 'chip--green' : b.status === 'forfeited' ? '' : 'chip--blue'}`}>
                    {b.status === 'returned' ? `Got ${money(backerReturn(b.amount))}` : b.status === 'forfeited' ? 'To pool' : `${money(b.potential_return)} if done`}
                  </span>
                </li>
              );
            })}
          </ul>
        </>
      )}

      <details className="explain">
        <summary>How the payout works</summary>
        <ul>
          <li>
            <strong>Finish:</strong> {g.user_id === ME ? 'you earn' : `${firstName(v.owner.name)} earns`} the full {money(p.total)} as a reward of their choice.
            {p.backerCount > 0 && ` Each backer gets their stake back plus ${Math.round(BACKER_RETURN_RATE * 100)}%, paid from the Sogo community pool.`}
          </li>
          <li>
            <strong>Miss after halfway:</strong> keep the {money(v.milestones.find((m) => !m.is_final && m.reward_amount > 0)?.reward_amount ?? 0)} you secured, paid from the sponsor match.
          </li>
          <li>
            <strong>Miss:</strong> unused commitments and backing go to the community pool that funds future rewards. Unused sponsor match returns
            to the sponsor.
          </li>
        </ul>
        {v.matchRemaining > 0 && g.status === 'active' && <p className="tiny muted">Sponsor will still match {money(v.matchRemaining)} of new backing.</p>}
      </details>
    </section>
  );
}

function Milestones({ v }: { v: GoalView }) {
  const g = v.goal;
  return (
    <section className="panel" aria-labelledby="ms-h">
      <h2 id="ms-h" className="section__title" style={{ marginBottom: 4 }}>
        Milestones
      </h2>
      <p className="muted small">
        {g.verification_method === 'connected'
          ? `Verified by ${SOURCE_NAMES[g.data_source ?? 'apple_health']}.`
          : g.verification_method === 'self'
            ? 'Self-reported.'
            : `Verified by ${METHOD_LABEL[g.verification_method].toLowerCase()}.`}{' '}
        Rewards are tiers — the biggest one you reach is yours.
      </p>
      <ol className="ms-list">
        {v.milestones.map((m) => {
          const reached = m.status === 'reached';
          const reward = m.is_final ? v.pool.total : m.reward_amount;
          return (
            <li key={m.id} className={`ms ${reached ? 'is-reached' : ''} ${m.is_final ? 'is-final' : ''}`}>
              <span className="ms__mark" aria-hidden>
                {reached ? <Icon name="check" size={16} /> : null}
              </span>
              <div className="ms__main">
                <div className="ms__title">
                  <span className="score ms__val">{metric(m.target_value, g.unit)}</span>
                  <span>{m.title}</span>
                  <span className="muted small">{Math.round((m.target_value / g.target_value) * 100)}%</span>
                </div>
                <div className="ms__meta small muted">
                  {reached
                    ? `Reached ${m.reached_at ? shortDate(m.reached_at) : ''} · ${
                        m.verification_status === 'self_reported'
                          ? 'self-reported'
                          : m.verification_status === 'pending'
                            ? 'verification pending'
                            : m.verification_status === 'rejected'
                              ? 'verification rejected'
                              : 'verified'
                      }`
                    : `Unlocks at ${metric(m.target_value, g.unit)}${g.current_value < m.target_value ? ` · ${metric(Math.round((m.target_value - g.current_value) * 10) / 10, g.unit)} to go` : ''}`}
                </div>
              </div>
              <span className={`ms__reward ${reached && reward > 0 ? 'is-on' : ''}`}>{reward > 0 ? money(reward) : 'Badge'}</span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function Verifications({ goal }: { goal: Goal }) {
  const { db, update } = useStore();
  const { toast } = useFeedback();
  const list = db.verifications.filter((x) => x.goal_id === goal.id).slice(0, 5);
  if (!list.length) return null;
  return (
    <div className="verifs">
      <h3 className="prize-panel__h3">Proof</h3>
      <ul className="list">
        {list.map((x) => (
          <li key={x.id} className="row">
            {x.evidence_url ? (
              <img src={x.evidence_url} alt={`Proof photo: ${x.note || 'session'}`} className="verif__img" />
            ) : (
              <span className="verif__img verif__img--ph" aria-hidden>
                <Icon name="camera" />
              </span>
            )}
            <div className="row__main">
              <div className="row__title">{x.note || `+${metric(x.amount, goal.unit)}`}</div>
              <div className="row__meta">
                {x.status === 'pending' && 'Verification pending · usually under 24 hours'}
                {x.status === 'approved' && `Verified ${x.reviewed_at ? relTime(x.reviewed_at) : ''}`}
                {x.status === 'rejected' && 'Rejected — the photo was unclear. Upload a new one to count it.'}
              </div>
              {x.status === 'pending' && (
                <div className="reviewer">
                  <span className="tiny muted">Reviewer tools (demo)</span>
                  <button
                    className="btn btn--sm btn--soft"
                    onClick={() => {
                      const r = update((d) => reviewVerification(d, x.id, true));
                      toast(r?.completed ? 'Approved. Goal complete!' : `Approved · +${metric(x.amount, goal.unit)}`);
                    }}
                  >
                    Approve
                  </button>
                  <button
                    className="btn btn--sm btn--soft"
                    onClick={() => {
                      update((d) => reviewVerification(d, x.id, false));
                      toast('Marked as rejected', 'error');
                    }}
                  >
                    Reject
                  </button>
                </div>
              )}
            </div>
            <span className={`chip ${x.status === 'approved' ? 'chip--green' : x.status === 'rejected' ? 'chip--red' : 'chip--blue'}`}>
              {x.status === 'pending' ? 'Pending' : x.status === 'approved' ? 'Verified' : 'Rejected'}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function LogSheet({ goal, onClose }: { goal: Goal; onClose: () => void }) {
  const { update } = useStore();
  const { toast } = useFeedback();
  const step = goal.unit === 'km' ? 1 : goal.target_value >= 1000 ? Math.round(goal.target_value / 20) : 1;
  const [amount, setAmount] = useState<number>(step);
  const remaining = Math.max(0, goal.target_value - goal.current_value);
  const submit = () => {
    if (!amount || amount <= 0) return;
    const r = update((d) => addProgress(d, goal.id, Math.min(amount, remaining)));
    toast(r.completed ? 'Goal complete!' : `+${metric(Math.min(amount, remaining), goal.unit)} logged`);
    onClose();
  };
  return (
    <Sheet open onClose={onClose} title="Log progress" sub="Self-reported. Your friends can see it's on the honour system.">
      <div className="field">
        <label className="label" htmlFor="amt">
          How many {goal.unit}?
        </label>
        <div className="input-suffix">
          <input id="amt" className="input input--big" type="number" inputMode="decimal" min={0} value={amount || ''} onChange={(e) => setAmount(Number(e.target.value))} />
          <span>{goal.unit}</span>
        </div>
        <span className="hint">
          {metric(remaining, goal.unit)} to go. {goal.metric_type === 'days' ? 'One per day.' : ''}
        </span>
      </div>
      <div className="sheet__actions">
        <button className="btn btn--soft" onClick={() => setAmount(remaining)}>
          Mark it all done
        </button>
        <button className="btn btn--blue" onClick={submit}>
          Log it
        </button>
      </div>
    </Sheet>
  );
}

function ProofSheet({ goal, onClose }: { goal: Goal; onClose: () => void }) {
  const { update } = useStore();
  const { toast } = useFeedback();
  const [img, setImg] = useState<string>('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const onFile = async (f?: File) => {
    if (!f) return;
    if (!f.type.startsWith('image/')) return setErr('That file isn’t an image. Try a JPG or PNG.');
    setBusy(true);
    setErr('');
    try {
      setImg(await downscale(f));
    } catch {
      setErr('We couldn’t read that image. Try another one.');
    } finally {
      setBusy(false);
    }
  };
  const submit = () => {
    if (!img) return setErr('Add a photo first.');
    update((d) => submitVerification(d, goal.id, 1, note.trim() || `Session ${Math.floor(goal.current_value) + 1}`, img));
    toast('Proof submitted. Verification pending.');
    onClose();
  };
  return (
    <Sheet open onClose={onClose} title="Upload proof" sub={`One upload = 1 ${goal.unit.replace(/s$/, '')}. ${goal.verification_method === 'human' ? 'A Sogo reviewer checks it.' : 'Checked before it counts.'}`}>
      <input ref={fileRef} type="file" accept="image/*" capture="environment" className="sr-only" id="proof-file" onChange={(e) => onFile(e.target.files?.[0])} />
      {img ? (
        <div className="proof-preview">
          <img src={img} alt="Your proof photo preview" />
          <button className="btn btn--soft btn--sm" onClick={() => fileRef.current?.click()}>
            Replace photo
          </button>
        </div>
      ) : (
        <label htmlFor="proof-file" className="dropzone">
          <Icon name="camera" size={30} />
          <strong>{busy ? 'Reading photo…' : 'Take or choose a photo'}</strong>
          <span className="muted small">Workout, gym session, race result, scoreboard</span>
        </label>
      )}
      <div className="field" style={{ marginTop: 16 }}>
        <label htmlFor="proof-note" className="label">
          What was it?
        </label>
        <input id="proof-note" className="input" placeholder="Leg day, 5×5 squats" value={note} onChange={(e) => setNote(e.target.value)} maxLength={60} />
      </div>
      {err && (
        <p className="error-text" role="alert" style={{ marginTop: 10 }}>
          {err}
        </p>
      )}
      <div className="sheet__actions">
        <button className="btn btn--blue btn--lg" onClick={submit} disabled={busy}>
          Submit proof
        </button>
      </div>
    </Sheet>
  );
}

function EditSheet({ goal, onClose }: { goal: Goal; onClose: () => void }) {
  const { db, update } = useStore();
  const { toast } = useFeedback();
  const [title, setTitle] = useState(goal.title);
  const [description, setDescription] = useState(goal.description);
  const [visibility, setVisibility] = useState<Visibility>(goal.visibility);
  const [brand, setBrand] = useState(goal.reward_brand_id);
  const brands = [...featuredRewards(db), ...standardRewards(db)].filter((r) => r.availability !== 'unavailable').map((r) => brandById(db, r.brand_id)!);
  const hasBackers = db.backings.some((b) => b.goal_id === goal.id);
  return (
    <Sheet open onClose={onClose} title="Edit goal" sub="The target, deadline and stake are locked once you commit. That's the point.">
      <div className="field">
        <label className="label" htmlFor="eg-title">
          Name
        </label>
        <input id="eg-title" className="input" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={60} />
      </div>
      <div className="field">
        <label className="label" htmlFor="eg-desc">
          Why it matters <span className="muted" style={{ fontWeight: 500 }}>(optional)</span>
        </label>
        <textarea id="eg-desc" className="textarea" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={140} />
      </div>
      <div className="field">
        <span className="label" id="eg-vis">
          Who can see it?
        </span>
        <div className="segmented" role="group" aria-labelledby="eg-vis">
          {(['private', 'friends', 'public'] as Visibility[]).map((x) => (
            <button key={x} aria-pressed={visibility === x} onClick={() => setVisibility(x)} disabled={x === 'private' && hasBackers}>
              {x === 'private' ? 'Only me' : x === 'friends' ? 'Friends' : 'Everyone'}
            </button>
          ))}
        </div>
        {hasBackers && <span className="hint">People have backed this goal, so it can't go private.</span>}
      </div>
      <div className="field">
        <label className="label" htmlFor="eg-brand">
          Preferred prize
        </label>
        <select id="eg-brand" className="select" value={brand} onChange={(e) => setBrand(e.target.value)}>
          {brands.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
        <span className="hint">The sponsor match already placed stays with the original sponsor.</span>
      </div>
      <div className="sheet__actions">
        <button
          className="btn btn--lg"
          onClick={() => {
            if (!title.trim()) return;
            update((d) => editGoal(d, goal.id, { title: title.trim(), description, visibility, reward_brand_id: brand }));
            toast('Goal updated');
            onClose();
          }}
        >
          Save changes
        </button>
      </div>
      {rewardForBrand(db, brand)?.availability === 'limited' && <Notice tone="warn">Limited stock on this reward right now.</Notice>}
    </Sheet>
  );
}
