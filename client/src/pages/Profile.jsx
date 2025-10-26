// client/src/pages/Profile.jsx
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api, { getToken } from '../lib/api';

export default function Profile() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [user, setUser] = useState(null);
  const nav = useNavigate();

  useEffect(() => {
    if (!getToken()) { nav('/login'); return; }
    let cancel = false;
    (async () => {
      try {
        const r = await api.get('/auth/me');
        if (!cancel) { setUser(r.data.user); setLoading(false); }
      } catch { if (!cancel) setLoading(false); }
    })();
    return () => { cancel = true; };
  }, [nav]);

  const set = (k,v)=>setUser(u=>({...u,[k]:v}));

  const onSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const { name, displayName, phone, gender, bio, photoUrl } = user || {};
      const r = await api.put('/auth/me', { name, displayName, phone, gender, bio, photoUrl });
      setUser(r.data.user);
      alert('Profile updated');
    } catch { alert('Failed to save profile'); }
    finally { setSaving(false); }
  };

  if (loading) return <div className="container px-4 py-6">Loading…</div>;
  if (!user)   return <div className="container px-4 py-6">Not signed in.</div>;

  return (
    <div className="container px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">Profile</h1>

      <form onSubmit={onSave} className="grid gap-6 lg:grid-cols-2">
        <div className="card p-6 grid gap-4">
          <div>
            <label className="text-xs text-zinc-500">Email</label>
            <input className="input" value={user.email} disabled />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="text-xs text-zinc-500">Display name</label>
              <input className="input" value={user.displayName || ''} onChange={e=>set('displayName', e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-zinc-500">Name</label>
              <input className="input" value={user.name || ''} onChange={e=>set('name', e.target.value)} />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="text-xs text-zinc-500">Phone</label>
              <input className="input" value={user.phone || ''} onChange={e=>set('phone', e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-zinc-500">Gender</label>
              <select className="select" value={user.gender || ''} onChange={e=>set('gender', e.target.value)}>
                <option value="">—</option>
                <option>Male</option>
                <option>Female</option>
                <option>Other</option>
                <option>Prefer not to say</option>
              </select>
            </div>
          </div>
        </div>

        <div className="card p-6 grid gap-4">
          <div>
            <label className="text-xs text-zinc-500">Photo URL</label>
            <input className="input" value={user.photoUrl || ''} onChange={e=>set('photoUrl', e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-zinc-500">Bio</label>
            <textarea className="textarea" value={user.bio || ''} onChange={e=>set('bio', e.target.value)} />
          </div>
          <div className="flex justify-end">
            <button className="btn btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Save changes'}</button>
          </div>
        </div>
      </form>
    </div>
  );
}
