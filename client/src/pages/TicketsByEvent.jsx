// client/src/pages/TicketsByEvent.jsx
import Nav from '../components/Nav.jsx';
import { useEffect, useState } from 'react';
import { api, setToken } from '../lib/api.js';

export default function TicketsByEvent() {
  const [tickets, setTickets] = useState([]);
  const params = new URLSearchParams(location.search);
  const id = params.get('id') || '';

  useEffect(() => {
    const t = localStorage.getItem('token') || '';
    setToken(t);
    if (!id) return;
    api
      .get(`/events/${id}/tickets`, { headers: { Authorization: `Bearer ${t}` } })
      .then((r) => setTickets(r.data.tickets || []))
      .catch(() => setTickets([]));
  }, [id]);

  return (
    <div>
      <Nav />
      <div className="container mx-auto p-4">
        <h1 className="text-2xl font-bold mb-3">Tickets</h1>
        <div className="overflow-auto rounded-2xl bg-white/70 backdrop-blur shadow">
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className="text-left p-3">#</th>
                <th className="text-left p-3">Type</th>
                <th className="text-left p-3">When</th>
                <th className="text-left p-3">Customer</th>
                <th className="text-left p-3">Refunded</th>
                <th className="text-left p-3">Checked-in</th>
              </tr>
            </thead>
            <tbody>
              {tickets.map((t) => (
                <tr key={t.id} className="border-t">
                  <td className="p-3">{t.ticketNumber}</td>
                  <td className="p-3">{t.ticketType?.name || '—'}</td>
                  <td className="p-3">
                    {t.showTime?.dateTime ? new Date(t.showTime.dateTime).toLocaleString() : '—'}
                  </td>
                  <td className="p-3">{t.order?.user?.name || t.order?.user?.email || '—'}</td>
                  <td className="p-3">{t.refunded ? 'Yes' : 'No'}</td>
                  {/* <-- this was the bug: use the boolean 'admitted' */}
                  <td className="p-3">{t.admitted ? 'Yes' : '—'}</td>
                </tr>
              ))}
              {tickets.length === 0 && (
                <tr>
                  <td className="p-3" colSpan={6}>
                    No tickets.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
