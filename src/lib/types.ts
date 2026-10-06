// Sogo domain model.
// Shaped like the relational schema a production backend would use (see README → Data model).
// In this prototype it lives in a client-side store persisted to localStorage.

export type ID = string;
export type ISODate = string;

export interface User {
  id: ID;
  name: string;
  email: string;
  avatar: string; // initials-based avatar colour key
  bio: string;
  created_at: ISODate;
  city?: string;
}

export type GoalCategory = 'run' | 'walk' | 'strength' | 'cycle' | 'sport' | 'recovery' | 'habit';

export type VerificationMethod = 'connected' | 'photo' | 'self' | 'human';
export type DataSource = 'apple_health' | 'strava' | 'garmin' | 'fitbit' | 'health_connect';

export type GoalStatus = 'active' | 'completed' | 'failed';
export type Visibility = 'private' | 'friends' | 'public';

export interface Goal {
  id: ID;
  user_id: ID;
  title: string;
  description: string;
  category: GoalCategory;
  metric_type: 'distance' | 'count' | 'days' | 'sessions';
  target_value: number;
  current_value: number;
  unit: string;
  start_date: ISODate;
  end_date: ISODate;
  status: GoalStatus;
  visibility: Visibility;
  verification_method: VerificationMethod;
  data_source?: DataSource;
  commitment_amount: number;
  sponsor_match: number; // sponsor match on the participant's own commitment
  reward_brand_id: ID; // preferred prize brand; the sponsor of the match
  created_at: ISODate;
  emoji: string;
  /** Acknowledged UI moments, so celebrations only fire once. */
  seen_moments: string[];
  settled_payout?: number;
}

export type MilestoneStatus = 'locked' | 'reached';
export type VerificationStatus = 'not_required' | 'verified' | 'pending' | 'rejected' | 'self_reported';

export interface Milestone {
  id: ID;
  goal_id: ID;
  title: string;
  target_value: number;
  /** Reward secured when reached. The final milestone's reward is the whole prize pool. */
  reward_amount: number;
  is_final: boolean;
  status: MilestoneStatus;
  verification_status: VerificationStatus;
  reached_at?: ISODate;
}

export interface Backing {
  id: ID;
  investor_id: ID;
  goal_id: ID;
  amount: number;
  sponsor_match: number;
  message: string;
  status: 'active' | 'returned' | 'forfeited';
  potential_return: number;
  created_at: ISODate;
}

export type ChallengeFormat =
  | 'individual' // reach a target
  | 'personal_best' // beat your own PR
  | 'completion' // complete N sessions
  | 'ranked' // most X wins
  | 'team' // team result decides
  | 'head_to_head';

export type ChallengeStatus = 'upcoming' | 'active' | 'ended';

export interface Challenge {
  id: ID;
  creator_id: ID;
  title: string;
  description: string; // the one-line, measurable goal
  category: 'running' | 'basketball' | 'strength' | 'walking' | 'cycling' | 'wellness' | 'hiking';
  format: ChallengeFormat;
  goal_metric: string; // e.g. "three-pointers made"
  unit: string;
  target_value: number;
  completion_condition: string;
  verification_method: VerificationMethod;
  verification_note: string;
  start_date: ISODate;
  end_date: ISODate;
  commitment: number;
  sponsor_contribution: number; // per participant
  capacity: number;
  /** Simulated count of participants who aren't individually modelled. */
  base_participants: number;
  /** Simulated collective progress from those participants. */
  base_collective: number;
  status_override?: ChallengeStatus;
  leaderboard_rule?: string;
  brand_id?: ID;
  campaign_id?: ID;
  takeover?: TakeoverTheme;
  emoji: string;
  teams?: { id: string; name: string }[];
  winner_team_id?: string;
}

export interface TakeoverTheme {
  campaign_name: string; // "NIKE HOOPS"
  headline: string; // "3-Point Challenge"
  bg: string;
  fg: string;
  accent: string;
  /** A campaign-specific collective stat, e.g. 42,850 shots logged. */
  extra_stat?: { label: string; value: number };
}

export interface ChallengeParticipant {
  challenge_id: ID;
  user_id: ID;
  progress: number;
  status: 'joined' | 'completed' | 'withdrawn' | 'won' | 'lost';
  team_id?: string;
  joined_at: ISODate;
}

export interface Brand {
  id: ID;
  name: string;
  description: string;
  category: string;
  status: 'concept';
  color: string;
  ink: string; // text colour on brand colour
}

export type PlacementTier = 'featured' | 'standard';

export interface Reward {
  id: ID;
  brand_id: ID;
  title: string;
  type: 'gift_card' | 'brand_credit';
  availability: 'available' | 'limited' | 'unavailable';
  tagline: string;
  placement_tier: PlacementTier;
  sponsor_campaign_id?: ID;
  /** Remaining sponsor match budget for this reward (simulated). */
  match_budget: number;
}

