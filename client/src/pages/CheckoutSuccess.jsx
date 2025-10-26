// client/src/pages/CheckoutSuccess.jsx
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../lib/api';

export default function CheckoutSuccess() {
  const [done, setDone] = useState(false);

  useEffect(() => {
    const go = async () => {
      try {
        const t = localStorage.getItem('token') || '';
        await api.post('/orders/issue', {}, { headers: { Authorization: `Bearer ${t}` } });
      } catch (e) {
        console.error('issue failed', e);
      } finally {
        setDone(true);
      }
    };
    go();
  }, []);

  return (
    <div className="max-w-2xl mx-auto p-8">
      <h1 className="text-3xl font-bold mb-2">Payment Complete</h1>
      <p className="mb-6">Your tickets have been issued and sent via email.</p>
      <Link className="btn btn-primary" to="/my-tickets">View My Tickets</Link>
    </div>
  );
}
