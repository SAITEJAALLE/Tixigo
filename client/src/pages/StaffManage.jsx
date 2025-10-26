import Nav from '../components/Nav.jsx'
import { useEffect, useState } from 'react'
import { api } from '../lib/api.js'

export default function StaffManage(){
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [eventId, setEventId] = useState('')

  async function invite(){
    const t = localStorage.getItem('token')||''
    await api.post('/api/v1/staff/invite', { email, name }, { headers: { Authorization: `Bearer ${t}` } })
    alert('Invite sent!')
  }
  async function approve(){
    const t = localStorage.getItem('token')||''
    await api.post('/api/v1/staff/approve', { email }, { headers: { Authorization: `Bearer ${t}` } })
    alert('Staff approved!')
  }
  async function assign(){
    const t = localStorage.getItem('token')||''
    await api.post('/api/v1/staff/assign', { email, eventId }, { headers: { Authorization: `Bearer ${t}` } })
    alert('Assigned to event!')
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100">
      <Nav/>
      <div className="max-w-xl mx-auto p-4 grid gap-3">
        <h1 className="text-2xl font-bold">Manage Staff</h1>
        <input className="input" placeholder="Staff email" value={email} onChange={e=>setEmail(e.target.value)}/>
        <input className="input" placeholder="Staff name (optional)" value={name} onChange={e=>setName(e.target.value)}/>
        <input className="input" placeholder="Event ID" value={eventId} onChange={e=>setEventId(e.target.value)}/>
        <div className="flex gap-2">
          <button className="btn btn-primary" onClick={invite}>Invite</button>
          <button className="btn btn-secondary" onClick={approve}>Approve</button>
          <button className="btn btn-secondary" onClick={assign}>Assign to Event</button>
        </div>
      </div>
    </div>
  )
}