export interface GoalReward {
  /** Goal id, or challenge id when source is 'challenge'. */
  goal_id: ID;
  source?: 'goal' | 'challenge';
  reward_id: ID;
  value: number;
  status: 'unlocked';
  unlocked_at: ISODate;
}

export interface Verification {
  id: ID;
  goal_id: ID;
  method: VerificationMethod;
  status: 'pending' | 'approved' | 'rejected';
  evidence_url?: string;
  amount: number; // progress being claimed
  note: string;
  reviewed_by?: string;
  reviewed_at?: ISODate;
  created_at: ISODate;
}

export type PropType = 'clap' | 'fire' | 'muscle' | 'rocket' | 'heart' | 'bolt';

export interface Prop {
  id: ID;
  sender_id: ID;
  recipient_id: ID;
  goal_id: ID;
  type: PropType;
  message: string;
  created_at: ISODate;
}

export type CampaignStatus = 'draft' | 'scheduled' | 'active' | 'completed';
export type CampaignType = 'challenge_sponsorship' | 'brand_takeover' | 'reward_placement' | 'sponsored_rewards';

export interface SponsorCampaign {
  id: ID;
  brand_id: ID;
  name: string;
  description: string;
  campaign_type: CampaignType;
  target_audience: string;
  start_date: ISODate;
  end_date: ISODate;
  sponsor_budget: number;
  participant_capacity: number;
  reward_value: number;
  verification: string;
  status: CampaignStatus;
  challenge_id?: ID;
}

export interface RewardSlot {
  id: ID;
  position: number;
  brand_id?: ID;
  reward_id?: ID;
  placement_tier: 'featured';
  start_date: ISODate;
  end_date: ISODate;
  campaign_id?: ID;
  status: 'booked' | 'available';
  impressions: number;
  selections: number;
}

export interface CampaignMetric {
  campaign_id: ID;
  participants: number;
  completions: number;
  rewards_distributed: number;
  rewards_redeemed: number;
  shares: number;
  estimated_acquisition: number;
  engagement: number; // avg verified actions per participant
}

export type ShareType =
  | 'goal_started'
  | 'progress'
  | 'milestone'
  | 'backed'
  | 'completed'
  | 'reward'
  | 'challenge_invite';

export interface SocialShareAsset {
  id: ID;
  user_id: ID;
  goal_id?: ID;
  challenge_id?: ID;
  share_type: ShareType;
  asset_type: 'story_9x16';
  generated_at: ISODate;
  destination: string;
}

export type LedgerKind =
  | 'demo_credit'
  | 'commitment'
  | 'backing'
  | 'reward_earned'
  | 'backing_return'
  | 'forfeit'
  | 'refund';

export interface LedgerEntry {
  id: ID;
  user_id: ID;
  kind: LedgerKind;
  amount: number; // + into simulated balance, - out of it
  label: string;
  ref_id?: ID;
  created_at: ISODate;
}

export interface ActivityItem {
  id: ID;
  actor_id: ID | 'system';
  verb: string; // human sentence fragment, e.g. "hit 80% of Half marathon training"
  goal_id?: ID;
  challenge_id?: ID;
  emoji: string;
  created_at: ISODate;
}

export interface Notification {
  id: ID;
  emoji: string;
  text: string;
  href: string;
  read: boolean;
  created_at: ISODate;
}

export interface Session {
  user_id: ID;
  provider: 'demo' | 'google' | 'apple';
  onboarded: boolean;
  motivations: string[];
  focus?: string;
}

export interface Settings {
  simulate_payment_failure: boolean;
  connected_sources: Record<DataSource, boolean>;
  default_visibility: Visibility;
  notify_props: boolean;
  notify_backing: boolean;
  notify_reminders: boolean;
  reduced_motion: boolean;
}

export interface DB {
  version: number;
  session: Session | null;
  users: User[];
  friendships: { user_id: ID; friend_id: ID }[];
  goals: Goal[];
  milestones: Milestone[];
  backings: Backing[];
  challenges: Challenge[];
  participants: ChallengeParticipant[];
  brands: Brand[];
  rewards: Reward[];
  goal_rewards: GoalReward[];
  verifications: Verification[];
  props: Prop[];
  campaigns: SponsorCampaign[];
  slots: RewardSlot[];
  campaign_metrics: CampaignMetric[];
  shares: SocialShareAsset[];
  ledger: LedgerEntry[];
  activity: ActivityItem[];
  notifications: Notification[];
  settings: Settings;
  /** Simulated Sogo community prize pool funded by forfeited commitments. */
  community_pool: number;
  seeded_at: ISODate;
}
