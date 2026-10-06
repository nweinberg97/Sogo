import { useState } from 'react';
import { useStore } from '../lib/store';
import { Link, navigate } from '../lib/router';
import {
  brandById,
  challengeView,
  claimablePrizes,
  featuredRewards,
  friends,
  goalView,
  me,
  myActiveGoals,
  visibleGoals,
} from '../lib/selectors';
import { markMoment } from '../lib/commands';
import { firstName, metric, money, pct } from '../lib/format';
import { greeting, relTime } from '../lib/time';
import type { Goal } from '../lib/types';
import { GoalHero, GoalRow } from '../components/GoalCards';
import { ChallengeCard } from '../components/ChallengeCard';
import { Avatar, BrandTile, Empty } from '../components/ui';
import { Icon } from '../components/Icon';
import { BackSheet, PropsSheet } from '../components/SocialSheets';
import { ME } from '../lib/seed';

export const QUICK_GOALS = [
  { key: 'run50', emoji: '🏃', title: 'Run 50 km', sub: 'in 30 days' },
  { key: 'steps', emoji: '🚶', title: 'Walk 100,000 steps', sub: 'in 14 days' },
  { key: 'workouts', emoji: '🏋️', title: 'Complete 12 workouts', sub: 'in 30 days' },
  { key: 'sleep', emoji: '🌙', title: 'Sleep 7+ hours, 20 nights', sub: 'in 30 days' },
];

function Moment() {
  // The single most important unseen moment across my goals.
  const { db, update } = useStore();
  const goals = myActiveGoals(db);
  for (const g of goals) {
    const v = goalView(db, g);
    const backing = v.backings.find((b) => b.investor_id !== ME && !g.seen_moments.includes(`backing:${b.id}`));
    if (backing) {
      const who = firstName(db.users.find((u) => u.id === backing.investor_id)?.name ?? 'Someone');
      return (
        <MomentCard
          tone="sun"
          emoji="💰"
          title={`${who} just backed your goal.`}
          body={`${money(backing.amount)} from ${who} + ${money(backing.sponsor_match)} sponsor match. Your prize is now ${money(v.pool.total)}.`}
          primary={{ label: 'Share', to: `/share/backed/${g.id}` }}
          onOpen={() => navigate(`/goal/${g.id}`)}
          onDismiss={() => update((d) => markMoment(d, g.id, `backing:${backing.id}`))}
        />
      );
    }
    const m = v.milestones.find((x) => x.status === 'reached' && !x.is_final && x.reward_amount > 0 && !g.seen_moments.includes(`milestone:${x.id}`));
    if (m) {
      return (
        <MomentCard
          tone="blue"
          emoji="🎉"
          title={`${metric(m.target_value, g.unit)} down.`}
          body={`You unlocked the ${m.title.toLowerCase()} milestone on ${g.title}. ${money(m.reward_amount)} is secured, whatever happens next.`}
          primary={{ label: 'Share milestone', to: `/share/milestone/${g.id}` }}
          onOpen={() => navigate(`/goal/${g.id}`)}
          onDismiss={() => update((d) => markMoment(d, g.id, `milestone:${m.id}`))}
        />
      );
    }
  }
  const { goals: claimGoals, challenges } = claimablePrizes(db);
  if (claimGoals[0]) {
    const g = claimGoals[0];
    return (
      <MomentCard
        tone="sun"
        emoji="🎁"
        title={g.status === 'completed' ? `${money(g.settled_payout ?? 0)} earned.` : `${money(g.settled_payout ?? 0)} kept.`}
        body={`Your reward from ${g.title} is waiting. Choose your prize.`}
        primary={{ label: 'Choose your prize', to: `/claim/goal/${g.id}` }}
      />
    );
  }
  if (challenges[0]) {
    const c = challenges[0];
    return (
      <MomentCard
        tone="sun"
        emoji="🏆"
        title={`${money(c.claimable)} earned.`}
        body={`You finished ${c.challenge.title}. Choose your prize.`}
        primary={{ label: 'Choose your prize', to: `/claim/challenge/${c.challenge.id}` }}
      />
    );
  }
  return null;
}

