import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../lib/api';
import Nav from '../components/Nav';

export default function AcceptStaff() {
  const { token } = useParams();
  const [state, setState] = useState({ loading: true, ok: false });

  useEffect(() => {
    let cancel = false;
    (async () => {
      try {
        await api.post('/staff/accept', { token });
        if (!cancel) setState({ loading: false, ok: true });
      } catch {
        if (!cancel) setState({ loading: false, ok: false });
      }
    })();
    return () => { cancel = true; };
  }, [token]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-50 to-zinc-100">
      <Nav />
      <main className="mx-auto max-w-3xl px-4 py-10">
        {state.loading ? (
          <div className="h-24 animate-pulse rounded-2xl bg-white/60" />
        ) : state.ok ? (
          <div className="rounded-2xl border bg-white p-6 shadow-sm">
            <h1 className="text-xl font-semibold">You’re in! 🎉</h1>
            <p className="mt-2 text-sm text-zinc-600">
              Your staff access has been recorded. If the organizer requires approval,
              they’ll need to approve you before you can scan tickets.
            </p>
            <div className="mt-4 flex gap-2">
              <button
                onClick={() => window.location.assign('/staff/scan')}
                className="rounded-xl border px-3 py-2 text-sm hover:bg-zinc-50"
              >
                Go to staff tools →
              </button>
              <Link
                to="/explore"
                className="rounded-xl border px-3 py-2 text-sm hover:bg-zinc-50"
              >
                Explore events
              </Link>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border bg-white p-6 shadow-sm">
            <h1 className="text-xl font-semibold">Could not accept invite.</h1>
            <p className="mt-2 text-sm text-zinc-600">
              It may be expired or already used.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
