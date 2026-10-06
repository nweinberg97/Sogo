import type {
  ActivityItem,
  Backing,
  Brand,
  CampaignMetric,
  Challenge,
  ChallengeParticipant,
  DB,
  Goal,
  GoalReward,
  LedgerEntry,
  Milestone,
  Notification,
  Prop,
  Reward,
  RewardSlot,
  SponsorCampaign,
  User,
  Verification,
} from './types';
import { defaultMilestones, sponsorMatchFor } from './economics';
import { daysFromNow, hoursAgo, iso, nextWeekday, now } from './time';

export const DB_VERSION = 3;
export const ME = 'u_me';

// ───────────────────────────── Brands (illustrative concepts only) ─────────────────────────────
// None of these companies is affiliated with Sogo. They show what a future marketplace could hold.
export const BRANDS: Brand[] = [
  { id: 'nike', name: 'Nike', description: 'Athletic footwear and apparel', category: 'Sport', status: 'concept', color: '#111111', ink: '#FFFFFF' },
  { id: 'lululemon', name: 'lululemon', description: 'Technical athletic apparel', category: 'Apparel', status: 'concept', color: '#C8102E', ink: '#FFFFFF' },
  { id: 'spotify', name: 'Spotify', description: 'Music and podcasts', category: 'Entertainment', status: 'concept', color: '#1ED760', ink: '#0B1A10' },
  { id: 'amazon', name: 'Amazon', description: 'Everything store', category: 'Retail', status: 'concept', color: '#232F3E', ink: '#FFFFFF' },
  { id: 'apple', name: 'Apple', description: 'Devices, apps and services', category: 'Tech', status: 'concept', color: '#E9E9EE', ink: '#111111' },
  { id: 'mec', name: 'MEC', description: 'Outdoor gear co-op', category: 'Outdoor', status: 'concept', color: '#0D6B3C', ink: '#FFFFFF' },
  { id: 'arcteryx', name: "Arc'teryx", description: 'Mountain apparel', category: 'Outdoor', status: 'concept', color: '#2B2B2B', ink: '#FFFFFF' },
  { id: 'classpass', name: 'ClassPass', description: 'Fitness classes', category: 'Fitness', status: 'concept', color: '#0055FF', ink: '#FFFFFF' },
  { id: 'wholefoods', name: 'Whole Foods', description: 'Grocery', category: 'Food', status: 'concept', color: '#00674B', ink: '#FFFFFF' },
  { id: 'starbucks', name: 'Starbucks', description: 'Coffee', category: 'Food', status: 'concept', color: '#00704A', ink: '#FFFFFF' },
  { id: 'doordash', name: 'DoorDash', description: 'Delivery', category: 'Food', status: 'concept', color: '#EB1700', ink: '#FFFFFF' },
  { id: 'strava', name: 'Strava', description: 'Activity tracking', category: 'Sport', status: 'concept', color: '#FC4C02', ink: '#FFFFFF' },
  { id: 'underarmour', name: 'Under Armour', description: 'Performance apparel', category: 'Sport', status: 'concept', color: '#1D1D1D', ink: '#FFFFFF' },
];

const REWARDS: Reward[] = [
  { id: 'r_nike', brand_id: 'nike', title: 'Nike reward', type: 'brand_credit', availability: 'available', tagline: 'For runners and hoopers', placement_tier: 'featured', sponsor_campaign_id: 'cp_slot_nike', match_budget: 2400 },
  { id: 'r_lululemon', brand_id: 'lululemon', title: 'lululemon reward', type: 'brand_credit', availability: 'available', tagline: 'Movement goals', placement_tier: 'featured', sponsor_campaign_id: 'cp_slot_lulu', match_budget: 1800 },
  { id: 'r_spotify', brand_id: 'spotify', title: 'Spotify gift card', type: 'gift_card', availability: 'available', tagline: 'Most picked this month', placement_tier: 'featured', sponsor_campaign_id: 'cp_slot_spotify', match_budget: 1500 },
  { id: 'r_mec', brand_id: 'mec', title: 'MEC reward', type: 'brand_credit', availability: 'available', tagline: 'Outdoor goals', placement_tier: 'featured', sponsor_campaign_id: 'cp_slot_mec', match_budget: 1200 },
  { id: 'r_amazon', brand_id: 'amazon', title: 'Amazon gift card', type: 'gift_card', availability: 'available', tagline: 'Anything you want', placement_tier: 'standard', match_budget: 900 },
  { id: 'r_apple', brand_id: 'apple', title: 'Apple gift card', type: 'gift_card', availability: 'available', tagline: 'Apps, music, gear', placement_tier: 'standard', match_budget: 900 },
  { id: 'r_classpass', brand_id: 'classpass', title: 'ClassPass credits', type: 'brand_credit', availability: 'available', tagline: 'Try a new class', placement_tier: 'standard', match_budget: 600 },
  { id: 'r_wholefoods', brand_id: 'wholefoods', title: 'Whole Foods gift card', type: 'gift_card', availability: 'available', tagline: 'Fuel the next one', placement_tier: 'standard', match_budget: 600 },
  { id: 'r_starbucks', brand_id: 'starbucks', title: 'Starbucks card', type: 'gift_card', availability: 'available', tagline: 'Post-run coffee', placement_tier: 'standard', match_budget: 450 },
  { id: 'r_doordash', brand_id: 'doordash', title: 'DoorDash credit', type: 'brand_credit', availability: 'limited', tagline: 'Recovery dinner', placement_tier: 'standard', match_budget: 90 },
  { id: 'r_arcteryx', brand_id: 'arcteryx', title: "Arc'teryx reward", type: 'brand_credit', availability: 'unavailable', tagline: 'Back next month', placement_tier: 'standard', match_budget: 0 },
];

