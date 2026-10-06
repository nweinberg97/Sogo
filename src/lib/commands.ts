// State transitions. Each command mutates a cloned draft of the DB (see store.tsx).
// Payment-bearing commands assume the PaymentProvider already succeeded.

import type {
  Challenge,
  ChallengeParticipant,
  DataSource,
  DB,
  Goal,
  GoalCategory,
  LedgerKind,
  Milestone,
  PropType,
  ShareType,
  SponsorCampaign,
  VerificationMethod,
  Visibility,
} from './types';
import { ME } from './seed';
import { backerMatch, backerReturn, defaultMilestones, goalPool, round2, settleGoal, sponsorMatchFor } from './economics';
import { iso, now } from './time';
import { firstName, metric, money, uid } from './format';
import { brandById, challengeView, userById } from './selectors';

const ts = () => iso(now());

function ledger(d: DB, kind: LedgerKind, amount: number, label: string, ref_id?: string) {
  d.ledger.push({ id: uid('l'), user_id: ME, kind, amount: round2(amount), label, ref_id, created_at: ts() });
}

function activity(d: DB, actor_id: string, verb: string, emoji: string, refs: { goal_id?: string; challenge_id?: string } = {}) {
  d.activity.unshift({ id: uid('a'), actor_id, verb, emoji, created_at: ts(), ...refs });
  d.activity = d.activity.slice(0, 60);
}

export function notify(d: DB, emoji: string, text: string, href: string) {
  d.notifications.unshift({ id: uid('n'), emoji, text, href, read: false, created_at: ts() });
  d.notifications = d.notifications.slice(0, 30);
}

export function balanceOf(d: DB): number {
  return round2(
    d.ledger.filter((l) => l.user_id === ME && l.kind !== 'reward_earned' && l.kind !== 'forfeit').reduce((s, l) => s + l.amount, 0),
  );
}

// ───────────────────────────── Session ─────────────────────────────
export function completeOnboarding(d: DB, focus: string, motivations: string[]) {
  if (!d.session) return;
  d.session.onboarded = true;
  d.session.focus = focus;
  d.session.motivations = motivations;
}

// ───────────────────────────── Goals ─────────────────────────────
export interface GoalDraft {
  title: string;
  description: string;
  category: GoalCategory;
  metric_type: Goal['metric_type'];
  target_value: number;
  unit: string;
  end_date: string;
  milestones: { title: string; target_value: number; reward_amount: number; is_final: boolean }[];
  commitment_amount: number;
  reward_brand_id: string;
  verification_method: VerificationMethod;
  data_source?: DataSource;
  visibility: Visibility;
  emoji: string;
}

export function sponsorAvailable(d: DB, brandId: string, amount: number): boolean {
  const r = d.rewards.find((x) => x.brand_id === brandId);
  return Boolean(r && r.availability !== 'unavailable' && r.match_budget >= amount);
}

export function createGoal(d: DB, draft: GoalDraft): string {
  const id = uid('g');
  const reward = d.rewards.find((r) => r.brand_id === draft.reward_brand_id);
  const match = sponsorMatchFor(draft.commitment_amount, sponsorAvailable(d, draft.reward_brand_id, draft.commitment_amount));
  if (reward) reward.match_budget = round2(reward.match_budget - match);
  const goal: Goal = {
    id,
    user_id: ME,
    title: draft.title,
    description: draft.description,
    category: draft.category,
    metric_type: draft.metric_type,
    target_value: draft.target_value,
    current_value: 0,
    unit: draft.unit,
    start_date: ts(),
    end_date: draft.end_date,
    status: 'active',
    visibility: draft.visibility,
    verification_method: draft.verification_method,
    data_source: draft.data_source,
    commitment_amount: draft.commitment_amount,
    sponsor_match: match,
    reward_brand_id: draft.reward_brand_id,
    created_at: ts(),
    emoji: draft.emoji,
    seen_moments: [],
  };
  d.goals.push(goal);
  const ms = draft.milestones.length ? draft.milestones : defaultMilestones(draft.target_value, draft.commitment_amount, match);
  ms.forEach((m, i) =>
    d.milestones.push({
      id: `${id}_m${i + 1}`,
      goal_id: id,
      title: m.title,
      target_value: m.target_value,
      reward_amount: m.is_final ? round2(draft.commitment_amount + match) : m.reward_amount,
      is_final: m.is_final,
      status: 'locked',
      verification_status: 'not_required',
    }),
  );
  ledger(d, 'commitment', -draft.commitment_amount, `Committed to ${draft.title}`, id);
  if (draft.visibility !== 'private') activity(d, ME, `put ${money(draft.commitment_amount)} on ${draft.title}`, '🎯', { goal_id: id });
  return id;
}

