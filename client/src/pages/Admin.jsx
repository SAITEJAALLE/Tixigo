
import Nav from '../components/Nav.jsx'
import { useEffect, useState } from 'react'
import { api, setToken } from '../lib/api.js'

const SEGMENTS = ['upcoming','today','past']

export default function Admin(){
  const [kpis, setKpis] = useState()
  const [segment, setSegment] = useState('upcoming')
  const [events, setEvents] = useState([])
  const [pending, setPending] = useState([])

  useEffect(()=>{
    const t = localStorage.getItem('token')||''; setToken(t)
    api.get('/admin/kpis', { headers: { Authorization: `Bearer ${t}` } }).then(r=>setKpis(r.data)).catch(()=>{})
    api.get('/admin/organizers/pending', { headers: { Authorization: `Bearer ${t}` } }).then(r=>setPending(r.data.pending||[])).catch(()=>{})
  },[])

  useEffect(()=>{
    const t = localStorage.getItem('token')||''
    api.get(`/admin/events/segments?segment=${segment}`, { headers: { Authorization: `Bearer ${t}` } })
      .then(r=> setEvents(r.data.events||[]))
      .catch(()=> setEvents([]))
  },[segment])

  const cancelEvent = async (id)=>{
    const t = localStorage.getItem('token')||''
    const isActive = false
    await api.post(`/events/${id}/toggle`, { isActive }, { headers: { Authorization: `Bearer ${t}` } })
    setEvents(evts=> evts.map(e=> e.id===id? { ...e, isActive } : e))
  }

  const approveOrganizer = async (userId)=>{
    const t = localStorage.getItem('token')||''
    await api.post(`/admin/organizers/${userId}/approve`, {}, { headers: { Authorization: `Bearer ${t}` } })
    setPending(p=> p.filter(x=> x.userId !== userId))
  }

  return (
    <div>
      <Nav/>
      <div className="container mx-auto p-4 space-y-6">
        <h1 className="text-2xl font-bold">Owner Admin</h1>
        <div className="grid md:grid-cols-3 gap-3">
          <Stat label="Revenue" value={kpis? `£${((kpis.totalRevenueCents||0)/100).toFixed(2)}` : '—'} />
          <Stat label="Events" value={kpis?.events ?? '—'} />
          <Stat label="Tickets" value={kpis?.tickets ?? '—'} />
        </div>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">Pending organizers</h2>
          <div className="grid gap-2">
            {pending.map(p=> (
              <div className="card p-3 flex items-center justify-between" key={p.id}>
                <div>
                  <div className="font-semibold">{p.displayName||p.user?.name||p.user?.email}</div>
                  <div className="text-sm opacity-70">{p.user?.email}</div>
                </div>
                <button className="btn btn-primary" onClick={()=>approveOrganizer(p.userId)}>Approve</button>
              </div>
            ))}
            {pending.length===0 && <div className="opacity-60">No pending organizer profiles.</div>}
          </div>
        </section>

        <section className="space-y-3">
          <div className="flex gap-2">
            {SEGMENTS.map(s=> <button key={s} className={"btn " + (segment===s?'btn-primary':'btn-secondary')} onClick={()=>setSegment(s)}>{s}</button>)}
          </div>

          <div className="grid gap-3">
            {events.map(ev=> (
              <div key={ev.id} className="card p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-semibold">{ev.title}</div>
                    <div className="text-sm opacity-70">{new Date(ev.startDate).toLocaleDateString()} → {new Date(ev.endDate).toLocaleDateString()}</div>
                  </div>
                  <div className="flex gap-4 items-center">
                    <div className="text-sm">Sold: <b>{ev.stats?.sold ?? 0}</b> / {ev.stats?.capacity ?? 0} (Left: {ev.stats?.left ?? 0})</div>
                    <a className="btn btn-secondary" href={`/tickets-by-event?id=${ev.id}`}>Tickets</a>
                    {ev.isActive ? <button className="btn btn-danger" onClick={()=>cancelEvent(ev.id)}>Cancel</button> : <span className="badge">Cancelled</span>}
                  </div>
                </div>
              </div>
            ))}
            {events.length===0 && <div className="opacity-60">No events.</div>}
          </div>
        </section>
      </div>
    </div>
  )
}

function Stat({label, value}){
  return (
    <div className="card p-3">
      <div className="text-sm opacity-70">{label}</div>
      <div className="text-lg font-bold">{value}</div>
    </div>
  )
}
