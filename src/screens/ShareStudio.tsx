import { useEffect, useRef, useState } from 'react';
import { useStore } from '../lib/store';
import { back, shareUrl, Link } from '../lib/router';
import { challengeView, goalView, me, userById } from '../lib/selectors';
import { recordShare } from '../lib/commands';
import { firstName, money, num } from '../lib/format';
import { daysLeft } from '../lib/time';
import { canShareFiles, DESTINATIONS, downloadBlob, intentUrl, renderStory, type Destination } from '../lib/share';
import type { ShareType } from '../lib/types';
import { ShareCard, type CardContent, type CardTheme } from '../components/ShareCard';
import { BackButton, Notice, Switch } from '../components/ui';
import { Icon } from '../components/Icon';
import { useFeedback } from '../components/feedback';
import { ME } from '../lib/seed';

const UPPER = (s: string) => s.toUpperCase();

function scoreText(n: number, unit: string) {
  return unit === 'km' ? (Number.isInteger(n) ? String(n) : n.toFixed(1)) : num(n, 0);
}

export function ShareStudio({ kind, id }: { kind: string; id: string }) {
  const { db, update } = useStore();
  const { toast } = useFeedback();
  const cardRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.3);
  const [busy, setBusy] = useState<Destination | null>(null);
  const [failed, setFailed] = useState('');
  const [hideMoney, setHideMoney] = useState(false);
  const [doneHint, setDoneHint] = useState('');

  const type = kind as ShareType;
  const goal = db.goals.find((g) => g.id === id);
  const challenge = db.challenges.find((c) => c.id === id);
  const user = me(db);

  let content: CardContent | null = null;
  let text = '';
  let url = shareUrl('/');
  let defaultTheme: CardTheme = 'blue';

  if (goal && type !== 'challenge_invite') {
    const v = goalView(db, goal);
    const goalName = UPPER(goal.title.replace(/^(Run|Walk|Cycle|Complete|Do|Make|Sleep|Practice)\s/i, ''));
    const head = `${scoreText(goal.target_value, goal.unit)} ${UPPER(goal.unit)}`;
    const ticks = v.milestones.filter((m) => !m.is_final).map((m) => m.target_value / goal.target_value);
    const progress = goal.current_value / goal.target_value;
    const base = {
      ticks,
      progress,
      bigValue: scoreText(goal.current_value, goal.unit),
      bigUnit: `/ ${scoreText(goal.target_value, goal.unit)} ${UPPER(goal.unit)}`,
    };
    const verb = goal.title.split(' ')[0].toUpperCase();
    const kicker = goal.unit === 'km' && ['RUN', 'CYCLE', 'WALK'].includes(verb) ? `${head} ${verb === 'CYCLE' ? 'RIDE' : verb}` : goalName;
    switch (type) {
      case 'goal_started':
        content = { ...base, headline: 'PUT SOMETHING ON IT.', kicker, stat: `${Math.max(0, daysLeft(goal.end_date))} DAYS. NO EXCUSES.`, ticket: { value: money(v.pool.total), label: `${money(goal.commitment_amount)} ON MYSELF` }, footer: 'Stop sports betting. Start betting on yourself.' };
        text = `I just put ${money(goal.commitment_amount)} on myself: ${goal.title}. Hold me to it.`;
        break;
      case 'milestone': {
        const m = [...v.milestones].reverse().find((x) => x.status === 'reached' && !x.is_final);
        content = { ...base, headline: m ? `${scoreText(m.target_value, goal.unit)} ${UPPER(goal.unit)} DOWN.` : 'MILESTONE.', kicker, stat: `${scoreText(v.remaining, goal.unit)} ${UPPER(goal.unit)} TO GO`, ticket: m ? { value: money(m.reward_amount), label: 'SECURED' } : undefined, footer: 'Bet on your potential.' };
        text = `${m ? `${scoreText(m.target_value, goal.unit)} ${goal.unit} down` : 'Milestone hit'} on ${goal.title}. Halfway reward secured.`;
        defaultTheme = 'sun';
        break;
      }
      case 'backed': {
        const b = [...v.backings].reverse().find((x) => x.investor_id !== ME);
        const who = b ? firstName(userById(db, b.investor_id).name) : 'Someone';
        content = { ...base, headline: `${UPPER(who)} BACKED ME.`, kicker, quote: b?.message, ticket: { value: money(v.pool.total), label: 'NOW ON THE LINE' }, footer: 'Invest in someone’s success.' };
        text = `${who} just put money behind my goal: ${goal.title}. No pressure.`;
        defaultTheme = 'sun';
        break;
      }
      case 'completed':
      case 'reward': {
        const payout = goal.settled_payout ?? v.pool.total;
        const brand = v.claimedReward?.brand.name;
        content = {
          headline: type === 'reward' ? `${money(payout)} EARNED.` : 'I DID IT.',
          kicker: `${head} COMPLETE`,
          progress: 1,
          ticks,
          ticket: { value: money(payout), label: type === 'reward' && brand ? `${UPPER(brand)} REWARD UNLOCKED` : 'REWARD UNLOCKED' },
          footer: 'BET ON YOURSELF.',
        };
        text = `I did it. ${goal.title}, done. ${money(payout)} reward unlocked on Sogo.`;
        break;
      }
      default: {
        const left = v.remaining;
        content = { ...base, headline: 'I BET ON MYSELF.', kicker, stat: `${(progress * 100).toFixed(1)}% · ${scoreText(left, goal.unit)} ${UPPER(goal.unit)} TO GO`, ticket: { value: money(v.pool.total), label: 'ON THE LINE' }, footer: 'Stop sports betting. Start betting on yourself.' };
        text = `${scoreText(goal.current_value, goal.unit)} of ${scoreText(goal.target_value, goal.unit)} ${goal.unit}. ${scoreText(left, goal.unit)} to go and ${money(v.pool.total)} on the line.`;
      }
    }
  } else if (challenge) {
    const cv = challengeView(db, challenge);
    const t = challenge.takeover;
    const mine = cv.mine?.progress ?? 0;
    url = shareUrl(`/c/${challenge.id}?ref=${user.id}`);
    content = {
      brandName: t ? 'CONCEPT CAMPAIGN' : undefined,
      brandColors: t ? { bg: t.bg, fg: t.fg, accent: t.accent } : undefined,
      headline: t ? t.campaign_name : UPPER(challenge.title),
      kicker: t ? UPPER(t.headline) : UPPER(challenge.description.replace(/\.$/, '')),
      bigValue: cv.joined && challenge.format !== 'team' ? num(mine) : undefined,
      bigUnit: cv.joined && challenge.format !== 'team' ? `/ ${num(challenge.target_value)}` : undefined,
      progress: cv.joined && challenge.format !== 'team' ? mine / challenge.target_value : undefined,
      stat: cv.status === 'ended' ? 'FINAL' : `${Math.max(0, cv.daysLeft)} DAYS LEFT · ${UPPER(challenge.description.replace(/\.$/, ''))}`,
      ticket: { value: money(challenge.format === 'team' ? cv.econ.pool : cv.econ.finisherReward), label: challenge.format === 'team' ? 'ON THE GAME' : 'TO EARN' },
      footer: cv.joined ? 'THINK YOU CAN BEAT ME? JOIN ME ON SOGO.' : 'JOIN ME ON SOGO.',
    };
    if (t) defaultTheme = 'brand';
    text = cv.joined
      ? `I'm taking on ${t ? `the ${t.campaign_name.toLowerCase().replace(/\b\w/g, (m) => m.toUpperCase())} ` : ''}${t?.headline ?? challenge.title}. ${num(mine)} / ${num(challenge.target_value)}, ${Math.max(0, cv.daysLeft)} days left. Think you can beat me?`
      : `${challenge.description} Who's in?`;
  }

  const [theme, setTheme] = useState<CardTheme>(defaultTheme);

  useEffect(() => {
    const fit = () => {
      const el = stageRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      setScale(Math.min((r.width - 8) / 1080, (r.height - 8) / 1920, 0.42));
    };
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, []);

  if (!content)
    return (
      <div className="page">
        <Notice tone="error">There's nothing to share here.</Notice>
        <Link to="/home" className="btn btn--sm" style={{ marginTop: 12 }}>
          Home
        </Link>
      </div>
    );

  const record = (d: Destination) =>
    update((x) => recordShare(x, type, d, goal ? { goal_id: goal.id } : { challenge_id: challenge?.id }));

  const go = async (dest: Destination) => {
    setFailed('');
    setDoneHint('');
    const link = intentUrl(dest, text, url);
    if (dest === 'copy') {
      try {
        await navigator.clipboard.writeText(`${text} ${url}`);
        toast('Link copied');
        record(dest);
      } catch {
        setFailed('Your browser blocked the clipboard. Long-press the link below to copy it.');
      }
      return;
    }
    if (link) {
      window.open(link, '_blank', 'noopener,noreferrer');
      record(dest);
      return;
    }
    // Visual destinations: render the 9:16 PNG and hand it to the OS share sheet, or download it.
    if (!cardRef.current) return;
    setBusy(dest);
    try {
      const blob = await renderStory(cardRef.current);
      const file = new File([blob], `sogo-${type}.png`, { type: 'image/png' });
      if (canShareFiles(file) && dest !== 'download') {
        await navigator.share({ files: [file], text: dest === 'native' ? `${text} ${url}` : undefined });
      } else {
        downloadBlob(blob, `sogo-${type}.png`);
        if (dest !== 'download' && dest !== 'native') {
          const app = DESTINATIONS.find((x) => x.id === dest)?.label ?? 'the app';
          setDoneHint(`Saved your story image. Open ${app} on your phone and add it to your story. Link to paste: ${url}`);
        } else toast('Story image saved');
      }
      record(dest);
    } catch (e) {
      if ((e as Error)?.name === 'AbortError') return; // user closed the share sheet
      setFailed('We couldn’t build the image this time. Try again, or copy the link instead.');
    } finally {
      setBusy(null);
    }
  };

  const themes: { id: CardTheme; label: string; swatch: string }[] = [
    ...(content.brandColors ? [{ id: 'brand' as CardTheme, label: 'Campaign', swatch: content.brandColors.bg }] : []),
    { id: 'blue', label: 'Blue', swatch: '#2340FF' },
    { id: 'sun', label: 'Sun', swatch: '#FFD23F' },
    { id: 'ink', label: 'Ink', swatch: '#111216' },
  ];
  const visibleDest = DESTINATIONS.filter((d) => d.id !== 'linkedin' || type === 'completed' || type === 'reward');

  return (
    <div className="studio on-dark">
      <header className="studio__bar">
        <BackButton onClick={() => back(goal ? `/goal/${goal.id}` : challenge ? `/c/${challenge.id}` : '/home')} />
        <h1 className="studio__title">Share</h1>
        <span style={{ width: 42 }} />
      </header>
      <div className="studio__layout">
        <div className="studio__stage" ref={stageRef}>
          <div className="studio__frame" style={{ width: 1080 * scale, height: 1920 * scale }}>
            <div style={{ transform: `scale(${scale})`, transformOrigin: 'top left', width: 1080, height: 1920 }}>
              <ShareCard ref={cardRef} content={content} theme={theme} hideMoney={hideMoney} />
            </div>
          </div>
        </div>
        <div className="studio__panel">
          <p className="studio__lede">{text}</p>
          <div className="studio__opts">
            <div className="studio__themes" role="radiogroup" aria-label="Card colour">
              {themes.map((t) => (
                <button key={t.id} role="radio" aria-checked={theme === t.id} className="theme-dot" onClick={() => setTheme(t.id)} title={t.label}>
                  <span style={{ background: t.swatch }} />
                  <span className="sr-only">{t.label}</span>
                </button>
              ))}
            </div>
            <label className="studio__toggle">
              <span>Hide amounts</span>
              <Switch checked={hideMoney} onChange={setHideMoney} label="Hide dollar amounts on the card" />
            </label>
          </div>
          <div className="dest-grid">
            {visibleDest.map((d) => (
              <button key={d.id} className={`dest dest--${d.id}`} onClick={() => go(d.id)} disabled={busy !== null} aria-busy={busy === d.id}>
                <span className="dest__icon" aria-hidden>
                  {d.id === 'copy' ? <Icon name="link" size={20} /> : d.id === 'native' ? <Icon name="share" size={20} /> : d.label[0]}
                </span>
                <span>{busy === d.id ? 'Building…' : d.label}</span>
              </button>
            ))}
          </div>
          <button className="btn btn--sun btn--lg btn--block" onClick={() => go('download')} disabled={busy !== null}>
            <Icon name="download" size={18} /> {busy === 'download' ? 'Building image…' : 'Save 1080×1920 image'}
          </button>
          {failed && (
            <div className="notice notice--error" role="alert" style={{ marginTop: 12 }}>
              <Icon name="alert" />
              <div>
                {failed}
                <div className="studio__url">{url}</div>
              </div>
            </div>
          )}
          {doneHint && (
            <div className="notice notice--ok" role="status" style={{ marginTop: 12 }}>
              <Icon name="check" />
              <div>{doneHint}</div>
            </div>
          )}
          {challenge && (
            <p className="tiny" style={{ opacity: 0.7, marginTop: 12 }}>
              The link opens this challenge directly, with your invite attached.
            </p>
          )}
          {challenge?.takeover && (
            <p className="tiny" style={{ opacity: 0.6, marginTop: 6 }}>
              Brand shown is an illustrative concept, not an actual partner.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
