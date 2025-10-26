import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../lib/api';
import Lockup from '../assets/tixigo-lockup.svg';


const INTERESTS = ['Concert', 'Movies', 'Sports', 'Dance', 'Circus', 'Comedy', 'Festival', 'Theatre', 'Meetup', 'Other'];

export default function Register() {
  const nav = useNavigate();
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    phone: '',
    gender: '',
    address: '',
    interests: [],
  });
  const [busy, setBusy] = useState(false);

  function toggleInterest(x) {
    setForm(f => {
      const has = f.interests.includes(x);
      return { ...f, interests: has ? f.interests.filter(i => i !== x) : [...f.interests, x] };
    });
  }

  async function onSubmit(e) {
    e.preventDefault();
    setBusy(true);
    try {
      await api.post('/auth/register', form);
      alert('We emailed you a verification link. Please verify your email, then login.');
      nav('/login');
    } catch (e) {
      console.error(e);
      alert(e.response?.data?.error || 'Registration failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-xl mx-auto p-6">
      <div className="flex flex-col items-center mb-4">
        <img src={Lockup} alt="Tixigo — Find your choice" className="h-16 md:h-20 mb-1" />
        <div className="text-m font-bold ">Welcome back</div>
      </div>
      <form onSubmit={onSubmit} className="grid grid-cols-1 gap-3">
        <input className="border rounded px-3 py-2" placeholder="Full name" value={form.name} onChange={e=>setForm({...form,name:e.target.value})} required />
        <input className="border rounded px-3 py-2" placeholder="Email" type="email" value={form.email} onChange={e=>setForm({...form,email:e.target.value})} required />
        <input className="border rounded px-3 py-2" placeholder="Password" type="password" value={form.password} onChange={e=>setForm({...form,password:e.target.value})} required />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <input className="border rounded px-3 py-2" placeholder="Phone number" value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})} />
          <select className="border rounded px-3 py-2" value={form.gender} onChange={e=>setForm({...form,gender:e.target.value})}>
            <option value="">Gender (optional)</option>
            <option value="MALE">Male</option>
            <option value="FEMALE">Female</option>
            <option value="OTHER">Other</option>
            <option value="PREFER_NOT_TO_SAY">Prefer not to say</option>
          </select>
        </div>
        <textarea className="border rounded px-3 py-2" placeholder="Address" rows={3} value={form.address} onChange={e=>setForm({...form,address:e.target.value})} />

        <div>
          <div className="text-sm mb-2">Interests</div>
          <div className="flex flex-wrap gap-2">
            {INTERESTS.map(x => (
              <label key={x} className={`px-3 py-1 rounded-full border cursor-pointer ${form.interests.includes(x) ? 'bg-indigo-600 text-white' : ''}`}>
                <input className="hidden" type="checkbox" checked={form.interests.includes(x)} onChange={()=>toggleInterest(x)} />
                {x}
              </label>
            ))}
          </div>
        </div>

        <button disabled={busy} className="mt-2 bg-indigo-600 text-white rounded px-4 py-2">
          {busy ? 'Creating…' : 'Create account'}
        </button>
      </form>

      <div className="mt-4 text-sm">
        Already have an account? <Link className="text-indigo-600" to="/login">Login</Link>
      </div>
    </div>
  );
}
