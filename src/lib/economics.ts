// Sogo economics engine — pure functions, no side effects, no React.
// Every number the UI shows about money comes from here so the mechanics stay consistent.
//
// The model (simulated in this prototype; no real money moves):
//   • Participant commits C. The reward sponsor matches it 1:1 → base prize 2C.
//   • Friends can back the goal. The sponsor matches backing 1:1 up to a cap.
//     Everything a backer puts in (and its match) is added to the participant's prize.
//   • Milestones secure a partial reward along the way (e.g. halfway → C).
//     Rewards are tiers, not additive: completing replaces any partial reward with the full pool.
//   • On completion: participant earns the full pool. Each backer gets their stake back plus a
//     fixed Believer return, paid from the Sogo community pool.
//   • On a miss: the participant keeps the highest milestone reward they secured (paid from
//     the sponsor match first). Unused commitments and backing flow into the community pool,
//     which funds future rewards and backer returns. Unused sponsor match returns to the sponsor.

export const SPONSOR_MATCH_RATE = 1;
export const BACKER_RETURN_RATE = 0.2;
/** Sponsor matches backers up to this multiple of the participant's own commitment. */
export const BACKER_MATCH_CAP_MULTIPLE = 3;
export const COMMITMENT_OPTIONS = [5, 10, 15, 25, 50] as const;
export const MAX_COMMITMENT = 100;
export const BACKING_OPTIONS = [5, 10, 15, 25] as const;

export const round2 = (n: number) => Math.round(n * 100) / 100;

export interface PoolInput {
  commitment_amount: number;
  sponsor_match: number;
}
export interface BackingInput {
  amount: number;
  sponsor_match: number;
}

export interface PoolBreakdown {
  participant: number;
  sponsorBase: number;
  backers: number;
  sponsorBackers: number;
  sponsorTotal: number;
  total: number;
  backerCount: number;
}

export function sponsorMatchFor(commitment: number, sponsorAvailable = true): number {
  return sponsorAvailable ? round2(commitment * SPONSOR_MATCH_RATE) : 0;
}

export function goalPool(goal: PoolInput, backings: BackingInput[]): PoolBreakdown {
  const backers = round2(backings.reduce((s, b) => s + b.amount, 0));
  const sponsorBackers = round2(backings.reduce((s, b) => s + b.sponsor_match, 0));
  const sponsorTotal = round2(goal.sponsor_match + sponsorBackers);
  return {
    participant: goal.commitment_amount,
    sponsorBase: goal.sponsor_match,
    backers,
    sponsorBackers,
    sponsorTotal,
    total: round2(goal.commitment_amount + goal.sponsor_match + backers + sponsorBackers),
    backerCount: backings.length,
  };
}

export function backerMatchCap(goal: PoolInput): number {
  return goal.sponsor_match > 0 ? round2(goal.commitment_amount * BACKER_MATCH_CAP_MULTIPLE) : 0;
}

/** How much the sponsor will add if someone backs with `amount` now. */
export function backerMatch(goal: PoolInput, existing: BackingInput[], amount: number): number {
  const used = existing.reduce((s, b) => s + b.sponsor_match, 0);
  const remaining = Math.max(0, backerMatchCap(goal) - used);
  return round2(Math.min(amount * SPONSOR_MATCH_RATE, remaining));
}

export function backerReturn(amount: number): number {
  return round2(amount * (1 + BACKER_RETURN_RATE));
}

export interface MilestoneDraft {
  title: string;
  target_value: number;
  reward_amount: number;
  is_final: boolean;
}