export function editGoal(d: DB, goalId: string, patch: Partial<Pick<Goal, 'title' | 'description' | 'visibility' | 'reward_brand_id'>>) {
  const g = d.goals.find((x) => x.id === goalId);
  if (!g || g.user_id !== ME) return;
  Object.assign(g, patch);
}

export function markMoment(d: DB, goalId: string, moment: string) {
  const g = d.goals.find((x) => x.id === goalId);
  if (g && !g.seen_moments.includes(moment)) g.seen_moments.push(moment);
}

export interface ProgressResult {
  reached: Milestone[];
  completed: boolean;
}

function verificationFor(method: VerificationMethod): Milestone['verification_status'] {
  if (method === 'self') return 'self_reported';
  return 'verified';
}

export function addProgress(d: DB, goalId: string, amount: number): ProgressResult {
  const g = d.goals.find((x) => x.id === goalId);
  if (!g || g.status !== 'active' || amount <= 0) return { reached: [], completed: false };
  const before = g.current_value;
  g.current_value = Math.min(g.target_value, round2(g.current_value + amount));
  const reached: Milestone[] = [];
  for (const m of d.milestones.filter((x) => x.goal_id === goalId)) {
    if (m.status === 'locked' && g.current_value >= m.target_value) {
      m.status = 'reached';
      m.reached_at = ts();
      m.verification_status = verificationFor(g.verification_method);
      reached.push(m);
    }
  }
  if (g.user_id === ME && g.visibility !== 'private') {
    for (const m of reached.filter((x) => !x.is_final)) {
      activity(d, ME, `unlocked the ${metric(m.target_value, g.unit)} milestone`, '🎉', { goal_id: g.id });
      if (m.reward_amount > 0) notify(d, '🎉', `${metric(m.target_value, g.unit)} down. ${money(m.reward_amount)} secured.`, `/goal/${g.id}`);
    }
    const p80 = g.target_value * 0.8;
    if (before < p80 && g.current_value >= p80 && g.current_value < g.target_value) {
      notify(d, '🔥', `You're 80% through ${g.title}.`, `/goal/${g.id}`);
    }
  }
  const completed = g.current_value >= g.target_value;
  if (completed) settle(d, g.id, true);
  return { reached, completed };
}

/** Settles a goal: completion pays the full pool; a miss keeps the best secured milestone reward. */
export function settle(d: DB, goalId: string, completed: boolean) {
  const g = d.goals.find((x) => x.id === goalId);
  if (!g || g.status !== 'active') return;
  const ms = d.milestones.filter((m) => m.goal_id === g.id);
  const backings = d.backings.filter((b) => b.goal_id === g.id);
  const s = settleGoal(g, ms, backings, completed);
  g.status = completed ? 'completed' : 'failed';
  g.settled_payout = s.participantPayout;
  d.community_pool = round2(d.community_pool + s.communityIn - s.communityOut);
  backings.forEach((b, i) => {
    b.status = completed ? 'returned' : 'forfeited';
    if (completed && b.investor_id === ME) {
      ledger(d, 'backing_return', s.backerReturns[i].amount, `${firstName(userById(d, g.user_id).name)} did it — your backing came back with a Believer return`, g.id);
    }
  });
  if (g.user_id !== ME) {
    if (completed) activity(d, g.user_id, `completed ${g.title}`, '🏆', { goal_id: g.id });
    return;
  }
  if (completed) {
    if (g.visibility !== 'private') activity(d, ME, `completed ${g.title}`, '🏆', { goal_id: g.id });
    notify(d, '🎁', `Your ${money(s.participantPayout)} reward is ready.`, `/goal/${g.id}`);
  } else {
    const kept = s.participantPayout;
    const toPool = round2(s.communityIn - backings.reduce((x, b) => x + b.amount, 0));
    ledger(d, 'forfeit', 0, `${money(toPool)} from ${g.title} went to the community pool`, g.id);
    if (kept > 0) notify(d, '🎁', `You kept ${money(kept)} from ${g.title}. Choose your prize.`, `/goal/${g.id}`);
  }
}

