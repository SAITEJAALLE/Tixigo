import { useState } from 'react'
import { api } from '../lib/api.js'

export default function ScannerFallback({ eventId }){
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [msg, setMsg] = useState('')

  async function submit(){
    const t = localStorage.getItem('token')||''
    try{
      await api.post('/api/v1/checkin/fallback', { eventId, name, email }, { headers: { Authorization: `Bearer ${t}` } })
      setMsg(' Admitted by fallback')
    }catch(e){
      setMsg('❌ ' + (e?.response?.data?.reason||'Failed'))
    }
  }

  return (
    <div className="card mt-4">
      <div className="font-bold">Fallback check-in</div>
      <div className="grid md:grid-cols-3 gap-2 mt-2">
        <input className="input" placeholder="Event ID" value={eventId||''} readOnly />
        <input className="input" placeholder="Customer name" value={name} onChange={e=>setName(e.target.value)}/>
        <input className="input" placeholder="Customer email" value={email} onChange={e=>setEmail(e.target.value)}/>
      </div>
      <button className="btn btn-secondary mt-2" onClick={submit}>Admit</button>
      {msg && <div className="mt-2 text-sm opacity-80">{msg}</div>}
    </div>
  )
}
