import { useEffect, useState } from 'react';
import { Link } from '../lib/router';
import { useStore } from '../lib/store';
import { BrandTile, Ticket, Wordmark, ProgressTrack, CountUp } from '../components/ui';
import { Icon } from '../components/Icon';
import { BRANDS } from '../lib/seed';

function BetSlip() {
  // The hero is the product: a bet slip, made out to yourself.
  const [km, setKm] = useState(31.4);
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setKm(34.2);
      return;
    }
    const t = setInterval(() => setKm((k) => (k >= 47.8 ? 31.4 : Math.round((k + 1.2) * 10) / 10)), 1400);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="slip" aria-label="Example Sogo commitment: run 50 km, $15 committed, $15 sponsor match, $30 potential reward">
      <div className="slip__top">
        <span className="slip__kind">Your slip</span>
        <span className="chip chip--green">
          <span className="live-dot" aria-hidden /> Live
        </span>
      </div>
      <div className="slip__pick">
        <span className="slip__who">Mark to run</span>
        <span className="slip__line score">50 km</span>
        <span className="muted small">by Oct 31 · verified by Apple Health</span>
      </div>
      <div className="slip__progress">
        <div className="slip__score">
          <span className="score">
            <CountUp value={km} format={(n) => n.toFixed(1)} duration={900} />
          </span>
          <span className="muted"> / 50 km</span>
        </div>
        <ProgressTrack
          value={km}
          target={50}
          label="Progress toward 50 km"
          milestones={[
            { target_value: 10, status: 'reached', is_final: false },
            { target_value: 25, status: 'reached', is_final: false },
          ]}
        />
      </div>
      <dl className="slip__rows">
        <div>
          <dt>Your stake</dt>
          <dd>$15</dd>
        </div>
        <div>
          <dt>Sponsor match</dt>
          <dd>+$15</dd>
        </div>
      </dl>
      <div className="slip__payout">
        <Ticket value="$30" label="Potential reward" stub="$15" stubLabel="Secured at 25 km" />
      </div>
    </div>
  );
}

