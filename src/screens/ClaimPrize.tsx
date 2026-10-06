import { useState } from 'react';
import { useStore } from '../lib/store';
import { Link, back } from '../lib/router';
import { brandById, challengeView, featuredRewards, standardRewards } from '../lib/selectors';
import { claimChallengeReward, claimReward } from '../lib/commands';
import { money } from '../lib/format';
import { BrandTile, Confetti, Empty, Wordmark, BackButton } from '../components/ui';
import { Icon } from '../components/Icon';
import type { Reward } from '../lib/types';

export function ClaimPrize({ kind, id }: { kind: 'goal' | 'challenge'; id: string }) {
  const { db, update } = useStore();
  const goal = kind === 'goal' ? db.goals.find((g) => g.id === id) : undefined;
  const challenge = kind === 'challenge' ? db.challenges.find((c) => c.id === id) : undefined;
  const cv = challenge ? challengeView(db, challenge) : undefined;
  const existing = db.goal_rewards.find((r) => r.goal_id === id && (kind === 'challenge' ? r.source === 'challenge' : r.source !== 'challenge'));
  const value = goal ? goal.settled_payout ?? 0 : cv?.claimable || existing?.value || 0;
  const preferred = goal?.reward_brand_id ?? challenge?.brand_id;
  const featured = featuredRewards(db);
  const more = standardRewards(db);
  const all = [...featured, ...more];
  const [pick, setPick] = useState<string>(() => all.find((r) => r.brand_id === preferred && r.availability !== 'unavailable')?.id ?? featured[0]?.id ?? '');
  const [revealed, setRevealed] = useState(Boolean(existing));

  if (!goal && !challenge) return <Empty title="Nothing to claim here" action={<Link to="/home" className="btn btn--sm">Home</Link>} />;
  if (!existing && value <= 0)
    return (
      <div className="claim">
        <div className="claim__bar">
          <BackButton onClick={() => back('/home')} />
        </div>
        <Empty title="No reward on this one" action={<Link to="/new" className="btn btn--sm">Start another goal</Link>}>
          This goal closed before any reward was secured.
        </Empty>
      </div>
    );

  const title = goal?.title ?? challenge?.takeover?.headline ?? challenge?.title ?? '';
  const claimed = existing ?? db.goal_rewards.find((r) => r.goal_id === id);
  const claimedReward = claimed ? db.rewards.find((r) => r.id === claimed.reward_id) : undefined;
  const claimedBrand = claimedReward ? brandById(db, claimedReward.brand_id) : undefined;
  const shareKind = goal?.status === 'completed' ? 'completed' : 'reward';

  const unlock = () => {
    if (!pick) return;
    update((d) => (kind === 'goal' ? claimReward(d, id, pick) : claimChallengeReward(d, id, pick)));
    setRevealed(true);
  };

  if (revealed && claimedBrand && claimed) {
    return (
      <div className="claim claim--done on-dark">
        <Confetti count={50} />
        <div className="claim__done">
          <span className="claim__kicker">Reward unlocked</span>
          <div className="claim__card" style={{ ['--brand-bg' as string]: claimedBrand.color, ['--brand-ink' as string]: claimedBrand.ink }}>
            <span className="claim__card-brand">{claimedBrand.name}</span>
            <span className="score claim__card-value">{money(claimed.value)}</span>
            <span className="claim__card-sub">{claimedReward!.title}</span>
            <span className="claim__card-foot">
              <Wordmark size={16} /> Earned on {title}
            </span>
          </div>
          <p className="claim__note">
            In the real product this arrives as a {claimedReward!.type === 'gift_card' ? 'gift card' : 'brand credit'} in your inbox. This prototype
            simulates it — no redeemable code is issued.
          </p>
          <div className="claim__actions">
            <Link to={kind === 'goal' ? `/share/${shareKind}/${id}` : `/share/challenge_invite/${id}`} className="btn btn--sun btn--lg">
              <Icon name="share" size={18} /> Share your win
            </Link>
            <Link to="/new" className="btn btn--white btn--lg">
              Start the next goal
            </Link>
          </div>
          <Link to="/wallet" className="link-btn" style={{ color: '#fff' }}>
            See it in your wallet
          </Link>
        </div>
      </div>
    );
  }

  const RewardBtn = ({ r }: { r: Reward }) => {
    const b = brandById(db, r.brand_id)!;
    const off = r.availability === 'unavailable';
    return (
      <button role="radio" aria-checked={pick === r.id} disabled={off} className={`prize ${pick === r.id ? 'is-picked' : ''}`} onClick={() => setPick(r.id)}>
        <BrandTile brand={b} size={64} />
        <span className="prize__name">{b.name}</span>
        <span className="score prize__value">{off ? '—' : money(value)}</span>
        <span className="prize__tag">
          {off ? 'Out of stock this month' : r.placement_tier === 'featured' ? 'Featured reward' : r.availability === 'limited' ? 'Limited' : r.tagline}
        </span>
        {pick === r.id && (
          <span className="prize__check" aria-hidden>
            <Icon name="check" size={16} />
          </span>
        )}
      </button>
    );
  };

  return (
    <div className="claim">
      <div className="claim__bar">
        <BackButton onClick={() => back('/home')} />
        <Wordmark size={22} />
        <span style={{ width: 42 }} />
      </div>
      <header className="claim__head">
        <span className="muted">{title}</span>
        <h1 className="claim__title">Choose your prize</h1>
        <p className="claim__amount">
          <span className="score">{money(value)}</span> to spend
        </p>
      </header>
      <section aria-labelledby="feat-h">
        <h2 id="feat-h" className="claim__h2">
          Featured rewards
        </h2>
        <div className="prizes" role="radiogroup" aria-labelledby="feat-h">
          {featured.map((r) => (
            <RewardBtn key={r.id} r={r} />
          ))}
        </div>
      </section>
      <section aria-labelledby="more-h" style={{ marginTop: 28 }}>
        <h2 id="more-h" className="claim__h2">
          More rewards
        </h2>
        <div className="prizes prizes--small" role="radiogroup" aria-labelledby="more-h">
          {more.map((r) => (
            <RewardBtn key={r.id} r={r} />
          ))}
        </div>
      </section>
      <p className="tiny muted" style={{ marginTop: 18 }}>
        Brands shown are illustrative concepts and are not affiliated with Sogo.
      </p>
      <div className="claim__sticky">
        <button className="btn btn--sun btn--lg btn--block btn--commit" onClick={unlock} disabled={!pick}>
          Unlock {money(value)} {pick ? `${brandById(db, all.find((r) => r.id === pick)?.brand_id)?.name} reward` : ''}
        </button>
      </div>
    </div>
  );
}
