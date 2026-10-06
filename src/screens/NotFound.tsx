import { Link } from '../lib/router';
import { useStore } from '../lib/store';

export function NotFound() {
  const { db } = useStore();
  return (
    <div className="page">
      <div className="empty" style={{ marginTop: 40 }}>
        <div className="empty__title">That page isn't here.</div>
        <p>The link may be old, or the challenge may have been removed.</p>
        <Link to={db.session ? '/home' : '/'} className="btn btn--sm">
          {db.session ? 'Back to home' : 'Go to Sogo'}
        </Link>
      </div>
    </div>
  );
}
