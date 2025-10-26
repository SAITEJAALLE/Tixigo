// client/src/pages/OrganizerDashboard.jsx
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import Nav from '../components/Nav.jsx';
import api, { setToken, getToken } from '../lib/api.js';

function StatCard({ label, value, icon }) {
  return (
    <div className="rounded-2xl border bg-white/70 backdrop-blur p-4 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="text-2xl">{icon}</div>
        <div>
          <div className="text-sm text-zinc-500">{label}</div>
          <div className="text-2xl font-semibold">{value}</div>
        </div>
      </div>
    </div>
  );
}

export default function OrganizerDashboard() {
  const [events, setEvents] = useState([]);
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [eventsError, setEventsError] = useState('');

const [assignments, setAssignments] = useState([]);
const [loadingAssign, setLoadingAssign] = useState(false);


  const [search, setSearch] = useState('');
  const filtered = useMemo(() => {
    if (!search.trim()) return events;
    const q = search.toLowerCase();
    return events.filter(e => (e.title || '').toLowerCase().includes(q));
  }, [events, search]);

  const [selectedId, setSelectedId] = useState('');
  const [insights, setInsights] = useState(null);
  const [detail, setDetail] = useState(null);
  const [loadingStats, setLoadingStats] = useState(false);

  // Load token & my events
  useEffect(() => {
    const t = getToken() || localStorage.getItem('token') || null;
    if (t) setToken(t);

    let cancel = false;
    (async () => {
      try {
        setLoadingEvents(true);
        setEventsError('');
        const r = await api.get('/events/mine');
        const list = r?.data?.events ?? r?.data ?? [];
        if (!cancel) setEvents(list);
      } catch (e) {
        if (!cancel) {
          setEvents([]);
          setEventsError('Could not load your events.');
        }
      } finally {
        if (!cancel) setLoadingEvents(false);
      }
    })();

    return () => { cancel = true; };
  }, []);

  useEffect(() => {
  if (!selectedId) { setAssignments([]); return; }
  let cancel = false;
  (async () => {
    try {
      setLoadingAssign(true);
      const r = await api.get(`/staff/event/${selectedId}/assignments`);
      if (!cancel) setAssignments(r?.data?.assignments || []);
    } catch {
      if (!cancel) setAssignments([]);
    } finally {
      if (!cancel) setLoadingAssign(false);
    }
  })();
  return () => { cancel = true; };
}, [selectedId]);


  // Fetch insights + event detail on selection
  useEffect(() => {
    if (!selectedId) {
      setInsights(null);
      setDetail(null);
      return;
    }
    let cancel = false;
    (async () => {
      try {
        setLoadingStats(true);
        const [ins, det] = await Promise.all([
          api.get(`/events/${selectedId}/insights`), // server also exposes /stats
          api.get(`/events/${selectedId}`)
        ]);
        if (!cancel) {
          setInsights(ins?.data ?? null);
          setDetail(det?.data?.event ?? det?.data ?? null);
        }
      } catch {
        if (!cancel) {
          setInsights(null);
          setDetail(null);
        }
      } finally {
        if (!cancel) setLoadingStats(false);
      }
    })();

    return () => { cancel = true; };
  }, [selectedId]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-50 to-zinc-100">
      <Nav />

      {/* Header */}
      <section className="border-b bg-white/70 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Organizer Dashboard</h1>
            <p className="text-sm text-zinc-600">Create events and monitor live stats in real time.</p>
          </div>
          <Link
            to="/organizer/events/new"
            className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow hover:bg-indigo-700"
          >
            + Create event
          </Link>
        </div>
      </section>

      {/* Main */}
      <main className="mx-auto max-w-6xl px-4 py-6 space-y-6">

        <button
  className="rounded-xl border px-3 py-2 text-sm hover:bg-zinc-50"
  onClick={async () => {
    try {
      if (!selectedId) return alert('Select an event first.');
      const email = prompt('Staff email to invite:');
      if (!email) return;
      const name = prompt('Name (optional):') || '';
      const role = prompt('Role (SCANNER | ADMIN | SUPPORT):') || 'SCANNER';
      const r = await api.post('/staff/invite', { eventId: selectedId, email, name, role });
      alert(`Invite link:\n${r.data.link}\n\nIt was also emailed (if SMTP is configured).`);
    } catch {
      alert('Could not create invite');
    }
  }}
>
  Invite staff
</button>


        {/* Event picker */}
        <div className="rounded-2xl border bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <label className="text-sm font-medium text-zinc-600">Select an event</label>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              {/* quick search to filter the dropdown */}
              <input
                type="text"
                placeholder="Search my events…"
                className="w-full sm:w-64 rounded-xl border px-3 py-2 text-sm"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <select
                className="w-full sm:w-96 rounded-xl border px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                value={selectedId}
                onChange={(e) => setSelectedId(e.target.value)}
                disabled={loadingEvents || filtered.length === 0}
              >
                <option value="">
                  {loadingEvents ? 'Loading…' : (filtered.length ? '— Choose an event —' : 'No events')}
                </option>
                {filtered.map(ev => (
                  <option key={ev.id} value={ev.id}>
                    {ev.title} {ev.startDate ? `• ${new Date(ev.startDate).toLocaleDateString()}` : ''}
                  </option>
                ))}
              </select>
              {selectedId && (
                <button
                  onClick={() => setSelectedId(selectedId)}
                  className="rounded-xl border px-3 py-2 text-sm hover:bg-zinc-50"
                  title="Refresh"
                >
                  ⟳ Refresh
                </button>
              )}
            </div>
          </div>

          {/* Empty state */}
          {!loadingEvents && events.length === 0 && (
            <div className="mt-4 rounded-xl border border-dashed bg-zinc-50 p-6 text-center">
              <div className="text-lg font-medium">No events yet</div>
              <p className="mt-1 text-sm text-zinc-600">
                Create your first event to start selling tickets and tracking stats.
              </p>
              <div className="mt-4">
                <Link
                  to="/organizer/events/new"
                  className="rounded-xl bg-black px-4 py-2 text-sm font-medium text-white hover:bg-zinc-900"
                >
                  + Create event
                </Link>
              </div>
            </div>
          )}

          {eventsError && (
            <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {eventsError}
            </div>
          )}
        </div>

        {/* Metrics */}
        {selectedId ? (
          <div className="space-y-6">
            {loadingStats ? (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="h-24 animate-pulse rounded-2xl bg-zinc-200/60" />
                ))}
              </div>
            ) : insights ? (
              <>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
                  <StatCard label="Capacity"  value={insights.capacity ?? 0}  icon="🏁" />
                  <StatCard label="Sold"      value={insights.sold ?? 0}      icon="🪙" />
                  <StatCard label="Left"      value={insights.left ?? 0}      icon="🧮" />
                  <StatCard label="Admitted"  value={insights.admitted ?? 0}  icon="✅" />
                  <StatCard label="Refunded"  value={insights.refunded ?? 0}  icon="↩️" />
                </div>

                <div className="grid gap-6 lg:grid-cols-3">
                  <div className="rounded-2xl border bg-white p-4 shadow-sm lg:col-span-2">
                    <div className="mb-3 flex items-center justify-between">
                      <h3 className="text-lg font-semibold">Show times</h3>
                      {detail?.photos?.[0] && (
                        <img
                          src={detail.photos[0]}
                          alt={detail?.title || 'Event'}
                          className="h-10 w-16 rounded-lg object-cover"
                          loading="lazy"
                        />
                      )}
                    </div>
                    {detail?.showTimes?.length ? (
                      <div className="overflow-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="text-left text-zinc-600">
                              <th className="px-2 py-2">When</th>
                              <th className="px-2 py-2">Capacity</th>
                            </tr>
                          </thead>
                          <tbody>
                            {detail.showTimes
                              .slice()
                              .sort((a, b) => new Date(a.dateTime) - new Date(b.dateTime))
                              .map(st => (
                                <tr key={st.id} className="border-t">
                                  <td className="px-2 py-2">{new Date(st.dateTime).toLocaleString()}</td>
                                  <td className="px-2 py-2">{st.capacity}</td>
                                </tr>
                              ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="rounded-xl border border-dashed bg-zinc-50 p-4 text-sm text-zinc-600">
                        No show times found for this event.
                      </div>
                    )}
                  </div>

                  {/* Staff Requests */}
<div className="rounded-2xl border bg-white p-4 shadow-sm">
  <div className="mb-3 flex items-center justify-between">
    <h3 className="text-lg font-semibold">Staff requests</h3>
    <button
      disabled={!selectedId || loadingAssign}
      className="rounded-xl border px-3 py-2 text-sm hover:bg-zinc-50 disabled:opacity-50"
      onClick={async () => {
        const r = await api.get(`/staff/event/${selectedId}/assignments`);
        setAssignments(r?.data?.assignments || []);
      }}
      title="Refresh"
    >
      ⟳ Refresh
    </button>
  </div>

  {loadingAssign ? (
    <div className="text-sm text-zinc-500">Loading…</div>
  ) : assignments.length === 0 ? (
    <div className="rounded-xl border border-dashed bg-zinc-50 p-4 text-sm text-zinc-600">
      No staff requests yet.
    </div>
  ) : (
    <div className="overflow-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-zinc-600">
            <th className="px-2 py-2">User</th>
            <th className="px-2 py-2">Email</th>
            <th className="px-2 py-2">Role</th>
            <th className="px-2 py-2">Approved</th>
            <th className="px-2 py-2"></th>
          </tr>
        </thead>
        <tbody>
          {assignments.map(row => (
            <tr key={row.id} className="border-t">
              <td className="px-2 py-2">{row.user?.name || '—'}</td>
              <td className="px-2 py-2">{row.user?.email || '—'}</td>
              <td className="px-2 py-2">{row.role}</td>
              <td className="px-2 py-2">{row.approved ? 'Yes' : 'No'}</td>
              <td className="px-2 py-2">
                {!row.approved ? (
                  <div className="flex gap-2">
                    <button
                      className="rounded-xl border px-3 py-1 text-sm hover:bg-zinc-50"
                      onClick={async () => {
                        await api.post(`/staff/assignments/${row.id}/approve`);
                        const r = await api.get(`/staff/event/${selectedId}/assignments`);
                        setAssignments(r?.data?.assignments || []);
                      }}
                    >
                      Approve
                    </button>
                    <button
                      className="rounded-xl border px-3 py-1 text-sm text-red-600 hover:bg-red-50"
                      onClick={async () => {
                        await api.post(`/staff/assignments/${row.id}/reject`);
                        const r = await api.get(`/staff/event/${selectedId}/assignments`);
                        setAssignments(r?.data?.assignments || []);
                      }}
                    >
                      Reject
                    </button>
                  </div>
                ) : (
                  <span className="text-zinc-500">—</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )}
</div>


                  <div className="rounded-2xl border bg-white p-4 shadow-sm">
                    <h3 className="mb-3 text-lg font-semibold">Quick actions</h3>
                    <div className="flex flex-col gap-2">
                      <a
                        href={`/tickets-by-event?id=${selectedId}`}
                        className="rounded-xl border px-3 py-2 text-sm hover:bg-zinc-50"
                      >
                        View tickets list →
                      </a>
                      <a
                        href={`/event/${selectedId}`}
                        className="rounded-xl border px-3 py-2 text-sm hover:bg-zinc-50"
                        target="_blank"
                        rel="noreferrer"
                      >
                        View event page →
                      </a>
                      <button
                        className="rounded-xl border px-3 py-2 text-sm text-zinc-500"
                        onClick={async () => {
                          try {
                            await navigator.clipboard.writeText(`${location.origin}/event/${selectedId}`);
                            alert('Event link copied!');
                          } catch {
                            alert('Could not copy link');
                          }
                        }}
                      >
                        Copy event link
                      </button>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="rounded-2xl border bg-white p-6 text-zinc-600">
                Couldn’t load stats for this event.
              </div>
            )}
          </div>
        ) : (
          <div className="rounded-2xl border bg-white p-6 text-zinc-600">
            Select an event to view live stats.
          </div>
        )}
      </main>
    </div>
  );
}
