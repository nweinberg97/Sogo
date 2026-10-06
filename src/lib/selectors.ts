import type { Backing, Brand, Challenge, ChallengeParticipant, ChallengeStatus, DB, Goal, Milestone, Prop, Reward, User } from './types';
import { ME } from './seed';
import {
  backerMatch,
  backerMatchCap,
  challengeEconomics,
  goalPool,
  nextMilestone,
  percent,
  securedReward,
  type PoolBreakdown,
} from './economics';
import { daysLeft, isPast, now } from './time';

export const userById = (db: DB, id: string): User =>
  db.users.find((u) => u.id === id) ?? { id, name: 'Sogo member', email: '', avatar: 'ink', bio: '', created_at: '' };

export const me = (db: DB) => userById(db, ME);
export const brandById = (db: DB, id?: string): Brand | undefined => db.brands.find((b) => b.id === id);
export const rewardForBrand = (db: DB, brandId: string): Reward | undefined => db.rewards.find((r) => r.brand_id === brandId);

export const friendIds = (db: DB) => db.friendships.filter((f) => f.user_id === ME).map((f) => f.friend_id);
export const friends = (db: DB) => friendIds(db).map((id) => userById(db, id));
export const isFriend = (db: DB, id: string) => friendIds(db).includes(id);

export interface GoalView {
  goal: Goal;
  owner: User;
  milestones: Milestone[];
  backings: Backing[];
  props: Prop[];
  pool: PoolBreakdown;
  pct: number;
  secured: number;
  next?: Milestone;
  daysLeft: number;
  overdue: boolean;
  remaining: number;
  brand?: Brand;
  claimedReward?: { reward: Reward; brand: Brand; value: number };
  pendingVerifications: number;
  /** Projection: on pace if progress share ≥ time share. */
  onPace: boolean;
  matchRemaining: number;
}

export function goalView(db: DB, goal: Goal): GoalView {
  const milestones = db.milestones.filter((m) => m.goal_id === goal.id).sort((a, b) => a.target_value - b.target_value);
  const backings = db.backings.filter((b) => b.goal_id === goal.id);
  const pool = goalPool(goal, backings);
  const gr = db.goal_rewards.find((r) => r.goal_id === goal.id && r.source !== 'challenge');
  const claimedReward = gr
    ? (() => {
        const reward = db.rewards.find((r) => r.id === gr.reward_id)!;
        return { reward, brand: brandById(db, reward.brand_id)!, value: gr.value };
      })()
    : undefined;
  const p = percent(goal.current_value, goal.target_value);
  const start = new Date(goal.start_date).getTime();
  const end = new Date(goal.end_date).getTime();
  const timeShare = Math.max(0.0001, Math.min(1, (now() - start) / Math.max(1, end - start)));
  const used = backings.reduce((s, b) => s + b.sponsor_match, 0);
  return {
    goal,
    owner: userById(db, goal.user_id),
    milestones,
    backings,
    props: db.props.filter((x) => x.goal_id === goal.id).sort((a, b) => b.created_at.localeCompare(a.created_at)),
    pool,
    pct: p,
    secured: securedReward(milestones, pool),
    next: nextMilestone(milestones, goal.current_value),
    daysLeft: daysLeft(goal.end_date),
    overdue: goal.status === 'active' && isPast(goal.end_date),
    remaining: Math.max(0, +(goal.target_value - goal.current_value).toFixed(2)),
    brand: brandById(db, goal.reward_brand_id),
    claimedReward,
    pendingVerifications: db.verifications.filter((v) => v.goal_id === goal.id && v.status === 'pending').length,
    onPace: p / 100 >= timeShare * 0.95,
    matchRemaining: Math.max(0, backerMatchCap(goal) - used),
  };
}

export const myGoals = (db: DB) => db.goals.filter((g) => g.user_id === ME);
export const myActiveGoals = (db: DB) =>
  myGoals(db)
    .filter((g) => g.status === 'active')
    .sort((a, b) => b.commitment_amount - a.commitment_amount || a.end_date.localeCompare(b.end_date));

/** Goals of someone else that I'm allowed to see. */
export function visibleGoals(db: DB, userId: string): Goal[] {
  const friend = isFriend(db, userId);
  return db.goals.filter(
    (g) => g.user_id === userId && (g.visibility === 'public' || (g.visibility === 'friends' && friend)),
  );
}

export function canSeeGoal(db: DB, g: Goal): boolean {
  if (g.user_id === ME) return true;
  return g.visibility === 'public' || (g.visibility === 'friends' && isFriend(db, g.user_id));
}

export function previewBacking(db: DB, goal: Goal, amount: number) {
  const backings = db.backings.filter((b) => b.goal_id === goal.id);
  const match = backerMatch(goal, backings, amount);
  const before = goalPool(goal, backings);
  const after = goalPool(goal, [...backings, { amount, sponsor_match: match }]);
  return { match, before, after };
}

