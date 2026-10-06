import { useState, type ReactNode } from 'react';
import { Sheet, Ticket } from './ui';
import { Icon } from './Icon';
import { payments, type CommitRequest } from '../lib/payments';
import { useStore } from '../lib/store';
import { balanceOf } from '../lib/commands';
import { money } from '../lib/format';

type Phase = 'confirm' | 'processing' | 'done' | 'error';

/**
 * The commitment moment. Every payment-bearing action in Sogo goes through here:
 * confirm → hold placed (simulated) → confirmation with the sponsor match and potential reward.
 */
export function PaymentSheet({
  open,
  onClose,
  request,
  title,
  processingText,
  breakdown,
  doneTitle,
  doneBody,
  onCommitted,
  onDone,
  confirmLabel,
}: {
  open: boolean;
  onClose: () => void;
  request: Omit<CommitRequest, 'userId'>;
  title: string;
  processingText: string;
  breakdown: { label: string; value: string; strong?: boolean }[];
  doneTitle: string;
  doneBody?: ReactNode;
  /** Runs the state change once the (simulated) payment succeeds. */
  onCommitted: () => void;
  onDone: () => void;
  confirmLabel?: string;
}) {
  const { db } = useStore();
  const [phase, setPhase] = useState<Phase>('confirm');
  const [error, setError] = useState('');
  const balance = balanceOf(db);

  const close = () => {
    if (phase === 'processing') return;
    setPhase('confirm');
    setError('');
    onClose();
  };

  async function pay() {
    setPhase('processing');
    const res = await payments.commit(
      { ...request, userId: 'u_me' },
      { balance, forceFailure: db.settings.simulate_payment_failure },
    );
    if (!res.ok) {
      setError(res.message);
      setPhase('error');
      return;
    }
    onCommitted();
    setPhase('done');
  }

  const total = breakdown.find((b) => b.strong);

  return (
    <Sheet open={open} onClose={close} title={phase === 'done' ? undefined : phase === 'processing' ? undefined : title}>
      {phase === 'confirm' && (
        <>
          <dl className="kv" style={{ marginTop: 8 }}>
            {breakdown.map((b) => (
              <div key={b.label} style={{ display: 'contents' }}>
                <dt style={b.strong ? { color: 'var(--ink)', fontWeight: 700, alignSelf: 'center' } : undefined}>{b.label}</dt>
                <dd className={b.strong ? 'kv__total' : undefined}>{b.value}</dd>
              </div>
            ))}
          </dl>
          <hr className="divider" />
          <p className="small muted">
            Demo credit available: <strong className="tnum">{money(balance)}</strong>. This is a prototype — no real money moves.
          </p>
          <div className="sheet__actions">
            <button className="btn btn--sun btn--lg btn--commit btn--block" onClick={pay}>
              {confirmLabel ?? `Commit ${money(request.amount)}`}
            </button>
          </div>
        </>
      )}
      {phase === 'processing' && (
        <div style={{ display: 'grid', placeItems: 'center', gap: 18, padding: '36px 0', textAlign: 'center' }} role="status" aria-live="polite">
          <div className="spinner" />
          <p style={{ fontWeight: 650, maxWidth: '30ch' }}>{processingText}</p>
        </div>
      )}
      {phase === 'error' && (
        <div style={{ display: 'grid', gap: 16, paddingTop: 8 }}>
          <div className="notice notice--error" role="alert">
            <Icon name="alert" />
            <div>
              <strong>That didn't go through.</strong>
              <div>{error}</div>
            </div>
          </div>
          <div className="sheet__actions">
            <button className="btn btn--ghost" onClick={close}>
              Not now
            </button>
            <button className="btn" onClick={pay}>
              Try again
            </button>
          </div>
        </div>
      )}
      {phase === 'done' && (
        <div style={{ display: 'grid', justifyItems: 'center', textAlign: 'center', gap: 14, paddingTop: 10 }}>
          <div style={{ width: 64, height: 64, borderRadius: 999, background: 'var(--green-50)', color: 'var(--green)', display: 'grid', placeItems: 'center' }}>
            <Icon name="check" size={32} />
          </div>
          <h2 className="sheet__title" style={{ padding: 0, margin: 0 }}>
            {doneTitle}
          </h2>
          {doneBody}
          {total && <Ticket value={total.value} label={total.label} />}
          <button
            className="btn btn--lg btn--block"
            style={{ marginTop: 10 }}
            onClick={() => {
              setPhase('confirm');
              onDone();
            }}
          >
            Let's go
          </button>
        </div>
      )}
    </Sheet>
  );
}
