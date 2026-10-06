import { useState, type ReactNode } from 'react';
import { Link, navigate, useLocation } from '../lib/router';
import { useStore } from '../lib/store';
import { me, unreadCount } from '../lib/selectors';
import { markAllRead } from '../lib/commands';
import { relTime } from '../lib/time';
import { Avatar, Sheet, Wordmark } from './ui';
import { Icon } from './Icon';
import { DemoGuide } from './DemoGuide';

const APP_NAV = [
  { to: '/home', label: 'Home', icon: 'home' },
  { to: '/discover', label: 'Discover', icon: 'compass' },
  { to: '/people', label: 'People', icon: 'users' },
  { to: '/rewards', label: 'Rewards', icon: 'gift' },
  { to: '/activity', label: 'Activity', icon: 'activity' },
  { to: '/profile', label: 'You', icon: 'user' },
];

const SPONSOR_NAV = [
  { to: '/sponsor', label: 'Campaigns', icon: 'chart' },
  { to: '/sponsor/new', label: 'New campaign', icon: 'plus' },
];

export function Shell({ children, mode = 'app' }: { children: ReactNode; mode?: 'app' | 'sponsor' }) {
  const { db, update } = useStore();
  const { path } = useLocation();
  const [notifOpen, setNotifOpen] = useState(false);
  const user = me(db);
  const unread = unreadCount(db);
  const isActive = (to: string) => (to === '/sponsor' ? path === '/sponsor' || path.startsWith('/sponsor/c') : path === to || path.startsWith(`${to}/`));
  const nav = mode === 'sponsor' ? SPONSOR_NAV : APP_NAV;

  const openNotifs = () => setNotifOpen(true);
  const closeNotifs = () => {
    setNotifOpen(false);
    if (unread) update((d) => markAllRead(d));
  };

  return (
    <div className={`shell ${mode === 'sponsor' ? 'shell--sponsor' : ''}`}>
      <a href="#main" className="skip-link" onClick={(e) => { e.preventDefault(); document.getElementById('main')?.focus(); }}>
        Skip to content
      </a>
      <aside className="sidenav" aria-label="Primary">
        <Link to={db.session ? '/home' : '/'} className="sidenav__brand" aria-label="Sogo home">
          <Wordmark size={34} />
          {mode === 'sponsor' && <span className="sidenav__mode">for Brands</span>}
        </Link>
        {mode === 'app' && db.session && (
          <Link to="/new" className="btn btn--blue btn--block sidenav__cta">
            <Icon name="plus" size={18} /> New goal
          </Link>
        )}
        <nav>
          <ul className="sidenav__list">
            {nav.map((n) => (
              <li key={n.to}>
                <Link to={n.to} className={`sidenav__item ${isActive(n.to) ? 'is-active' : ''}`} aria-current={isActive(n.to) ? 'page' : undefined}>
                  <Icon name={n.icon} />
                  {n.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div className="sidenav__foot">
          {mode === 'app' ? (
            <Link to="/sponsor" className="sidenav__item">
              <Icon name="building" /> Sogo for Brands
            </Link>
          ) : (
            <Link to="/home" className="sidenav__item">
              <Icon name="back" /> Back to Sogo
            </Link>
          )}
          {db.session && (
            <Link to="/settings" className={`sidenav__item ${isActive('/settings') ? 'is-active' : ''}`}>
              <Icon name="settings" /> Settings
            </Link>
          )}
        </div>
      </aside>

      <header className="topbar">
        <Link to={db.session ? (mode === 'sponsor' ? '/sponsor' : '/home') : '/'} aria-label="Sogo home" className="topbar__brand">
          <Wordmark size={26} />
          {mode === 'sponsor' && <span className="sidenav__mode">for Brands</span>}
        </Link>
        <div className="topbar__actions">
          {db.session && mode === 'app' && (
            <button className="icon-btn" onClick={openNotifs} aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`}>
              <Icon name="bell" />
              {unread > 0 && <span className="dot">{unread}</span>}
            </button>
          )}
          {mode === 'sponsor' && (
            <Link to="/home" className="btn btn--soft btn--sm">
              Back to Sogo
            </Link>
          )}
          {db.session && mode === 'app' && (
            <Link to="/settings" aria-label="Settings" className="icon-btn">
              <Icon name="settings" />
            </Link>
          )}
        </div>
      </header>

      {db.session && mode === 'app' && (
        <div className="deskbar">
          <button className="icon-btn" onClick={openNotifs} aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`}>
            <Icon name="bell" />
            {unread > 0 && <span className="dot">{unread}</span>}
          </button>
          <Link to="/profile" aria-label="Your profile" className="deskbar__me">
            <Avatar user={user} size="sm" />
          </Link>
        </div>
      )}

      <main id="main" tabIndex={-1} className="main">
        {children}
      </main>

      {db.session && mode === 'app' && (
        <nav className="tabbar" aria-label="Primary">
          {[APP_NAV[0], APP_NAV[1]].map((n) => (
            <Link key={n.to} to={n.to} className={`tabbar__item ${isActive(n.to) ? 'is-active' : ''}`} aria-current={isActive(n.to) ? 'page' : undefined}>
              <Icon name={n.icon} />
              <span>{n.label}</span>
            </Link>
          ))}
          <Link to="/new" className="tabbar__new" aria-label="New goal">
            <Icon name="plus" size={26} />
          </Link>
          {[APP_NAV[2], APP_NAV[5]].map((n) => (
            <Link key={n.to} to={n.to} className={`tabbar__item ${isActive(n.to) ? 'is-active' : ''}`} aria-current={isActive(n.to) ? 'page' : undefined}>
              <Icon name={n.icon} />
              <span>{n.label}</span>
            </Link>
          ))}
        </nav>
      )}

      {db.session && mode === 'app' && <DemoGuide />}

      <Sheet open={notifOpen} onClose={closeNotifs} title="Notifications">
        {db.notifications.length === 0 ? (
          <p className="muted">Nothing new. When someone backs you or gives you Props, it shows up here.</p>
        ) : (
          <ul className="list">
            {db.notifications.slice(0, 12).map((n) => (
              <li key={n.id}>
                <button
                  className="row row--link notif"
                  style={{ width: '100%', background: 'none', border: 0, textAlign: 'left' }}
                  onClick={() => {
                    closeNotifs();
                    navigate(n.href);
                  }}
                >
                  <span className="notif__emoji" aria-hidden>
                    {n.emoji}
                  </span>
                  <span className="row__main">
                    <span className="row__title" style={{ display: 'block', fontWeight: n.read ? 500 : 700 }}>
                      {n.text}
                    </span>
                    <span className="row__meta">{relTime(n.created_at)}</span>
                  </span>
                  {!n.read && <span className="notif__unread" aria-label="Unread" />}
                </button>
              </li>
            ))}
          </ul>
        )}
      </Sheet>
    </div>
  );
}