// ───────────────────────────── Challenges ─────────────────────────────
export interface LeaderRow {
  user: User;
  progress: number;
  status: ChallengeParticipant['status'];
  team_id?: string;
  isMe: boolean;
}

export interface ChallengeView {
  challenge: Challenge;
  status: ChallengeStatus;
  brand?: Brand;
  count: number;
  spotsLeft: number;
  isFull: boolean;
  mine?: ChallengeParticipant;
  joined: boolean;
  leaderboard: LeaderRow[];
  collective: number;
  econ: ReturnType<typeof challengeEconomics>;
  daysLeft: number;
  creator?: User;
  claimable: number;
  claimed: boolean;
  teamTotals?: { id: string; name: string; members: LeaderRow[] }[];
}

export function challengeStatus(c: Challenge): ChallengeStatus {
  if (c.status_override) return c.status_override;
  const t = now();
  if (t < new Date(c.start_date).getTime()) return 'upcoming';
  if (t > new Date(c.end_date).getTime()) return 'ended';
  return 'active';
}

export function challengeView(db: DB, c: Challenge): ChallengeView {
  const rows = db.participants.filter((p) => p.challenge_id === c.id && p.status !== 'withdrawn');
  const mine = db.participants.find((p) => p.challenge_id === c.id && p.user_id === ME && p.status !== 'withdrawn');
  const count = c.base_participants + rows.length;
  const leaderboard: LeaderRow[] = rows
    .map((p) => ({ user: userById(db, p.user_id), progress: p.progress, status: p.status, team_id: p.team_id, isMe: p.user_id === ME }))
    .sort((a, b) => b.progress - a.progress);
  const teamSize = c.teams ? Math.max(1, Math.round(c.capacity / c.teams.length)) : 0;
  const econ = challengeEconomics(c, count, teamSize);
  const won = mine && (mine.status === 'won' || mine.status === 'completed');
  const claimed = db.goal_rewards.some((r) => r.source === 'challenge' && r.goal_id === c.id);
  return {
    challenge: c,
    status: challengeStatus(c),
    brand: brandById(db, c.brand_id),
    count,
    spotsLeft: Math.max(0, c.capacity - count),
    isFull: count >= c.capacity,
    mine,
    joined: Boolean(mine),
    leaderboard,
    collective: c.base_collective + rows.reduce((s, p) => s + p.progress, 0),
    econ,
    daysLeft: daysLeft(c.end_date),
    creator: c.creator_id === 'brand' ? undefined : userById(db, c.creator_id),
    claimable: won && !claimed ? econ.finisherReward : 0,
    claimed,
    teamTotals: c.teams?.map((t) => ({
      ...t,
      members: leaderboard.filter((r) => r.team_id === t.id),
    })),
  };
}

// ───────────────────────────── Wallet ─────────────────────────────
export function wallet(db: DB) {
  const mine = db.ledger.filter((l) => l.user_id === ME);
  const balance = mine.filter((l) => l.kind !== 'reward_earned' && l.kind !== 'forfeit').reduce((s, l) => s + l.amount, 0);
  const active = myActiveGoals(db);
  const committed =
    active.reduce((s, g) => s + g.commitment_amount, 0) +
    db.backings.filter((b) => b.investor_id === ME && b.status === 'active').reduce((s, b) => s + b.amount, 0) +
    db.participants
      .filter((p) => p.user_id === ME && p.status === 'joined')
      .reduce((s, p) => s + (db.challenges.find((c) => c.id === p.challenge_id)?.commitment ?? 0), 0);
  const earned = db.goal_rewards.reduce((s, r) => s + r.value, 0);
  const pending = active.reduce((s, g) => s + goalView(db, g).secured, 0);
  const forfeited = myGoals(db)
    .filter((g) => g.status === 'failed')
    .reduce((s, g) => s + Math.max(0, g.commitment_amount - Math.max(0, (g.settled_payout ?? 0) - g.sponsor_match)), 0);
  const potential = active.reduce((s, g) => s + goalView(db, g).pool.total, 0);
  return { balance: Math.round(balance * 100) / 100, committed, earned, pending, forfeited, potential, ledger: [...mine].reverse() };
}

// ───────────────────────────── Profile & achievements ─────────────────────────────
export function profileStats(db: DB, userId: string) {
  const goals = db.goals.filter((g) => g.user_id === userId);
  const done = goals.filter((g) => g.status !== 'active');
  const completed = goals.filter((g) => g.status === 'completed');
  const milestones = db.milestones.filter((m) => goals.some((g) => g.id === m.goal_id) && m.status === 'reached').length;
  const propsReceived = db.props.filter((p) => p.recipient_id === userId).length;
  const challengesCompleted = db.participants.filter(
    (p) => p.user_id === userId && (p.status === 'completed' || p.status === 'won'),
  ).length;
  let streak = 0;
  for (const g of [...done].sort((a, b) => b.end_date.localeCompare(a.end_date))) {
    if (g.status === 'completed') streak++;
    else break;
  }
  const backed = new Set(db.backings.filter((b) => b.investor_id === userId).map((b) => b.goal_id)).size;
  return {
    active: goals.filter((g) => g.status === 'active').length,
    completed: completed.length,
    finished: done.length,
    successRate: done.length ? Math.round((completed.length / done.length) * 100) : null,
    milestones,
    propsReceived,
    challengesCompleted,
    streak,
    backed,
  };
}

