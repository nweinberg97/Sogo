import { useState, type CSSProperties } from 'react';
import { useStore } from '../../lib/store';
import { back, navigate } from '../../lib/router';
import { createCampaign, type CampaignDraft } from '../../lib/commands';
import { brandById } from '../../lib/selectors';
import { money, num } from '../../lib/format';
import { dateInputValue, daysFromNow, fromDateInput } from '../../lib/time';
import type { Challenge, CampaignStatus, VerificationMethod } from '../../lib/types';
import { BackButton, BrandTile, Notice, Ticket } from '../../components/ui';
import { useFeedback } from '../../components/feedback';

export function SponsorBuilder() {
  const { db, update } = useStore();
  const { toast } = useFeedback();
  const [d, setD] = useState<CampaignDraft>({
    brand_id: 'nike',
    name: 'Nike Hoops',
    headline: '3-Point Challenge',
    goal: 'Make 100 three-pointers in 30 days.',
    category: 'basketball',
    unit: 'threes',
    target_value: 100,
    target_audience: 'Basketball players',
    start_date: daysFromNow(4, 0),
    end_date: daysFromNow(35, 23),
    reward_value: 30,
    sponsor_budget: 3000,
    participant_capacity: 200,
    verification: 'connected',
    campaign_type: 'brand_takeover',
    status: 'draft',
  });
  const [err, setErr] = useState('');
  const set = <K extends keyof CampaignDraft>(k: K, v: CampaignDraft[K]) => setD((x) => ({ ...x, [k]: v }));
  const brand = brandById(db, d.brand_id)!;
  const match = d.reward_value / 2;
  const fundable = Math.floor(d.sponsor_budget / Math.max(1, match));
  const short = fundable < d.participant_capacity;

  const submit = (status: CampaignStatus) => {
    if (!d.headline.trim() || !d.goal.trim()) return setErr('Give the challenge a name and a measurable goal.');
    if (!/\d/.test(d.goal)) return setErr('The goal needs a number. "Make 100 three-pointers in 30 days", not "Shoot more threes".');
    if (d.target_value <= 0 || !d.unit.trim()) return setErr('Set a target and a unit.');
    if (new Date(d.end_date) <= new Date(d.start_date)) return setErr('End date must be after the start date.');
    setErr('');
    const id = update((x) => createCampaign(x, { ...d, status }));
    toast(status === 'draft' ? 'Draft saved' : status === 'active' ? 'Campaign live' : 'Campaign scheduled');
    navigate(`/sponsor/c/${id}`, { replace: true });
  };

  const style = { ['--to-bg' as string]: brand.color, ['--to-fg' as string]: brand.ink, ['--to-accent' as string]: '#FFD23F' } as CSSProperties;

  return (
    <div className="page page--wide sponsor">
      <div className="page__bar">
        <BackButton onClick={() => back('/sponsor')} />
      </div>
      <header className="page__head">
        <h1 className="page__title">New campaign</h1>
        <p className="page__sub">Sponsor a challenge with a finish line. Prefilled with an example — change anything.</p>
      </header>
      <div className="builder">
        <div className="builder__form">
          <div className="form-grid">
            <div className="field">
              <label className="label" htmlFor="b-brand">
                Brand
              </label>
              <select id="b-brand" className="select" value={d.brand_id} onChange={(e) => set('brand_id', e.target.value)}>
                {db.brands.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label className="label" htmlFor="b-type">
                Campaign type
              </label>
              <select id="b-type" className="select" value={d.campaign_type} onChange={(e) => set('campaign_type', e.target.value as CampaignDraft['campaign_type'])}>
                <option value="brand_takeover">Premium brand takeover</option>
                <option value="challenge_sponsorship">Challenge sponsorship</option>
              </select>
            </div>
            <div className="field">
              <label className="label" htmlFor="b-name">
                Campaign name
              </label>
              <input id="b-name" className="input" value={d.name} onChange={(e) => set('name', e.target.value)} />
            </div>
            <div className="field">
              <label className="label" htmlFor="b-head">
                Challenge name
              </label>
              <input id="b-head" className="input" value={d.headline} onChange={(e) => set('headline', e.target.value)} />
            </div>
          </div>
          <div className="field">
            <label className="label" htmlFor="b-goal">
              Goal
            </label>
            <input id="b-goal" className="input" value={d.goal} onChange={(e) => set('goal', e.target.value)} />
            <span className="hint">Specific and measurable. Members should know what success means in five seconds.</span>
          </div>
          <div className="form-grid">
            <div className="field">
              <label className="label" htmlFor="b-target">
                Target
              </label>
              <input id="b-target" className="input" type="number" min={1} value={d.target_value} onChange={(e) => set('target_value', Number(e.target.value))} />
            </div>
            <div className="field">
              <label className="label" htmlFor="b-unit">
                Unit
              </label>
              <input id="b-unit" className="input" value={d.unit} onChange={(e) => set('unit', e.target.value)} />
            </div>
            <div className="field">
              <label className="label" htmlFor="b-cat">
                Category
              </label>
              <select id="b-cat" className="select" value={d.category} onChange={(e) => set('category', e.target.value as Challenge['category'])}>
                {['running', 'basketball', 'strength', 'walking', 'cycling', 'wellness', 'hiking'].map((c) => (
                  <option key={c} value={c}>
                    {c[0].toUpperCase() + c.slice(1)}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label className="label" htmlFor="b-aud">
                Target audience
              </label>
              <input id="b-aud" className="input" value={d.target_audience} onChange={(e) => set('target_audience', e.target.value)} />
            </div>
            <div className="field">
              <label className="label" htmlFor="b-start">
                Starts
              </label>
              <input id="b-start" className="input" type="date" value={dateInputValue(d.start_date)} onChange={(e) => e.target.value && set('start_date', fromDateInput(e.target.value))} />
            </div>
            <div className="field">
              <label className="label" htmlFor="b-end">
                Ends
              </label>
              <input id="b-end" className="input" type="date" value={dateInputValue(d.end_date)} onChange={(e) => e.target.value && set('end_date', fromDateInput(e.target.value))} />
            </div>
            <div className="field">
              <label className="label" htmlFor="b-reward">
                Reward per finisher
              </label>
              <div className="input-suffix">
                <input id="b-reward" className="input" type="number" min={2} step={2} value={d.reward_value} onChange={(e) => set('reward_value', Number(e.target.value))} />
                <span>$</span>
              </div>
              <span className="hint">
                Half from the member ({money(match)}), half from you ({money(match)}).
              </span>
            </div>
            <div className="field">
              <label className="label" htmlFor="b-budget">
                Sponsor budget
              </label>
              <div className="input-suffix">
                <input id="b-budget" className="input" type="number" min={0} step={100} value={d.sponsor_budget} onChange={(e) => set('sponsor_budget', Number(e.target.value))} />
                <span>$</span>
              </div>
            </div>
            <div className="field">
              <label className="label" htmlFor="b-cap">
                Capacity
              </label>
              <div className="input-suffix">
                <input id="b-cap" className="input" type="number" min={1} value={d.participant_capacity} onChange={(e) => set('participant_capacity', Number(e.target.value))} />
                <span>people</span>
              </div>
            </div>
            <div className="field">
              <label className="label" htmlFor="b-ver">
                Verification
              </label>
              <select id="b-ver" className="select" value={d.verification} onChange={(e) => set('verification', e.target.value as VerificationMethod)}>
                <option value="connected">Connected data</option>
                <option value="photo">Photo / video proof</option>
                <option value="human">Human review</option>
              </select>
            </div>
          </div>
          {short ? (
            <Notice tone="warn">
              {money(d.sponsor_budget)} matches {num(fundable, 0)} members at {money(match)} each — fewer than your capacity of {num(d.participant_capacity, 0)}. Raise the budget
              to {money(d.participant_capacity * match)} or lower capacity.
            </Notice>
          ) : (
            <Notice tone="ok">
              Fully funded: {money(d.sponsor_budget)} covers {num(d.participant_capacity, 0)} members at {money(match)} each.
            </Notice>
          )}
          {err && (
            <p className="error-text" role="alert" style={{ marginTop: 12 }}>
              {err}
            </p>
          )}
          <div className="builder__actions">
            <button className="btn btn--ghost" onClick={() => submit('draft')}>
              Save draft
            </button>
            <button className="btn btn--blue" onClick={() => submit('scheduled')}>
              Schedule
            </button>
            <button className="btn" onClick={() => submit('active')}>
              Launch now
            </button>
          </div>
        </div>

        <aside className="builder__preview" aria-label="Preview">
          <span className="tiny muted">How members will see it</span>
          <div className={`mini-takeover ${d.campaign_type === 'brand_takeover' ? '' : 'mini-takeover--plain'}`} style={style}>
            <div className="mini-takeover__top">
              <BrandTile brand={brand} size={40} />
              <span className="chip chip--sun">{d.campaign_type === 'brand_takeover' ? 'Brand challenge' : 'Sponsored'}</span>
            </div>
            {d.campaign_type === 'brand_takeover' && <div className="mini-takeover__campaign">{d.name.toUpperCase() || 'CAMPAIGN'}</div>}
            <div className="mini-takeover__head">{d.headline || 'Challenge name'}</div>
            <div className="mini-takeover__goal">{d.goal || 'Your measurable goal.'}</div>
            <div className="mini-takeover__math">
              <span>
                {money(match)} + {brand.name} {money(match)}
              </span>
              <Ticket value={money(d.reward_value)} label="Reward" />
            </div>
            <div className="mini-takeover__foot">Powered by Sogo · Reward partner: {brand.name}</div>
          </div>
        </aside>
      </div>
    </div>
  );
}
