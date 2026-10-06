import { useState } from 'react';
import { navigate } from '../lib/router';
import { useStore } from '../lib/store';
import { completeOnboarding } from '../lib/commands';
import { me } from '../lib/selectors';
import { firstName } from '../lib/format';
import { Wordmark } from '../components/ui';

export const FOCUS = [
  { id: 'move', label: 'Move more', emoji: '🚶' },
  { id: 'strength', label: 'Get stronger', emoji: '🏋️' },
  { id: 'run', label: 'Run', emoji: '🏃' },
  { id: 'sport', label: 'Improve my sport', emoji: '🏀' },
  { id: 'sleep', label: 'Sleep better', emoji: '🌙' },
  { id: 'consistency', label: 'Build consistency', emoji: '📆' },
  { id: 'train', label: 'Train for something', emoji: '🏁' },
  { id: 'other', label: 'Something else', emoji: '✨' },
];

const MOTIVATIONS = ['Competition', 'Rewards', 'Accountability', 'Progress', 'Friends', 'Proving it to myself'];

export function Onboarding() {
  const { db, update } = useStore();
  const [step, setStep] = useState<1 | 2>(1);
  const [focus, setFocus] = useState('');
  const [motivations, setMotivations] = useState<string[]>([]);
  const name = firstName(me(db).name);

  const finish = () => {
    update((d) => completeOnboarding(d, focus || 'run', motivations));
    navigate(`/new?focus=${focus || 'run'}&first=1`, { replace: true });
  };

  return (
    <div className="onboard">
      <div className="onboard__top">
        <Wordmark size={28} />
        <span className="onboard__count" aria-label={`Step ${step} of 2`}>
          <span className={step >= 1 ? 'is-on' : ''} />
          <span className={step >= 2 ? 'is-on' : ''} />
        </span>
      </div>
      {step === 1 ? (
        <section className="onboard__body" aria-labelledby="ob1">
          <p className="onboard__hi">Hey {name}.</p>
          <h1 id="ob1" className="onboard__q">
            What are you working toward?
          </h1>
          <div className="choices choices--big" role="radiogroup" aria-labelledby="ob1">
            {FOCUS.map((f) => (
              <button key={f.id} role="radio" aria-checked={focus === f.id} className="choice" onClick={() => setFocus(f.id)}>
                <span className="choice__emoji" aria-hidden>
                  {f.emoji}
                </span>
                <span className="choice__title">{f.label}</span>
              </button>
            ))}
          </div>
          <div className="onboard__actions">
            <button className="btn btn--lg" disabled={!focus} onClick={() => setStep(2)}>
              Next
            </button>
          </div>
        </section>
      ) : (
        <section className="onboard__body" aria-labelledby="ob2">
          <h1 id="ob2" className="onboard__q">
            What gets you out the door?
          </h1>
          <p className="muted">Pick as many as you like. We'll use it to suggest challenges.</p>
          <div className="pill-choices" role="group" aria-labelledby="ob2">
            {MOTIVATIONS.map((m) => {
              const on = motivations.includes(m);
              return (
                <button
                  key={m}
                  aria-pressed={on}
                  className="pill-choice"
                  onClick={() => setMotivations((x) => (on ? x.filter((y) => y !== m) : [...x, m]))}
                >
                  {m}
                </button>
              );
            })}
          </div>
          <div className="onboard__actions">
            <button className="btn btn--ghost btn--lg" onClick={() => setStep(1)}>
              Back
            </button>
            <button className="btn btn--blue btn--lg" onClick={finish}>
              Create my first goal
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
