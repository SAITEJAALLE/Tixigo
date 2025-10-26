import { useEffect, useState } from 'react';
import api from '../lib/api';

export default function BecomeOrganiser() {
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState(null);
  const [message, setMessage] = useState('');

  // Load my existing request (if any)
  useEffect(() => {
    (async () => {
      try {
        const r = await api.get('/organizers/requests/mine');
        if (r.data?.request) setStatus(r.data.request.status);
      } catch {}
    })();
  }, []);

  async function submit() {
    setBusy(true);
    setMessage('');
    try {
      const r = await api.post('/organizers/requests');
      setStatus(r.data?.request?.status || null);
      setMessage('✅ Request sent. The Owner will review it.');
    } catch (e) {
      setMessage('❌ Failed to submit request');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-lg p-6">
      <h1 className="text-2xl font-bold">Become an organiser</h1>
      <p className="mt-2 text-zinc-600">
        Send a request to upgrade your account. The Owner must approve it before you can create events and manage staff.
      </p>

      <div className="mt-4 rounded-2xl border bg-white p-4">
        <div className="text-sm text-zinc-600">Current status:</div>
        <div className="mt-1 font-medium">{status ?? 'No request yet'}</div>

        <button
          disabled={busy || status === 'PENDING' || status === 'APPROVED'}
          onClick={submit}
          className="mt-4 w-full rounded-xl bg-gradient-to-r from-fuchsia-600 to-sky-500 px-4 py-2 font-medium text-white shadow hover:from-sky-500 hover:to-fuchsia-600 disabled:opacity-50"
        >
          {status === 'PENDING' ? 'Request pending' : status === 'APPROVED' ? 'Already approved' : busy ? 'Sending…' : 'Send request'}
        </button>

        {message && <div className="mt-3 text-sm">{message}</div>}
      </div>
    </div>
  );
}
