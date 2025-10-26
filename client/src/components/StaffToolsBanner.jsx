import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api, { getToken } from '../lib/api';

export default function StaffToolsBanner() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    let cancel = false;
    (async () => {
      try {
        if (!getToken()) { if (!cancel) setShow(false); return; }
        const me = await api.get('/auth/me');
        const role = me?.data?.user?.role;
        if (['OWNER', 'ORGANIZER'].includes(role)) { if (!cancel) setShow(true); return; }
        const r = await api.get('/staff/my-assignments'); // approved only
        const ok = (r?.data?.assignments || []).length > 0;
        if (!cancel) setShow(ok);
      } catch {
        if (!cancel) setShow(false);
      }
    })();
    return () => { cancel = true; };
  }, []);

  if (!show) return null;

  return (
    <div className="rounded-2xl border bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="font-medium">Staff access enabled</div>
          <div className="text-sm text-zinc-600">You’ve been approved to scan tickets.</div>
        </div>
        <Link
          to="/staff/scan"
          className="rounded-xl border px-3 py-2 text-sm hover:bg-zinc-50"
        >
          Go to staff tools →
        </Link>
      </div>
    </div>
  );
}