function MomentCard({
  tone,
  emoji,
  title,
  body,
  primary,
  onOpen,
  onDismiss,
}: {
  tone: 'blue' | 'sun';
  emoji: string;
  title: string;
  body: string;
  primary: { label: string; to: string };
  onOpen?: () => void;
  onDismiss?: () => void;
}) {
  return (
    <section className={`moment moment--${tone} ${tone === 'blue' ? 'on-dark' : ''}`} aria-label="New moment">
      <span className="moment__emoji" aria-hidden>
        {emoji}
      </span>
      <div className="moment__main">
        <h2 className="moment__title">{title}</h2>
        <p>{body}</p>
        <div className="moment__actions">
          <Link to={primary.to} className={`btn btn--sm ${tone === 'blue' ? 'btn--sun' : ''}`} onClick={() => onDismiss?.()}>
            {primary.label}
          </Link>
          {onOpen && (
            <button
              className="btn btn--sm btn--ghost"
              style={{ color: 'inherit', boxShadow: 'inset 0 0 0 2px currentColor' }}
              onClick={() => {
                onDismiss?.();
                onOpen();
              }}
            >
              View goal
            </button>
          )}
        </div>
      </div>
      {onDismiss && (
        <button className="icon-btn moment__x" onClick={onDismiss} aria-label="Dismiss">
          <Icon name="x" size={18} />
        </button>
      )}
    </section>
  );
}

function PeopleStrip() {
  const { db } = useStore();
  const [propsFor, setPropsFor] = useState<Goal | null>(null);
  const [backFor, setBackFor] = useState<Goal | null>(null);
  const fr = friends(db);
  const items = fr
    .flatMap((u) => visibleGoals(db, u.id).filter((g) => g.status === 'active'))
    .map((g) => ({ g, v: goalView(db, g) }))
    .sort((a, b) => b.v.pct - a.v.pct)
    .slice(0, 3);

  if (fr.length === 0)
    return (
      <Empty title="Sogo is better with your people" action={<Link to="/people" className="btn btn--sm">Find friends</Link>}>
        Friends can give you Props and back your goals.
      </Empty>
    );
  if (items.length === 0) return <p className="muted">None of your friends have an active goal right now.</p>;

  return (
    <>
      <ul className="list people-strip">
        {items.map(({ g, v }) => {
          const lastProp = v.props[0];
          return (
            <li key={g.id} className="person-update">
              <Link to={`/u/${g.user_id}`} aria-label={v.owner.name}>
                <Avatar user={v.owner} />
              </Link>
              <div className="person-update__main">
                <Link to={`/goal/${g.id}`} className="person-update__title">
                  {firstName(v.owner.name)} {v.pct >= 90 ? 'is almost there' : `just hit ${pct(v.pct)}`}
                </Link>
                <span className="muted small">
                  “{g.title}” · {money(v.pool.total)} prize{lastProp ? ` · Props ${relTime(lastProp.created_at)}` : ''}
                </span>
              </div>
              <div className="person-update__actions">
                <button className="btn btn--soft btn--sm" onClick={() => setPropsFor(g)}>
                  Give Props
                </button>
                <button className="btn btn--sm btn--ghost person-update__back" onClick={() => setBackFor(g)}>
                  Back
                </button>
              </div>
            </li>
          );
        })}
      </ul>
      {propsFor && <PropsSheet goal={propsFor} open onClose={() => setPropsFor(null)} />}
      {backFor && <BackSheet goal={backFor} open onClose={() => setBackFor(null)} />}
    </>
  );
}

