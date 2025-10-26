import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useNavigate, useLocation } from 'react-router-dom';
import api, { getToken, setToken } from '../lib/api';
import TixigoLockup from '../assets/tixigo-lockup.svg'

// brand ticket icon (inline so it always matches your theme)
function TicketIcon({ className = 'h-5 w-5' }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path
        fill="currentColor"
        d="M3.5 6.75A1.75 1.75 0 0 1 5.25 5h8.5c.46 0 .9.18 1.23.51l3.51 3.51c.33.33.51.77.51 1.23v7.5A1.75 1.75 0 0 1 17.25 20h-12A1.75 1.75 0 0 1 3.5 18.25v-11.5Zm11 .75L18 10.0V7.5c0-.14-.06-.27-.15-.36L14.5 3.79c-.09-.09-.22-.15-.35-.15H12v2.25c0 .83-.67 1.5-1.5 1.5H8.25V9h6.25Zm-5 6.25a.75.75 0 0 0 0 1.5h3a.75.75 0 0 0 0-1.5h-3Z"
      />
    </svg>
  );
}

export default function Nav() {
  const nav = useNavigate();
  const { pathname } = useLocation();
  const [user, setUser] = useState(null);
  const [assignments, setAssignments] = useState([]);
  const [open, setOpen] = useState(false);
  const ddRef = useRef(null);

  // load current user
  useEffect(() => {
    let cancel = false;
    (async () => {
      try {
        if (!getToken()) return;
        const r = await api.get('/auth/me');
        if (!cancel) setUser(r.data?.user || null);
      } catch {
        if (!cancel) setUser(null);
      }
    })();
    return () => { cancel = true; };
  }, [pathname]);

  // load approved staff assignments (shows Staff tools when >0)
  useEffect(() => {
    let cancel = false;
    (async () => {
      try {
        if (!getToken()) return;
        const r = await api.get('/staff/my-assignments');
        if (!cancel) setAssignments(r.data?.assignments || []);
      } catch {
        if (!cancel) setAssignments([]);
      }
    })();
    return () => { cancel = true; };
  }, [pathname]);

  // closes dropdown on outside click
  useEffect(() => {
    const onDoc = (e) => { if (!ddRef.current?.contains(e.target)) setOpen(false); };
    document.addEventListener('click', onDoc);
    return () => document.removeEventListener('click', onDoc);
  }, []);

  const isOwner = user?.role === 'OWNER';
  const isOrganizer = user?.role === 'ORGANIZER';
  const canScan = assignments.length > 0 || isOwner || isOrganizer;

  const logout = () => {
    setToken('');
    setUser(null);
    nav('/login');
  };

  return (
    <header className="sticky top-0 z-40 border-b bg-white/70 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-4 px-4">
        {/* Brand */}
<Link to="/" className="flex items-center gap-2 select-none">
  {/* Mobile: ticket only */}
  <img src="/tixigo-ticket.svg" alt="Tixigo" className="md:hidden h-7 w-auto" />

  {/* md+ screens: full lockup (ticket + TIXIGO + tagline) */}
  <img src={TixigoLockup} alt="Tixigo — Find your choice" className="hidden md:block h-8 w-auto" />
</Link>


        {/* Left nav */}
        <nav className="ml-2 hidden gap-6 md:flex">
          {[
            ['Explore', '/explore'],
            ['My Tickets', '/my-tickets'],
            ['Calendar', '/calendar'],
          ].map(([label, to]) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `text-sm ${isActive ? 'text-zinc-900' : 'text-zinc-600 hover:text-zinc-900'}`
              }
            >
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="flex-1" />

        {/* Right side */}
        {!user ? (
          <div className="flex items-center gap-2">
            <Link
              to="/login"
              className="rounded-xl border px-3 py-1.5 text-sm hover:bg-zinc-50"
            >
              Log in
            </Link>
            <Link
              to="/register"
              className="rounded-xl bg-gradient-to-r from-fuchsia-600 to-sky-500 px-3 py-1.5 text-sm font-medium text-white shadow hover:from-sky-500 hover:to-fuchsia-600"
            >
              Sign up
            </Link>
          </div>
        ) : (
          <div className="relative" ref={ddRef}>
            <button
              onClick={() => setOpen((v) => !v)}
              className="flex items-center gap-2 rounded-full border bg-white px-3 py-1.5 text-sm shadow-sm hover:bg-zinc-50"
            >
              <span className="grid h-6 w-6 place-items-center rounded-full bg-zinc-900 text-white">
                {user.name?.[0]?.toUpperCase() || 'U'}
              </span>
              <span className="hidden sm:block">{user.displayName || user.name || 'Account'}</span>
              <svg viewBox="0 0 20 20" className="h-4 w-4 opacity-60"><path fill="currentColor" d="M5 7l5 6 5-6H5z"/></svg>
            </button>

            {open && (
              <div className="absolute right-0 mt-2 w-56 overflow-hidden rounded-2xl border bg-white p-1 shadow-xl">
                <Link to="/profile" className="block rounded-lg px-3 py-2 text-sm hover:bg-zinc-50">Profile</Link>
                <Link to="/my-tickets" className="block rounded-lg px-3 py-2 text-sm hover:bg-zinc-50">My tickets</Link>

                {!isOrganizer && !isOwner && (
                  <Link to="/become-organiser" className="block rounded-lg px-3 py-2 text-sm hover:bg-zinc-50">
                    Become an organiser
                  </Link>
                )}

                {(isOrganizer || isOwner) && (
                  <Link to="/organizer" className="block rounded-lg px-3 py-2 text-sm hover:bg-zinc-50">
                    Organizer dashboard
                  </Link>
                )}

                {isOwner && (
                  <Link to="/owner" className="block rounded-lg px-3 py-2 text-sm hover:bg-zinc-50">
                    Owner dashboard
                  </Link>
                )}

                {canScan && (
                  <Link to="/staff/scan" className="block rounded-lg px-3 py-2 text-sm hover:bg-zinc-50">
                    Staff tools
                  </Link>
                )}

                <button onClick={logout} className="mt-1 w-full rounded-lg px-3 py-2 text-left text-sm text-rose-600 hover:bg-rose-50">
                  Logout
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
