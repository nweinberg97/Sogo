import { useStore } from '../lib/store';
import { Link } from '../lib/router';
import { canSeeGoal, userById } from '../lib/selectors';
import { firstName } from '../lib/format';
import { relTime } from '../lib/time';
import { ME } from '../lib/seed';
import { Avatar, Empty } from '../components/ui';

const DAY = 86_400_000;

export function Activity() {
  const { db } = useStore();
  const cutoff = Date.now() - 14 * DAY;
  const items = db.activity
    .filter((a) => new Date(a.created_at).getTime() >= cutoff)
    .filter((a) => {
      if (!a.goal_id) return true;
      const g = db.goals.find((x) => x.id === a.goal_id);
      return !g || canSeeGoal(db, g);
    })
    .slice(0, 30);

  const groups: { label: string; items: typeof items }[] = [
    { label: 'Today', items: items.filter((a) => Date.now() - new Date(a.created_at).getTime() < DAY) },
    { label: 'This week', items: items.filter((a) => { const d = Date.now() - new Date(a.created_at).getTime(); return d >= DAY && d < 7 * DAY; }) },
    { label: 'Earlier', items: items.filter((a) => Date.now() - new Date(a.created_at).getTime() >= 7 * DAY) },
  ].filter((g) => g.items.length);

  return (
    <div className="page page--narrow">
      <header className="page__head">
        <h1 className="page__title">Activity</h1>
        <p className="page__sub">What your people did. Two weeks, then it's gone. Go do your thing.</p>
      </header>
      {items.length === 0 ? (
        <Empty title="Quiet in here" action={<Link to="/people" className="btn btn--sm">Find your people</Link>}>
          When friends hit milestones or back someone, you'll see it here.
        </Empty>
      ) : (
        groups.map((grp) => (
          <section key={grp.label} className="activity-group" aria-label={grp.label}>
            <h2 className="activity-group__label">{grp.label}</h2>
            <ul className="list">
              {grp.items.map((a) => {
                const actor = a.actor_id === 'system' ? null : userById(db, a.actor_id);
                const href = a.goal_id ? `/goal/${a.goal_id}` : a.challenge_id ? `/c/${a.challenge_id}` : '/home';
                return (
                  <li key={a.id}>
                    <Link to={href} className="row row--link activity-item">
                      {actor ? <Avatar user={actor} size="sm" /> : <span className="activity-item__sys" aria-hidden>{a.emoji}</span>}
                      <span className="row__main">
                        <span className="row__title" style={{ fontWeight: 500 }}>
                          <strong>{actor ? (actor.id === ME ? 'You' : firstName(actor.name)) : ''}</strong> {a.verb}
                        </span>
                        <span className="row__meta" style={{ display: 'block' }}>
                          {relTime(a.created_at)}
                        </span>
                      </span>
                      {actor && <span aria-hidden>{a.emoji}</span>}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        ))
      )}
      {items.length > 0 && <p className="activity-end">You're all caught up.</p>}
    </div>
  );
}
