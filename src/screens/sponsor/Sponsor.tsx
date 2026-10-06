import { useState } from 'react';
import { useStore } from '../../lib/store';
import { Link } from '../../lib/router';
import { brandById, campaignView } from '../../lib/selectors';
import { bookSlot } from '../../lib/commands';
import { money, num } from '../../lib/format';
import { shortDate } from '../../lib/time';
import type { CampaignStatus } from '../../lib/types';
import { BrandTile, Sheet } from '../../components/ui';
import { Icon } from '../../components/Icon';
import { useFeedback } from '../../components/feedback';

export const TYPE_LABEL = {
  brand_takeover: 'Brand takeover',
  challenge_sponsorship: 'Challenge sponsorship',
  reward_placement: 'Featured reward slot',
  sponsored_rewards: 'Sponsored rewards',
} as const;

export const STATUS_CHIP: Record<CampaignStatus, string> = {
  draft: 'chip',
  scheduled: 'chip chip--blue',
  active: 'chip chip--green',
  completed: 'chip chip--ink',
};

const PRODUCTS = [
  { t: 'Featured reward slots', d: 'Top placement in Choose your prize. Finite inventory, booked by the month.', p: 'From $1,200 / slot / month' },
  { t: 'Sponsored rewards', d: 'Fund a pool of matches. Every dollar lands with someone who just finished something.', p: 'Budget you set' },
  { t: 'Challenge sponsorship', d: 'Your name on a measurable challenge. You match each participant’s commitment.', p: 'Match + platform fee' },
  { t: 'Premium takeover', d: 'Own the campaign: your colours, your headline, Sogo underneath.', p: 'Flat fee + match' },
  { t: 'Performance pricing', d: 'Pay per verified completion, redemption or new customer instead of impressions.', p: 'Future · per outcome' },
];

