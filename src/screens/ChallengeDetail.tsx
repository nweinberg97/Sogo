import { useState, type CSSProperties } from 'react';
import { useStore } from '../lib/store';
import { Link, back, navigate, useLocation } from '../lib/router';
import { challengeView, type ChallengeView } from '../lib/selectors';
import { joinChallenge, logChallengeProgress, recordTeamResult, withdrawChallenge, SOURCE_NAMES } from '../lib/commands';
import { firstName, money, num, plural } from '../lib/format';
import { longDate, shortDate, daysBetween } from '../lib/time';
import { ME } from '../lib/seed';
import { Avatar, BackButton, BrandTile, ConceptTag, CountUp, Notice, ProgressTrack, Sheet, Ticket, Wordmark } from '../components/ui';
import { Icon } from '../components/Icon';
import { PaymentSheet } from '../components/PaymentSheet';
import { useFeedback } from '../components/feedback';
import { FORMAT_LABEL } from '../components/ChallengeCard';
import { NotFound } from './NotFound';

const VERIFY_LABEL = { connected: 'Connected activity data', photo: 'Photo or video proof', self: 'Self-reported', human: 'Reviewed by Sogo' } as const;

export function ChallengeDetail({ id }: { id: string }) {
  const { db } = useStore();
  const c = db.challenges.find((x) => x.id === id);
  if (!c) return <NotFound />;
  return <ChallengePage v={challengeView(db, c)} />;
}

