import { Link } from 'react-router-dom';
import Lockup from '../assets/tixigo-lockup.svg';

export default function Footer() {
  return (
    <footer className="mt-16 border-t bg-white">
      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-10 px-4 py-10 sm:grid-cols-3">
        <div>
          <div className="space-y-3">
          <img
            src={Lockup}
            alt="Tixigo — Find your choice"
            className="h-9 select-none"
            draggable="false"
          />
          <p className="text-sm text-zinc-600">
            Discover events, buy tickets, scan QR codes, and see live stats — all in one sleek app.
          </p>
        </div>
        </div>

        <div className="grid grid-cols-2 gap-6 sm:gap-10">
          <div>
            <div className="text-sm font-semibold text-zinc-900">Explore</div>
            <ul className="mt-3 space-y-2 text-sm text-zinc-600">
              <li><Link to="/">Home</Link></li>
              <li><Link to="/explore">Explore</Link></li>
              <li><Link to="/my-tickets">My Tickets</Link></li>
              <li><Link to="/calendar">Calendar</Link></li>
            </ul>
          </div>
          <div>
            <div className="text-sm font-semibold text-zinc-900">For organisers</div>
            <ul className="mt-3 space-y-2 text-sm text-zinc-600">
              <li><Link to="/become-organiser">Become an organiser</Link></li>
              <li><Link to="/organizer">Organizer dashboard</Link></li>
              <li><Link to="/staff/scan">Staff tools</Link></li>
            </ul>
          </div>
        </div>

        <div>
          <div className="text-sm font-semibold text-zinc-900">About the Developer</div>
          <ul className="mt-3 space-y-1 text-sm text-zinc-600">
            <li>Saiteja — Fullstack Web Developer</li>
            <li>📞 07778307800</li>
            <li>✉️ saitejaalle999@gmail.com</li>
          </ul>
        </div>
      </div>
      <div className="border-t py-3 text-center text-xs text-zinc-500">
        © {new Date().getFullYear()} Tixigo • VAT included · GBP
      </div>
    </footer>
  );
}
