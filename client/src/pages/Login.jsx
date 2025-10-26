// client/src/pages/Login.jsx
import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api, { setToken } from '../lib/api';
import Lockup from '../assets/tixigo-lockup.svg';

export default function Login() {
  const nav = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setBusy(true);
    try {
      const r = await api.post('/auth/login', { email, password });
      const token = r.data?.token;
      if (token) setToken(token);
      nav('/');
    } catch (e) {
      const msg = e?.response?.data?.error === 'email_not_verified'
        ? 'Please verify your email from the link we sent you.'
        : (e?.response?.data?.error || 'Login failed');
      alert(msg);
    } finally { setBusy(false); }
  }

  return (
    <div className="min-h-screen grid place-items-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center">
          <img src={Lockup} alt="Tixigo — Find your choice" className="h-16 md:h-20 mb-1" />
          <div className="text-m font-bold ">Welcome back</div>
        </div>

        <form onSubmit={onSubmit} className="card mt-4 p-5 grid gap-3">
          <input className="input" placeholder="Email" type="email" value={email} onChange={e=>setEmail(e.target.value)} required />
          <input className="input" placeholder="Password" type="password" value={password} onChange={e=>setPassword(e.target.value)} required />
          <button disabled={busy} className="btn btn-primary w-full">{busy ? 'Signing in…' : 'Login'}</button>
          <div className="text-center text-sm">
            No account? <Link to="/register" className="text-indigo-600 hover:underline">Register</Link>
          </div>
        </form>
      </div>
    </div>
  );
}
