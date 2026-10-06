# Sogo

**Stop sports betting. Start betting on yourself.**

Sogo is a working web-app prototype of a goal achievement platform that borrows the energy of betting — stakes, anticipation, competition, payoff — and points it at the one thing worth betting on: you.

> Sogo = **So**cial **Go**als. Also: *So. Go.*

---

## What it is

You pick a measurable goal ("Run 50 km by Oct 31"), put money behind it, and a reward partner matches you. Progress is verified — ideally straight from your watch or app. Hit the goal and the prize pool becomes a reward you actually want. Hit a milestone along the way and part of it is yours no matter what. Miss, and your commitment flows into the community pool that funds other people's wins.

Friends can give you **Props**, or **invest in your success** by backing your goal. Brands fund the matches, own measurable challenges and fill the prize shelf.

The hierarchy is deliberate: **me → my progress → my commitment → my reward → my people → the wider community.** Sogo is not a social feed.

## Core mechanic: the 50/50 prize pool

| | |
|---|---|
| You commit | **$15** |
| Reward sponsor matches | **+$15** |
| Potential reward | **$30** |

- **Milestones are tiers, not additive.** Default ladder: *Started* (20%, badge), *Halfway* (50%, secures half the base prize — e.g. $15), *Complete* (100%, the whole pool).
- **Complete:** you earn the full pool as a reward of your choice.
- **Miss after halfway:** you keep what you secured, paid from the sponsor match first.
- **Miss:** unused commitments go to the **Sogo community pool**, which funds future rewards and backer returns. Unused sponsor match goes back to the sponsor. Nothing disappears into a black hole.

All money math lives in [`src/lib/economics.ts`](src/lib/economics.ts) (pure functions, unit-tested in `economics.test.ts`).

## Social investing

A friend can **back** your goal:

```
You $15 + sponsor $15                    = $30 prize
Jordan backs you $15 + sponsor matches $15 → $60 prize
```

- Backing is added to the participant's prize pool; the sponsor matches backers 1:1 up to 3× the participant's commitment.
- **If you finish:** you earn the full $60. Each backer gets their stake back **plus a 20% Believer return** ($15 → $18), paid from the community pool.
- **If you miss:** backers' stakes flow to the community pool.
- Every backing carries a short message ("You've got this. Finish strong.").

## Brand monetization (illustrated in the prototype)

- **Reward placement** — brands appear in *Choose your prize*.
- **Featured reward slots** — finite, bookable inventory (5 slots in the demo, 4 booked, 1 open). Tracks views, picks and pick rate.
- **Sponsored rewards** — a brand funds a pool of matches.
- **Challenge sponsorship** — a brand matches every participant in a measurable challenge.
- **Premium brand takeover** — the challenge page becomes the brand's campaign (colours, headline, live counters) while staying recognisably Sogo.
- **Performance / acquisition pricing (future)** — price on participants, completions, redemptions, new customers, shares, verified actions, repeat participation.

The **Sogo for Brands** dashboard (`/#/sponsor`) shows campaigns by status (draft / scheduled / active / completed), participants, completion rate, rewards distributed and redeemed, estimated acquisition, shares, estimated campaign value, the featured-slot shelf, and a campaign builder that publishes real challenges into Discover.

## Verification

Each goal declares how it's verified:

1. **Connected data** — Apple Health, Strava, Garmin, Fitbit, Google Health Connect. Simulated sync in the prototype (and a disconnected-source error state). *You don't tell Sogo you did it. Sogo knows.*
2. **Photo proof** — upload/capture an image; it's downscaled and stored, and enters *verification pending*.
3. **Self-report** — clearly labelled as self-reported everywhere.
4. **Human review** — submissions wait for a reviewer. In demo mode, "Reviewer tools (demo)" lets you approve or reject (rejection has its own state).

## Social sharing

Sharing is a first-class feature. The **Share studio** (`/#/share/:type/:id`) renders a dedicated **1080×1920 Instagram Story asset** — not a screenshot — from the same design tokens as the product, and exports it as a PNG.

Share moments: goal started (*Put something on it.*), milestone (*25 KM DOWN.*), friend backing (*JORDAN BACKED ME.*), near completion, completion (*I DID IT.*), reward (*$60 EARNED.*), and challenge invites (*NIKE HOOPS · 3-POINT CHALLENGE · JOIN ME ON SOGO*).

Destinations: Instagram Stories, TikTok and Snapchat (OS share sheet with the image on mobile; download + instructions on desktop), WhatsApp, Messages/native share, X, LinkedIn (wins only), copy link. Card colour themes and a *hide amounts* toggle are included.

Challenge invite links (`/#/c/nike-hoops?ref=u_me`) open the challenge directly — even logged out — with an "X is taking this on. Think you can beat them?" banner.

## Tech stack

- **React 19 + TypeScript + Vite.** No UI framework, no router dependency, no state library.
- **Hash router** (`src/lib/router.tsx`) so deep links work on any static host.
- **Client-side store** (`src/lib/store.tsx`) — a relational-shaped `DB` (see `src/lib/types.ts`) persisted to `localStorage`. Commands in `src/lib/commands.ts`, read models in `src/lib/selectors.ts`.
- **Payments behind an interface** (`src/lib/payments.ts`): `PaymentProvider` with a `SimulatedPaymentProvider`. A Stripe provider can replace it without touching screens.
- **Auth** (`src/lib/auth.ts`) structured for Google and Apple OAuth (authorization-code redirect + backend exchange).
- **html-to-image** for PNG export of share cards.
- Plain CSS with design tokens (`src/styles/`). Fonts: Archivo (variable width, for scores and headlines) + Figtree.