export function Landing() {
  const { db } = useStore();
  const start = db.session ? '/home' : '/login';
  const nike = BRANDS.find((b) => b.id === 'nike')!;
  const strip = BRANDS.filter((b) => ['nike', 'lululemon', 'spotify', 'mec', 'amazon', 'apple', 'classpass', 'starbucks'].includes(b.id));

  return (
    <div className="landing">
      <header className="landing__nav">
        <Wordmark size={30} />
        <nav aria-label="Landing">
          <a href="#how" className="landing__navlink">
            How it works
          </a>
          <a href="#brands" className="landing__navlink">
            For brands
          </a>
          <Link to={start} className="btn btn--white btn--sm">
            {db.session ? 'Open Sogo' : 'Log in'}
          </Link>
        </nav>
      </header>

      <section className="hero on-dark">
        <div className="hero__copy">
          <h1 className="hero__title">
            <span className="hero__line1">Stop sports betting.</span>
            <span className="hero__line2">Start betting on yourself.</span>
          </h1>
          <p className="hero__lede">
            Sogo turns your goals into something worth showing up for. Put something behind your goal, track your progress, earn real rewards,
            and get your people behind you.
          </p>
          <div className="hero__ctas">
            <Link to={start} className="btn btn--sun btn--lg btn--commit">
              Start betting on yourself
            </Link>
            <a href="#how" className="btn btn--lg hero__ghost">
              See how it works
            </a>
          </div>
        </div>
        <div className="hero__slip">
          <BetSlip />
        </div>
      </section>

      <section id="how" className="how">
        <div className="landing__inner">
          <h2 className="landing__h2">Five steps. One promise to yourself.</h2>
          <ol className="how__track">
            {[
              { t: 'Pick your goal', v: 'Run 50 km', d: 'Measurable, with a deadline. Sogo builds the milestones.' },
              { t: 'Put something on it', v: '$15', d: 'Your commitment. Skin in the game makes it real.' },
              { t: 'Sogo adds the sponsor reward', v: '+$15', d: 'A reward partner matches you, dollar for dollar.' },
              { t: 'Go', v: '34.2 km', d: 'Progress syncs from Apple Health, Strava or Garmin.' },
              { t: 'Earn it', v: '$30', d: 'Hit the goal and choose your prize. Halfway secures $15.' },
            ].map((s, i) => (
              <li key={s.t} className={`how__step ${i === 4 ? 'how__step--earn' : ''}`}>
                <span className="how__n">{i + 1}</span>
                <span className="how__t">{s.t}</span>
                <span className="how__v score">{s.v}</span>
                <span className="how__d">{s.d}</span>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="invest">
        <div className="landing__inner invest__grid">
          <div>
            <h2 className="landing__h2">Invest in someone's success.</h2>
            <p className="landing__p">
              Believe in someone? Put something behind them. Your backing grows their prize, the sponsor matches it, and when they finish you get
              your stake back plus a 20% Believer return.
            </p>
          </div>
          <div className="invest__card">
            <div className="invest__who">
              <span className="avatar avatar--blue">JR</span>
              <div>
                <strong>Jordan is training for a half marathon</strong>
                <div className="muted small">85.2 of 120 km · 14 days left</div>
              </div>
            </div>
            <ProgressTrack value={85.2} target={120} label="Jordan's progress" />
            <div className="invest__math">
              <div>
                <span className="muted small">Prize now</span>
                <span className="score">$30</span>
              </div>
              <Icon name="chevron" />
              <div>
                <span className="muted small">You $15 + sponsor $15</span>
                <span className="score" style={{ color: 'var(--blue)' }}>
                  $60
                </span>
              </div>
            </div>
            <p className="invest__msg">“You've got this Jordan. Keep going.”</p>
          </div>
        </div>
      </section>

      <section id="brands" className="brands on-dark">
        <div className="landing__inner brands__grid">
          <div>
            <h2 className="landing__h2">Brands can fund human potential.</h2>
            <p className="landing__p">
              Sponsors match commitments, own measurable challenges and fill the prize shelf. They reach people mid-effort, and every dollar they
              spend is tied to something that actually happened.
            </p>
            <ul className="brands__list">
              <li>Featured reward placement</li>
              <li>Sponsored challenges with a clear finish line</li>
              <li>Pricing that can follow completions, not impressions</li>
            </ul>
          </div>
          <div className="mini-takeover" style={{ ['--to-bg' as string]: '#0E0E10', ['--to-accent' as string]: '#FFD23F' }}>
            <div className="mini-takeover__top">
              <BrandTile brand={nike} size={44} />
              <span className="chip chip--sun">Concept · not affiliated</span>
            </div>
            <div className="mini-takeover__campaign">NIKE HOOPS</div>
            <div className="mini-takeover__goal">Make 100 three-pointers in 30 days.</div>
            <div className="mini-takeover__math">
              <span>$15 + $15 sponsor</span>
              <Ticket value="$30" label="Reward" />
            </div>
          </div>
        </div>
        <div className="brand-strip" aria-label="Example reward brands (illustrative)">
          {strip.map((b) => (
            <BrandTile key={b.id} brand={b} size={64} />
          ))}
        </div>
        <p className="landing__inner tiny" style={{ opacity: 0.6, marginTop: 14 }}>
          Brand names are illustrative examples of a future reward marketplace. They do not imply sponsorship, endorsement, partnership or
          affiliation.
        </p>
      </section>

      <section className="final">
        <div className="landing__inner final__inner">
          <h2 className="final__title">Make your goals matter.</h2>
          <p className="landing__p">What are you willing to put behind becoming who you want to be?</p>
          <Link to={start} className="btn btn--sun btn--lg btn--commit">
            Start betting on yourself
          </Link>
          <span className="final__sogo score" aria-hidden>
            So. Go.
          </span>
        </div>
      </section>

      <footer className="landing__foot">
        <div className="landing__inner">
          <Wordmark size={22} />
          <p className="tiny muted" style={{ maxWidth: '72ch', marginTop: 10 }}>
            Sogo is a product prototype. Payment flows are simulated and no real money is processed. Brand names shown are illustrative examples
            only and do not imply sponsorship, endorsement, partnership or affiliation. A production launch requires legal review of contest,
            skill-competition, gambling, payments and gift-card regulations in each jurisdiction.
          </p>
          <div style={{ display: 'flex', gap: 16, marginTop: 12 }}>
            <Link to="/login" className="link-btn">
              Try the demo
            </Link>
            <Link to="/sponsor" className="link-btn">
              Sogo for Brands
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
