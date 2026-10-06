import { useEffect, type ReactNode } from 'react';
import { match, navigate, useLocation } from './lib/router';
import { useStore } from './lib/store';
import { Shell } from './components/Shell';
import { Landing } from './screens/Landing';
import { Login } from './screens/Login';
import { Onboarding } from './screens/Onboarding';
import { Home } from './screens/Home';
import { CreateGoal } from './screens/CreateGoal';
import { GoalDetail } from './screens/GoalDetail';
import { ClaimPrize } from './screens/ClaimPrize';
import { People } from './screens/People';
import { PersonProfile } from './screens/PersonProfile';
import { Discover } from './screens/Discover';
import { ChallengeDetail } from './screens/ChallengeDetail';
import { CreateChallenge } from './screens/CreateChallenge';
import { Rewards } from './screens/Rewards';
import { Profile } from './screens/Profile';
import { Activity } from './screens/Activity';
import { Wallet } from './screens/Wallet';
import { Settings } from './screens/Settings';
import { ShareStudio } from './screens/ShareStudio';
import { Sponsor } from './screens/sponsor/Sponsor';
import { SponsorBuilder } from './screens/sponsor/SponsorBuilder';
import { SponsorCampaign } from './screens/sponsor/SponsorCampaign';
import { NotFound } from './screens/NotFound';

type Route = { pattern: string; render: (p: Record<string, string>) => ReactNode; auth?: boolean; chrome?: 'app' | 'none' | 'sponsor' };

const routes: Route[] = [
  { pattern: '/', render: () => <Landing />, chrome: 'none' },
  { pattern: '/login', render: () => <Login />, chrome: 'none' },
  { pattern: '/onboarding', render: () => <Onboarding />, chrome: 'none', auth: true },
  { pattern: '/home', render: () => <Home />, auth: true },
  { pattern: '/new', render: () => <CreateGoal />, auth: true, chrome: 'none' },
  { pattern: '/goal/:id', render: (p) => <GoalDetail id={p.id} />, auth: true },
  { pattern: '/claim/:kind/:id', render: (p) => <ClaimPrize kind={p.kind as 'goal' | 'challenge'} id={p.id} />, auth: true, chrome: 'none' },
  { pattern: '/people', render: () => <People />, auth: true },
  { pattern: '/u/:id', render: (p) => <PersonProfile id={p.id} />, auth: true },
  { pattern: '/discover', render: () => <Discover />, auth: true },
  { pattern: '/c/:id', render: (p) => <ChallengeDetail id={p.id} /> },
  { pattern: '/challenges/new', render: () => <CreateChallenge />, auth: true },
  { pattern: '/rewards', render: () => <Rewards />, auth: true },
  { pattern: '/profile', render: () => <Profile />, auth: true },
  { pattern: '/activity', render: () => <Activity />, auth: true },
  { pattern: '/wallet', render: () => <Wallet />, auth: true },
  { pattern: '/settings', render: () => <Settings />, auth: true },
  { pattern: '/share/:kind/:id', render: (p) => <ShareStudio kind={p.kind} id={p.id} />, auth: true, chrome: 'none' },
  { pattern: '/sponsor', render: () => <Sponsor />, auth: true, chrome: 'sponsor' },
  { pattern: '/sponsor/new', render: () => <SponsorBuilder />, auth: true, chrome: 'sponsor' },
  { pattern: '/sponsor/c/:id', render: (p) => <SponsorCampaign id={p.id} />, auth: true, chrome: 'sponsor' },
];

export function App() {
  const { path, raw } = useLocation();
  const { db } = useStore();

  let found: { route: Route; params: Record<string, string> } | null = null;
  for (const route of routes) {
    const params = match(route.pattern, path);
    if (params) {
      found = { route, params };
      break;
    }
  }

  const needsAuth = found?.route.auth && !db.session;
  const needsOnboarding = db.session && !db.session.onboarded && path !== '/onboarding' && path !== '/new' && found?.route.auth;

  useEffect(() => {
    if (needsAuth) navigate(`/login?next=${encodeURIComponent(raw)}`, { replace: true });
    else if (needsOnboarding) navigate('/onboarding', { replace: true });
  }, [needsAuth, needsOnboarding, raw]);

  useEffect(() => {
    document.documentElement.classList.toggle('reduce-motion', db.settings.reduced_motion);
  }, [db.settings.reduced_motion]);

  if (!found) return <Shell>{<NotFound />}</Shell>;
  if (needsAuth || needsOnboarding) return null;
  const content = found.route.render(found.params);
  const chrome = found.route.chrome ?? (db.session ? 'app' : 'none');
  if (chrome === 'none') return <main id="main">{content}</main>;
  return <Shell mode={chrome === 'sponsor' ? 'sponsor' : 'app'}>{content}</Shell>;
}