```
src/
  lib/          types, economics (+tests), seed data, store, commands, selectors, router, auth, payments, share
  components/   UI primitives, share card, payment sheet, social sheets, shell, demo guide
  screens/      landing, auth, onboarding, home, create goal, goal detail, claim prize, people,
                discover, challenge (incl. brand takeover + team games), rewards, profile,
                activity, wallet, settings, share studio, sponsor/*
```

### Data model

Entities mirror a production relational schema: `User`, `Goal`, `Milestone`, `Challenge`, `ChallengeParticipant`, `Backing` (investment), `Reward`, `GoalReward`, `Verification`, `Prop`, `Brand`, `SponsorCampaign`, `RewardSlot`, `CampaignMetric`, `SocialShareAsset`, a `LedgerEntry` wallet abstraction (simulated balance, committed, earned, pending/secured, forfeited) and a simulated community pool. `ChallengeSponsor` is represented by `brand_id` + `campaign_id` + `sponsor_contribution` on `Challenge`.

## Running locally

Requires Node 22.6+.

```bash
git clone https://github.com/nweinberg97/sogo.git
cd sogo
npm install
npm run dev        # http://localhost:5173
```

Other scripts:

```bash
npm test           # economics unit tests (node:test)
npm run typecheck  # tsc --noEmit
npm run build      # production build to dist/
npm run preview    # serve the build
```

A GitHub Actions workflow (`.github/workflows/deploy.yml`) builds and deploys to **GitHub Pages** on every push to `main`. Turn it on under *Settings → Pages → Source: GitHub Actions*.

## Environment variables

None are required — the app runs fully in demo mode. Copy `.env.example` to `.env.local` to enable more:

| Variable | Purpose |
|---|---|
| `VITE_GOOGLE_CLIENT_ID` | Enables *Continue with Google* (real redirect to Google). |
| `VITE_APPLE_CLIENT_ID` | Enables *Continue with Apple* (Sign in with Apple Services ID). |
| `VITE_AUTH_API_URL` | Backend that exchanges the OAuth code for a session (`POST /oauth/:provider/exchange`). Required to finish OAuth. |
| `VITE_PUBLIC_URL` | Base URL used in share links (defaults to the current origin). |

Unconfigured providers are shown as unavailable. The app never pretends an OAuth sign-in succeeded.

## Demo mode

Open the app → **Start betting on yourself** → **Explore the demo as Mark**. Mark is 34.2 km into a 50 km run goal, has secured his 25 km milestone, has friends (Jordan, Maya, Alex, Sam, Priya) with live goals, and Sogo is full of challenges and rewards. Or choose *Start fresh* to go through onboarding with your own name and an empty dashboard.

The **Demo guide** button (bottom right) walks the hero journey in about a minute:

1. Sync a run (simulated Apple Health)
2. Jordan backs you — $15 + $15 sponsor match → prize pool goes from $30 to **$60**, with "You've got this. Finish strong."
3. Finish the 50 km → **You did it.**
4. Choose your prize → **Reward unlocked**
5. Share your win → 9:16 **I DID IT. · 50 KM COMPLETE · $60 REWARD UNLOCKED**

Plus: see a constructive miss, the Nike Hoops brand takeover, Friday Night Basketball (team stakes), and the sponsor dashboard. *Settings → Demo controls* includes **Simulate payment failure**, **Reduce motion** and **Reset the demo**.

Other things worth trying: create a goal end-to-end, upload photo proof and approve/reject it, back and give Props to friends, join/withdraw from challenges (refund before start, forfeit after), a full challenge (MEC), an ended campaign (ClassPass), a draft campaign with no participants (Starbucks), booking the open featured slot, and a shared challenge link while logged out.

## Production roadmap

- [ ] **Payments (TODO):** replace `SimulatedPaymentProvider` with a Stripe-backed provider behind a server API — PaymentIntents/holds for commitments, escrow or Connect for prize pools, refunds, disputes, ledger reconciliation.
- [ ] **Legal / compliance review** before any real money moves (see below).
- [ ] Integrations: **Apple Health / HealthKit** (native app), **Strava**, **Garmin**, **Fitbit**, **Google Health Connect**.
- [ ] Automated verification (activity data rules, anomaly detection, image verification).
- [ ] Human verification queue, reviewer tooling, appeals.
- [ ] Real brand partnerships and contracts.
- [ ] Gift-card / brand-credit fulfilment infrastructure.
- [ ] Sponsor dashboard: accounts, roles, real analytics, brand billing and invoicing.
- [ ] Campaign analytics and attribution (redemptions → purchases → acquisition).
- [ ] Native iOS / Android apps.
- [ ] Fraud prevention, identity verification, KYC/AML where applicable.
- [ ] Responsible-product safeguards: commitment limits, cooling-off, self-exclusion, age gating.
- [ ] Social sharing infrastructure: server-rendered share images, Open Graph previews, deep links, attribution.
- [ ] Server-side auth sessions for Google/Apple OAuth (`VITE_AUTH_API_URL`).

## Legal and responsible-product considerations

Sogo makes **no claim** to be legally distinct from gambling, or compliant, in any jurisdiction. A production launch requires review of: contest and sweepstakes laws, skill-based competition laws, gambling regulations, payment and money-transmission regulations, gift-card regulations, consumer protection, custody of committed funds, KYC/AML where applicable, age restrictions, responsible-use policies, jurisdiction-specific requirements, promotional/advertising rules and sponsored-challenge disclosures. Challenges are not called "sweepstakes" anywhere in the product.

The product is designed to motivate without unhealthy pressure: no streak guilt, sparse notifications, no public failure shaming, and misses are framed as fuel for the next attempt.

## Important disclaimer

> This repository is a product prototype. Payment flows are simulated and no real money is processed. Brand names shown are illustrative examples only and do not imply sponsorship, endorsement, partnership, or affiliation.
