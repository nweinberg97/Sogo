import { useStore } from '../lib/store';
import { Link } from '../lib/router';
import { achievements, me, myGoals, profileStats, wallet } from '../lib/selectors';
import { money } from '../lib/format';
import { shortDate } from '../lib/time';
import { Avatar, Empty } from '../components/ui';
import { GoalRow } from '../components/GoalCards';
import { Icon } from '../components/Icon';

export function Profile() {
  const { db } = useStore();
  const user = me(db);
  const s = profileStats(db, user.id);
  const goals = myGoals(db);
  const current = goals.filter((g) => g.status === 'active');
  const past = goals.filter((g) => g.status !== 'active').sort((a, b) => b.end_date.localeCompare(a.end_date));
  const ach = achievements(db, user.id);
  const w = wallet(db);

  return (
    <div className="page">
      <header className="profile-head">
        <Avatar user={user} size="xl" />
        <div>
          <h1 className="page__title">{user.name}</h1>
          <p className="muted">{user.bio || 'This is what I’m becoming.'}</p>
          <p className="tiny muted" style={{ marginTop: 4 }}>
            On Sogo since {shortDate(user.created_at)}
          </p>
        </div>
        <Link to="/settings" className="btn btn--soft btn--sm profile-head__edit">
          <Icon name="edit" size={16} /> Edit
        </Link>
      </header>

      <div className="stat-grid" style={{ marginTop: 24 }}>
        <div className="stat stat--blue">
          <div className="stat__value">{s.successRate === null ? '—' : `${s.successRate}%`}</div>
          <div className="stat__label">Success rate</div>
        </div>
        <div className="stat">
          <div className="stat__value">{s.completed}</div>
          <div className="stat__label">Goals completed</div>
        </div>
        <div className="stat">
          <div className="stat__value">{s.milestones}</div>
          <div className="stat__label">Milestones hit</div>
        </div>
        <div className="stat">
          <div className="stat__value">{s.propsReceived}</div>
          <div className="stat__label">Props received</div>
        </div>
        <div className="stat">
          <div className="stat__value">{s.challengesCompleted}</div>
          <div className="stat__label">Challenges finished</div>
        </div>
        <div className="stat">
          <div className="stat__value">{s.streak}</div>
          <div className="stat__label">Finished in a row</div>
        </div>
      </div>

      <Link to="/wallet" className="wallet-strip">
        <span>
          <Icon name="wallet" size={18} /> Earned
        </span>
        <strong className="tnum">{money(w.earned)}</strong>
        <span className="muted">·</span>
        <span>On the line</span>
        <strong className="tnum">{money(w.potential)}</strong>
        <Icon name="chevron" size={18} />
      </Link>

      <section className="section">
        <div className="section__head">
          <h2 className="section__title">Now</h2>
          <Link to="/new" className="link-btn">
            New goal
          </Link>
        </div>
        {current.length === 0 ? (
          <Empty title="No active goals" action={<Link to="/new" className="btn btn--sm">Start one</Link>}>
            What's the next thing you want to prove?
          </Empty>
        ) : (
          <div className="goal-rows">
            {current.map((g) => (
              <GoalRow key={g.id} goal={g} />
            ))}
          </div>
        )}
      </section>

      <section className="section">
        <h2 className="section__title" style={{ marginBottom: 12 }}>
          Achievements
        </h2>
        <div className="badges">
          {ach.map((a) => (
            <div key={a.id} className={`badge ${a.earned ? 'is-earned' : ''}`} aria-label={`${a.title}: ${a.description}${a.earned ? '' : ' (not yet earned)'}`}>
              <span className="badge__glyph" aria-hidden>
                {a.glyph}
              </span>
              <strong>{a.title}</strong>
              <span className="tiny muted">{a.description}</span>
            </div>
          ))}
        </div>
      </section>

      {past.length > 0 && (
        <section className="section">
          <h2 className="section__title" style={{ marginBottom: 12 }}>
            History
          </h2>
          <div className="goal-rows">
            {past.map((g) => (
              <GoalRow key={g.id} goal={g} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
