import React from 'react'
import ReactDOM from 'react-dom/client'
import { createBrowserRouter, RouterProvider , Navigate } from 'react-router-dom'
import './tailwind.css'

//Layout (wraps pages with Nav + Footer)
import AppLayout from './layouts/AppLayout.jsx'

// Pages
import App from './pages/App.jsx'
import Explore from './pages/Explore.jsx'
import EventDetail from './pages/EventDetail.jsx'
import Dashboard from './pages/Dashboard.jsx'
import StaffScan from './pages/StaffScan.jsx'
import Admin from './pages/Admin.jsx'
import OrganizerDashboard from './pages/OrganizerDashboard.jsx'
import Refunds from './pages/Refunds.jsx'
import CheckoutSuccess from './pages/CheckoutSuccess.jsx'
import Checkout from './pages/Checkout.jsx'
import MyTickets from './pages/MyTickets.jsx'
import StaffManage from './pages/StaffManage.jsx'
import AcceptStaff from './pages/AcceptStaff.jsx'
import TicketsByEvent from './pages/TicketsByEvent.jsx'
import Calendar from './pages/Calendar.jsx'
import Login from './pages/Login.jsx'
import Register from './pages/Register.jsx'
import Verify from './pages/Verify.jsx'
import RequestReset from './pages/RequestReset.jsx'
import ResetPassword from './pages/ResetPassword.jsx'
import Profile from './pages/Profile.jsx'
import ProtectedRoute from './components/ProtectedRoute.jsx';
import Forbidden from './pages/Forbidden.jsx';
import CreateEvent from './pages/CreateEvent.jsx';
import BecomeOrganiser from './pages/BecomeOrganiser.jsx';


// IMPORTANT: All routes that should show the global navbar/footer
// live as children of the AppLayout route.
const router = createBrowserRouter([
  {
    element: <AppLayout />,   // Layout wraps these child routes
    children: [
      { index: true, element: <App /> },                  // '/'
      { path: 'explore', element: <Explore /> },
      { path: 'event/:id', element: <EventDetail /> },
      { path: 'calendar', element: <Calendar /> },
      { path: '/profile', element: <Profile /> },
      { path: '/forbidden', element: <Forbidden /> },

      // navbar/footer visible on these as well, keep them here:
       { path: '/my-tickets', element: <ProtectedRoute><MyTickets /></ProtectedRoute> },
       { path: '/checkout', element: <ProtectedRoute><Checkout /></ProtectedRoute> },
       { path: '/checkout/success', element: <ProtectedRoute><CheckoutSuccess /></ProtectedRoute> },
       { path: '/admin', element: <ProtectedRoute roles={['OWNER']}><Admin /></ProtectedRoute> },
       { path: '/dashboard', element: <ProtectedRoute roles={['OWNER']}><Dashboard /></ProtectedRoute> },
       { path: 'refunds', element: <Refunds /> },
       { path: '/become-organiser', element: <ProtectedRoute><BecomeOrganiser /></ProtectedRoute> },

    ],
  },

  // If you prefer full-screen (no navbar) for auth pages,
  { path: '/login', element: <Login /> },
  { path: '/register', element: <Register /> },
  { path: '/verify', element: <Verify /> },
  { path: '/forgot', element: <RequestReset /> },
  { path: '/reset-password', element: <ResetPassword /> },
  { path: '/tickets-by-event', element: <ProtectedRoute roles={['OWNER','ORGANIZER']}><TicketsByEvent /></ProtectedRoute> },
  { path: '/organizer/events/new', element: <CreateEvent /> },
  { path: '/organizer', element: <ProtectedRoute roles={['ORGANIZER','OWNER']}><OrganizerDashboard /></ProtectedRoute> },
  { path: '/staff/scan', element: <ProtectedRoute roles={['STAFF','ORGANIZER','OWNER']}><StaffScan /></ProtectedRoute> },
  { path: '/staff/manage', element: <ProtectedRoute roles={['ORGANIZER','OWNER']}><StaffManage /></ProtectedRoute> },
  { path: '/invite/staff/:token', element: <AcceptStaff /> },
  { path: '/owner', element: <ProtectedRoute roles={['OWNER']}><Admin /></ProtectedRoute> },
  { path: '/staff', element: <Navigate to="/staff/scan" replace /> },
])

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>
)