/** Default milestone ladder: Started (20%), Halfway (50% → stake back as reward), Complete (100% → full pool). */
export function defaultMilestones(target: number, commitment: number, sponsorMatch: number): MilestoneDraft[] {
  const at = (p: number) => {
    const v = target * p;
    return target >= 20 ? Math.round(v) : Math.max(1, Math.round(v));
  };
  const base = commitment + sponsorMatch;
  return [
    { title: 'Started', target_value: at(0.2), reward_amount: 0, is_final: false },
    { title: 'Halfway', target_value: at(0.5), reward_amount: round2(base / 2), is_final: false },
    { title: 'Complete', target_value: target, reward_amount: base, is_final: true },
  ];
}

export interface MilestoneLike {
  target_value: number;
  reward_amount: number;
  is_final: boolean;
  status: 'locked' | 'reached';
}

export function milestoneValue(m: MilestoneLike, pool: PoolBreakdown): number {
  return m.is_final ? pool.total : m.reward_amount;
}

/** Reward currently secured by reached milestones (tiered, not additive). */
export function securedReward(milestones: MilestoneLike[], pool: PoolBreakdown): number {
  return milestones
    .filter((m) => m.status === 'reached')
    .reduce((best, m) => Math.max(best, milestoneValue(m, pool)), 0);
}

export function nextMilestone<T extends MilestoneLike>(milestones: T[], current: number): T | undefined {
  return [...milestones]
    .sort((a, b) => a.target_value - b.target_value)
    .find((m) => m.status === 'locked' && current < m.target_value);
}

export interface Settlement {
  outcome: 'completed' | 'failed';
  participantPayout: number;
  backerReturns: { index: number; amount: number }[];
  /** Paid out of the community pool (backer Believer returns). */
  communityOut: number;
  /** Flows into the community pool (unused commitments and backing). */
  communityIn: number;
  sponsorSpent: number;
  sponsorReturned: number;
}

export function settleGoal(
  goal: PoolInput,
  milestones: MilestoneLike[],
  backings: BackingInput[],
  completed: boolean,
): Settlement {
  const pool = goalPool(goal, backings);
  if (completed) {
    const backerReturns = backings.map((b, index) => ({ index, amount: backerReturn(b.amount) }));
    return {
      outcome: 'completed',
      participantPayout: pool.total,
      backerReturns,
      communityOut: round2(backerReturns.reduce((s, r) => s + r.amount, 0)),
      communityIn: 0,
      sponsorSpent: pool.sponsorTotal,
      sponsorReturned: 0,
    };
  }
  const partial = milestones
    .filter((m) => m.status === 'reached' && !m.is_final)
    .reduce((best, m) => Math.max(best, m.reward_amount), 0);
  const sponsorPaid = Math.min(partial, pool.sponsorBase);
  const fromCommitment = round2(partial - sponsorPaid);
  return {
    outcome: 'failed',
    participantPayout: round2(partial),
    backerReturns: backings.map((_, index) => ({ index, amount: 0 })),
    communityOut: 0,
    communityIn: round2(pool.participant - fromCommitment + pool.backers),
    sponsorSpent: round2(sponsorPaid),
    sponsorReturned: round2(pool.sponsorTotal - sponsorPaid),
  };
}

export interface ChallengeEconomics {
  participants: number;
  commitments: number;
  sponsor: number;
  pool: number;
  finisherReward: number;
}

export function challengeEconomics(
  c: { commitment: number; sponsor_contribution: number; format: string },
  participantCount: number,
  teamSize = 0,
): ChallengeEconomics {
  const commitments = round2(participantCount * c.commitment);
  const sponsor = round2(participantCount * c.sponsor_contribution);
  const pool = round2(commitments + sponsor);
  // Target-based formats: everyone who finishes earns their own stake + the sponsor match.
  // Team formats: the winning team splits the whole pool.
  const finisherReward =
    c.format === 'team' && teamSize > 0 ? round2(pool / teamSize) : round2(c.commitment + c.sponsor_contribution);
  return { participants: participantCount, commitments, sponsor, pool, finisherReward };
}

export function percent(current: number, target: number): number {
  if (target <= 0) return 0;
  return Math.max(0, Math.min(100, (current / target) * 100));
}
