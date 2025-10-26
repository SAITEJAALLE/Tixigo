import { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import api, { getToken } from '../lib/api';

export default function ProtectedRoute({ children, roles = [] }) {
  const loc = useLocation();
  const [state, setState] = useState({ loading: true, ok: false });

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        // must be logged in
        const token = getToken();
        if (!token) throw new Error('no token');

        const me = await api.get('/auth/me');
        const user = me?.data?.user;
        if (!user) throw new Error('no user');

        const needsRoles = roles.length > 0;
        const isStaffScan = loc.pathname.startsWith('/staff/scan');

        // owners & organizers pass all checks
        if (['OWNER', 'ORGANIZER'].includes(user.role)) {
          if (!cancelled) setState({ loading: false, ok: true });
          return;
        }

        // for general protected routes with explicit roles prop
        if (needsRoles && !roles.includes(user.role)) {
          // special case: /staff/scan is allowed if they are approved staff
          if (isStaffScan) {
            const r = await api.get('/staff/my-assignments');
            const approved = (r?.data?.assignments || []).length > 0;
            if (!cancelled) setState({ loading: false, ok: approved });
            return;
          }
          if (!cancelled) setState({ loading: false, ok: false });
          return;
        }

        // for /staff/scan with no roles prop: gate by approved staff assignment
        if (isStaffScan) {
          const r = await api.get('/staff/my-assignments');
          const approved = (r?.data?.assignments || []).length > 0;
          if (!cancelled) setState({ loading: false, ok: approved });
          return;
        }

        if (!cancelled) setState({ loading: false, ok: true });
      } catch {
        if (!cancelled) setState({ loading: false, ok: false });
      }
    })();

    return () => { cancelled = true; };
  }, [loc.pathname, roles.join('|')]);

  if (state.loading) return null;
  return state.ok ? children : <Navigate to="/forbidden" replace />;
}
