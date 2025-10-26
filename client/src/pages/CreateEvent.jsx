// client/src/pages/CreateEvent.jsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Nav from '../components/Nav';
import api, { getToken, setToken } from '../lib/api';

export default function CreateEvent() {
  const nav = useNavigate();

  const [title, setTitle] = useState('');
  const [location, setLocation] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('General');
  const [cover, setCover] = useState('');

  const [start, setStart] = useState(''); // datetime-local
  const [end, setEnd] = useState('');

  const [showTimes, setShowTimes] = useState([
    { when: '', capacity: 100 } // when: datetime-local
  ]);

  const [ticketTypes, setTicketTypes] = useState([
    { name: 'Standard', price: '19.99', includesDrink: false, includesMeal: false },
  ]);

  const toISO = (v) => (v ? new Date(v).toISOString() : null);

  const addShow = () => setShowTimes((a) => [...a, { when: '', capacity: 100 }]);
  const rmShow = (i) => setShowTimes((a) => a.filter((_, idx) => idx !== i));
  const updShow = (i, k, v) =>
    setShowTimes((a) => a.map((s, idx) => (idx === i ? { ...s, [k]: v } : s)));

  const addType = () =>
    setTicketTypes((t) => [...t, { name: '', price: '0', includesDrink: false, includesMeal: false }]);
  const rmType = (i) => setTicketTypes((t) => t.filter((_, idx) => idx !== i));
  const updType = (i, k, v) =>
    setTicketTypes((t) => t.map((x, idx) => (idx === i ? { ...x, [k]: v } : x)));

  const onSubmit = async (e) => {
    e.preventDefault();
    try {
      const token = getToken();
      if (token) setToken(token);

      const body = {
        title,
        description,
        category,
        location,
        startDate: toISO(start),
        endDate: toISO(end),
        photos: cover ? [cover] : [],
        showTimes: showTimes
          .filter((s) => s.when)
          .map((s) => ({ dateTime: toISO(s.when), capacity: Number(s.capacity || 0) })),
        ticketTypes: ticketTypes
          .filter((t) => t.name)
          .map((t) => ({
            name: t.name,
            priceCents: Math.round(Number(t.price || 0) * 100),
            currency: 'GBP',
            includesDrink: !!t.includesDrink,
            includesMeal: !!t.includesMeal,
          })),
      };

      const r = await api.post('/events', body);
      if (r.data?.ok) {
        alert('Event created!');
        nav('/organizer');
        return;
      }
      alert(r.data?.error || 'Failed to create event');
    } catch (err) {
      console.error(err);
      alert('internal_error');
    }
  };

  return (
    <div>
      <Nav />
      <div className="mx-auto max-w-3xl p-5">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Create new event</h1>
          <button onClick={onSubmit} className="rounded-lg bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-700">
            Create event
          </button>
        </div>

        <form onSubmit={onSubmit} className="mt-6 space-y-8">
          {/* Basics */}
          <section className="rounded-2xl border p-4 shadow-sm">
            <h2 className="mb-3 text-lg font-semibold">Basics</h2>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium">Title</label>
                <input className="mt-1 w-full rounded-lg border px-3 py-2" value={title} onChange={(e) => setTitle(e.target.value)} />
              </div>

              <div>
                <label className="block text-sm font-medium">Location</label>
                <input className="mt-1 w-full rounded-lg border px-3 py-2" value={location} onChange={(e) => setLocation(e.target.value)} />
              </div>

              <div>
                <label className="block text-sm font-medium">Category</label>
                <input className="mt-1 w-full rounded-lg border px-3 py-2" value={category} onChange={(e) => setCategory(e.target.value)} />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium">Short description</label>
                <textarea rows={3} className="mt-1 w-full rounded-lg border px-3 py-2" value={description} onChange={(e) => setDescription(e.target.value)} />
              </div>

              <div>
                <label className="block text-sm font-medium">Starts at</label>
                <input type="datetime-local" className="mt-1 w-full rounded-lg border px-3 py-2" value={start} onChange={(e) => setStart(e.target.value)} />
              </div>

              <div>
                <label className="block text-sm font-medium">Ends at</label>
                <input type="datetime-local" className="mt-1 w-full rounded-lg border px-3 py-2" value={end} onChange={(e) => setEnd(e.target.value)} />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium">Cover image URL</label>
                <input className="mt-1 w-full rounded-lg border px-3 py-2" placeholder="https://…" value={cover} onChange={(e) => setCover(e.target.value)} />
              </div>
            </div>
          </section>

          {/* Show times */}
          <section className="rounded-2xl border p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Show times</h2>
              <button type="button" className="rounded-lg border px-3 py-1.5 hover:bg-zinc-50" onClick={addShow}>+ Add show time</button>
            </div>

            <div className="space-y-3">
              {showTimes.map((s, i) => (
                <div key={i} className="grid items-end gap-3 md:grid-cols-3">
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium">When</label>
                    <input type="datetime-local" className="mt-1 w-full rounded-lg border px-3 py-2" value={s.when} onChange={(e) => updShow(i, 'when', e.target.value)} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium">Capacity</label>
                    <input type="number" min="0" className="mt-1 w-full rounded-lg border px-3 py-2" value={s.capacity} onChange={(e) => updShow(i, 'capacity', e.target.value)} />
                  </div>
                  <div className="md:col-span-3">
                    <button type="button" className="text-sm text-red-600 hover:underline" onClick={() => rmShow(i)}>Remove</button>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Ticket types */}
          <section className="rounded-2xl border p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Ticket types</h2>
              <button type="button" className="rounded-lg border px-3 py-1.5 hover:bg-zinc-50" onClick={addType}>+ Add ticket type</button>
            </div>

            <div className="space-y-5">
              {ticketTypes.map((t, i) => (
                <div key={i} className="grid gap-3 md:grid-cols-4">
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium">Name</label>
                    <input className="mt-1 w-full rounded-lg border px-3 py-2" value={t.name} onChange={(e) => updType(i, 'name', e.target.value)} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium">Price (GBP)</label>
                    <input type="number" min="0" step="0.01" className="mt-1 w-full rounded-lg border px-3 py-2" value={t.price} onChange={(e) => updType(i, 'price', e.target.value)} />
                  </div>
                  <div className="flex items-center gap-4">
                    <label className="inline-flex items-center gap-2 text-sm">
                      <input type="checkbox" checked={t.includesDrink} onChange={(e) => updType(i, 'includesDrink', e.target.checked)} />
                      Drink
                    </label>
                    <label className="inline-flex items-center gap-2 text-sm">
                      <input type="checkbox" checked={t.includesMeal} onChange={(e) => updType(i, 'includesMeal', e.target.checked)} />
                      Meal
                    </label>
                  </div>
                  <div className="md:col-span-4">
                    <button type="button" className="text-sm text-red-600 hover:underline" onClick={() => rmType(i)}>Remove</button>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <div className="flex justify-end">
            <button className="rounded-lg bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-700">Create event</button>
          </div>
        </form>
      </div>
    </div>
  );
}