export function claimReward(d: DB, goalId: string, rewardId: string) {
  const g = d.goals.find((x) => x.id === goalId);
  if (!g || g.status === 'active' || !g.settled_payout) return;
  if (d.goal_rewards.some((r) => r.goal_id === goalId && r.source !== 'challenge')) return;
  const reward = d.rewards.find((r) => r.id === rewardId)!;
  d.goal_rewards.push({ goal_id: goalId, source: 'goal', reward_id: rewardId, value: g.settled_payout, status: 'unlocked', unlocked_at: ts() });
  ledger(d, 'reward_earned', g.settled_payout, `${brandById(d, reward.brand_id)?.name} reward — ${g.title}`, goalId);
  const slot = d.slots.find((s) => s.reward_id === rewardId);
  if (slot) slot.selections += 1;
}

export function claimChallengeReward(d: DB, challengeId: string, rewardId: string) {
  const c = d.challenges.find((x) => x.id === challengeId);
  if (!c) return;
  const v = challengeView(d, c);
  if (!v.claimable) return;
  const reward = d.rewards.find((r) => r.id === rewardId)!;
  d.goal_rewards.push({ goal_id: challengeId, source: 'challenge', reward_id: rewardId, value: v.claimable, status: 'unlocked', unlocked_at: ts() });
  ledger(d, 'reward_earned', v.claimable, `${brandById(d, reward.brand_id)?.name} reward — ${c.title}`, challengeId);
}

// ───────────────────────────── Verification ─────────────────────────────
export function submitVerification(d: DB, goalId: string, amount: number, note: string, evidence_url?: string): string {
  const g = d.goals.find((x) => x.id === goalId)!;
  const id = uid('v');
  d.verifications.unshift({
    id,
    goal_id: goalId,
    method: g.verification_method,
    status: 'pending',
    amount,
    note,
    evidence_url,
    created_at: ts(),
  });
  return id;
}

export function reviewVerification(d: DB, verificationId: string, approve: boolean): ProgressResult | null {
  const v = d.verifications.find((x) => x.id === verificationId);
  if (!v || v.status !== 'pending') return null;
  v.status = approve ? 'approved' : 'rejected';
  v.reviewed_by = 'Sogo review (demo)';
  v.reviewed_at = ts();
  if (!approve) {
    notify(d, '📷', 'One proof upload needs another look. Add a clearer photo to count it.', `/goal/${v.goal_id}`);
    return null;
  }
  return addProgress(d, v.goal_id, v.amount);
}

/** Simulated connected-data sync. Returns the amount synced, or an error. */
export function syncConnected(d: DB, goalId: string): { ok: true; amount: number } | { ok: false; reason: string } {
  const g = d.goals.find((x) => x.id === goalId);
  if (!g || g.status !== 'active') return { ok: false, reason: 'This goal is not active.' };
  const src = g.data_source ?? 'apple_health';
  if (!d.settings.connected_sources[src]) {
    return { ok: false, reason: `${SOURCE_NAMES[src]} is disconnected. Reconnect it in Settings to sync.` };
  }
  const remaining = g.target_value - g.current_value;
  const typical: Record<string, [number, number]> = {
    km: [3.2, 8.6],
    steps: [6000, 14000],
    nights: [1, 1],
    sessions: [1, 1],
    workouts: [1, 1],
  };
  const [lo, hi] = typical[g.unit] ?? [1, 1];
  let amount = lo === hi ? lo : lo + Math.random() * (hi - lo);
  amount = g.unit === 'km' ? Math.round(amount * 10) / 10 : Math.round(amount);
  amount = Math.min(amount, remaining);
  return { ok: true, amount };
}

export const SOURCE_NAMES: Record<DataSource, string> = {
  apple_health: 'Apple Health',
  strava: 'Strava',
  garmin: 'Garmin',
  fitbit: 'Fitbit',
  health_connect: 'Health Connect',
};

