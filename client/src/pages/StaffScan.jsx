// client/src/pages/StaffScan.jsx
import { useEffect, useRef, useState } from 'react';
import Nav from '../components/Nav.jsx';
import api from '../lib/api.js';
import ScannerFallback from '../components/ScannerFallback.jsx';

// small ticket preview
function TicketPreview({ t }) {
  if (!t) return null;
  return (
    <div className="mt-2 rounded-xl border bg-white p-3 text-sm">
      <div className="font-medium">{t.event?.title || 'Event'}</div>
      <div className="text-zinc-600">
        Type: {t.ticketType?.name ?? '-'} • Show:{' '}
        {t.showTime ? new Date(t.showTime.dateTime).toLocaleString() : '-'}
      </div>
      <div className="text-zinc-600">Code: {t.code || t.ticketNumber}</div>
    </div>
  );
}

export default function StaffScan() {
  const [eventId, setEventId] = useState('');
  const [msg, setMsg] = useState('');
  const [detail, setDetail] = useState(null);
  const [assignments, setAssignments] = useState([]);
  const mounted = useRef(false);

  // show which events this staff is approved for
  useEffect(() => {
    let cancel = false;
    (async () => {
      try {
        const r = await api.get('/staff/my-assignments');
        if (!cancel) setAssignments(r.data.assignments || []);
      } catch {
        if (!cancel) setAssignments([]);
      }
    })();
    return () => { cancel = true; };
  }, []);

  // camera scanner (optional)
  useEffect(() => {
    if (mounted.current) return;
    mounted.current = true;
    let scanner;
    (async () => {
      try {
        const { Html5QrcodeScanner } = await import('html5-qrcode');
        scanner = new Html5QrcodeScanner('reader', { fps: 10, qrbox: 250 });
        scanner.render(async (text) => handlePayload(text));
      } catch {
        console.warn('html5-qrcode unavailable (desktop w/o camera is fine)');
      }
    })();
    return () => { try { scanner?.clear(); } catch {} };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handlePayload(text) {
    setMsg('Scanning…');
    setDetail(null);
    try {
      const r = await api.post('/staff/scan', { code: text, eventId: eventId || undefined });
      if (r.data?.ok) {
        setMsg(r.data.alreadyAdmitted ? '⚠️ Already admitted' : '✅ Admitted');
        setDetail(r.data.ticket || null);
      } else {
        setMsg('❌ Invalid ticket');
      }
    } catch (e) {
      const status = e?.response?.status;
      const body = e?.response?.data || {};
      if (status === 403) setMsg('🚫 Not allowed to scan for this event.');
      else if (status === 404) setMsg('❌ Ticket not found');
      else if (status === 409 && body?.error === 'ticket_refunded') setMsg('↩️ Already refunded — cannot admit');
      else setMsg('❌ Error');
      setDetail(null);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Nav />
      <div className="mx-auto max-w-xl p-4">
        <h1 className="mb-3 text-2xl font-bold">Staff tools</h1>

        <label className="text-sm text-zinc-600">Current Event ID (optional)</label>
        <input
          className="mb-3 w-full rounded-xl border bg-white px-3 py-2 text-sm"
          placeholder="Event ID (optional)"
          value={eventId}
          onChange={(e) => setEventId(e.target.value)}
        />

        {assignments.length > 0 && (
          <div className="mb-3 text-xs text-zinc-600">
            Approved for: {assignments.map(a => a.event?.title).filter(Boolean).join(', ')}
          </div>
        )}

        <div id="reader" className="rounded-xl border bg-white p-2" />

        <div className="mt-3 text-center text-lg">{msg}</div>

        {/* image upload fallback */}
        <ScannerFallback eventId={eventId} onScan={handlePayload} onError={() => setMsg('❌ Error')} />

        <TicketPreview t={detail} />
      </div>
    </div>
  );
}
