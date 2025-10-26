import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../lib/api';

export default function Verify() {
  const [state, setState] = useState('checking'); // checking | ok | bad | missing
  const [email, setEmail] = useState('');
  const nav = useNavigate();

  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get('token') || '';
    if (!token) {
      setState('missing');
      return;
    }
    (async () => {
      try {
        await api.get(`/auth/verify?token=${encodeURIComponent(token)}`);
        // success – go to login and show “verified” toast via query flag
        nav('/login?verified=1', { replace: true });
      } catch (e) {
        setState('bad');
      }
    })();
  }, [nav]);

  async function resend(e) {
    e.preventDefault();
    if (!email) return;
    try {
      await api.post('/auth/request-verify', { email: String(email).trim() });
      alert('A new verification link has been sent if the email exists.');
    } catch {
      alert('Could not send a new link. Try again in a minute.');
    }
  }

  if (state === 'checking') return <div className="p-6">Verifying…</div>;

  if (state === 'missing' || state === 'bad') {
    return (
      <div className="max-w-md mx-auto p-6 space-y-4">
        <h1 className="text-2xl font-bold">Email verification</h1>
        <p className="text-sm opacity-80">
          The verification link is invalid or expired. You can request a new one below.
        </p>

        <form onSubmit={resend} className="space-y-2">
          <input
            type="email"
            required
            placeholder="your@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full border rounded px-3 py-2"
          />
          <button className="btn btn-primary w-full" type="submit">Send me a new link</button>
        </form>

        <div className="text-sm">
          <Link to="/login" className="underline">Back to login</Link>
        </div>
      </div>
    );
  }

  return null;
}