// ───────────────────────────── Social ─────────────────────────────
export const PROP_TYPES: { type: PropType; emoji: string; label: string }[] = [
  { type: 'clap', emoji: '👏', label: 'Nice work' },
  { type: 'fire', emoji: '🔥', label: 'Keep going' },
  { type: 'muscle', emoji: '💪', label: 'Beast mode' },
  { type: 'rocket', emoji: '🚀', label: "You're moving" },
  { type: 'heart', emoji: '❤️', label: 'Proud of you' },
  { type: 'bolt', emoji: '⚡', label: 'Finish strong' },
];

export function giveProps(d: DB, goalId: string, type: PropType, message: string) {
  const g = d.goals.find((x) => x.id === goalId);
  if (!g) return;
  d.props.unshift({ id: uid('p'), sender_id: ME, recipient_id: g.user_id, goal_id: goalId, type, message: message.trim().slice(0, 80), created_at: ts() });
  activity(d, ME, `gave ${firstName(userById(d, g.user_id).name)} Props`, PROP_TYPES.find((p) => p.type === type)!.emoji, { goal_id: goalId });
}

export function backGoal(d: DB, goalId: string, amount: number, message: string, investorId = ME) {
  const g = d.goals.find((x) => x.id === goalId);
  if (!g || g.status !== 'active') return null;
  const existing = d.backings.filter((b) => b.goal_id === goalId);
  const match = backerMatch(g, existing, amount);
  const before = goalPool(g, existing).total;
  d.backings.push({
    id: uid('b'),
    investor_id: investorId,
    goal_id: goalId,
    amount,
    sponsor_match: match,
    message: message.trim().slice(0, 100),
    status: 'active',
    potential_return: backerReturn(amount),
    created_at: ts(),
  });
  const after = goalPool(g, d.backings.filter((b) => b.goal_id === goalId)).total;
  const investor = firstName(userById(d, investorId).name);
  if (investorId === ME) {
    ledger(d, 'backing', -amount, `Backed ${firstName(userById(d, g.user_id).name)}: ${g.title}`, goalId);
    activity(d, ME, `invested ${money(amount)} in ${firstName(userById(d, g.user_id).name)}'s goal`, '💰', { goal_id: goalId });
  } else {
    activity(d, investorId, `invested ${money(amount)} in your goal`, '💰', { goal_id: goalId });
    if (g.user_id === ME) notify(d, '💰', `${investor} invested ${money(amount)} in ${g.title}.`, `/goal/${goalId}`);
  }
  return { match, before, after };
}

/** Demo: a friend backs one of my goals and sends Props with a message. */
export function simulateIncomingBacking(d: DB, goalId: string, fromId = 'u_jordan', amount = 15, message = "You've got this. Finish strong.") {
  const res = backGoal(d, goalId, amount, message, fromId);
  if (!res) return null;
  d.props.unshift({ id: uid('p'), sender_id: fromId, recipient_id: ME, goal_id: goalId, type: 'bolt', message, created_at: ts() });
  notify(d, '⚡', `${firstName(userById(d, fromId).name)} gave you Props: "${message}"`, `/goal/${goalId}`);
  return res;
}

// ───────────────────────────── Challenges ─────────────────────────────
export function joinChallenge(d: DB, challengeId: string, teamId?: string) {
  const c = d.challenges.find((x) => x.id === challengeId)!;
  const existing = d.participants.find((p) => p.challenge_id === challengeId && p.user_id === ME);
  if (existing) {
    existing.status = 'joined';
    existing.progress = 0;
    existing.team_id = teamId;
    existing.joined_at = ts();
  } else {
    d.participants.push({ challenge_id: challengeId, user_id: ME, progress: 0, status: 'joined', team_id: teamId, joined_at: ts() });
  }
  ledger(d, 'commitment', -c.commitment, `Joined ${c.title}`, challengeId);
  activity(d, ME, `joined ${c.takeover ? `${titleCase(c.takeover.campaign_name)} ` : ''}${c.title}`, c.emoji, { challenge_id: challengeId });
}

const titleCase = (s: string) => s.split(' ').map((w) => (w.length <= 3 ? w : w[0] + w.slice(1).toLowerCase())).join(' ');

