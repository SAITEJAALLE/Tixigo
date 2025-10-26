import Nav from '../components/Nav.jsx'
import { useEffect, useState } from 'react'
import { api, setToken } from '../lib/api.js'

export default function Dashboard(){
  const [token, setTok] = useState('')
  const [form, setForm] = useState({
    title:'', description:'', category:'concert', photos:'', location:'', lat:'', lng:'', minAge:'', startDate:'', endDate:'', ticketTypes:'', showTimes:''
  })

  useEffect(()=>{
    const t = localStorage.getItem('token')||''; setTok(t); setToken(t)
  },[])

  async function becomeOrganizer(){
    const t = token
    await api.post('/admin/become-organizer', {}, { headers: { Authorization: `Bearer ${t}` } })
    alert('Organizer profile created (owner must approve).')
  }

  async function createEvent(){
    const t = token
    try{
      const payload = {
        title: form.title,
        description: form.description,
        category: form.category,
        photos: form.photos ? form.photos.split(',').map(s=>s.trim()) : [],
        location: form.location,
            lat: form.lat,
            lng: form.lng,
        minAge: form.minAge? Number(form.minAge) : null,
        startDate: form.startDate,
        endDate: form.endDate,
        ticketTypes: JSON.parse(form.ticketTypes || '[]'),
        showTimes: JSON.parse(form.showTimes || '[]')
      }
      const r = await api.post('/events', payload, { headers: { Authorization: `Bearer ${t}` } })
      alert('Created: '+r.data.title)
    }catch(e){
      alert('Failed: ' + (e?.response?.data?.error || 'check your JSON fields'))
    }
  }
  function googleLogin(){
    const w = window.open('http://localhost:4000/auth/google','google','width=500,height=600')
    window.addEventListener('message', (e)=>{
      if(e.data?.type==='tixigo:token'){
        localStorage.setItem('token', e.data.token); setTok(e.data.token); setToken(e.data.token)
        alert('Logged in with Google')
      }
    })
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100">
      <Nav/>
      <div className="max-w-3xl mx-auto p-4 grid gap-4">
        <div className="card">
          <h3 className="text-xl font-bold">Become an organizer</h3>
          <div className="flex gap-2 mt-2">
            <button className="btn btn-primary" onClick={becomeOrganizer}>Create Organizer Profile</button>
            <button className="btn btn-secondary" onClick={googleLogin}>Login with Google</button>
          </div>
        </div>

        <div className="card grid gap-2">
          <h3 className="text-xl font-bold">Create event</h3>
          <input className="input" placeholder="Title" value={form.title} onChange={e=>setForm({form, title:e.target.value})}/>
          <textarea className="input" placeholder="Description" value={form.description} onChange={e=>setForm({form, description:e.target.value})}/>
          <select className="input" value={form.category} onChange={e=>setForm({form, category:e.target.value})}>
            <option>concert</option><option>movie</option><option>theatre</option><option>comedy</option><option>sports</option><option>circus</option><option>dance</option><option>festival</option><option>conference</option><option>other</option>
          </select>
          <input className="input" placeholder="Photos (comma-separated URLs)" value={form.photos} onChange={e=>setForm({form, photos:e.target.value})}/>
          <input className="input" placeholder="Location" value={form.location} onChange={e=>setForm({form, location:e.target.value})}/>
          <input className="input" placeholder="Min Age (e.g., 18)" value={form.minAge} onChange={e=>setForm({form, minAge:e.target.value})}/>
          <input className="input" type="datetime-local" value={form.startDate} onChange={e=>setForm({form, startDate:e.target.value})}/>
          <input className="input" type="datetime-local" value={form.endDate} onChange={e=>setForm({form, endDate:e.target.value})}/>
          <label className="opacity-75">Ticket Types JSON e.g. [{"{"}"name":"Standard","priceCents":2000,"currency":"GBP"{"}"}]</label>
          <textarea className="input" rows="3" value={form.ticketTypes} onChange={e=>setForm({form, ticketTypes:e.target.value})}/>
          <label className="opacity-75">Show Times JSON e.g. [{"{"}"date":"2025-09-20","time":"18:00","capacity":200{"}"}]</label>
          <textarea className="input" rows="3" value={form.showTimes} onChange={e=>setForm({form, showTimes:e.target.value})}/>
          <button className="btn btn-primary" onClick={createEvent}>Create Event</button>
        </div>
      </div>
    </div>
  )
}
