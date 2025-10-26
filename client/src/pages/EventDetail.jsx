import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../lib/api';

export default function EventDetail() {
  const { id } = useParams();
  const nav = useNavigate();

  const [event, setEvent] = useState(null);
  const [selShow, setSelShow] = useState('');
  const [qty, setQty] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await api.get(`/events/${id}`);
        if (!cancelled) {
          setEvent(r.data?.event || r.data);
          setLoading(false);
        }
      } catch {
        try {
          const r2 = await api.get('/v1/events');
          const ev = (r2.data?.events || []).find(e => e.id === id);
          if (!cancelled) {
            setEvent(ev || null);
            setLoading(false);
          }
        } catch {
          if (!cancelled) setLoading(false);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [id]);

  const ticketTypes = event?.ticketTypes || [];
  const showTimes = event?.showTimes || [];

  const items = useMemo(
    () =>
      Object.entries(qty)
        .filter(([, v]) => Number(v) > 0)
        .map(([ticketTypeId, v]) => ({ ticketTypeId, qty: Number(v) })), // NOTE: qty
    [qty]
  );

  const handleQty = (ticketTypeId, val) => {
    setQty(prev => ({ ...prev, [ticketTypeId]: Math.max(0, Number(val) || 0) }));
  };

  const handleCheckout = async () => {
    if (!selShow) return alert('Please select a show time');
    if (items.length === 0) return alert('Select at least one ticket');

    try {
      const t = localStorage.getItem('token') || '';
      await api.post(
        '/orders/checkout',
        { eventId: id, showTimeId: selShow, items },
        { headers: { Authorization: `Bearer ${t}` } }
      );

      // immediately issue (because we are in stub mode by default)
      const r2 = await api.post(
        '/orders/issue',
        {},
        { headers: { Authorization: `Bearer ${t}` } }
      );

      if (r2.data?.ok) {
        nav('/checkout/success');
      } else {
        alert('Issuing tickets failed.');
      }
    } catch (e) {
      console.error(e);
      alert('Checkout failed. Please try again.');
    }
  };

  if (loading) return <div className="p-6">Loading…</div>;
  if (!event) return <div className="p-6">Event not found.</div>;

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold">{event.title}</h1>
        <div className="text-sm opacity-70">
          {event.category} • {event.location}
        </div>
      </div>

      {event.photos?.length ? (
        <img src={event.photos[0]} alt={event.title} className="w-full rounded-xl" loading="lazy" />
      ) : null}

      <p className="opacity-90">{event.description}</p>

      <div className="space-y-3">
        <label className="block text-sm font-medium">Choose show time</label>
        <select
          className="border rounded px-3 py-2 w-full"
          value={selShow}
          onChange={e => setSelShow(e.target.value)}
        >
          <option value="">Select…</option>
          {showTimes.map(st => (
            <option key={st.id} value={st.id}>
              {new Date(st.dateTime).toLocaleString()}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Tickets</h2>
        <div className="space-y-3">
          {ticketTypes.map(tt => (
            <div key={tt.id} className="flex items-center justify-between border rounded px-3 py-2">
              <div>
                <div className="font-medium">{tt.name}</div>
                <div className="text-sm opacity-70">
                  {(tt.priceCents / 100).toFixed(2)} {tt.currency || 'GBP'}
                  {tt.includesDrink ? ' • Drink included' : ''}
                  {tt.includesMeal ? ' • Meal included' : ''}
                </div>
              </div>
              <input
                type="number"
                min="0"
                className="w-20 border rounded px-2 py-1"
                value={qty[tt.id] ?? 0}
                onChange={e => handleQty(tt.id, e.target.value)}
              />
            </div>
          ))}
        </div>
      </div>

      <div className="flex gap-3">
        <button className="bg-black text-white px-4 py-2 rounded-lg" onClick={handleCheckout}>
          Checkout
        </button>
        <button className="px-4 py-2 rounded-lg border" onClick={() => nav(-1)}>
          Back
        </button>
      </div>
    </div>
  );
}
