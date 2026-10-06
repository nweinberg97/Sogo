import { useStore } from '../lib/store';
import { Link } from '../lib/router';
import { brandById, claimablePrizes, featuredRewards, standardRewards } from '../lib/selectors';
import { money } from '../lib/format';
import { shortDate } from '../lib/time';
import type { Reward } from '../lib/types';
import { BrandTile, Notice } from '../components/ui';
import { Icon } from '../components/Icon';

export function Rewards() {
  const { db } = useStore();
  const featured = featuredRewards(db);
  const more = standardRewards(db);
  const openSlots = db.slots.filter((s) => s.status === 'available');
  const { goals, challenges } = claimablePrizes(db);
  const mine = db.goal_rewards.slice().reverse();
  const anyAvailable = [...featured, ...more].some((r) => r.availability !== 'unavailable');

  const Card = ({ r, slot }: { r: Reward; slot?: number }) => {
    const b = brandById(db, r.brand_id)!;
    const off = r.availability === 'unavailable';
    return (
      <article className={`rcard ${off ? 'is-off' : ''} ${slot ? 'rcard--featured' : ''}`}>
        <BrandTile brand={b} size={slot ? 84 : 60} />
        <div className="rcard__main">
          <h3 className="rcard__title">{b.name}</h3>
          <p className="muted small">{r.title}</p>
          <div className="rcard__tags">
            {slot ? <span className="chip chip--sun">Featured placement</span> : null}
            {r.sponsor_campaign_id && !slot && <span className="chip">Sponsored reward</span>}
            {r.availability === 'limited' && <span className="chip chip--pink">Limited</span>}
            {off && <span className="chip">Out of stock</span>}
            {!off && <span className="chip chip--outline">{r.tagline}</span>}
          </div>
        </div>
        <span className="rcard__values tnum">{off ? 'Back next month' : 'Any amount you earn'}</span>
      </article>
    );
  };

  return (
    <div className="page">
      <header className="page__head">
        <h1 className="page__title">Choose your prize</h1>
        <p className="page__sub">Finish a goal and turn the prize pool into something you actually want.</p>
      </header>

      {(goals.length > 0 || challenges.length > 0) && (
        <section className="claim-list" aria-label="Rewards waiting">
          {goals.map((g) => (
            <Link key={g.id} to={`/claim/goal/${g.id}`} className="claim-item">
              <span aria-hidden>🎁</span>
              <span className="claim-item__main">
                <strong>{money(g.settled_payout ?? 0)} ready from {g.title}</strong>
                <span className="small">Pick your prize</span>
              </span>
              <Icon name="chevron" />
            </Link>
          ))}
          {challenges.map((v) => (
            <Link key={v.challenge.id} to={`/claim/challenge/${v.challenge.id}`} className="claim-item">
              <span aria-hidden>🏆</span>
              <span className="claim-item__main">
                <strong>{money(v.claimable)} ready from {v.challenge.title}</strong>
                <span className="small">Pick your prize</span>
              </span>
              <Icon name="chevron" />
            </Link>
          ))}
        </section>
      )}

      {!anyAvailable && <Notice tone="warn">Reward inventory is restocking. Your earned rewards are held until a prize is available.</Notice>}

      <section className="section" aria-labelledby="feat-h">
        <div className="section__head">
          <h2 id="feat-h" className="section__title">
            Featured rewards
          </h2>
          <span className="tiny muted">{featured.length} of {featured.length + openSlots.length} featured slots booked</span>
        </div>
        <div className="rgrid rgrid--featured">
          {featured.map((r, i) => (
            <Card key={r.id} r={r} slot={i + 1} />
          ))}
          {openSlots.map((s) => (
            <Link key={s.id} to="/sponsor" className="rcard rcard--open">
              <span className="rcard__slot">Slot {s.position}</span>
              <strong>Open featured slot</strong>
              <span className="muted small">Available from {shortDate(s.start_date)}. Brands can book it.</span>
            </Link>
          ))}
        </div>
      </section>

      <section className="section" aria-labelledby="more-h">
        <div className="section__head">
          <h2 id="more-h" className="section__title">
            More rewards
          </h2>
        </div>
        <div className="rgrid">
          {more.map((r) => (
            <Card key={r.id} r={r} />
          ))}
        </div>
      </section>

      <section className="section" aria-labelledby="mine-h">
        <div className="section__head">
          <h2 id="mine-h" className="section__title">
            Your rewards
          </h2>
          <Link to="/wallet" className="link-btn">
            Wallet
          </Link>
        </div>
        {mine.length === 0 ? (
          <p className="muted">Nothing yet. Your first one is a goal away.</p>
        ) : (
          <ul className="list">
            {mine.map((gr) => {
              const r = db.rewards.find((x) => x.id === gr.reward_id)!;
              const b = brandById(db, r.brand_id)!;
              const src = gr.source === 'challenge' ? db.challenges.find((c) => c.id === gr.goal_id)?.title : db.goals.find((g) => g.id === gr.goal_id)?.title;
              return (
                <li key={`${gr.goal_id}-${gr.reward_id}`} className="row">
                  <BrandTile brand={b} size={40} />
                  <div className="row__main">
                    <div className="row__title">
                      {money(gr.value)} {r.title}
                    </div>
                    <div className="row__meta">
                      {src} · unlocked {shortDate(gr.unlocked_at)}
                    </div>
                  </div>
                  <span className="chip chip--green">Unlocked</span>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <p className="tiny muted" style={{ marginTop: 28 }}>
        Rewards are simulated in this prototype; no gift cards or codes are issued. Brand names are illustrative examples of a future marketplace and
        do not imply sponsorship, endorsement, partnership or affiliation.
      </p>
    </div>
  );
}