export function Sponsor() {
  const { db, update } = useStore();
  const { toast } = useFeedback();
  const [tab, setTab] = useState<CampaignStatus | 'all'>('all');
  const [bookFor, setBookFor] = useState<string | null>(null);
  const [brandPick, setBrandPick] = useState('arcteryx');
  const all = db.campaigns.map((c) => campaignView(db, c.id));
  const challengeCampaigns = all.filter((c) => !c.isPlacement && c.campaign.status !== 'draft');
  const kpi = {
    participants: challengeCampaigns.reduce((s, c) => s + c.participants, 0),
    completions: challengeCampaigns.reduce((s, c) => s + c.completions, 0),
    distributed: challengeCampaigns.reduce((s, c) => s + c.rewardsDistributed, 0),
    redeemed: challengeCampaigns.reduce((s, c) => s + c.rewardsRedeemed, 0),
    shares: all.reduce((s, c) => s + c.shares, 0),
    acquisition: all.reduce((s, c) => s + c.acquisition, 0),
    value: all.reduce((s, c) => s + c.estValue, 0),
  };
  const shown = all.filter((c) => tab === 'all' || c.campaign.status === tab);
  const counts = (s: CampaignStatus) => all.filter((c) => c.campaign.status === s).length;

  return (
    <div className="page page--wide sponsor">
      <header className="sponsor__hero">
        <div>
          <p className="sponsor__eyebrow">Sogo for Brands · concept dashboard</p>
          <h1 className="sponsor__title">Fund measurable human achievement.</h1>
          <p className="sponsor__lede">Every sponsor dollar is tied to a verified action: a commitment matched, a milestone hit, a goal finished.</p>
        </div>
        <Link to="/sponsor/new" className="btn btn--sun btn--lg">
          <Icon name="plus" size={18} /> New campaign
        </Link>
      </header>
      <p className="tiny muted" style={{ marginBottom: 18 }}>
        Simulated data. Brand names are illustrative examples and do not imply any partnership or affiliation.
      </p>

      <section className="kpis" aria-label="Portfolio metrics">
        {[
          ['Participants', num(kpi.participants, 0)],
          ['Completion rate', kpi.participants ? `${Math.round((kpi.completions / kpi.participants) * 100)}%` : '—'],
          ['Rewards distributed', money(kpi.distributed)],
          ['Rewards redeemed', num(kpi.redeemed, 0)],
          ['New customers (est.)', num(kpi.acquisition, 0)],
          ['Social shares', num(kpi.shares, 0)],
          ['Est. campaign value', money(kpi.value)],
        ].map(([k, v]) => (
          <div key={k} className="kpi">
            <span className="kpi__v">{v}</span>
            <span className="kpi__k">{k}</span>
          </div>
        ))}
      </section>

      <section className="section" aria-labelledby="camp-h">
        <div className="section__head">
          <h2 id="camp-h" className="section__title">
            Campaigns
          </h2>
          <div className="segmented" role="group" aria-label="Filter campaigns">
            {(['all', 'active', 'scheduled', 'draft', 'completed'] as const).map((s) => (
              <button key={s} aria-pressed={tab === s} onClick={() => setTab(s)}>
                {s === 'all' ? 'All' : `${s[0].toUpperCase()}${s.slice(1)} ${counts(s)}`}
              </button>
            ))}
          </div>
        </div>
        <div className="ctable" role="table" aria-label="Campaigns">
          <div className="ctable__row ctable__row--head" role="row">
            <span role="columnheader">Campaign</span>
            <span role="columnheader">Type</span>
            <span role="columnheader">Participants</span>
            <span role="columnheader">Completion</span>
            <span role="columnheader">Budget used</span>
            <span role="columnheader">Status</span>
          </div>
          {shown.map((c) => (
            <Link key={c.campaign.id} to={`/sponsor/c/${c.campaign.id}`} className="ctable__row" role="row">
              <span className="ctable__name" role="cell">
                <BrandTile brand={c.brand} size={36} />
                <span>
                  <strong>{c.campaign.name}</strong>
                  <span className="muted small" style={{ display: 'block' }}>
                    {shortDate(c.campaign.start_date)} – {shortDate(c.campaign.end_date)}
                  </span>
                </span>
              </span>
              <span role="cell" className="small">
                {TYPE_LABEL[c.campaign.campaign_type]}
              </span>
              <span role="cell" className="tnum">
                {c.isPlacement ? `${num(c.selections, 0)} picks` : `${num(c.participants, 0)} / ${num(c.campaign.participant_capacity, 0)}`}
              </span>
              <span role="cell" className="tnum">
                {c.isPlacement ? `${num(c.impressions, 0)} views` : c.participants ? `${c.completionRate}%` : '—'}
              </span>
              <span role="cell" className="ctable__budget">
                <span className="mini-bar">
                  <span style={{ width: `${Math.min(100, (c.budgetUsed / Math.max(1, c.campaign.sponsor_budget)) * 100)}%` }} />
                </span>
                <span className="tnum small">
                  {money(c.budgetUsed)} / {money(c.campaign.sponsor_budget)}
                </span>
              </span>
              <span role="cell">
                <span className={STATUS_CHIP[c.campaign.status]}>{c.campaign.status}</span>
              </span>
            </Link>
          ))}
          {shown.length === 0 && <p className="muted" style={{ padding: 16 }}>No campaigns with this status.</p>}
        </div>
      </section>

      <section className="section" aria-labelledby="slots-h">
        <div className="section__head">
          <div>
            <h2 id="slots-h" className="section__title">
              Featured reward slots
            </h2>
            <p className="section__sub">Finite inventory in Choose your prize. This is the shelf brands pay to be on.</p>
          </div>
        </div>
        <div className="slots">
          {db.slots
            .slice()
            .sort((a, b) => a.position - b.position)
            .map((s) => {
              const b = brandById(db, s.brand_id);
              return (
                <div key={s.id} className={`slot ${s.status === 'available' ? 'slot--open' : ''}`}>
                  <span className="slot__pos">Slot {s.position}</span>
                  {b ? (
                    <>
                      <BrandTile brand={b} size={52} />
                      <strong>{b.name}</strong>
                      <span className="small muted">
                        {shortDate(s.start_date)} – {shortDate(s.end_date)}
                      </span>
                      <dl className="slot__m">
                        <dt>Views</dt>
                        <dd>{num(s.impressions, 0)}</dd>
                        <dt>Picks</dt>
                        <dd>{num(s.selections, 0)}</dd>
                        <dt>Pick rate</dt>
                        <dd>{s.impressions ? `${((s.selections / s.impressions) * 100).toFixed(1)}%` : '—'}</dd>
                      </dl>
                    </>
                  ) : (
                    <>
                      <strong>Available</strong>
                      <span className="small muted">From {shortDate(s.start_date)}</span>
                      <button className="btn btn--sm btn--blue" onClick={() => setBookFor(s.id)}>
                        Book slot
                      </button>
                    </>
                  )}
                </div>
              );
            })}
        </div>
      </section>

      <section className="section" aria-labelledby="prod-h">
        <h2 id="prod-h" className="section__title" style={{ marginBottom: 14 }}>
          What brands buy
        </h2>
        <div className="products">
          {PRODUCTS.map((p) => (
            <div key={p.t} className="product">
              <strong>{p.t}</strong>
              <p className="small muted">{p.d}</p>
              <span className="product__price">{p.p}</span>
            </div>
          ))}
        </div>
        <p className="tiny muted" style={{ marginTop: 10 }}>
          Illustrative packaging. No billing is implemented in this prototype.
        </p>
      </section>

      <section className="section loop" aria-labelledby="loop-h">
        <h2 id="loop-h" className="section__title" style={{ marginBottom: 14 }}>
          The loop you're paying for
        </h2>
        <ol className="loop__steps">
          {[
            'You sponsor a measurable challenge',
            'People commit their own money',
            'You match it',
            'Progress is verified',
            'Friends back participants',
            'Participants share progress',
            'New people discover you',
            'Finishers earn your reward',
            'Rewards drive purchases',
            'You see the results — and run it again',
          ].map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ol>
      </section>

      <Sheet open={Boolean(bookFor)} onClose={() => setBookFor(null)} title="Book a featured slot" sub="Simulated booking. In production this is a paid placement with an insertion order.">
        <div className="field">
          <label className="label" htmlFor="slot-brand">
            Brand
          </label>
          <select id="slot-brand" className="select" value={brandPick} onChange={(e) => setBrandPick(e.target.value)}>
            {db.brands
              .filter((b) => !db.slots.some((s) => s.brand_id === b.id) && db.rewards.some((r) => r.brand_id === b.id))
              .map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
          </select>
        </div>
        <div className="sheet__actions">
          <button
            className="btn btn--lg"
            onClick={() => {
              update((d) => bookSlot(d, bookFor!, brandPick));
              setBookFor(null);
              toast('Slot booked');
            }}
          >
            Book slot
          </button>
        </div>
      </Sheet>
    </div>
  );
}
