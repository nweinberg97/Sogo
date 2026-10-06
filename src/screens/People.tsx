import { useState } from 'react';
import { useStore } from '../lib/store';
import { Link, shareUrl } from '../lib/router';
import { friends, goalView, isFriend, visibleGoals } from '../lib/selectors';
import { firstName, money, pct } from '../lib/format';
import { daysLeftLabel } from '../lib/time';
import type { Goal } from '../lib/types';
import { Avatar, Empty, ProgressTrack } from '../components/ui';
import { Icon } from '../components/Icon';
import { BackSheet, PropsSheet } from '../components/SocialSheets';
import { useFeedback } from '../components/feedback';
import { ME } from '../lib/seed';

export function People() {
  const { db, update } = useStore();
  const { toast } = useFeedback();
  const [propsFor, setPropsFor] = useState<Goal | null>(null);
  const [backFor, setBackFor] = useState<Goal | null>(null);
  const fr = friends(db);
  const suggested = db.users.filter((u) => u.id !== ME && !isFriend(db, u.id) && u.id.startsWith('u_')).slice(0, 4);

  const invite = async () => {
    const url = shareUrl('/login');
    const text = 'I’m betting on myself on Sogo. Come put something on your goal.';
    try {
      if (navigator.share) await navigator.share({ title: 'Join me on Sogo', text, url });
      else {
        await navigator.clipboard.writeText(`${text} ${url}`);
        toast('Invite link copied');
      }
    } catch {
      /* user cancelled */
    }
  };

  return (
    <div className="page">
      <header className="page__head">
        <h1 className="page__title">Your people</h1>
        <p className="page__sub">The people rooting for you, and the ones you're rooting for.</p>
      </header>

      {fr.length === 0 ? (
        <Empty title="No one here yet" action={<button className="btn btn--sm" onClick={invite}>Invite a friend</button>}>
          Sogo works best with a few people in your corner. Invite someone who'll actually check on you.
        </Empty>
      ) : (
        <ul className="list friend-list">
          {fr.map((u) => {
            const goals = visibleGoals(db, u.id).filter((g) => g.status === 'active');
            return (
              <li key={u.id} className="friend">
                <div className="friend__head">
                  <Link to={`/u/${u.id}`} className="friend__who">
                    <Avatar user={u} />
                    <span>
                      <strong>{u.name}</strong>
                      <span className="muted small" style={{ display: 'block' }}>
                        {u.city ?? 'Sogo'} · {goals.length ? `${goals.length} active goal${goals.length > 1 ? 's' : ''}` : 'No active goals'}
                      </span>
                    </span>
                  </Link>
                </div>
                {goals.map((g) => {
                  const v = goalView(db, g);
                  const iBacked = v.backings.some((b) => b.investor_id === ME);
                  return (
                    <div key={g.id} className="friend__goal">
                      <Link to={`/goal/${g.id}`} className="friend__goal-main">
                        <span className="friend__goal-title">
                          <span aria-hidden>{g.emoji}</span> {g.title}
                        </span>
                        <span className="muted small">
                          {pct(v.pct)} · {money(v.pool.total)} prize · {daysLeftLabel(g.end_date)}
                        </span>
                        <ProgressTrack value={g.current_value} target={g.target_value} label={`${firstName(u.name)}: ${pct(v.pct)}`} thin />
                      </Link>
                      <div className="friend__actions">
                        <button className="btn btn--soft btn--sm" onClick={() => setPropsFor(g)}>
                          Give Props
                        </button>
                        <button className="btn btn--sm" onClick={() => setBackFor(g)}>
                          {iBacked ? 'Back again' : 'Back them'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </li>
            );
          })}
        </ul>
      )}

      <section className="section">
        <div className="section__head">
          <h2 className="section__title">Bring someone in</h2>
        </div>
        <div className="invite-card">
          <div>
            <strong>Invite a friend</strong>
            <p className="muted small">When they start a goal, you'll both see each other's progress.</p>
          </div>
          <button className="btn btn--blue" onClick={invite}>
            <Icon name="share" size={18} /> Invite
          </button>
        </div>
      </section>

      {suggested.length > 0 && (
        <section className="section">
          <div className="section__head">
            <h2 className="section__title">People in your challenges</h2>
          </div>
          <ul className="list">
            {suggested.map((u) => (
              <li key={u.id} className="row">
                <Avatar user={u} size="sm" />
                <div className="row__main">
                  <Link to={`/u/${u.id}`} className="row__title" style={{ textDecoration: 'none' }}>
                    {u.name}
                  </Link>
                </div>
                <button
                  className="btn btn--soft btn--sm"
                  onClick={() => {
                    update((d) => d.friendships.push({ user_id: ME, friend_id: u.id }));
                    toast(`You and ${firstName(u.name)} are connected`);
                  }}
                >
                  Add friend
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {propsFor && <PropsSheet goal={propsFor} open onClose={() => setPropsFor(null)} />}
      {backFor && <BackSheet goal={backFor} open onClose={() => setBackFor(null)} />}
    </div>
  );
}
