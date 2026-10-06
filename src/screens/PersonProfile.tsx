import { useStore } from '../lib/store';
import { back } from '../lib/router';
import { Profile } from './Profile';
import { achievements, isFriend, profileStats, userById, visibleGoals } from '../lib/selectors';
import { firstName } from '../lib/format';
import { ME } from '../lib/seed';
import { Avatar, BackButton, Empty } from '../components/ui';
import { GoalRow } from '../components/GoalCards';
import { useFeedback } from '../components/feedback';
import { NotFound } from './NotFound';

export function PersonProfile({ id }: { id: string }) {
  const { db, update } = useStore();
  const { toast } = useFeedback();
  if (id === ME) return <Profile />;
  const u = db.users.find((x) => x.id === id);
  if (!u) return <NotFound />;
  const user = userById(db, id);
  const friend = isFriend(db, id);
  const goals = visibleGoals(db, id);
  const hidden = db.goals.filter((g) => g.user_id === id).length - goals.length;
  const s = profileStats(db, id);
  const earned = achievements(db, id).filter((a) => a.earned);

  return (
    <div className="page">
      <div className="page__bar">
        <BackButton onClick={() => back('/people')} />
      </div>
      <header className="profile-head">
        <Avatar user={user} size="xl" />
        <div>
          <h1 className="page__title">{user.name}</h1>
          {user.bio && <p className="muted">{user.bio}</p>}
          <div style={{ marginTop: 12 }}>
            {friend ? (
              <button
                className="btn btn--soft btn--sm"
                onClick={() => {
                  update((d) => {
                    d.friendships = d.friendships.filter((f) => !(f.user_id === ME && f.friend_id === id));
                  });
                  toast(`Removed ${firstName(user.name)}`);
                }}
              >
                Friends ✓
              </button>
            ) : (
              <button
                className="btn btn--blue btn--sm"
                onClick={() => {
                  update((d) => d.friendships.push({ user_id: ME, friend_id: id }));
                  toast(`You and ${firstName(user.name)} are connected`);
                }}
              >
                Add friend
              </button>
            )}
          </div>
        </div>
      </header>

      <div className="stat-grid" style={{ marginTop: 22 }}>
        <div className="stat">
          <div className="stat__value">{s.active}</div>
          <div className="stat__label">Active goals</div>
        </div>
        <div className="stat">
          <div className="stat__value">{s.completed}</div>
          <div className="stat__label">Completed</div>
        </div>
        <div className="stat">
          <div className="stat__value">{s.propsReceived}</div>
          <div className="stat__label">Props received</div>
        </div>
      </div>

      <section className="section">
        <h2 className="section__title" style={{ marginBottom: 12 }}>
          Goals
        </h2>
        {goals.length === 0 ? (
          <Empty title={friend ? 'Nothing shared yet' : 'Goals are friends-only'}>
            {friend ? `${firstName(user.name)} hasn't shared a goal.` : `Add ${firstName(user.name)} to see their goals.`}
          </Empty>
        ) : (
          <div className="goal-rows">
            {goals.map((g) => (
              <GoalRow key={g.id} goal={g} />
            ))}
          </div>
        )}
        {hidden > 0 && friend && (
          <p className="tiny muted" style={{ marginTop: 10 }}>
            {hidden} private goal{hidden > 1 ? 's' : ''} not shown.
          </p>
        )}
      </section>

      {earned.length > 0 && (
        <section className="section">
          <h2 className="section__title" style={{ marginBottom: 12 }}>
            Achievements
          </h2>
          <div className="badges">
            {earned.map((a) => (
              <div key={a.id} className="badge is-earned">
                <span className="badge__glyph">{a.glyph}</span>
                <strong>{a.title}</strong>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