function ChallengePage({ v }: { v: ChallengeView }) {
  const { db, update } = useStore();
  const { toast, celebrate } = useFeedback();
  const { query } = useLocation();
  const c = v.challenge;
  const t = c.takeover;
  const signedIn = Boolean(db.session);
  const ref = query.get('ref');
  const inviter = ref ? db.users.find((u) => u.id === ref) : undefined;
  const [joining, setJoining] = useState<false | { team?: string }>(false);
  const [logging, setLogging] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [result, setResult] = useState(false);
  const isTeam = c.format === 'team';
  const teamSize = c.teams ? Math.round(c.capacity / c.teams.length) : 0;
  const days = daysBetween(c.start_date, c.end_date);
  const sponsorName = v.brand?.name ?? (c.sponsor_contribution > 0 ? 'Sogo reward partners' : undefined);
  const myRank = v.mine ? v.leaderboard.findIndex((r) => r.isMe) + 1 : 0;

  const startJoin = (team?: string) => {
    if (!signedIn) return navigate(`/login?next=${encodeURIComponent(`/c/${c.id}`)}`);
    if (v.isFull) return toast('This challenge is full. We’ll tell you if a spot opens.', 'error');
    setJoining({ team });
  };

  const style = t
    ? ({ ['--to-bg' as string]: t.bg, ['--to-fg' as string]: t.fg, ['--to-accent' as string]: t.accent } as CSSProperties)
    : undefined;

  const outcome = (
    <dl className="facts">
      <div>
        <dt>What you do</dt>
        <dd>{c.description}</dd>
      </div>
      <div>
        <dt>Target</dt>
        <dd>
          {c.format === 'personal_best'
            ? 'Any verified 5K faster than your PR'
            : isTeam
              ? `First team to ${c.target_value} wins`
              : c.format === 'ranked'
                ? 'Highest total wins'
                : `${num(c.target_value)} ${c.unit}`}
        </dd>
      </div>
      <div>
        <dt>By when</dt>
        <dd>
          {longDate(c.end_date)} · {days > 1 ? `${days} days` : 'one night'}
        </dd>
      </div>
      <div>
        <dt>Verified by</dt>
        <dd>{c.verification_note || VERIFY_LABEL[c.verification_method]}</dd>
      </div>
      <div>
        <dt>At stake</dt>
        <dd>{money(c.commitment)} from you</dd>
      </div>
      <div>
        <dt>You can earn</dt>
        <dd>
          {isTeam
            ? `${money(v.econ.finisherReward)} each if your team wins`
            : c.format === 'ranked'
              ? `Up to ${money(Math.round(v.econ.pool * 0.5))} for 1st`
              : `${money(v.econ.finisherReward)} reward`}
        </dd>
      </div>
      <div>
        <dt>Sponsor</dt>
        <dd>{sponsorName ? `${sponsorName}${c.sponsor_contribution ? ` · +${money(c.sponsor_contribution)} per person` : ''}` : 'None — players fund the pool'}</dd>
      </div>
      <div>
        <dt>When you finish</dt>
        <dd>{c.completion_condition}</dd>
      </div>
    </dl>
  );

  return (
    <div className={`challenge ${t ? 'challenge--takeover' : ''}`} style={style}>
      {!signedIn && (
        <div className="public-bar">
          <Wordmark size={24} />
          <Link to={`/login?next=${encodeURIComponent(`/c/${c.id}`)}`} className="btn btn--sm">
            Join Sogo
          </Link>
        </div>
      )}

      <section className={`ch-hero ${t ? 'ch-hero--takeover on-dark' : ''}`}>
        <div className="ch-hero__bar">
          {signedIn && <BackButton onClick={() => back('/discover')} />}
          <span className="ch-hero__labels">
            {t && <span className="ch-hero__label">Brand challenge</span>}
            {!t && c.brand_id && <span className="chip chip--sun">Sponsored</span>}
            <span className={t ? 'ch-hero__label' : 'chip'}>{FORMAT_LABEL[c.format]}</span>
          </span>
        </div>
        {inviter && inviter.id !== ME && (
          <div className="invite-banner">
            <Avatar user={inviter} size="sm" />
            <span>
              <strong>{firstName(inviter.name)}</strong> is taking this on. Think you can beat them?
            </span>
          </div>
        )}
        {t ? (
          <>
            <div className="ch-hero__campaign">{t.campaign_name}</div>
            <h1 className="ch-hero__headline">{t.headline}</h1>
          </>
        ) : (
          <>
            <span className="ch-hero__emoji" aria-hidden>
              {c.emoji}
            </span>
            <h1 className="ch-hero__headline ch-hero__headline--plain">{c.title}</h1>
          </>
        )}
        <p className="ch-hero__goal">{c.description}</p>
        <div className="ch-hero__deal">
          <span>{days > 1 ? `${days} days` : 'One night'}</span>
          <span>{money(c.commitment)} commitment</span>
          {c.sponsor_contribution > 0 && (
            <span>
              {v.brand?.name ?? 'Sponsor'} +{money(c.sponsor_contribution)}
            </span>
          )}
          <Ticket
            value={isTeam || c.format === 'ranked' ? money(v.econ.pool) : money(v.econ.finisherReward)}
            label={isTeam || c.format === 'ranked' ? 'prize pool' : 'potential reward'}
            variant={t ? 'sun' : 'sun'}
            bump={v.count}
          />
        </div>
        <div className="ch-hero__stats">
          <div>
            <span className="score">
              <CountUp value={v.count} format={(n) => num(n, 0)} />
            </span>
            <span>{v.count === 1 ? 'participant' : 'participants'}</span>
          </div>
          {t?.extra_stat ? (
            <div>
              <span className="score">{num(t.extra_stat.value + (v.mine?.progress ?? 0) * 4, 0)}</span>
              <span>{t.extra_stat.label}</span>
            </div>
          ) : (
            <div>
              <span className="score">{money(v.econ.pool)}</span>
              <span>prize pool</span>
            </div>
          )}
          <div>
            <span className="score">{v.status === 'upcoming' ? shortDate(c.start_date) : v.status === 'ended' ? 'Done' : Math.max(0, v.daysLeft)}</span>
            <span>{v.status === 'upcoming' ? 'start date' : v.status === 'ended' ? 'ended' : 'days left'}</span>
          </div>
        </div>
        <div className="ch-hero__cta">
          {v.status === 'ended' ? (
            <span className="ch-hero__closed">This challenge has ended.</span>
          ) : v.joined ? (
            <span className="ch-hero__in">
              <Icon name="check" size={18} /> You're in{isTeam && v.mine?.team_id ? ` · Team ${c.teams?.find((x) => x.id === v.mine?.team_id)?.name}` : ''}
            </span>
          ) : isTeam ? null : (
            <button className={`btn btn--lg btn--commit ${t ? 'ch-hero__join' : 'btn--sun'}`} onClick={() => startJoin()} disabled={v.isFull}>
              {v.isFull ? 'Challenge full' : 'Join challenge'}
            </button>
          )}
          {!v.joined && v.status !== 'ended' && !v.isFull && v.spotsLeft <= 10 && <span className="ch-hero__spots">{plural(v.spotsLeft, 'spot')} left</span>}
          {v.isFull && !v.joined && v.status !== 'ended' && <span className="ch-hero__spots">All {c.capacity} spots taken</span>}
        </div>
        {t && (
          <div className="ch-hero__foot">
            <span>Powered by Sogo</span>
            <span>Reward partner: {v.brand?.name}</span>
            <ConceptTag light />
          </div>
        )}
      </section>

      <div className="page challenge__body">
        {v.joined && v.mine && v.status !== 'ended' && !isTeam && c.format !== 'head_to_head' && (
          <section className="panel my-progress" aria-labelledby="mine-h">
            <div className="my-progress__head">
              <div>
                <h2 id="mine-h" className="section__title">
                  Your progress
                </h2>
                <p className="muted small">
                  {c.format === 'ranked' ? `Rank #${myRank} of ${v.leaderboard.length} tracked` : v.mine.status === 'completed' ? 'Finished. Reward unlocked.' : `${num(Math.max(0, c.target_value - v.mine.progress))} ${c.unit} to go`}
                </p>
              </div>
              <span className="score my-progress__val">
                {num(v.mine.progress)}
                <span className="muted"> / {num(c.target_value)}</span>
              </span>
            </div>
            <ProgressTrack value={v.mine.progress} target={c.target_value} label="Your challenge progress" />
            <div className="my-progress__actions">
              {v.mine.status === 'joined' && (
                <button className="btn btn--blue" onClick={() => setLogging(true)}>
                  {c.verification_method === 'connected' ? `Sync from ${SOURCE_NAMES.apple_health}` : 'Log progress'}
                </button>
              )}
              {v.claimable > 0 && (
                <Link to={`/claim/challenge/${c.id}`} className="btn btn--sun">
                  Choose your {money(v.claimable)} prize
                </Link>
              )}
              <Link to={`/share/challenge_invite/${c.id}`} className="btn btn--soft">
                <Icon name="share" size={16} /> Challenge your friends
              </Link>
              {v.mine.status === 'joined' && (
                <button className="link-btn" style={{ color: 'var(--muted)' }} onClick={() => setLeaving(true)}>
                  Withdraw
                </button>
              )}
            </div>
          </section>
        )}

        {v.status === 'ended' && v.mine && (
          <Notice tone={v.mine.status === 'won' || v.mine.status === 'completed' ? 'ok' : 'info'}>
            {v.mine.status === 'won' || v.mine.status === 'completed'
              ? v.claimed
                ? 'You won this one. Reward claimed.'
                : (
                    <>
                      You won this one.{' '}
                      <Link to={`/claim/challenge/${c.id}`} className="link-btn">
                        Choose your {money(v.claimable)} prize
                      </Link>
                    </>
                  )
              : 'Not this time. Your stake went to the winners. Run it back?'}
          </Notice>
        )}

        <div className="challenge__cols">
          <section className="panel" aria-labelledby="facts-h">
            <h2 id="facts-h" className="section__title" style={{ marginBottom: 14 }}>
              The deal
            </h2>
            {outcome}
          </section>

          <section className="panel" aria-labelledby="pool-h">
            <h2 id="pool-h" className="section__title" style={{ marginBottom: 14 }}>
              Prize pool
            </h2>
            <dl className="kv">
              <dt>Participant commitments</dt>
              <dd>
                {v.count} × {money(c.commitment)} = {money(v.econ.commitments)}
              </dd>
              <dt>Sponsor contribution</dt>
              <dd>{c.sponsor_contribution ? `${v.count} × ${money(c.sponsor_contribution)} = ${money(v.econ.sponsor)}` : '—'}</dd>
              <dt style={{ color: 'var(--ink)', fontWeight: 700 }}>Prize pool</dt>
              <dd className="kv__total">{money(v.econ.pool)}</dd>
            </dl>
            <p className="muted small" style={{ marginTop: 12 }}>
              {isTeam
                ? `Winning team of ${teamSize} splits it: ${money(v.econ.finisherReward)} each.`
                : c.format === 'ranked'
                  ? 'Top 3 split it 50 / 30 / 20.'
                  : c.format === 'head_to_head'
                    ? 'Winner takes both stakes plus the sponsor match.'
                    : `Everyone who finishes earns ${money(v.econ.finisherReward)}. Stakes from people who don't finish fund future Sogo rewards.`}
            </p>
            {v.creator && (
              <p className="small" style={{ marginTop: 12 }}>
                Started by <Link to={`/u/${v.creator.id}`}>{v.creator.id === ME ? 'you' : v.creator.name}</Link>
              </p>
            )}
          </section>
        </div>

        {isTeam && v.teamTotals && (
          <section className="section" aria-labelledby="teams-h">
            <div className="section__head">
              <h2 id="teams-h" className="section__title">
                Teams
              </h2>
              <span className="muted small">
                {v.count} / {c.capacity} players
              </span>
            </div>
            <div className="teams">
              {v.teamTotals.map((tm) => (
                <div key={tm.id} className={`team team--${tm.id} ${c.winner_team_id === tm.id ? 'is-winner' : ''}`}>
                  <div className="team__head">
                    <h3>Team {tm.name}</h3>
                    {c.winner_team_id === tm.id && <span className="chip chip--ink">Winners</span>}
                    <span className="muted small">
                      {tm.members.length}/{teamSize}
                    </span>
                  </div>
                  <ul className="list">
                    {tm.members.map((m) => (
                      <li key={m.user.id} className="row">
                        <Avatar user={m.user} size="sm" />
                        <span className="row__main">{m.isMe ? 'You' : m.user.name}</span>
                      </li>
                    ))}
                    {Array.from({ length: Math.max(0, teamSize - tm.members.length) }).map((_, i) => (
                      <li key={i} className="row team__open">
                        Open spot
                      </li>
                    ))}
                  </ul>
                  {!v.joined && v.status !== 'ended' && tm.members.length < teamSize && (
                    <button className="btn btn--sm btn--block" onClick={() => startJoin(tm.id)}>
                      Join Team {tm.name} · {money(c.commitment)}
                    </button>
                  )}
                </div>
              ))}
            </div>
            {v.joined && v.status !== 'ended' && (
              <div className="result-box">
                <div>
                  <strong>Game over?</strong>
                  <p className="muted small">Both captains confirm the final score. In the demo, you confirm for both.</p>
                </div>
                <button className="btn" onClick={() => setResult(true)} disabled={v.count < c.capacity}>
                  Record result
                </button>
              </div>
            )}
            {v.joined && v.count < c.capacity && v.status !== 'ended' && (
              <p className="tiny muted" style={{ marginTop: 8 }}>
                Results open once all {c.capacity} spots are filled.{' '}
                <Link to={`/share/challenge_invite/${c.id}`} className="link-btn">
                  Invite someone
                </Link>
              </p>
            )}
          </section>
        )}

        {!isTeam && (
          <section className="section" aria-labelledby="lb-h">
            <div className="section__head">
              <h2 id="lb-h" className="section__title">
                Leaderboard
              </h2>
              {c.leaderboard_rule && <span className="muted small">{c.leaderboard_rule}</span>}
            </div>
            {v.leaderboard.length === 0 ? (
              <p className="muted">No one's on the board yet. First in sets the pace.</p>
            ) : (
              <ol className="leaderboard">
                {v.leaderboard.map((r, i) => (
                  <li key={r.user.id} className={`lb ${r.isMe ? 'is-me' : ''}`}>
                    <span className="lb__rank score">{i + 1}</span>
                    <Avatar user={r.user} size="sm" />
                    <span className="lb__name">{r.isMe ? 'You' : r.user.name}</span>
                    <span className="lb__bar">
                      <ProgressTrack value={r.progress} target={Math.max(c.target_value, v.leaderboard[0].progress)} label={`${r.user.name} progress`} thin />
                    </span>
                    <span className="lb__val tnum">
                      {num(r.progress)} {c.format === 'personal_best' ? 's' : ''}
                    </span>
                    {(r.status === 'completed' || r.status === 'won') && <span className="chip chip--green">Done</span>}
                  </li>
                ))}
              </ol>
            )}
            {c.base_participants > 0 && (
              <p className="tiny muted" style={{ marginTop: 8 }}>
                Showing people you know and the top of the board. {num(c.base_participants)} more are taking part.
              </p>
            )}
          </section>
        )}

        {signedIn && !v.joined && v.status !== 'ended' && (
          <section className="section">
            <Link to={`/share/challenge_invite/${c.id}`} className="btn btn--ghost">
              <Icon name="share" size={16} /> Send to a friend
            </Link>
          </section>
        )}
      </div>

      <PaymentSheet
        open={Boolean(joining)}
        onClose={() => setJoining(false)}
        request={{ amount: c.commitment, purpose: 'challenge_commitment', referenceId: c.id, description: c.title }}
        title={`Join ${t ? t.headline : c.title}`}
        processingText={`Your ${money(c.commitment)} commitment is being placed into ${t ? t.headline : c.title}.`}
        breakdown={[
          { label: 'Your commitment', value: money(c.commitment) },
          ...(c.sponsor_contribution ? [{ label: `${v.brand?.name ?? 'Sponsor'} contribution`, value: `+${money(c.sponsor_contribution)}` }] : []),
          { label: isTeam ? 'If your team wins' : c.format === 'ranked' ? 'Prize pool' : 'Potential reward', value: money(isTeam ? v.econ.finisherReward : c.format === 'ranked' ? v.econ.pool + c.commitment + c.sponsor_contribution : v.econ.finisherReward), strong: true },
        ]}
        doneTitle="You're in."
        doneBody={<p className="muted">{c.description}</p>}
        onCommitted={() => update((d) => joinChallenge(d, c.id, joining ? joining.team : undefined))}
        onDone={() => {
          setJoining(false);
          celebrate({
            kicker: t ? t.campaign_name : c.title,
            title: "You're in.",
            body: <p style={{ fontWeight: 600 }}>{c.description}</p>,
            confetti: false,
            actions: [
              { label: 'Challenge your friends', onClick: () => navigate(`/share/challenge_invite/${c.id}`) },
              { label: 'Later', onClick: () => undefined, variant: 'ghost-light' },
            ],
          });
        }}
      />

      {logging && v.mine && (
        <LogChallenge
          v={v}
          onClose={() => setLogging(false)}
          onLogged={(done) => {
            setLogging(false);
            if (done)
              celebrate({
                kicker: t?.campaign_name ?? c.title,
                title: 'You did it.',
                body: <Ticket value={money(v.econ.finisherReward)} label="reward unlocked" variant="white" />,
                actions: [
                  { label: 'Choose your prize', onClick: () => navigate(`/claim/challenge/${c.id}`) },
                  { label: 'Share', onClick: () => navigate(`/share/challenge_invite/${c.id}`), variant: 'ghost-light' },
                ],
              });
          }}
        />
      )}

      <Sheet
        open={leaving}
        onClose={() => setLeaving(false)}
        title="Withdraw from this challenge?"
        sub={
          v.status === 'upcoming'
            ? `It hasn't started, so your ${money(c.commitment)} comes straight back.`
            : `It's already started, so your ${money(c.commitment)} goes to the community pool that funds future rewards.`
        }
      >
        <div className="sheet__actions">
          <button className="btn btn--ghost" onClick={() => setLeaving(false)}>
            Stay in
          </button>
          <button
            className="btn btn--danger"
            onClick={() => {
              const r = update((d) => withdrawChallenge(d, c.id));
              setLeaving(false);
              toast(r === 'refunded' ? `Withdrawn. ${money(c.commitment)} refunded.` : 'Withdrawn.');
            }}
          >
            Withdraw
          </button>
        </div>
      </Sheet>

      <Sheet open={result} onClose={() => setResult(false)} title="Who won?" sub="This settles the game. Winners split the pool.">
        <div className="choices">
          {c.teams?.map((tm) => (
            <button
              key={tm.id}
              className="choice"
              onClick={() => {
                update((d) => recordTeamResult(d, c.id, tm.id));
                setResult(false);
                const won = v.mine?.team_id === tm.id;
                celebrate(
                  won
                    ? {
                        kicker: c.title,
                        title: 'Game won.',
                        body: <Ticket value={money(v.econ.finisherReward)} label="your share" variant="white" />,
                        actions: [{ label: 'Choose your prize', onClick: () => navigate(`/claim/challenge/${c.id}`) }],
                      }
                    : {
                        kicker: c.title,
                        title: 'Next time.',
                        tone: 'sun',
                        confetti: false,
                        body: <p>Team {tm.name} took it. Run it back next Friday?</p>,
                        actions: [{ label: 'Start a rematch', onClick: () => navigate('/challenges/new?format=team') }],
                      },
                );
              }}
            >
              <span className="choice__title">Team {tm.name}</span>
            </button>
          ))}
        </div>
      </Sheet>
    </div>
  );
}

