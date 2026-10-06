import type { CSSProperties } from 'react';
import type { Challenge } from '../lib/types';
import { useStore } from '../lib/store';
import { challengeView } from '../lib/selectors';
import { Link } from '../lib/router';
import { money, plural } from '../lib/format';
import { daysLeftLabel, shortDate } from '../lib/time';
import { Icon } from './Icon';

const FORMAT_LABEL: Record<Challenge['format'], string> = {
  individual: 'Target',
  personal_best: 'Personal best',
  completion: 'Completion',
  ranked: 'Ranked',
  team: 'Team game',
  head_to_head: 'Head-to-head',
};

export function ChallengeCard({ challenge, compact }: { challenge: Challenge; compact?: boolean }) {
  const { db } = useStore();
  const v = challengeView(db, challenge);
  const sponsored = Boolean(challenge.brand_id);
  const takeover = challenge.takeover;
  const state =
    v.status === 'ended' ? 'Ended' : v.status === 'upcoming' ? `Starts ${shortDate(challenge.start_date)}` : daysLeftLabel(challenge.end_date);

  const style = takeover
    ? ({ ['--cc-bg' as string]: takeover.bg, ['--cc-fg' as string]: takeover.fg, ['--cc-accent' as string]: takeover.accent } as CSSProperties)
    : undefined;

  return (
    <Link to={`/c/${challenge.id}`} className={`ccard ${takeover ? 'ccard--takeover on-dark' : ''} ${compact ? 'ccard--compact' : ''}`} style={style}>
      <div className="ccard__top">
        {takeover ? (
          <span className="ccard__campaign">{takeover.campaign_name}</span>
        ) : (
          <span className="ccard__emoji" aria-hidden>
            {challenge.emoji}
          </span>
        )}
        <span className="ccard__badges">
          {sponsored && <span className="ccard__badge">{takeover ? 'Brand challenge' : 'Sponsored'}</span>}
          {v.joined && (
            <span className="ccard__badge ccard__badge--joined">
              <Icon name="check" size={13} /> Joined
            </span>
          )}
        </span>
      </div>
      <h3 className="ccard__title">{takeover ? takeover.headline : challenge.title}</h3>
      <p className="ccard__goal">{challenge.description}</p>
      <div className="ccard__money">
        <span>
          {money(challenge.commitment)}
          {challenge.sponsor_contribution > 0 ? ` + ${money(challenge.sponsor_contribution)} sponsor` : ' each'}
        </span>
        <span className="ccard__reward">
          {challenge.format === 'team' || challenge.format === 'ranked' ? `${money(v.econ.pool)} pool` : `${money(v.econ.finisherReward)} reward`}
        </span>
      </div>
      <div className="ccard__meta">
        <span>{plural(v.count, 'participant')}</span>
        <span>{state}</span>
        {v.isFull && v.status !== 'ended' && <span className="ccard__full">Full</span>}
        {!v.isFull && v.spotsLeft <= 5 && v.status !== 'ended' && <span className="ccard__full">{v.spotsLeft} left</span>}
        <span className="ccard__format">{FORMAT_LABEL[challenge.format]}</span>
      </div>
    </Link>
  );
}

export { FORMAT_LABEL };
