// client/src/pages/MyTickets.jsx
import { useEffect, useMemo, useState } from 'react';
import api from '../lib/api';
import QR from 'qrcode';

function groupByDate(tickets) {
  const map = {};
  for (const t of tickets) {
    const d = new Date(t.showTime?.dateTime || t.showTime?.datetime || t.showTime).toDateString();
    if (!map[d]) map[d] = [];
    map[d].push(t);
  }
  return Object.entries(map).sort((a,b)=> new Date(b[0]) - new Date(a[0]));
}

export default function MyTickets() {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [qrFor, setQrFor] = useState(null);
  const [qrData, setQrData] = useState('');

  useEffect(() => {
    let ignore = false;
    (async () => {
      try {
        const t = localStorage.getItem('token') || '';
        const r = await api.get('/v1/me/tickets', { headers: { Authorization: `Bearer ${t}` } });
        if (!ignore) setTickets(r.data?.tickets || r.data || []);
      } catch { if (!ignore) setTickets([]); }
      finally { if (!ignore) setLoading(false); }
    })();
    return () => { ignore = true; };
  }, []);

  const grouped = useMemo(() => groupByDate(tickets), [tickets]);

  const openQR = async (t) => {
    try { setQrData(await QR.toDataURL(t.code || t.qrPng || t.ticketNumber || '')); }
    catch { setQrData(''); }
    setQrFor(t);
  };

  return (
    <div className="container px-4 py-8">
      <h1 className="mb-6 text-2xl font-bold">My Tickets</h1>

      {loading && <div className="card p-6">Loading…</div>}
      {!loading && grouped.length === 0 && (
        <div className="card p-6 text-zinc-600">No tickets yet.</div>
      )}

      <div className="space-y-8">
        {grouped.map(([day, list]) => (
          <section key={day}>
            <div className="mb-3 text-xs font-medium text-zinc-500">{day}</div>
            <div className="grid gap-4">
              {list.map(t => {
                const dt = new Date(t.showTime?.dateTime || t.showTime?.datetime || t.showTime);
                return (
                  <article key={t.id || t.code} className="card p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="space-y-1">
                      <div className="text-xs text-zinc-500">Ticket # · <span className="font-mono">{t.ticketNumber}</span></div>
                      <div className="font-medium">{t.event?.title || 'Event'}</div>
                      <div className="text-xs text-zinc-600">
                        {dt.toLocaleDateString()} · {dt.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}
                        {t.event?.location ? ` · ${t.event.location}` : ''}
                      </div>
                      <div className="text-[11px] text-zinc-500 break-all">Code: {t.code}</div>
                    </div>
                    <div className="sm:ml-4">
                      <button onClick={() => openQR(t)} className="btn btn-primary">View QR</button>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        ))}
      </div>

      {qrFor && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4">
          <div className="w-full max-w-xs card p-5 text-center">
            <div className="text-sm text-zinc-500">Ticket</div>
            <div className="mb-2 font-semibold">{qrFor.ticketNumber}</div>
            <img src={qrData} alt="Ticket QR" className="mx-auto h-60 w-60 rounded-lg border bg-white p-2" />
            <div className="mt-2 break-all text-xs text-zinc-500">{qrFor.code}</div>
            <button onClick={() => setQrFor(null)} className="btn btn-secondary w-full mt-4">Close</button>
          </div>
        </div>
      )}
    </div>
  );
}