export function withdrawChallenge(d: DB, challengeId: string): 'refunded' | 'forfeited' {
  const c = d.challenges.find((x) => x.id === challengeId)!;
  const p = d.participants.find((x) => x.challenge_id === challengeId && x.user_id === ME && x.status === 'joined');
  if (!p) return 'refunded';
  p.status = 'withdrawn';
  const started = now() >= new Date(c.start_date).getTime();
  if (!started) {
    ledger(d, 'refund', c.commitment, `Left ${c.title} before it started — refunded`, challengeId);
    return 'refunded';
  }
  d.community_pool = round2(d.community_pool + c.commitment);
  ledger(d, 'forfeit', 0, `${money(c.commitment)} from ${c.title} went to the community pool`, challengeId);
  return 'forfeited';
}

export function logChallengeProgress(d: DB, challengeId: string, amount: number): { completed: boolean } {
  const c = d.challenges.find((x) => x.id === challengeId)!;
  const p = d.participants.find((x) => x.challenge_id === challengeId && x.user_id === ME && x.status === 'joined');
  if (!p) return { completed: false };
  p.progress = round2(p.progress + amount);
  if (c.format !== 'ranked' && c.format !== 'team' && c.format !== 'head_to_head' && p.progress >= c.target_value) {
    p.status = 'completed';
    activity(d, ME, `finished ${c.title}`, '🏆', { challenge_id: challengeId });
    notify(d, '🏆', `You finished ${c.title}. Your reward is ready.`, `/c/${challengeId}`);
    return { completed: true };
  }
  return { completed: false };
}

export function recordTeamResult(d: DB, challengeId: string, winningTeam: string) {
  const c = d.challenges.find((x) => x.id === challengeId)!;
  c.winner_team_id = winningTeam;
  c.status_override = 'ended';
  for (const p of d.participants.filter((x) => x.challenge_id === challengeId && x.status === 'joined')) {
    p.status = p.team_id === winningTeam ? 'won' : 'lost';
  }
  // Losing stakes go to the winning team (that is the format), not to the community pool.
  const name = c.teams?.find((t) => t.id === winningTeam)?.name ?? 'The winning team';
  activity(d, 'system', `Team ${name} won ${c.title}`, '🏆', { challenge_id: challengeId });
}

export interface ChallengeDraft {
  title: string;
  description: string;
  category: Challenge['category'];
  format: Challenge['format'];
  goal_metric: string;
  unit: string;
  target_value: number;
  days: number;
  commitment: number;
  capacity: number;
  verification_method: VerificationMethod;
  invite: string[];
}

export function createChallenge(d: DB, draft: ChallengeDraft): string {
  const id = uid('c');
  const start = now();
  const c: Challenge = {
    id,
    creator_id: ME,
    title: draft.title,
    description: draft.description,
    category: draft.category,
    format: draft.format,
    goal_metric: draft.goal_metric,
    unit: draft.unit,
    target_value: draft.target_value,
    completion_condition:
      draft.format === 'ranked'
        ? `Highest verified ${draft.goal_metric} when the challenge ends. Top 3 split the pool.`
        : draft.format === 'team'
          ? `First team to win ${draft.target_value} ${draft.unit}. Both captains confirm the result.`
          : `Reach ${draft.target_value.toLocaleString()} ${draft.unit} before the deadline.`,
    verification_method: draft.verification_method,
    verification_note:
      draft.verification_method === 'connected'
        ? 'Connected activity data'
        : draft.verification_method === 'photo'
          ? 'Photo or video proof'
          : draft.verification_method === 'human'
            ? 'Reviewed by Sogo'
            : 'Self-reported',
    start_date: iso(start),
    end_date: iso(start + draft.days * 86_400_000),
    commitment: draft.commitment,
    sponsor_contribution: draft.format === 'team' ? 0 : draft.commitment,
    capacity: draft.capacity,
    teams: draft.format === 'team' ? [{ id: 'blue', name: 'Blue' }, { id: 'sun', name: 'Yellow' }] : undefined,
    base_participants: 0,
    base_collective: 0,
    leaderboard_rule:
      draft.format === 'ranked'
        ? 'Ranked. Top 3 split 50/30/20.'
        : draft.format === 'team'
          ? 'Winning team splits the pool evenly.'
          : `Everyone who finishes earns ${money(draft.commitment * 2)}.`,
    emoji: { running: '🏃', basketball: '🏀', strength: '💪', walking: '👟', cycling: '🚴', wellness: '🧘', hiking: '⛰️' }[draft.category],
  };
  d.challenges.unshift(c);
  joinChallenge(d, id, draft.format === 'team' ? 'blue' : undefined);
  for (const fid of draft.invite) {
    activity(d, ME, `invited ${firstName(userById(d, fid).name)} to ${c.title}`, '✉️', { challenge_id: id });
  }
  return id;
}

