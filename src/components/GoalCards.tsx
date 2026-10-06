import type { Goal } from '../lib/types';
import { useStore } from '../lib/store';
import { goalView, type GoalView } from '../lib/selectors';
import { Link } from '../lib/router';
import { metric, money, pct, num } from '../lib/format';
import { daysLeftLabel } from '../lib/time';
import { CountUp, ProgressTrack, Ticket } from './ui';
import { Icon } from './Icon';

export function encouragement(v: GoalView): string {
  const p = Math.floor(v.pct);
  if (v.goal.status === 'completed') return 'You did it.';
  if (v.goal.status === 'failed') return "You didn't hit this one.";
  if (v.overdue) return "Time's up on this one.";
  if (p === 0) return 'Day one. Get the first one on the board.';
  if (p >= 95) return `You're ${p}% there. Finish it.`;
  if (p >= 80) return `You're ${p}% there. Finish strong.`;
  if (!v.onPace && v.daysLeft <= 7) return `You're ${p}% there. Time to push.`;
  return `You're ${p}% there. Keep going.`;
}

function scoreValue(n: number, unit: string) {
  return unit === 'km' ? n.toFixed(1) : num(n, 0);
}

export function GoalHero({ goal }: { goal: Goal }) {
  const { db } = useStore();
  const v = goalView(db, goal);
  const next = v.next;
  return (
    <article className="goal-hero on-dark" aria-labelledby={`gh-${goal.id}`}>
      <div className="goal-hero__head">
        <span className="goal-hero__emoji" aria-hidden>
          {goal.emoji}
        </span>
        <h2 id={`gh-${goal.id}`} className="goal-hero__title">
          {goal.title}
        </h2>
        <span className="goal-hero__days">
          <Icon name="clock" size={16} /> {daysLeftLabel(goal.end_date)}
        </span>
      </div>
      <div className="goal-hero__score">
        <span className="score goal-hero__big">
          <CountUp value={goal.current_value} format={(n) => scoreValue(n, goal.unit)} />
        </span>
        <span className="goal-hero__of">
          / {num(goal.target_value)} {goal.unit}
        </span>
      </div>
      <p className="goal-hero__line">{encouragement(v)}</p>
      <ProgressTrack value={goal.current_value} target={goal.target_value} milestones={v.milestones} variant="on-blue" label={`${pct(v.pct)} of ${goal.title}`} />
      <div className="goal-hero__foot">
        <Ticket
          value={<CountUp value={v.pool.total} format={(n) => money(n)} />}
          label={v.pool.backerCount ? `prize · ${v.pool.backerCount} backer${v.pool.backerCount > 1 ? 's' : ''}` : 'prize'}
          stub={v.secured > 0 && v.secured < v.pool.total ? money(v.secured) : undefined}
          stubLabel="secured"
          bump={v.pool.total}
        />
        <div className="goal-hero__next">
          {next ? (
            <>
              <span className="goal-hero__next-label">Next milestone</span>
              <span className="goal-hero__next-val">
                {metric(next.target_value, goal.unit)} → {money(next.is_final ? v.pool.total : next.reward_amount)} {next.is_final ? 'reward' : 'secured'}
              </span>
            </>
          ) : (
            <span className="goal-hero__next-val">Every milestone hit</span>
          )}
        </div>
        <Link to={`/goal/${goal.id}`} className="btn btn--white goal-hero__cta">
          View goal
        </Link>
      </div>
    </article>
  );
}

export function GoalRow({ goal, showOwner }: { goal: Goal; showOwner?: boolean }) {
  const { db } = useStore();
  const v = goalView(db, goal);
  const status =
    goal.status === 'completed' ? (
      <span className="chip chip--green">Done · {money(goal.settled_payout ?? v.pool.total)}</span>
    ) : goal.status === 'failed' ? (
      <span className="chip">Missed</span>
    ) : v.overdue ? (
      <span className="chip chip--sun">Time's up</span>
    ) : v.pendingVerifications ? (
      <span className="chip chip--blue">Verification pending</span>
    ) : (
      <span className="chip">{daysLeftLabel(goal.end_date)}</span>
    );
  return (
    <Link to={`/goal/${goal.id}`} className="goal-row">
      <span className="goal-row__emoji" aria-hidden>
        {goal.emoji}
      </span>
      <span className="goal-row__main">
        <span className="goal-row__title">
          {showOwner ? `${v.owner.name.split(' ')[0]} · ` : ''}
          {goal.title}
        </span>
        <span className="goal-row__meta">
          <span className="tnum">
            {metric(goal.current_value, goal.unit)} / {metric(goal.target_value, goal.unit)}
          </span>
          {status}
          {goal.visibility === 'private' && (
            <span className="chip" title="Only you can see this goal">
              <Icon name="lock" /> Private
            </span>
          )}
        </span>
        <ProgressTrack value={goal.current_value} target={goal.target_value} label={`${pct(v.pct)} complete`} thin variant={goal.status === 'completed' ? 'green' : undefined} />
      </span>
      <span className="goal-row__prize">
        <span className="score">{money(goal.status === 'active' ? v.pool.total : goal.settled_payout ?? 0)}</span>
        <span className="tiny muted">{goal.status === 'active' ? 'prize' : goal.status === 'completed' ? 'earned' : 'kept'}</span>
      </span>
    </Link>
  );
}
