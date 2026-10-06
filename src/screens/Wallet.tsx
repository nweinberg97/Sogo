import { useStore } from '../lib/store';
import { wallet } from '../lib/selectors';
import { money } from '../lib/format';
import { relTime } from '../lib/time';
import { Notice } from '../components/ui';

const KIND_LABEL = {
  demo_credit: 'Credit',
  commitment: 'Committed',
  backing: 'Backed',
  reward_earned: 'Reward',
  backing_return: 'Return',
  forfeit: 'Community pool',
  refund: 'Refund',
} as const;

export function Wallet() {
  const { db } = useStore();
  const w = wallet(db);
  return (
    <div className="page page--narrow">
      <header className="page__head">
        <h1 className="page__title">Wallet</h1>
        <p className="page__sub">Where your commitments are and what they've earned.</p>
      </header>
      <Notice tone="blue">Simulated. This is not a real-money wallet — no funds are held, moved or paid out in this prototype.</Notice>
      <div className="stat-grid" style={{ marginTop: 18 }}>
        <div className="stat stat--blue">
          <div className="stat__value">{money(w.balance)}</div>
          <div className="stat__label">Demo credit available</div>
        </div>
        <div className="stat">
          <div className="stat__value">{money(w.committed)}</div>
          <div className="stat__label">Committed right now</div>
        </div>
        <div className="stat">
          <div className="stat__value">{money(w.pending)}</div>
          <div className="stat__label">Secured by milestones</div>
        </div>
        <div className="stat stat--sun">
          <div className="stat__value">{money(w.earned)}</div>
          <div className="stat__label">Rewards earned</div>
        </div>
        <div className="stat">
          <div className="stat__value">{money(w.forfeited)}</div>
          <div className="stat__label">Sent to the community pool</div>
        </div>
      </div>
      <p className="small muted" style={{ marginTop: 14 }}>
        The Sogo community pool holds <strong className="tnum">{money(db.community_pool)}</strong> (simulated) from missed commitments. It funds
        Believer returns and future rewards.
      </p>
      <section className="section">
        <h2 className="section__title" style={{ marginBottom: 10 }}>
          History
        </h2>
        <ul className="list">
          {w.ledger.map((l) => (
            <li key={l.id} className="row">
              <span className={`ledger-kind ledger-kind--${l.kind}`}>{KIND_LABEL[l.kind]}</span>
              <div className="row__main">
                <div className="row__title" style={{ fontWeight: 550 }}>
                  {l.label}
                </div>
                <div className="row__meta">{relTime(l.created_at)}</div>
              </div>
              <span className={`tnum ledger-amt ${l.amount > 0 ? 'is-plus' : ''}`}>
                {l.kind === 'forfeit' ? '' : l.amount > 0 ? `+${money(l.amount)}` : money(l.amount).replace('$-', '−$')}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