function LogChallenge({ v, onClose, onLogged }: { v: ChallengeView; onClose: () => void; onLogged: (done: boolean) => void }) {
  const { update } = useStore();
  const { toast } = useFeedback();
  const c = v.challenge;
  const remaining = Math.max(1, c.target_value - (v.mine?.progress ?? 0));
  const def = c.unit === 'km' ? 5 : c.target_value >= 100 ? Math.min(remaining, Math.round(c.target_value / 10)) : 1;
  const [amount, setAmount] = useState<number>(def);
  return (
    <Sheet open onClose={onClose} title="Log progress" sub={c.verification_method === 'connected' ? 'Simulated sync from your connected app.' : 'Add what you did. Proof is checked before payout.'}>
      <div className="field">
        <label htmlFor="cl-amt" className="label">
          {c.goal_metric}
        </label>
        <div className="input-suffix">
          <input id="cl-amt" className="input input--big" type="number" min={0} value={amount || ''} onChange={(e) => setAmount(Number(e.target.value))} />
          <span>{c.unit}</span>
        </div>
      </div>
      <div className="sheet__actions">
        {c.format !== 'ranked' && c.format !== 'personal_best' && (
          <button className="btn btn--soft" onClick={() => setAmount(remaining)}>
            Finish it ({num(remaining)})
          </button>
        )}
        <button
          className="btn btn--blue"
          onClick={() => {
            if (!amount || amount <= 0) return;
            const r = update((d) => logChallengeProgress(d, c.id, amount));
            toast(`+${num(amount)} ${c.unit}`);
            onLogged(r.completed);
          }}
        >
          Log it
        </button>
      </div>
      {c.brand_id && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 14 }}>
          {v.brand && <BrandTile brand={v.brand} size={24} />}
          <span className="tiny muted">Concept campaign · not affiliated</span>
        </div>
      )}
    </Sheet>
  );
}
