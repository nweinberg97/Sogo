import { useState } from 'react';
import { useStore } from '../lib/store';
import { Link } from '../lib/router';
import { brandById, challengeView, featuredRewards, friends, goalView, visibleGoals } from '../lib/selectors';
import type { Challenge } from '../lib/types';
import { ChallengeCard } from '../components/ChallengeCard';
import { GoalRow } from '../components/GoalCards';
import { BrandTile, Empty } from '../components/ui';
import { Icon } from '../components/Icon';
import { money } from '../lib/format';

const FILTERS: { id: 'all' | Challenge['category']; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'running', label: 'Running' },
  { id: 'basketball', label: 'Basketball' },
  { id: 'strength', label: 'Strength' },
  { id: 'walking', label: 'Walking' },
  { id: 'cycling', label: 'Cycling' },
  { id: 'wellness', label: 'Wellness' },
  { id: 'hiking', label: 'Outdoors' },
];

const POPULAR = [
  { key: 'run50', emoji: '🏃', title: 'Run 50 km in 30 days', people: 1284 },
  { key: 'steps', emoji: '🚶', title: 'Walk 100,000 steps in 14 days', people: 2310 },
  { key: 'workouts', emoji: '🏋️', title: 'Complete 12 workouts', people: 978 },
  { key: 'sleep', emoji: '🌙', title: 'Sleep 7+ hours for 20 nights', people: 642 },
];

export function Discover() {
  const { db } = useStore();
  const [filter, setFilter] = useState<(typeof FILTERS)[number]['id']>('all');
  const views = db.challenges.map((c) => challengeView(db, c));
  const sponsored = views.filter((v) => v.challenge.takeover && v.status !== 'ended');
  const sports = views.filter((v) => (v.challenge.format === 'team' || v.challenge.format === 'head_to_head') && v.status !== 'ended');
  const open = views
    .filter((v) => v.status !== 'ended' && !v.challenge.takeover && v.challenge.format !== 'team' && v.challenge.format !== 'head_to_head')
    .filter((v) => filter === 'all' || v.challenge.category === filter);
  const brandFiltered = views.filter((v) => v.challenge.takeover && v.status !== 'ended' && filter !== 'all' && v.challenge.category === filter);
  const ended = views.filter((v) => v.status === 'ended');
  const friendGoals = friends(db)
    .flatMap((u) => visibleGoals(db, u.id))
    .filter((g) => g.status === 'active')
    .sort((a, b) => goalView(db, b).pct - goalView(db, a).pct)
    .slice(0, 3);

  return (
    <div className="page">
      <header className="page__head page__head--row">
        <div>
          <h1 className="page__title">Discover</h1>
          <p className="page__sub">Every challenge has a finish line you can measure.</p>
        </div>
        <Link to="/challenges/new" className="btn btn--blue">
          <Icon name="plus" size={18} /> Group challenge
        </Link>
      </header>

      <section aria-labelledby="brand-h">
        <div className="section__head">
          <h2 id="brand-h" className="section__title">
            Brand challenges
          </h2>
          <span className="tiny muted">Concept campaigns · not affiliated</span>
        </div>
        <div className="hscroll">
          {sponsored.map((v) => (
            <ChallengeCard key={v.challenge.id} challenge={v.challenge} />
          ))}
        </div>
      </section>

      <section className="section" aria-labelledby="open-h">
        <div className="section__head">
          <h2 id="open-h" className="section__title">
            Challenges
          </h2>
        </div>
        <div className="filters" role="group" aria-label="Filter by category">
          {FILTERS.map((f) => (
            <button key={f.id} className="pill-choice pill-choice--sm" aria-pressed={filter === f.id} onClick={() => setFilter(f.id)}>
              {f.label}
            </button>
          ))}
        </div>
        {open.length + brandFiltered.length === 0 ? (
          <Empty title="Nothing in this category yet" action={<Link to="/challenges/new" className="btn btn--sm">Start one</Link>}>
            Start a challenge and invite your people. Make it specific.
          </Empty>
        ) : (
          <div className="cgrid">
            {[...brandFiltered, ...open].map((v) => (
              <ChallengeCard key={v.challenge.id} challenge={v.challenge} />
            ))}
          </div>
        )}
      </section>

      <section className="section sports" aria-labelledby="sports-h">
        <div className="sports__head on-dark">
          <div>
            <h2 id="sports-h" className="sports__title">
              Make the game matter.
            </h2>
            <p>Pickup games, 1v1s, team nights. Everyone puts in, the result decides it.</p>
          </div>
          <Link to="/challenges/new?format=team" className="btn btn--sun">
            Start a game
          </Link>
        </div>
        <div className="cgrid cgrid--2" style={{ marginTop: 14 }}>
          {sports.map((v) => (
            <ChallengeCard key={v.challenge.id} challenge={v.challenge} />
          ))}
        </div>
      </section>

      <section className="section" aria-labelledby="pop-h">
        <div className="section__head">
          <h2 id="pop-h" className="section__title">
            Popular goals
          </h2>
        </div>
        <div className="popular">
          {POPULAR.map((p) => (
            <Link key={p.key} to={`/new?template=${p.key}`} className="popular__item">
              <span className="popular__emoji" aria-hidden>
                {p.emoji}
              </span>
              <span className="popular__main">
                <strong>{p.title}</strong>
                <span className="muted small">{p.people.toLocaleString()} people this month</span>
              </span>
              <Icon name="chevron" size={18} />
            </Link>
          ))}
        </div>
      </section>

      {friendGoals.length > 0 && (
        <section className="section" aria-labelledby="fg-h">
          <div className="section__head">
            <h2 id="fg-h" className="section__title">
              Friends' goals
            </h2>
            <Link to="/people" className="link-btn">
              Your people
            </Link>
          </div>
          <div className="goal-rows">
            {friendGoals.map((g) => (
              <GoalRow key={g.id} goal={g} showOwner />
            ))}
          </div>
        </section>
      )}

      <section className="section" aria-labelledby="fr-h">
        <div className="section__head">
          <h2 id="fr-h" className="section__title">
            Featured rewards
          </h2>
          <Link to="/rewards" className="link-btn">
            All rewards
          </Link>
        </div>
        <div className="reward-strip">
          {featuredRewards(db).map((r) => {
            const b = brandById(db, r.brand_id)!;
            return (
              <Link key={r.id} to="/rewards" className="reward-chip">
                <BrandTile brand={b} size={46} />
                <span>
                  <strong>{b.name}</strong>
                  <span className="muted small">{r.tagline}</span>
                </span>
              </Link>
            );
          })}
        </div>
      </section>

      {ended.length > 0 && (
        <section className="section" aria-labelledby="end-h">
          <div className="section__head">
            <h2 id="end-h" className="section__title">
              Recently ended
            </h2>
          </div>
          <div className="cgrid">
            {ended.map((v) => (
              <ChallengeCard key={v.challenge.id} challenge={v.challenge} compact />
            ))}
          </div>
          <p className="tiny muted" style={{ marginTop: 8 }}>
            {money(ended.reduce((s, v) => s + v.econ.pool, 0))} in prize pools across ended challenges.
          </p>
        </section>
      )}
    </div>
  );
}
