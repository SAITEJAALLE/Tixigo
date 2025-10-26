import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../lib/api';

export default function Checkout() {
  const nav = useNavigate();
  const [status, setStatus] = useState('processing'); // processing | done | error
  const [result, setResult] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // In this project, /orders/issue finalizes the most recent checkout for the user
        const r = await api.post('/orders/issue');
        if (!cancelled) {
          setResult(r.data || {});
          setStatus('done');
        }
      } catch (e) {
        console.error(e);
        if (!cancelled) setStatus('error');
      }
    })();
    return () => { cancelled = true; };
  }, []);

  if (status === 'processing') {
    return <div className="max-w-md mx-auto p-6">Finishing your order…</div>;
  }

  if (status === 'error') {
    return (
      <div className="max-w-md mx-auto p-6 space-y-3">
        <div className="text-red-600 font-semibold">Couldn’t finalize the order.</div>
        <div className="text-sm opacity-80">Make sure you’re logged in and tried checkout from an event page.</div>
        <div className="flex gap-2">
          <button className="px-4 py-2 border rounded" onClick={() => nav(-1)}>Back</button>
          <Link className="px-4 py-2 bg-black text-white rounded" to="/my-tickets">My Tickets</Link>
        </div>
      </div>
    );
  }

  // done
  return (
    <div className="max-w-md mx-auto p-6 space-y-4">
      <h1 className="text-2xl font-bold">Order complete 🎉</h1>
      <p>Your tickets have been issued. You can view them any time:</p>
      <Link className="px-4 py-2 bg-black text-white rounded inline-block" to="/my-tickets">
        Go to My Tickets
      </Link>
      {result?.tickets?.length ? (
        <div className="mt-4 text-sm opacity-80">Issued {result.tickets.length} ticket(s).</div>
      ) : null}
    </div>
  );
}