export interface Achievement {
  id: string;
  title: string;
  description: string;
  glyph: string;
  earned: boolean;
}

export function achievements(db: DB, userId: string): Achievement[] {
  const s = profileStats(db, userId);
  const started = db.goals.some((g) => g.user_id === userId);
  return [
    { id: 'first_bet', title: 'First Bet', description: 'Started your first Sogo goal.', glyph: '1', earned: started },
    { id: 'follow_through', title: 'Follow Through', description: 'Completed your first goal.', glyph: '✓', earned: s.completed >= 1 },
    { id: 'team_player', title: 'Team Player', description: "Invested in someone's success.", glyph: '+', earned: s.backed >= 1 },
    { id: 'on_fire', title: 'On Fire', description: 'Completed 3 goals in a row.', glyph: '3', earned: s.streak >= 3 },
    { id: 'believer', title: 'Believer', description: 'Backed 5 friends.', glyph: '5', earned: s.backed >= 5 },
    { id: 'finisher', title: 'Finisher', description: 'Completed a major challenge.', glyph: '★', earned: s.challengesCompleted >= 1 },
  ];
}

// ───────────────────────────── Sponsor ─────────────────────────────
export function campaignView(db: DB, campaignId: string) {
  const cp = db.campaigns.find((c) => c.id === campaignId)!;
  const base = db.campaign_metrics.find((m) => m.campaign_id === campaignId);
  const ch = cp.challenge_id ? db.challenges.find((c) => c.id === cp.challenge_id) : undefined;
  const cv = ch ? challengeView(db, ch) : undefined;
  const participants = cv ? cv.count : 0;
  const myCompletion = cv?.mine && (cv.mine.status === 'completed' || cv.mine.status === 'won') ? 1 : 0;
  const completions = (base?.completions ?? 0) + myCompletion;
  const sponsorCommitted = ch ? participants * ch.sponsor_contribution : cp.sponsor_budget;
  const isPlacement = cp.campaign_type === 'reward_placement' || cp.campaign_type === 'sponsored_rewards';
  const slot = db.slots.find((s) => s.campaign_id === cp.id);
  const selections = isPlacement
    ? (slot?.selections ?? 0) + db.goals.filter((g) => g.user_id === ME && g.reward_brand_id === cp.brand_id && g.status === 'active').length
    : 0;
  return {
    campaign: cp,
    brand: brandById(db, cp.brand_id)!,
    challenge: ch,
    challengeView: cv,
    participants,
    completions,
    completionRate: participants ? Math.round((completions / participants) * 100) : 0,
    rewardsDistributed: (base?.rewards_distributed ?? 0) + myCompletion * cp.reward_value,
    rewardsRedeemed: base?.rewards_redeemed ?? 0,
    shares: (base?.shares ?? 0) + db.shares.filter((s) => s.challenge_id && s.challenge_id === cp.challenge_id).length,
    acquisition: base?.estimated_acquisition ?? 0,
    engagement: base?.engagement ?? 0,
    budgetUsed: cp.status === 'draft' ? 0 : isPlacement ? Math.round(cp.sponsor_budget * 0.38) : Math.min(cp.sponsor_budget, sponsorCommitted),
    impressions: slot?.impressions ?? 0,
    selections,
    // Rough illustrative value: verified participants × $9 engagement value + acquisitions × $60 + shares × $1.50.
    estValue: Math.round(participants * 9 + (base?.estimated_acquisition ?? 0) * 60 + (base?.shares ?? 0) * 1.5),
    isPlacement,
  };
}

export function unreadCount(db: DB) {
  return db.notifications.filter((n) => !n.read).length;
}

export const featuredRewards = (db: DB) =>
  db.slots
    .filter((s) => s.status === 'booked' && s.reward_id)
    .sort((a, b) => a.position - b.position)
    .map((s) => db.rewards.find((r) => r.id === s.reward_id)!)
    .filter(Boolean);

export const standardRewards = (db: DB) => db.rewards.filter((r) => r.placement_tier === 'standard');

export function claimablePrizes(db: DB) {
  const goals = myGoals(db)
    .filter((g) => g.status !== 'active' && (g.settled_payout ?? 0) > 0)
    .filter((g) => !db.goal_rewards.some((r) => r.goal_id === g.id && r.source !== 'challenge'));
  const challenges = db.challenges.map((c) => challengeView(db, c)).filter((v) => v.claimable > 0);
  return { goals, challenges };
}
