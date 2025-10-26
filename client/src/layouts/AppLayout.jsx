import { Outlet } from 'react-router-dom'
import Nav from '../components/Nav.jsx'

import Footer from '../components/Footer.jsx'

export default function AppLayout() {
  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-indigo-50 to-white dark:from-zinc-950 dark:to-zinc-900 text-zinc-900 dark:text-zinc-100">
      {/* Global navbar */}
      <Nav />

      {/* Page content goes here */}
      <main className="flex-1">
        <Outlet />
      </main>

      {/* Global footer */}
      <Footer />
    </div>
  )
}
