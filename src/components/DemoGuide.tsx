import { useState } from 'react';
import { useStore, signIn } from '../lib/store';
import { navigate } from '../lib/router';
import { myActiveGoals, myGoals } from '../lib/selectors';
import { addProgress, settle, simulateIncomingBacking, syncConnected } from '../lib/commands';
import { Sheet } from './ui';
import { Icon } from './Icon';
import { useFeedback } from './feedback';
import { metric } from '../lib/format';
import { ME } from '../lib/seed';

/** A guided path through the hero journey for portfolio / investor demos. */
export function DemoGuide() {
  const { db, update, replace } = useStore();
  const { toast } = useFeedback();
  const [open, setOpen] = useState(false);

  const mine = myGoals(db);
  const hero = mine.find((g) => g.id === 'g_run50') ?? myActiveGoals(db)[0] ?? mine[0];
  const backed = hero ? db.backings.some((b) => b.goal_id === hero.id && b.investor_id !== ME) : false;
  const done = hero ? hero.status === 'completed' : false;
  const claimed = hero ? db.goal_rewards.some((r) => r.goal_id === hero.id) : false;
  const shared = hero ? db.shares.some((s) => s.goal_id === hero.id && s.share_type === 'completed') : false;
  const missGoal = mine.find((g) => g.status === 'active' && g.id !== hero?.id);
  const missed = mine.some((g) => g.status === 'failed' && g.id !== 'g_meditate');

  const go = (to: string) => {
    setOpen(false);
    navigate(to);
  };

  type Step = { title: string; body: string; done: boolean; action: () => void; cta: string; disabled?: boolean };
  const steps: Step[] = hero
    ? [
        {
          title: 'Sync a run',
          body: `Pull your latest activity from ${hero.data_source ? 'your connected app' : 'Apple Health'} (simulated).`,
          done: hero.current_value > 34.2 || hero.id !== 'g_run50',
          cta: 'Sync now',
          disabled: hero.status !== 'active',
          action: () => {
            const r = update((d) => {
              const s = syncConnected(d, hero.id);
              if (!s.ok) return s;
              const amt = Math.min(s.amount, Math.max(0, hero.target_value - hero.current_value - 2.2) || s.amount);
              addProgress(d, hero.id, amt);
              return { ok: true as const, amount: amt };
            });
            if (r.ok) toast(`+${metric(r.amount, hero.unit)} synced`);
            else toast(r.reason, 'error');
            go(`/goal/${hero.id}`);
          },
        },
        {
          title: 'Jordan backs you',
          body: '$15 from Jordan, matched $15 by the sponsor. Watch the prize pool grow.',
          done: backed,
          cta: 'Send backing',
          disabled: backed || hero.status !== 'active',
          action: () => {
            update((d) => simulateIncomingBacking(d, hero.id));
            go(`/goal/${hero.id}`);
          },
        },
        {
          title: `Finish the ${metric(hero.target_value, hero.unit)}`,
          body: 'Sync the final stretch and complete the goal.',
          done,
          cta: 'Finish it',
          disabled: hero.status !== 'active',
          action: () => {
            update((d) => {
              const g = d.goals.find((x) => x.id === hero.id)!;
              addProgress(d, hero.id, g.target_value - g.current_value);
            });
            go(`/goal/${hero.id}`);
          },
        },
        {
          title: 'Choose your prize',
          body: 'Turn the pool into a reward you actually want.',
          done: claimed,
          cta: 'Choose',
          disabled: !done || claimed,
          action: () => go(`/claim/goal/${hero.id}`),
        },
        {
          title: 'Share your win',
          body: 'Generate the 9:16 story card.',
          done: shared,
          cta: 'Open share',
          disabled: !done,
          action: () => go(`/share/completed/${hero.id}`),
        },
      ]
    : [];

  const extras: Step[] = [
    {
      title: 'See what a miss looks like',
      body: missGoal ? `End “${missGoal.title}” at its current progress.` : 'Start another goal first.',
      done: missed,
      cta: 'End it',
      disabled: !missGoal,
      action: () => {
        if (!missGoal) return;
        update((d) => settle(d, missGoal.id, false));
        go(`/goal/${missGoal.id}`);
      },
    },
    { title: 'Brand takeover challenge', body: 'Nike Hoops, as a concept campaign.', done: false, cta: 'Open', action: () => go('/c/nike-hoops') },
    { title: 'Make the game matter', body: 'Friday Night Basketball, team stakes.', done: false, cta: 'Open', action: () => go('/c/friday-night') },
    { title: 'Sponsor dashboard', body: 'What brands see and buy.', done: false, cta: 'Open', action: () => go('/sponsor') },
  ];

  return (
    <>
      <button className="demo-fab" onClick={() => setOpen(true)} aria-haspopup="dialog">
        <Icon name="sparkle" size={18} />
        Demo guide
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title="Demo guide" sub="Walk the full Sogo loop in about a minute. Everything here is simulated.">
        {steps.length > 0 && (
          <ol className="demo-steps">
            {steps.map((s, i) => (
              <li key={s.title} className={s.done ? 'is-done' : ''}>
                <span className="demo-steps__n" aria-hidden>
                  {s.done ? <Icon name="check" size={16} /> : i + 1}
                </span>
                <div className="demo-steps__main">
                  <strong>{s.title}</strong>
                  <span className="muted small">{s.body}</span>
                </div>
                <button className="btn btn--sm" onClick={s.action} disabled={s.disabled}>
                  {s.done && !s.disabled ? 'Again' : s.cta}
                </button>
              </li>
            ))}
          </ol>
        )}
        <h3 style={{ fontSize: 17, margin: '22px 0 8px' }}>More to explore</h3>
        <ul className="demo-steps demo-steps--plain">
          {extras.map((s) => (
            <li key={s.title}>
              <div className="demo-steps__main">
                <strong>{s.title}</strong>
                <span className="muted small">{s.body}</span>
              </div>
              <button className="btn btn--soft btn--sm" onClick={s.action} disabled={s.disabled}>
                {s.cta}
              </button>
            </li>
          ))}
        </ul>
        <hr className="divider" />
        <button
          className="link-btn"
          onClick={() => {
            signIn(replace, { kind: 'demo' });
            toast('Demo reset. You are Mark again.');
            go('/home');
          }}
        >
          Reset the demo
        </button>
      </Sheet>
    </>
  );
}
