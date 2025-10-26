// client/src/pages/App.jsx
import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../lib/api.js';

function CategoryChip({ label, icon, value }) {
  const nav = useNavigate();
  return (
    <button
      onClick={() => nav(`/explore?category=${encodeURIComponent(value)}`)}
      className="badge hover:bg-zinc-200 transition"
      title={label}
    >
      <span>{icon}</span><span>{label}</span>
    </button>
  );
}

function EventTile({ ev }) {
  return (
    <Link
      to={`/event/${ev.id}`}
      className="group overflow-hidden card border border-zinc-200/60 hover:shadow-md transition"
    >
      <div className="aspect-[16/9] w-full bg-zinc-100">
        {ev.photos?.[0] && (
          <img
            src={ev.photos[0]}
            alt={ev.title}
            className="h-full w-full object-cover transition group-hover:scale-[1.02]"
          />
        )}
      </div>
      <div className="p-3">
        <div className="text-xs text-zinc-500">
          {ev.category || 'General'} • {ev.location || '—'}
        </div>
        <div className="mt-0.5 line-clamp-1 font-semibold">{ev.title}</div>
        <div className="mt-0.5 text-xs text-zinc-600">
          {new Date(ev.startDate).toLocaleDateString()} — {new Date(ev.endDate).toLocaleDateString()}
        </div>
      </div>
    </Link>
  );
}

export default function App() {
  const nav = useNavigate();
  const [q, setQ] = useState('');
  const [trending, setTrending] = useState([]);

  useEffect(() => {
    (async () => {
      try {
        const r = await api.get('/events');
        const all = (r.data?.events || r.data || []);
        const today = new Date(); today.setHours(0,0,0,0);
        const items = all
          .filter(e => { const end = new Date(e.endDate); end.setHours(0,0,0,0); return end >= today; })
          .sort((a,b) => new Date(a.startDate) - new Date(b.startDate))
          .slice(0, 6);
        setTrending(items);
      } catch { setTrending([]); }
    })();
  }, []);

  function submitSearch(e) {
    e?.preventDefault?.();
    if (!q.trim()) return nav('/explore');
    nav(`/explore?q=${encodeURIComponent(q.trim())}`);
  }

  return (
    <div className="min-h-screen">
      {/* HERO */}
      <section className="container px-4 py-14 text-center">
        <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight">
          Discover. <span className="gradient-text">Book.</span> Enter. — <span className="gradient-text">Tixigo</span>
        </h1>
        <p className="mx-auto mt-3 max-w-2xl text-zinc-600">
          Create and manage events, sell tickets, scan QR codes, and see live stats — all in one sleek app.
        </p>

        <form onSubmit={submitSearch} className="mx-auto mt-6 flex max-w-xl items-center gap-2 rounded-2xl border bg-white p-2 shadow-sm">
          <input
            className="flex-1 rounded-xl px-3 py-2 text-sm outline-none"
            placeholder="Search events, artists, venues…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <button type="submit" className="btn btn-primary">Find events</button>
          <Link to="/my-tickets" className="btn btn-secondary">My Tickets</Link>
        </form>

        <div className="mx-auto mt-8 grid max-w-5xl grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ['˚˖📍🎀༘⋆ Browse', 'Find events you’ll love'],
            ['🔐 Secure', 'Fast, safe checkout'],
            ['𝄃𝄃𝄂𝄀𝄁𝄃𝄂𝄂𝄃 Scan', 'Instant QR entry'],
            ['📊📉 Insights', 'Live sales & check-ins'],
          ].map(([t, s]) => (
            <div key={t} className="card p-4 text-left">
              <div className="text-lg font-semibold">{t}</div>
              <div className="text-sm text-zinc-600">{s}</div>
            </div>
          ))}
        </div>

        <div className="mx-auto mt-8 flex max-w-4xl flex-wrap items-center justify-center gap-2">
          <CategoryChip label="Music" icon="🥁" value="Music" />
          <CategoryChip label="Festivals" icon="🛕🪔🎆" value="Festival" />
          <CategoryChip label="Conferences" icon="👥" value="Conference" />
          <CategoryChip label="Sports" icon="⛹🏾‍♀️🏌🏾‍♂️🚴🏻" value="Sports" />
          <CategoryChip label="Comedy" icon="🤡" value="Comedy" />
          <CategoryChip label="Theatre" icon="🎞️" value="Theatre" />
        </div>
      </section>

      {/* Trending */}
      <section className="container px-4 pb-16">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-xl font-bold">Trending this week</h2>
          <Link to="/explore" className="text-sm text-indigo-600 hover:underline">Explore all →</Link>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {trending.map(ev => <EventTile key={ev.id} ev={ev} />)}
          {trending.length === 0 && (
            <div className="card p-6 text-sm text-zinc-600">
              No upcoming events yet. Check back soon!
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
