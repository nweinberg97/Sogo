import { useRef, useState } from 'react';
import type { Goal, PropType } from '../lib/types';
import { useStore } from '../lib/store';
import { backGoal, giveProps, PROP_TYPES } from '../lib/commands';
import { goalView, previewBacking, userById } from '../lib/selectors';
import { BACKING_OPTIONS, backerReturn, BACKER_RETURN_RATE } from '../lib/economics';
import { firstName, metric, money, pct } from '../lib/format';
import { daysLeftLabel } from '../lib/time';
import { Avatar, ProgressTrack, Sheet, Notice } from './ui';
import { PaymentSheet } from './PaymentSheet';
import { useFeedback } from './feedback';

export function PropsSheet({ goal, open, onClose }: { goal: Goal; open: boolean; onClose: () => void }) {
  const { db, update } = useStore();
  const { toast, burst } = useFeedback();
  const [type, setType] = useState<PropType>('fire');
  const [msg, setMsg] = useState('');
  const sendRef = useRef<HTMLButtonElement>(null);
  const owner = userById(db, goal.user_id);
  const send = () => {
    update((d) => giveProps(d, goal.id, type, msg));
    burst(PROP_TYPES.find((p) => p.type === type)!.emoji, sendRef.current);
    toast(`Props sent to ${firstName(owner.name)}`);
    setMsg('');
    onClose();
  };
  return (
    <Sheet open={open} onClose={onClose} title={`Give ${firstName(owner.name)} Props`} sub={`${goal.title} · ${pct(goalView(db, goal).pct)} there`}>
      <div className="props-grid" role="radiogroup" aria-label="Type of Props">
        {PROP_TYPES.map((p) => (
          <button key={p.type} role="radio" aria-checked={type === p.type} className="prop-choice" onClick={() => setType(p.type)}>
            <span className="prop-choice__emoji" aria-hidden>
              {p.emoji}
            </span>
            <span>{p.label}</span>
          </button>
        ))}
      </div>
      <div className="field" style={{ marginTop: 18 }}>
        <label className="label" htmlFor="props-msg">
          Add a note <span className="muted" style={{ fontWeight: 500 }}>(optional)</span>
        </label>
        <input id="props-msg" className="input" maxLength={80} value={msg} onChange={(e) => setMsg(e.target.value)} placeholder="That pace though" />
      </div>
      <div className="sheet__actions">
        <button ref={sendRef} className="btn btn--pink btn--lg" onClick={send}>
          Give Props
        </button>
      </div>
    </Sheet>
  );
}

export function BackSheet({ goal, open, onClose }: { goal: Goal; open: boolean; onClose: () => void }) {
  const { db, update } = useStore();
  const { toast, burst } = useFeedback();
  const [amount, setAmount] = useState<number>(15);
  const [msg, setMsg] = useState(`You've got this ${firstName(userById(db, goal.user_id).name)}. Keep going.`);
  const [paying, setPaying] = useState(false);
  const owner = userById(db, goal.user_id);
  const v = goalView(db, goal);
  const { match, before, after } = previewBacking(db, goal, amount);
  const first = firstName(owner.name);

  return (
    <>
      <Sheet open={open && !paying} onClose={onClose} title={`Back ${first}`} sub="Invest in their success. If they finish, your stake comes back with a Believer return.">
        <div className="back-who">
          <Avatar user={owner} />
          <div style={{ flex: 1 }}>
            <strong>{goal.title}</strong>
            <div className="muted small">
              {metric(goal.current_value, goal.unit)} of {metric(goal.target_value, goal.unit)} · {daysLeftLabel(goal.end_date)}
            </div>
          </div>
        </div>
        <ProgressTrack value={goal.current_value} target={goal.target_value} label={`${first}'s progress`} thin />
        <div className="field" style={{ marginTop: 20 }}>
          <span className="label" id="back-amt">
            How much are you putting behind them?
          </span>
          <div className="amounts" role="group" aria-labelledby="back-amt">
            {BACKING_OPTIONS.map((a) => (
              <button key={a} className="amount" aria-pressed={amount === a} onClick={() => setAmount(a)}>
                ${a}
              </button>
            ))}
          </div>
        </div>
        <div className="pool-preview" aria-live="polite">
          <div>
            <span className="muted small">Prize now</span>
            <span className="score">{money(before.total)}</span>
          </div>
          <span className="pool-preview__arrow" aria-hidden>
            →
          </span>
          <div>
            <span className="muted small">
              You {money(amount)}
              {match > 0 ? ` + sponsor ${money(match)}` : ''}
            </span>
            <span className="score" style={{ color: 'var(--blue)' }}>
              {money(after.total)}
            </span>
          </div>
        </div>
        {match < amount && (
          <Notice tone="warn">
            {match === 0
              ? `The sponsor match on ${first}'s goal is used up. Your backing still grows the prize.`
              : `Only ${money(match)} of sponsor match is left on this goal.`}
          </Notice>
        )}
        <dl className="kv" style={{ marginTop: 16 }}>
          <dt>If {first} finishes</dt>
          <dd style={{ color: 'var(--green)' }}>You get {money(backerReturn(amount))} back</dd>
          <dt>If {first} misses</dt>
          <dd>{money(amount)} funds future Sogo rewards</dd>
        </dl>
        <p className="tiny muted" style={{ marginTop: 8 }}>
          Believer return is {Math.round(BACKER_RETURN_RATE * 100)}%, paid from the Sogo community pool. {v.backings.length > 0 && `${v.backings.length} ${v.backings.length === 1 ? 'person has' : 'people have'} already backed ${first}.`}
        </p>
        <div className="field" style={{ marginTop: 16 }}>
          <label className="label" htmlFor="back-msg">
            Your message
          </label>
          <input id="back-msg" className="input" maxLength={100} value={msg} onChange={(e) => setMsg(e.target.value)} />
        </div>
        <div className="sheet__actions">
          <button className="btn btn--blue btn--lg" onClick={() => setPaying(true)}>
            Back {first} with {money(amount)}
          </button>
        </div>
      </Sheet>
      <PaymentSheet
        open={open && paying}
        onClose={() => setPaying(false)}
        request={{ amount, purpose: 'backing', referenceId: goal.id, description: `Backing ${owner.name}` }}
        title={`Back ${first} with ${money(amount)}`}
        processingText={`Placing your ${money(amount)} behind ${first}…`}
        breakdown={[
          { label: 'Your backing', value: money(amount) },
          { label: 'Sponsor match', value: `+${money(match)}` },
          { label: `${first}'s new prize`, value: money(after.total), strong: true },
        ]}
        doneTitle={`You're backing ${first}.`}
        doneBody={<p className="muted">The prize pool just went from {money(before.total)} to {money(after.total)}. We'll tell you when they finish.</p>}
        onCommitted={() => {
          update((d) => backGoal(d, goal.id, amount, msg));
          burst('💰');
        }}
        onDone={() => {
          setPaying(false);
          toast(`You backed ${first}`);
          onClose();
        }}
        confirmLabel={`Invest ${money(amount)}`}
      />
    </>
  );
}
