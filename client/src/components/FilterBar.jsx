import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

export default function FilterBar({ onChange }) {
  const [sp, setSp] = useSearchParams();
  const [q, setQ] = useState(sp.get('q') || '');
  const [category, setCategory] = useState(sp.get('category') || '');
  const [location, setLocation] = useState(sp.get('location') || '');
  const [from, setFrom] = useState(sp.get('from') || '');
  const [to, setTo] = useState(sp.get('to') || '');

  // push state to URL & parent
  useEffect(() => {
    const next = new URLSearchParams(sp);
    q ? next.set('q', q) : next.delete('q');
    category ? next.set('category', category) : next.delete('category');
    location ? next.set('location', location) : next.delete('location');
    from ? next.set('from', from) : next.delete('from');
    to ? next.set('to', to) : next.delete('to');
    setSp(next, { replace: true });
    onChange?.({ q, category, location, from, to });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, category, location, from, to]);

  const hasFilters = useMemo(
    () => Boolean(q || category || location || from || to),
    [q, category, location, from, to]
  );

  function clearAll() {
    setQ(''); setCategory(''); setLocation(''); setFrom(''); setTo('');
  }

  return (
    <div className="sticky top-14 z-30 -mx-4 bg-white/70 backdrop-blur supports-[backdrop-filter]:bg-white/50 border-b">
      <div className="mx-auto max-w-6xl px-4 py-3 flex flex-wrap gap-2 items-center">
        <input
          className="w-48 rounded-xl border bg-white px-3 py-2 text-sm"
          placeholder="Search…"
          value={q} onChange={e => setQ(e.target.value)}
        />
        <select
          value={category}
          onChange={e => setCategory(e.target.value)}
          className="w-44 rounded-xl border bg-white px-3 py-2 text-sm"
        >
          <option value="">All categories</option>
          <option>Music</option>
          <option>Festival</option>
          <option>Conference</option>
          <option>Sports</option>
          <option>Comedy</option>
          <option>Theatre</option>
          <option>General</option>
        </select>
        <input
          className="w-44 rounded-xl border bg-white px-3 py-2 text-sm"
          placeholder="Location"
          value={location} onChange={e => setLocation(e.target.value)}
        />

        <input
          type="date"
          className="rounded-xl border bg-white px-3 py-2 text-sm"
          value={from} onChange={e => setFrom(e.target.value)}
        />
        <input
          type="date"
          className="rounded-xl border bg-white px-3 py-2 text-sm"
          value={to} onChange={e => setTo(e.target.value)}
        />

        {hasFilters && (
          <button
            onClick={clearAll}
            className="ml-auto rounded-xl border px-3 py-2 text-sm hover:bg-zinc-50"
          >
            Clear filters
          </button>
        )}
      </div>
    </div>
  );
}
