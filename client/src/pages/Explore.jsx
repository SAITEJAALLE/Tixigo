// client/src/pages/Explore.jsx
import { useEffect, useMemo, useState } from 'react';
import api from '../lib/api.js';

export default function Explore() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  // filters
  const [q, setQ] = useState('');
  const [category, setCategory] = useState('');
  const [location, setLocation] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  useEffect(() => {
    let cancelled = false;
    const t = setTimeout(async () => {
      try {
        setLoading(true);
        const params = {};
        if (q.trim()) params.q = q.trim();
        if (category) params.category = category;
        if (location.trim()) params.location = location.trim();
        if (from) params.from = from;
        if (to) params.to = to;

        const r = await api.get('/events', { params });
        if (cancelled) return;
        const raw = Array.isArray(r.data) ? r.data : (r.data?.events || []);
        setEvents(onlyUpcoming(raw));
      } catch {
        if (!cancelled) setEvents([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 250);

    return () => { cancelled = true; clearTimeout(t); };
  }, [q, category, location, from, to]);

  function onlyUpcoming(rows = []) {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    return rows.filter(e => {
      const end = new Date(e.endDate); end.setHours(0, 0, 0, 0);
      return end >= today;
    });
  }

  const categories = useMemo(() => {
    const set = new Set();
    events.forEach(e => e?.category && set.add(e.category));
    return ['All categories', ...Array.from(set)];
  }, [events]);

  const resetFilters = () => { setQ(''); setCategory(''); setLocation(''); setFrom(''); setTo(''); };

  return (
    <div className="min-h-screen">
      <div className="border-b bg-white">
        <div className="container px-4 py-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <input className="input" placeholder="Search…"
                   value={q} onChange={(e)=>setQ(e.target.value)} />
            <select className="select" value={category}
                    onChange={(e)=>setCategory(e.target.value === 'All categories' ? '' : e.target.value)}>
              {categories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <input className="input" placeholder="Location"
                   value={location} onChange={(e)=>setLocation(e.target.value)} />
            <input type="date" className="input" value={from} onChange={(e)=>setFrom(e.target.value)} />
            <div className="flex items-center gap-2">
              <input type="date" className="input flex-1" value={to} onChange={(e)=>setTo(e.target.value)} />
              <button onClick={resetFilters} className="btn btn-ghost hidden lg:inline-flex">Reset</button>
            </div>
          </div>
          <div className="mt-2 lg:hidden">
            <button onClick={resetFilters} className="btn btn-ghost w-full">Reset filters</button>
          </div>
        </div>
      </div>

      <main className="container px-4 py-6">
        <h1 className="mb-4 text-2xl font-bold">Explore</h1>

        {loading && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({length:6}).map((_,i)=>(
              <div key={i} className="card overflow-hidden">
                <div className="aspect-[16/9] w-full skeleton" />
                <div className="p-3 space-y-2">
                  <div className="h-3 w-1/2 skeleton" />
                  <div className="h-4 w-2/3 skeleton" />
                  <div className="h-3 w-1/3 skeleton" />
                </div>
              </div>
            ))}
          </div>
        )}

        {!loading && events.length === 0 && (
          <div className="card p-6 text-sm text-zinc-600">No ongoing or upcoming events match your filters.</div>
        )}

        {!loading && events.length > 0 && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {events.map(ev => (
              <a key={ev.id} href={`/event/${ev.id}`} className="card overflow-hidden hover:shadow-md transition">
                <div className="aspect-[16/9] w-full bg-zinc-100">
                  {ev.photos?.[0] && <img src={ev.photos[0]} alt={ev.title} className="h-full w-full object-cover" />}
                </div>
                <div className="p-3">
                  <div className="text-xs text-zinc-500">{ev.category || 'General'} • {ev.location || '—'}</div>
                  <div className="mt-0.5 line-clamp-1 font-semibold">{ev.title}</div>
                  <div className="mt-0.5 text-xs text-zinc-600">
                    {fmt(ev.startDate)} — {fmt(ev.endDate)}
                  </div>
                </div>
              </a>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

function fmt(d) { try { return new Date(d).toLocaleDateString(); } catch { return '-'; } }