// ───────────────────────────── People ─────────────────────────────
const PEOPLE: User[] = [
  { id: 'u_jordan', name: 'Jordan Reyes', email: 'jordan@example.com', avatar: 'blue', bio: 'Training for my first half. Slow miles, big dreams.', created_at: daysFromNow(-120), city: 'Vancouver' },
  { id: 'u_maya', name: 'Maya Chen', email: 'maya@example.com', avatar: 'sun', bio: 'Lifting heavy things, then putting them down.', created_at: daysFromNow(-200), city: 'Vancouver' },
  { id: 'u_alex', name: 'Alex Okafor', email: 'alex@example.com', avatar: 'pink', bio: 'Walking everywhere. Seriously, everywhere.', created_at: daysFromNow(-90), city: 'Toronto' },
  { id: 'u_sam', name: 'Sam Park', email: 'sam@example.com', avatar: 'green', bio: 'Rec league point guard. Working on my left hand.', created_at: daysFromNow(-60), city: 'Vancouver' },
  { id: 'u_priya', name: 'Priya Natarajan', email: 'priya@example.com', avatar: 'ink', bio: 'Long rides, longer coffee stops.', created_at: daysFromNow(-150), city: 'Calgary' },
];

// Public Sogo members who appear on leaderboards.
const PUBLIC_PEOPLE: User[] = [
  ['u_dev', 'Dev Malhotra', 'blue'],
  ['u_lena', 'Lena Fischer', 'pink'],
  ['u_tomas', 'Tomás Ruiz', 'green'],
  ['u_kai', 'Kai Thompson', 'sun'],
  ['u_noor', 'Noor Haddad', 'ink'],
  ['u_ben', 'Ben Adeyemi', 'blue'],
  ['u_chloe', 'Chloé Martin', 'pink'],
  ['u_ravi', 'Ravi Shah', 'green'],
].map(([id, name, avatar]) => ({
  id,
  name,
  email: `${id.slice(2)}@example.com`,
  avatar,
  bio: '',
  created_at: daysFromNow(-100),
}));

// ───────────────────────────── Builders ─────────────────────────────
function goal(g: Partial<Goal> & Pick<Goal, 'id' | 'user_id' | 'title' | 'target_value' | 'current_value' | 'unit'>): Goal {
  const commitment = g.commitment_amount ?? 15;
  return {
    description: '',
    category: 'run',
    metric_type: 'distance',
    start_date: daysFromNow(-10),
    end_date: daysFromNow(20),
    status: 'active',
    visibility: 'friends',
    verification_method: 'connected',
    commitment_amount: commitment,
    sponsor_match: g.sponsor_match ?? sponsorMatchFor(commitment),
    reward_brand_id: 'nike',
    created_at: g.start_date ?? daysFromNow(-10),
    emoji: '🏃',
    seen_moments: [],
    ...g,
  };
}

function milestonesFor(g: Goal, opts: { pendingIds?: string[] } = {}): Milestone[] {
  return defaultMilestones(g.target_value, g.commitment_amount, g.sponsor_match).map((m, i) => {
    const reached = g.current_value >= m.target_value;
    const id = `${g.id}_m${i + 1}`;
    let verification_status: Milestone['verification_status'] = 'not_required';
    if (reached) {
      verification_status =
        g.verification_method === 'connected'
          ? 'verified'
          : g.verification_method === 'self'
            ? 'self_reported'
            : 'verified';
    }
    if (opts.pendingIds?.includes(id)) verification_status = 'pending';
    return {
      id,
      goal_id: g.id,
      title: m.title,
      target_value: m.target_value,
      reward_amount: m.reward_amount,
      is_final: m.is_final,
      status: reached ? 'reached' : 'locked',
      verification_status,
      reached_at: reached ? daysFromNow(-3) : undefined,
    };
  });
}

function participants(challenge_id: string, rows: [string, number, ChallengeParticipant['status']?, string?][]): ChallengeParticipant[] {
  return rows.map(([user_id, progress, status, team_id], i) => ({
    challenge_id,
    user_id,
    progress,
    status: status ?? 'joined',
    team_id,
    joined_at: hoursAgo(24 * (i + 2)),
  }));
}

