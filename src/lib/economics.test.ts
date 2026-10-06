import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  backerMatch,
  backerReturn,
  challengeEconomics,
  defaultMilestones,
  goalPool,
  securedReward,
  settleGoal,
} from './economics.ts';

const goal = { commitment_amount: 15, sponsor_match: 15 };

test('50/50 base prize: $15 + $15 sponsor = $30', () => {
  assert.equal(goalPool(goal, []).total, 30);
});

test('a $15 backer is matched, growing the pool to $60', () => {
  const m = backerMatch(goal, [], 15);
  assert.equal(m, 15);
  const pool = goalPool(goal, [{ amount: 15, sponsor_match: m }]);
  assert.equal(pool.total, 60);
  assert.equal(pool.sponsorTotal, 30);
});

test('backer match is capped at 3x the commitment', () => {
  const existing = [
    { amount: 25, sponsor_match: 25 },
    { amount: 15, sponsor_match: 15 },
  ];
  assert.equal(backerMatch(goal, existing, 15), 5);
  assert.equal(backerMatch(goal, [...existing, { amount: 5, sponsor_match: 5 }], 15), 0);
});

test('no sponsor → no backer match', () => {
  assert.equal(backerMatch({ commitment_amount: 15, sponsor_match: 0 }, [], 15), 0);
});

test('milestones: halfway secures the stake value, final is the whole pool', () => {
  const ms = defaultMilestones(50, 15, 15).map((m) => ({ ...m, status: 'locked' as 'locked' | 'reached' }));
  assert.deepEqual(
    ms.map((m) => [m.title, m.target_value, m.reward_amount]),
    [
      ['Started', 10, 0],
      ['Halfway', 25, 15],
      ['Complete', 50, 30],
    ],
  );
  const pool = goalPool(goal, [{ amount: 15, sponsor_match: 15 }]);
  ms[0].status = 'reached';
  ms[1].status = 'reached';
  assert.equal(securedReward(ms, pool), 15);
  ms[2].status = 'reached';
  assert.equal(securedReward(ms, pool), 60);
});

test('completion: participant earns $60, backer gets $18 from the community pool', () => {
  const ms = defaultMilestones(50, 15, 15).map((m) => ({ ...m, status: 'reached' as const }));
  const s = settleGoal(goal, ms, [{ amount: 15, sponsor_match: 15 }], true);
  assert.equal(s.participantPayout, 60);
  assert.equal(s.backerReturns[0].amount, 18);
  assert.equal(backerReturn(15), 18);
  assert.equal(s.communityOut, 18);
  assert.equal(s.communityIn, 0);
});

test('miss after halfway: keep $15 secured, commitment + backing feed the community pool', () => {
  const ms = defaultMilestones(50, 15, 15).map((m) => ({
    ...m,
    status: (m.is_final ? 'locked' : 'reached') as 'locked' | 'reached',
  }));
  const s = settleGoal(goal, ms, [{ amount: 15, sponsor_match: 15 }], false);
  assert.equal(s.participantPayout, 15);
  assert.equal(s.sponsorSpent, 15);
  assert.equal(s.communityIn, 30); // $15 commitment + $15 backing
  assert.equal(s.sponsorReturned, 15); // unused backer match goes back to the sponsor
});

test('miss before any reward: whole commitment goes to the community pool', () => {
  const ms = defaultMilestones(50, 15, 15).map((m) => ({ ...m, status: 'locked' as const }));
  const s = settleGoal(goal, ms, [], false);
  assert.equal(s.participantPayout, 0);
  assert.equal(s.communityIn, 15);
  assert.equal(s.sponsorReturned, 15);
});

test('challenge: 10 runners at $15 + $15 → $300 pool, $30 per finisher', () => {
  const e = challengeEconomics({ commitment: 15, sponsor_contribution: 15, format: 'individual' }, 10);
  assert.equal(e.pool, 300);
  assert.equal(e.finisherReward, 30);
});

test('team challenge: 8 players at $15, winning team of 4 splits the pool', () => {
  const e = challengeEconomics({ commitment: 15, sponsor_contribution: 0, format: 'team' }, 8, 4);
  assert.equal(e.pool, 120);
  assert.equal(e.finisherReward, 30);
});