// ───────────────────────────── Misc ─────────────────────────────
export function recordShare(d: DB, share_type: ShareType, destination: string, refs: { goal_id?: string; challenge_id?: string }) {
  d.shares.unshift({ id: uid('sh'), user_id: ME, share_type, asset_type: 'story_9x16', generated_at: ts(), destination, ...refs });
}

export function markAllRead(d: DB) {
  d.notifications.forEach((n) => (n.read = true));
}

// ───────────────────────────── Sponsor ─────────────────────────────
export interface CampaignDraft {
  brand_id: string;
  name: string;
  headline: string;
  goal: string;
  category: Challenge['category'];
  unit: string;
  target_value: number;
  target_audience: string;
  start_date: string;
  end_date: string;
  reward_value: number;
  sponsor_budget: number;
  participant_capacity: number;
  verification: VerificationMethod;
  campaign_type: SponsorCampaign['campaign_type'];
  status: SponsorCampaign['status'];
}

export function createCampaign(d: DB, draft: CampaignDraft): string {
  const id = uid('cp');
  const brand = brandById(d, draft.brand_id)!;
  let challenge_id: string | undefined;
  if (draft.status !== 'draft') {
    challenge_id = uid('c');
    const half = round2(draft.reward_value / 2);
    d.challenges.unshift({
      id: challenge_id,
      creator_id: 'brand',
      title: draft.headline,
      description: draft.goal,
      category: draft.category,
      format: 'individual',
      goal_metric: draft.unit,
      unit: draft.unit,
      target_value: draft.target_value,
      completion_condition: `Reach ${draft.target_value.toLocaleString()} ${draft.unit} before the deadline.`,
      verification_method: draft.verification,
      verification_note: draft.verification === 'connected' ? 'Connected activity data' : draft.verification === 'photo' ? 'Photo or video proof' : 'Reviewed by Sogo',
      start_date: draft.start_date,
      end_date: draft.end_date,
      commitment: half,
      sponsor_contribution: half,
      capacity: draft.participant_capacity,
      base_participants: 0,
      base_collective: 0,
      brand_id: draft.brand_id,
      campaign_id: id,
      emoji: { running: '🏃', basketball: '🏀', strength: '💪', walking: '👟', cycling: '🚴', wellness: '🧘', hiking: '⛰️' }[draft.category],
      takeover:
        draft.campaign_type === 'brand_takeover'
          ? { campaign_name: draft.name.toUpperCase(), headline: draft.headline, bg: brand.color, fg: brand.ink, accent: '#FFD23F' }
          : undefined,
      leaderboard_rule: `Everyone who finishes earns ${money(draft.reward_value)}.`,
    });
  }
  d.campaigns.unshift({
    id,
    brand_id: draft.brand_id,
    name: draft.campaign_type === 'brand_takeover' ? `${draft.name} — ${draft.headline}` : draft.headline,
    description: draft.goal,
    campaign_type: draft.campaign_type,
    target_audience: draft.target_audience,
    start_date: draft.start_date,
    end_date: draft.end_date,
    sponsor_budget: draft.sponsor_budget,
    participant_capacity: draft.participant_capacity,
    reward_value: draft.reward_value,
    verification: draft.verification,
    status: draft.status,
    challenge_id,
  });
  d.campaign_metrics.push({ campaign_id: id, participants: 0, completions: 0, rewards_distributed: 0, rewards_redeemed: 0, shares: 0, estimated_acquisition: 0, engagement: 0 });
  return id;
}

export function bookSlot(d: DB, slotId: string, brandId: string) {
  const slot = d.slots.find((s) => s.id === slotId);
  if (!slot || slot.status !== 'available') return;
  const reward = d.rewards.find((r) => r.brand_id === brandId);
  slot.status = 'booked';
  slot.brand_id = brandId;
  slot.reward_id = reward?.id;
  if (reward) reward.placement_tier = 'featured';
}

export type { ChallengeParticipant };
