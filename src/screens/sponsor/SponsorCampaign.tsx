import { useStore } from '../../lib/store';
import { Link, back } from '../../lib/router';
import { campaignView } from '../../lib/selectors';
import { money, num } from '../../lib/format';
import { longDate, isPast } from '../../lib/time';
import type { CampaignStatus } from '../../lib/types';
import { BackButton, BrandTile, Empty, Notice } from '../../components/ui';
import { useFeedback } from '../../components/feedback';
import { STATUS_CHIP, TYPE_LABEL } from './Sponsor';
import { NotFound } from '../NotFound';

const FLOW: CampaignStatus[] = ['draft', 'scheduled', 'active', 'completed'];

export function SponsorCampaign({ id }: { id: string }) {
  const { db, update } = useStore();
  const { toast } = useFeedback();
  if (!db.campaigns.some((c) => c.id === id)) return <NotFound />;
  const v = campaignView(db, id);
  const cp = v.campaign;
  const expired = cp.status !== 'completed' && isPast(cp.end_date);
  const funnel = v.isPlacement
    ? [
        ['Views in Choose your prize', v.impressions],
        ['Picked as prize', v.selections],
      ]
    : [
        ['Joined', v.participants],
        ['Completed', v.completions],
        ['Redeemed reward', v.rewardsRedeemed],
        ['New customers (est.)', v.acquisition],
      ];
  const max = Math.max(1, ...funnel.map((f) => f[1] as number));

  return (
    <div className="page page--wide sponsor">
      <div className="page__bar">
        <BackButton onClick={() => back('/sponsor')} />
      </div>
      <header className="camp-head">
        <BrandTile brand={v.brand} size={64} />
        <div>
          <span className="muted small">
            {v.brand.name} · {TYPE_LABEL[cp.campaign_type]}
          </span>
          <h1 className="page__title">{cp.name}</h1>
          <p className="muted">{cp.description}</p>
        </div>
        <span className={STATUS_CHIP[cp.status]}>{cp.status}</span>
      </header>

      {expired && <Notice tone="warn">This campaign's end date has passed. Mark it complete to close out rewards and reporting.</Notice>}
      {cp.status === 'draft' && <Notice>Draft. Nothing is live and no budget is committed. Schedule it to publish a challenge on Sogo.</Notice>}

      <div className="status-flow" role="group" aria-label="Campaign status">
        {FLOW.map((s) => (
          <button
            key={s}
            className={`status-step ${cp.status === s ? 'is-on' : ''}`}
            aria-pressed={cp.status === s}
            onClick={() => {
              update((d) => {
                const c = d.campaigns.find((x) => x.id === id)!;
                c.status = s;
                if (c.challenge_id) {
                  const ch = d.challenges.find((x) => x.id === c.challenge_id);
                  if (ch) ch.status_override = s === 'completed' ? 'ended' : s === 'scheduled' ? 'upcoming' : s === 'active' ? 'active' : undefined;
                }
              });
              toast(`Campaign ${s}`);
            }}
          >
            {s}
          </button>
        ))}
      </div>

      <div className="camp-grid">
        <section className="panel" aria-labelledby="perf-h">
          <h2 id="perf-h" className="section__title" style={{ marginBottom: 14 }}>
            Performance
          </h2>
          {!v.isPlacement && v.participants === 0 ? (
            <Empty title="No participants yet" action={v.challenge ? <Link to={`/c/${v.challenge.id}`} className="btn btn--sm">View the challenge</Link> : undefined}>
              {cp.status === 'draft' ? 'Publish the campaign to open it to Sogo members.' : 'Once people join, you’ll see joins, completions and redemptions here.'}
            </Empty>
          ) : (
            <div className="funnel">
              {funnel.map(([k, n]) => (
                <div key={k as string} className="funnel__row">
                  <span className="funnel__k">{k}</span>
                  <span className="funnel__bar">
                    <span style={{ width: `${((n as number) / max) * 100}%` }} />
                  </span>
                  <span className="funnel__v tnum">{num(n as number, 0)}</span>
                </div>
              ))}
            </div>
          )}
          <div className="stat-grid" style={{ marginTop: 18 }}>
            <div className="stat">
              <div className="stat__value">{v.isPlacement ? `${v.impressions ? ((v.selections / v.impressions) * 100).toFixed(1) : 0}%` : `${v.completionRate}%`}</div>
              <div className="stat__label">{v.isPlacement ? 'Pick rate' : 'Completion rate'}</div>
            </div>
            <div className="stat">
              <div className="stat__value">{money(v.rewardsDistributed)}</div>
              <div className="stat__label">Rewards distributed</div>
            </div>
            <div className="stat">
              <div className="stat__value">{num(v.shares, 0)}</div>
              <div className="stat__label">Social shares</div>
            </div>
            <div className="stat">
              <div className="stat__value">{v.engagement ? v.engagement.toFixed(1) : '—'}</div>
              <div className="stat__label">Verified actions / person</div>
            </div>
          </div>
        </section>

        <section className="panel" aria-labelledby="setup-h">
          <h2 id="setup-h" className="section__title" style={{ marginBottom: 14 }}>
            Setup
          </h2>
          <dl className="kv">
            <dt>Audience</dt>
            <dd>{cp.target_audience}</dd>
            <dt>Dates</dt>
            <dd>
              {longDate(cp.start_date)} – {longDate(cp.end_date)}
            </dd>
            <dt>Reward</dt>
            <dd>
              {money(cp.reward_value)} {v.brand.name} reward
            </dd>
            <dt>Sponsor budget</dt>
            <dd>{money(cp.sponsor_budget)}</dd>
            <dt>Budget used</dt>
            <dd>{money(v.budgetUsed)}</dd>
            {!v.isPlacement && (
              <>
                <dt>Capacity</dt>
                <dd>
                  {num(v.participants, 0)} / {num(cp.participant_capacity, 0)}
                </dd>
              </>
            )}
            <dt>Verification</dt>
            <dd>{cp.verification}</dd>
            <dt>Est. campaign value</dt>
            <dd>{money(v.estValue)}</dd>
          </dl>
          <p className="tiny muted" style={{ marginTop: 12 }}>
            Estimated value is illustrative: participants × $9 engagement + new customers × $60 + shares × $1.50.
          </p>
          {v.challenge && (
            <Link to={`/c/${v.challenge.id}`} className="btn btn--soft btn--block" style={{ marginTop: 16 }}>
              See it as a member
            </Link>
          )}
        </section>
      </div>
    </div>
  );
}