// ───────────────────────────── Seed ─────────────────────────────
export function createSeed(persona: { kind: 'demo' } | { kind: 'fresh'; name: string; email?: string }): DB {
  const isDemo = persona.kind === 'demo';
  const me: User = {
    id: ME,
    name: isDemo ? 'Mark' : persona.name,
    email: isDemo ? 'mark@sogo.demo' : persona.email ?? 'you@sogo.demo',
    avatar: 'sun',
    bio: isDemo ? 'Becoming a runner, one kilometre at a time.' : '',
    created_at: isDemo ? daysFromNow(-75) : iso(now()),
    city: 'Vancouver',
  };

  // Friends' goals
  const friendGoals: Goal[] = [
    goal({ id: 'g_jordan_half', user_id: 'u_jordan', title: 'Half marathon training', description: 'Run 120 km before the Victoria Half.', target_value: 120, current_value: 85.2, unit: 'km', data_source: 'strava', start_date: daysFromNow(-24), end_date: daysFromNow(14), reward_brand_id: 'nike', emoji: '🏃' }),
    goal({ id: 'g_jordan_sleep', user_id: 'u_jordan', title: 'In bed by 11 for 20 nights', target_value: 20, current_value: 6, unit: 'nights', metric_type: 'days', category: 'recovery', verification_method: 'self', visibility: 'private', emoji: '🌙' }),
    goal({ id: 'g_maya_workouts', user_id: 'u_maya', title: 'Complete 20 workouts', description: 'Strength block, 5 days a week.', target_value: 20, current_value: 16, unit: 'workouts', metric_type: 'sessions', category: 'strength', verification_method: 'photo', commitment_amount: 25, reward_brand_id: 'lululemon', start_date: daysFromNow(-26), end_date: daysFromNow(6), emoji: '🏋️' }),
    goal({ id: 'g_alex_steps', user_id: 'u_alex', title: 'Walk 100,000 steps', description: 'Ten days, no taxis.', target_value: 100000, current_value: 72000, unit: 'steps', metric_type: 'count', category: 'walk', data_source: 'apple_health', commitment_amount: 10, reward_brand_id: 'spotify', start_date: daysFromNow(-7), end_date: daysFromNow(4), emoji: '🚶' }),
    goal({ id: 'g_sam_hoops', user_id: 'u_sam', title: 'Practice basketball 12 times', description: 'Left-hand layups and free throws every session.', target_value: 12, current_value: 5, unit: 'sessions', metric_type: 'sessions', category: 'sport', verification_method: 'self', commitment_amount: 10, reward_brand_id: 'nike', start_date: daysFromNow(-9), end_date: daysFromNow(19), emoji: '🏀' }),
    goal({ id: 'g_priya_ride', user_id: 'u_priya', title: 'Cycle 200 km', description: 'Last big block before winter.', target_value: 200, current_value: 188, unit: 'km', data_source: 'garmin', category: 'cycle', commitment_amount: 25, reward_brand_id: 'mec', start_date: daysFromNow(-20), end_date: daysFromNow(3), emoji: '🚴' }),
  ];

  // Mark's goals (demo persona only)
  const myGoals: Goal[] = isDemo
    ? [
        goal({ id: 'g_run50', user_id: ME, title: 'Run 50 km', description: 'This month. Every kilometre counts.', target_value: 50, current_value: 34.2, unit: 'km', data_source: 'apple_health', start_date: daysFromNow(-18), end_date: daysFromNow(12), reward_brand_id: 'nike', emoji: '🏃' }),
        goal({ id: 'g_sleep', user_id: ME, title: 'Sleep 7+ hours for 20 nights', description: 'Recovery is training too.', target_value: 20, current_value: 9, unit: 'nights', metric_type: 'days', category: 'recovery', verification_method: 'self', visibility: 'private', commitment_amount: 10, reward_brand_id: 'spotify', start_date: daysFromNow(-12), end_date: daysFromNow(18), emoji: '🌙' }),
        goal({ id: 'g_gym', user_id: ME, title: 'Complete 12 strength sessions', description: 'Twice a week, photo proof after each.', target_value: 12, current_value: 5, unit: 'sessions', metric_type: 'sessions', category: 'strength', verification_method: 'photo', commitment_amount: 10, reward_brand_id: 'classpass', start_date: daysFromNow(-16), end_date: daysFromNow(26), emoji: '🏋️' }),
        goal({ id: 'g_steps_sept', user_id: ME, title: 'Walk 300,000 steps', description: 'September step block.', target_value: 300000, current_value: 300000, unit: 'steps', metric_type: 'count', category: 'walk', data_source: 'apple_health', status: 'completed', start_date: daysFromNow(-40), end_date: daysFromNow(-10), reward_brand_id: 'spotify', emoji: '🚶', seen_moments: ['completed'], settled_payout: 30 }),
        goal({ id: 'g_meditate', user_id: ME, title: 'Meditate 15 times', description: '', target_value: 15, current_value: 9, unit: 'sessions', metric_type: 'sessions', category: 'recovery', verification_method: 'self', visibility: 'private', status: 'failed', commitment_amount: 10, reward_brand_id: 'spotify', start_date: daysFromNow(-70), end_date: daysFromNow(-40), emoji: '🧘', seen_moments: ['failed'], settled_payout: 10 }),
      ]
    : [];

  const goals = [...myGoals, ...friendGoals];
  const milestones = goals.flatMap((g) => milestonesFor(g));

  const backings: Backing[] = [
    { id: 'b_alex_jordan', investor_id: 'u_alex', goal_id: 'g_jordan_half', amount: 15, sponsor_match: 15, message: 'Victoria is yours. Go get it.', status: 'active', potential_return: 18, created_at: hoursAgo(30) },
    { id: 'b_priya_maya', investor_id: 'u_priya', goal_id: 'g_maya_workouts', amount: 10, sponsor_match: 10, message: 'Four more. Easy.', status: 'active', potential_return: 12, created_at: hoursAgo(50) },
  ];

  const verifications: Verification[] = isDemo
    ? [
        { id: 'v_gym_5', goal_id: 'g_gym', method: 'photo', status: 'approved', amount: 1, note: 'Session 5 — deadlifts', reviewed_by: 'Sogo review', reviewed_at: hoursAgo(40), created_at: hoursAgo(44) },
        { id: 'v_gym_6', goal_id: 'g_gym', method: 'photo', status: 'pending', amount: 1, note: 'Session 6 — squats and rows', created_at: hoursAgo(5) },
      ]
    : [];

  const goal_rewards: GoalReward[] = isDemo
    ? [{ goal_id: 'g_steps_sept', reward_id: 'r_spotify', value: 30, status: 'unlocked', unlocked_at: daysFromNow(-9) }]
    : [];

  const props: Prop[] = [
    ...(isDemo
      ? [
          { id: 'p1', sender_id: 'u_maya', recipient_id: ME, goal_id: 'g_run50', type: 'fire' as const, message: 'That 12k on Sunday though', created_at: hoursAgo(20) },
          { id: 'p2', sender_id: 'u_sam', recipient_id: ME, goal_id: 'g_run50', type: 'rocket' as const, message: '', created_at: hoursAgo(46) },
          { id: 'p3', sender_id: 'u_alex', recipient_id: ME, goal_id: 'g_steps_sept', type: 'clap' as const, message: 'Machine.', created_at: daysFromNow(-10) },
        ]
      : []),
    { id: 'p4', sender_id: 'u_alex', recipient_id: 'u_jordan', goal_id: 'g_jordan_half', type: 'bolt', message: 'Finish strong', created_at: hoursAgo(28) },
    { id: 'p5', sender_id: 'u_priya', recipient_id: 'u_maya', goal_id: 'g_maya_workouts', type: 'muscle', message: '', created_at: hoursAgo(9) },
  ];

  // ── Challenges ──
  const fridayNight = nextWeekday(5, 19);
  const challenges: Challenge[] = [
    {
      id: 'nike-hoops', creator_id: 'brand', title: '3-Point Challenge', description: 'Make 100 three-pointers in 30 days.',
      category: 'basketball', format: 'individual', goal_metric: 'three-pointers made', unit: 'threes', target_value: 100,
      completion_condition: 'Log 100 made three-pointers before the deadline.', verification_method: 'connected',
      verification_note: 'Shot-tracking data, or a short video for each session', start_date: daysFromNow(-12), end_date: daysFromNow(18),
      commitment: 15, sponsor_contribution: 15, capacity: 76, base_participants: 69, base_collective: 4384,
      leaderboard_rule: 'Ranked by threes made. Everyone who hits 100 earns the reward.', brand_id: 'nike', campaign_id: 'cp_nike_hoops', emoji: '🏀',
      takeover: { campaign_name: 'NIKE HOOPS', headline: '3-Point Challenge', bg: '#0E0E10', fg: '#FFFFFF', accent: '#FFD23F', extra_stat: { label: 'shots logged', value: 42850 } },
    },
    {
      id: 'strava-5k', creator_id: 'brand', title: '5K Speed Challenge', description: 'Beat your current 5K personal best.',
      category: 'running', format: 'personal_best', goal_metric: 'seconds faster than your PR', unit: 'sec', target_value: 1,
      completion_condition: 'Record a verified 5K faster than the PR on file when you joined.', verification_method: 'connected',
      verification_note: 'GPS activity from Strava, Garmin or Apple Health', start_date: daysFromNow(-8), end_date: daysFromNow(25),
      commitment: 10, sponsor_contribution: 10, capacity: 1000, base_participants: 412, base_collective: 96,
      leaderboard_rule: 'Ranked by seconds taken off your own PR.', brand_id: 'strava', campaign_id: 'cp_strava_5k', emoji: '⚡',
      takeover: { campaign_name: 'STRAVA', headline: '5K Speed Challenge', bg: '#FC4C02', fg: '#FFFFFF', accent: '#111111', extra_stat: { label: 'PRs broken', value: 96 } },
    },
    {
      id: 'ua-pushups', creator_id: 'brand', title: 'Push-Up Challenge', description: 'Complete 1,000 push-ups in 30 days.',
      category: 'strength', format: 'individual', goal_metric: 'push-ups', unit: 'push-ups', target_value: 1000,
      completion_condition: 'Log 1,000 push-ups with a short video for each set.', verification_method: 'human',
      verification_note: 'Video sets, spot-checked by Sogo reviewers', start_date: daysFromNow(4), end_date: daysFromNow(34),
      commitment: 15, sponsor_contribution: 15, capacity: 300, base_participants: 128, base_collective: 0,
      leaderboard_rule: 'Ranked by verified push-ups.', brand_id: 'underarmour', campaign_id: 'cp_ua_pushups', emoji: '💪',
      takeover: { campaign_name: 'UNDER ARMOUR', headline: '1,000 Push-Ups', bg: '#1D1D1D', fg: '#FFFFFF', accent: '#E8352E' },
    },
    {
      id: 'lulu-movement', creator_id: 'brand', title: 'Movement Challenge', description: 'Complete a verified movement session on 20 separate days.',
      category: 'wellness', format: 'completion', goal_metric: 'movement days', unit: 'days', target_value: 20,
      completion_condition: '20 different days with at least one 20-minute session.', verification_method: 'connected',
      verification_note: 'Any workout from a connected app counts', start_date: daysFromNow(-5), end_date: daysFromNow(25),
      commitment: 15, sponsor_contribution: 15, capacity: 250, base_participants: 211, base_collective: 860,
      leaderboard_rule: 'Everyone who reaches 20 days earns the reward.', brand_id: 'lululemon', campaign_id: 'cp_lulu', emoji: '🧘',
      takeover: { campaign_name: 'LULULEMON', headline: '20 Days of Movement', bg: '#C8102E', fg: '#FFFFFF', accent: '#FFE6EA' },
    },
    {
      id: 'mec-mountain', creator_id: 'brand', title: 'Mountain Challenge', description: 'Hike 40 km across at least 4 outings.',
      category: 'hiking', format: 'individual', goal_metric: 'km hiked', unit: 'km', target_value: 40,
      completion_condition: '40 km of GPS-verified hiking, spread over 4 or more outings.', verification_method: 'connected',
      verification_note: 'GPS hikes from Garmin, Strava or Apple Health', start_date: daysFromNow(-20), end_date: daysFromNow(10),
      commitment: 20, sponsor_contribution: 20, capacity: 60, base_participants: 59, base_collective: 1712,
      leaderboard_rule: 'Ranked by km hiked.', brand_id: 'mec', campaign_id: 'cp_mec', emoji: '⛰️',
      takeover: { campaign_name: 'MEC', headline: '40 km Mountain Goal', bg: '#0D6B3C', fg: '#FFFFFF', accent: '#C6F432' },
    },
    {
      id: 'classpass-september', creator_id: 'brand', title: '12 Classes in September', description: 'Take 12 classes between Sept 1 and Sept 30.',
      category: 'wellness', format: 'completion', goal_metric: 'classes', unit: 'classes', target_value: 12,
      completion_condition: '12 check-ins verified by the studio.', verification_method: 'connected',
      verification_note: 'Studio check-ins', start_date: daysFromNow(-40), end_date: daysFromNow(-6),
      commitment: 15, sponsor_contribution: 15, capacity: 150, base_participants: 138, base_collective: 1290,
      brand_id: 'classpass', campaign_id: 'cp_classpass', emoji: '🎟️',
    },
    {
      id: 'run-50', creator_id: 'u_jordan', title: '30-Day Running Challenge', description: 'Run 50 km in 30 days.',
      category: 'running', format: 'individual', goal_metric: 'km run', unit: 'km', target_value: 50,
      completion_condition: 'Log 50 km of verified running before the deadline.', verification_method: 'connected',
      verification_note: 'Runs from Apple Health, Strava or Garmin', start_date: daysFromNow(-2), end_date: daysFromNow(28),
      commitment: 15, sponsor_contribution: 15, capacity: 12, base_participants: 7, base_collective: 31,
      leaderboard_rule: 'Ranked by km. Everyone who reaches 50 km earns $30.', emoji: '🏃',
    },
    {
      id: 'weekend-ft', creator_id: 'u_sam', title: 'Weekend Free-Throw 150', description: 'Make 150 free throws between Friday and Sunday.',
      category: 'basketball', format: 'individual', goal_metric: 'free throws made', unit: 'makes', target_value: 150,
      completion_condition: '150 made free throws, logged with a video of each set of 25.', verification_method: 'photo',
      verification_note: 'Video of each set of 25', start_date: fridayNight, end_date: new Date(new Date(fridayNight).getTime() + 2.2 * 86_400_000).toISOString(),
      commitment: 15, sponsor_contribution: 15, capacity: 10, base_participants: 6, base_collective: 0,
      leaderboard_rule: 'Everyone who makes 150 earns $30.', emoji: '🏀',
    },
    {
      id: 'friday-night', creator_id: 'u_sam', title: 'Friday Night Basketball', description: 'Best of 5 games, 4 on 4. Winning team takes the pool.',
      category: 'basketball', format: 'team', goal_metric: 'games won', unit: 'games', target_value: 3,
      completion_condition: 'First team to win 3 games. Both captains confirm the result.', verification_method: 'human',
      verification_note: 'Both team captains confirm the final score', start_date: fridayNight, end_date: new Date(new Date(fridayNight).getTime() + 3 * 3_600_000).toISOString(),
      commitment: 15, sponsor_contribution: 0, capacity: 8, base_participants: 0, base_collective: 0,
      leaderboard_rule: 'Winning team splits the pool evenly.', emoji: '🏀',
      teams: [ { id: 'blue', name: 'Blue' }, { id: 'sun', name: 'Yellow' } ],
    },
    {
      id: 'jordan-alex-5k', creator_id: 'u_jordan', title: 'Jordan vs. Alex: Saturday 5K', description: 'Fastest verified 5K on Saturday wins.',
      category: 'running', format: 'head_to_head', goal_metric: '5K time', unit: 'min', target_value: 1,
      completion_condition: 'Both run a GPS-verified 5K on Saturday. Faster time wins.', verification_method: 'connected',
      verification_note: 'GPS runs from Strava or Apple Health', start_date: nextWeekday(6, 8), end_date: nextWeekday(6, 20),
      commitment: 10, sponsor_contribution: 10, capacity: 2, base_participants: 0, base_collective: 0, emoji: '⚔️',
    },
    {
      id: 'october-steps', creator_id: 'u_alex', title: 'October Step Leaders', description: 'Most steps in October. Top 3 split the pool.',
      category: 'walking', format: 'ranked', goal_metric: 'steps', unit: 'steps', target_value: 300000,
      completion_condition: 'Highest verified step count on Oct 31. Top 3 split 50/30/20.', verification_method: 'connected',
      verification_note: 'Apple Health, Fitbit or Health Connect', start_date: daysFromNow(-5), end_date: daysFromNow(25),
      commitment: 10, sponsor_contribution: 10, capacity: 40, base_participants: 18, base_collective: 1_240_000,
      leaderboard_rule: 'Ranked by steps. Top 3 split 50/30/20.', emoji: '👟',
    },
  ];

  const allParticipants: ChallengeParticipant[] = [
    ...participants('nike-hoops', [['u_sam', 73], ['u_dev', 96], ['u_kai', 88], ['u_ben', 64]]),
    ...participants('strava-5k', [['u_jordan', 41], ['u_lena', 63], ['u_tomas', 22]]),
    ...participants('lulu-movement', [['u_maya', 6], ['u_chloe', 5], ['u_noor', 4]]),
    ...participants('mec-mountain', [['u_priya', 31.5]]),
    ...participants('classpass-september', [['u_maya', 12, 'completed']]),
    ...participants('run-50', [['u_jordan', 9.4], ['u_alex', 6.1], ['u_lena', 11.2]]),
    ...participants('weekend-ft', [['u_sam', 0], ['u_jordan', 0]]),
    ...participants('friday-night', [
      ['u_sam', 0, 'joined', 'blue'], ['u_dev', 0, 'joined', 'blue'], ['u_ben', 0, 'joined', 'blue'],
      ['u_jordan', 0, 'joined', 'sun'], ['u_kai', 0, 'joined', 'sun'], ['u_ravi', 0, 'joined', 'sun'], ['u_tomas', 0, 'joined', 'sun'],
    ]),
    ...participants('jordan-alex-5k', [['u_jordan', 0], ['u_alex', 0]]),
    ...participants('october-steps', [['u_alex', 74210], ['u_noor', 81002], ['u_chloe', 66540]]),
  ];

  // ── Sponsor side ──
  const campaigns: SponsorCampaign[] = [
    { id: 'cp_nike_hoops', brand_id: 'nike', name: 'Nike Hoops — 3-Point Challenge', description: 'Make 100 three-pointers in 30 days.', campaign_type: 'brand_takeover', target_audience: 'Basketball players, 18–34', start_date: daysFromNow(-12), end_date: daysFromNow(18), sponsor_budget: 2280, participant_capacity: 76, reward_value: 30, verification: 'Connected data / video proof', status: 'active', challenge_id: 'nike-hoops' },
    { id: 'cp_strava_5k', brand_id: 'strava', name: '5K Speed Challenge', description: 'Beat your current 5K personal best.', campaign_type: 'brand_takeover', target_audience: 'Runners with a recorded 5K', start_date: daysFromNow(-8), end_date: daysFromNow(25), sponsor_budget: 10000, participant_capacity: 1000, reward_value: 20, verification: 'Connected data', status: 'active', challenge_id: 'strava-5k' },
    { id: 'cp_ua_pushups', brand_id: 'underarmour', name: '1,000 Push-Ups', description: 'Complete 1,000 push-ups in 30 days.', campaign_type: 'brand_takeover', target_audience: 'Strength training, 18–40', start_date: daysFromNow(4), end_date: daysFromNow(34), sponsor_budget: 4500, participant_capacity: 300, reward_value: 30, verification: 'Video proof + human review', status: 'scheduled', challenge_id: 'ua-pushups' },
    { id: 'cp_lulu', brand_id: 'lululemon', name: '20 Days of Movement', description: 'A verified session on 20 separate days.', campaign_type: 'brand_takeover', target_audience: 'Yoga, pilates and run', start_date: daysFromNow(-5), end_date: daysFromNow(25), sponsor_budget: 3750, participant_capacity: 250, reward_value: 30, verification: 'Connected data', status: 'active', challenge_id: 'lulu-movement' },
    { id: 'cp_mec', brand_id: 'mec', name: 'Mountain Challenge', description: '40 km of hiking across 4 outings.', campaign_type: 'challenge_sponsorship', target_audience: 'Hikers in BC and Alberta', start_date: daysFromNow(-20), end_date: daysFromNow(10), sponsor_budget: 1200, participant_capacity: 60, reward_value: 40, verification: 'GPS connected data', status: 'active', challenge_id: 'mec-mountain' },
    { id: 'cp_classpass', brand_id: 'classpass', name: '12 Classes in September', description: '12 studio check-ins in September.', campaign_type: 'challenge_sponsorship', target_audience: 'New-to-studio members', start_date: daysFromNow(-40), end_date: daysFromNow(-6), sponsor_budget: 2250, participant_capacity: 150, reward_value: 30, verification: 'Studio check-ins', status: 'completed', challenge_id: 'classpass-september' },
    { id: 'cp_starbucks_draft', brand_id: 'starbucks', name: 'Morning Miles', description: 'Run 5 km before 8am, 10 times.', campaign_type: 'challenge_sponsorship', target_audience: 'Early runners', start_date: daysFromNow(20), end_date: daysFromNow(50), sponsor_budget: 1500, participant_capacity: 100, reward_value: 20, verification: 'Connected data', status: 'draft' },
    { id: 'cp_slot_nike', brand_id: 'nike', name: 'Featured reward — slot 1', description: 'Top placement in Choose your prize.', campaign_type: 'reward_placement', target_audience: 'All Sogo members', start_date: daysFromNow(-6), end_date: daysFromNow(24), sponsor_budget: 2400, participant_capacity: 0, reward_value: 30, verification: '—', status: 'active' },
    { id: 'cp_slot_lulu', brand_id: 'lululemon', name: 'Featured reward — slot 2', description: 'Featured placement for movement goals.', campaign_type: 'reward_placement', target_audience: 'Movement & wellness goals', start_date: daysFromNow(-6), end_date: daysFromNow(24), sponsor_budget: 1800, participant_capacity: 0, reward_value: 30, verification: '—', status: 'active' },
    { id: 'cp_slot_spotify', brand_id: 'spotify', name: 'Featured reward — slot 3', description: 'Sponsored reward pool.', campaign_type: 'sponsored_rewards', target_audience: 'All Sogo members', start_date: daysFromNow(-6), end_date: daysFromNow(24), sponsor_budget: 1500, participant_capacity: 0, reward_value: 30, verification: '—', status: 'active' },
    { id: 'cp_slot_mec', brand_id: 'mec', name: 'Featured reward — slot 4', description: 'Featured for outdoor goals.', campaign_type: 'reward_placement', target_audience: 'Outdoor goals', start_date: daysFromNow(-6), end_date: daysFromNow(24), sponsor_budget: 1200, participant_capacity: 0, reward_value: 30, verification: '—', status: 'active' },
  ];

  const slots: RewardSlot[] = [
    { id: 's1', position: 1, brand_id: 'nike', reward_id: 'r_nike', placement_tier: 'featured', start_date: daysFromNow(-6), end_date: daysFromNow(24), campaign_id: 'cp_slot_nike', status: 'booked', impressions: 18420, selections: 412 },
    { id: 's2', position: 2, brand_id: 'lululemon', reward_id: 'r_lululemon', placement_tier: 'featured', start_date: daysFromNow(-6), end_date: daysFromNow(24), campaign_id: 'cp_slot_lulu', status: 'booked', impressions: 15105, selections: 288 },
    { id: 's3', position: 3, brand_id: 'spotify', reward_id: 'r_spotify', placement_tier: 'featured', start_date: daysFromNow(-6), end_date: daysFromNow(24), campaign_id: 'cp_slot_spotify', status: 'booked', impressions: 16880, selections: 503 },
    { id: 's4', position: 4, brand_id: 'mec', reward_id: 'r_mec', placement_tier: 'featured', start_date: daysFromNow(-6), end_date: daysFromNow(24), campaign_id: 'cp_slot_mec', status: 'booked', impressions: 9340, selections: 131 },
    { id: 's5', position: 5, placement_tier: 'featured', start_date: daysFromNow(24), end_date: daysFromNow(54), status: 'available', impressions: 0, selections: 0 },
  ];

  const campaign_metrics: CampaignMetric[] = [
    { campaign_id: 'cp_nike_hoops', participants: 0, completions: 9, rewards_distributed: 270, rewards_redeemed: 6, shares: 211, estimated_acquisition: 31, engagement: 14.2 },
    { campaign_id: 'cp_strava_5k', participants: 0, completions: 96, rewards_distributed: 1920, rewards_redeemed: 71, shares: 640, estimated_acquisition: 118, engagement: 6.8 },
    { campaign_id: 'cp_ua_pushups', participants: 0, completions: 0, rewards_distributed: 0, rewards_redeemed: 0, shares: 58, estimated_acquisition: 0, engagement: 0 },
    { campaign_id: 'cp_lulu', participants: 0, completions: 0, rewards_distributed: 0, rewards_redeemed: 0, shares: 305, estimated_acquisition: 44, engagement: 4.1 },
    { campaign_id: 'cp_mec', participants: 0, completions: 14, rewards_distributed: 560, rewards_redeemed: 11, shares: 97, estimated_acquisition: 12, engagement: 3.9 },
    { campaign_id: 'cp_classpass', participants: 0, completions: 101, rewards_distributed: 3030, rewards_redeemed: 94, shares: 388, estimated_acquisition: 63, engagement: 11.6 },
    { campaign_id: 'cp_starbucks_draft', participants: 0, completions: 0, rewards_distributed: 0, rewards_redeemed: 0, shares: 0, estimated_acquisition: 0, engagement: 0 },
  ];

  const ledger: LedgerEntry[] = [
    { id: 'l0', user_id: ME, kind: 'demo_credit', amount: 250, label: 'Demo credit (simulated)', created_at: me.created_at },
    ...(isDemo
      ? ([
          { id: 'l1', user_id: ME, kind: 'commitment', amount: -10, label: 'Committed to Meditate 15 times', ref_id: 'g_meditate', created_at: daysFromNow(-70) },
          { id: 'l2', user_id: ME, kind: 'reward_earned', amount: 10, label: 'Halfway reward — Meditate 15 times', ref_id: 'g_meditate', created_at: daysFromNow(-40) },
          { id: 'l3', user_id: ME, kind: 'forfeit', amount: 0, label: '$10 commitment went to the community pool', ref_id: 'g_meditate', created_at: daysFromNow(-40) },
          { id: 'l4', user_id: ME, kind: 'commitment', amount: -15, label: 'Committed to Walk 300,000 steps', ref_id: 'g_steps_sept', created_at: daysFromNow(-40) },
          { id: 'l5', user_id: ME, kind: 'reward_earned', amount: 30, label: 'Spotify reward — Walk 300,000 steps', ref_id: 'g_steps_sept', created_at: daysFromNow(-9) },
          { id: 'l6', user_id: ME, kind: 'commitment', amount: -15, label: 'Committed to Run 50 km', ref_id: 'g_run50', created_at: daysFromNow(-18) },
          { id: 'l7', user_id: ME, kind: 'commitment', amount: -10, label: 'Committed to Sleep 7+ hours for 20 nights', ref_id: 'g_sleep', created_at: daysFromNow(-12) },
          { id: 'l8', user_id: ME, kind: 'commitment', amount: -10, label: 'Committed to Complete 12 strength sessions', ref_id: 'g_gym', created_at: daysFromNow(-16) },
        ] as LedgerEntry[])
      : []),
  ];

  const activity: ActivityItem[] = [
    { id: 'a1', actor_id: 'u_priya', verb: 'is 94% through Cycle 200 km', goal_id: 'g_priya_ride', emoji: '🚴', created_at: hoursAgo(2) },
    { id: 'a2', actor_id: 'u_jordan', verb: 'hit 71% of Half marathon training', goal_id: 'g_jordan_half', emoji: '🔥', created_at: hoursAgo(6) },
    { id: 'a3', actor_id: 'u_maya', verb: 'logged workout 16 of 20', goal_id: 'g_maya_workouts', emoji: '🏋️', created_at: hoursAgo(9) },
    { id: 'a4', actor_id: 'u_alex', verb: "invested $15 in Jordan's goal", goal_id: 'g_jordan_half', emoji: '💰', created_at: hoursAgo(30) },
    { id: 'a5', actor_id: 'system', verb: 'Nike Hoops reached 73 participants', challenge_id: 'nike-hoops', emoji: '🏀', created_at: hoursAgo(33) },
    { id: 'a6', actor_id: 'u_sam', verb: 'started Practice basketball 12 times', goal_id: 'g_sam_hoops', emoji: '🏀', created_at: hoursAgo(9 * 24) },
    ...(isDemo
      ? [
          { id: 'a7', actor_id: 'u_maya', verb: 'gave you Props', goal_id: 'g_run50', emoji: '🔥', created_at: hoursAgo(20) },
          { id: 'a8', actor_id: ME, verb: 'unlocked the 25 km milestone', goal_id: 'g_run50', emoji: '🎉', created_at: hoursAgo(26) },
        ]
      : []),
  ];

  const notifications: Notification[] = isDemo
    ? [
        { id: 'n1', emoji: '🎉', text: 'You unlocked your 25 km milestone. $15 secured.', href: '/goal/g_run50', read: false, created_at: hoursAgo(26) },
        { id: 'n2', emoji: '🔥', text: 'Maya gave you Props on Run 50 km.', href: '/goal/g_run50', read: false, created_at: hoursAgo(20) },
        { id: 'n3', emoji: '🏀', text: 'The Nike Hoops challenge has 3 spots left.', href: '/c/nike-hoops', read: true, created_at: hoursAgo(33) },
      ]
    : [];

  return {
    version: DB_VERSION,
    session: null,
    users: [me, ...PEOPLE, ...PUBLIC_PEOPLE],
    friendships: PEOPLE.map((p) => ({ user_id: ME, friend_id: p.id })),
    goals,
    milestones,
    backings,
    challenges,
    participants: allParticipants,
    brands: BRANDS,
    rewards: REWARDS,
    goal_rewards,
    verifications,
    props,
    campaigns,
    slots,
    campaign_metrics,
    shares: [],
    ledger,
    activity,
    notifications,
    settings: {
      simulate_payment_failure: false,
      connected_sources: { apple_health: true, strava: true, garmin: false, fitbit: false, health_connect: false },
      default_visibility: 'friends',
      notify_props: true,
      notify_backing: true,
      notify_reminders: true,
      reduced_motion: false,
    },
    community_pool: 18_420,
    seeded_at: iso(now()),
  };
}