export function Home() {
  const { db } = useStore();
  const user = me(db);
  const active = myActiveGoals(db);
  const [primary, ...rest] = active;
  const primaryBrand = primary ? brandById(db, primary.reward_brand_id) : undefined;
  const featured = featuredRewards(db);
  const discover = db.challenges
    .map((c) => challengeView(db, c))
    .filter((v) => v.status !== 'ended' && !v.joined && !v.isFull)
    .sort((a, b) => Number(Boolean(b.challenge.takeover)) - Number(Boolean(a.challenge.takeover)))
    .slice(0, 2);
  const joined = db.challenges.map((c) => challengeView(db, c)).filter((v) => v.joined && v.status !== 'ended');

  return (
    <div className="page page--home">
      <header className="home__head">
        <p className="home__greet">
          {greeting()}, {firstName(user.name)}
        </p>
        {active.length > 0 && (
          <p className="home__sub">
            {active.length === 1 ? 'One goal in play.' : `${active.length} goals in play.`}{' '}
            <span className="tnum">{money(active.reduce((s, g) => s + goalView(db, g).pool.total, 0))}</span> on the line for you.
          </p>
        )}
      </header>

      <Moment />

      {primary ? (
        <section aria-label="Your goals" className="home__goals">
          <GoalHero goal={primary} />
          {rest.length > 0 && (
            <div className="home__rest">
              {rest.map((g) => (
                <GoalRow key={g.id} goal={g} />
              ))}
            </div>
          )}
          {joined.length > 0 && (
            <div className="home__joined">
              {joined.map((v) => (
                <Link key={v.challenge.id} to={`/c/${v.challenge.id}`} className="joined-row">
                  <span aria-hidden>{v.challenge.emoji}</span>
                  <span className="joined-row__main">
                    <strong>{v.challenge.takeover?.headline ?? v.challenge.title}</strong>
                    <span className="muted small">
                      {v.mine?.progress.toLocaleString()} / {v.challenge.target_value.toLocaleString()} {v.challenge.unit}
                    </span>
                  </span>
                  <Icon name="chevron" size={18} />
                </Link>
              ))}
            </div>
          )}
        </section>
      ) : (
        <section className="start-card" aria-labelledby="start-title">
          <h2 id="start-title" className="start-card__title">
            What are you going after?
          </h2>
          <p>Pick a goal, put something on it, and Sogo's sponsor matches you dollar for dollar.</p>
          <div className="quick-goals">
            {QUICK_GOALS.map((q) => (
              <Link key={q.key} to={`/new?template=${q.key}`} className="quick-goal">
                <span aria-hidden>{q.emoji}</span>
                <strong>{q.title}</strong>
                <span className="muted small">{q.sub}</span>
              </Link>
            ))}
          </div>
          <Link to="/new" className="btn btn--sun btn--lg btn--commit">
            Start betting on yourself
          </Link>
        </section>
      )}

      {primary && (
        <section className="section" aria-labelledby="reward-h">
          <div className="section__head">
            <h2 id="reward-h" className="section__title">
              Your reward
            </h2>
            <Link to="/rewards" className="link-btn">
              Choose your prize
            </Link>
          </div>
          <div className="reward-strip">
            {[primaryBrand, ...featured.map((r) => brandById(db, r.brand_id))]
              .filter((b, i, arr) => b && arr.findIndex((x) => x?.id === b.id) === i)
              .slice(0, 4)
              .map((b, i) => (
                <Link key={b!.id} to="/rewards" className={`reward-chip ${i === 0 ? 'is-picked' : ''}`}>
                  <BrandTile brand={b!} size={46} />
                  <span>
                    <strong>{b!.name}</strong>
                    <span className="muted small">{i === 0 ? 'Your pick' : 'Featured'}</span>
                  </span>
                  <span className="score reward-chip__val">{money(goalView(db, primary).pool.total)}</span>
                </Link>
              ))}
          </div>
        </section>
      )}

      <section className="section" aria-labelledby="people-h">
        <div className="section__head">
          <h2 id="people-h" className="section__title">
            Your people
          </h2>
          <Link to="/people" className="link-btn">
            See all
          </Link>
        </div>
        <PeopleStrip />
      </section>

      <section className="section" aria-labelledby="disc-h">
        <div className="section__head">
          <h2 id="disc-h" className="section__title">
            Discover
          </h2>
          <Link to="/discover" className="link-btn">
            All challenges
          </Link>
        </div>
        <div className="cgrid cgrid--2">
          {discover.map((v) => (
            <ChallengeCard key={v.challenge.id} challenge={v.challenge} />
          ))}
        </div>
      </section>
    </div>
  );
}
