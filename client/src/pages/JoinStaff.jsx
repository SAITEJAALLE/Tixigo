import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import api from '../lib/api';

export default function JoinStaff() {
  const [sp] = useSearchParams();
  const token = sp.get('token') || '';
  const [invite, setInvite] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    (async () => {
      try {
        const r = await api.get(`/staff/invite/${token}`);
        setInvite(r.data.invite);
      } catch {
        alert('Invalid or expired invite.');
      }
    })();
  }, [token]);

  async function accept() {
    try {
      await api.post('/staff/join', { token });
      alert('Request sent to organizer. You will be approved soon.');
      navigate('/'); // or to /organizer if they’re also an organizer
    } catch {
      alert('Could not accept invite. Please log in first.');
    }
  }

  if (!invite) return null;
  return (
    <div className="p-6">
      <h1 className="text-xl font-bold">Join staff</h1>
      <p className="mt-2">Event: <b>{invite.event.title}</b></p>
      <p className="mt-1">Role: <b>{invite.role}</b></p>
      <button className="mt-4 rounded-lg border px-3 py-2" onClick={accept}>
        Accept invite
      </button>
    </div>
  );
}
