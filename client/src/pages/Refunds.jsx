
import Nav from '../components/Nav.jsx'
import { useState } from 'react'
import { api, setToken } from '../lib/api.js'

export default function Refunds(){
  const [ticketId, setTicketId] = useState('')
  const [reason, setReason] = useState('Customer request')
  const [msg, setMsg] = useState('')

  const submit = async ()=>{
    const t = localStorage.getItem('token')||''; setToken(t)
    try{
      await api.post('/v1/refunds/request', { ticketId, reason }, { headers: { Authorization: `Bearer ${t}` } })
      setMsg('Refund marked successfully.')
    }catch(e){
      setMsg('Refund failed.')
    }
  }

  return (
    <div>
      <Nav/>
      <div className="container mx-auto p-4 space-y-4">
        <h1 className="text-2xl font-bold">Refund Ticket</h1>
        <div className="card p-3 space-y-2 max-w-xl">
          <input className="input" placeholder="Ticket ID" value={ticketId} onChange={e=>setTicketId(e.target.value)}/>
          <input className="input" placeholder="Reason" value={reason} onChange={e=>setReason(e.target.value)}/>
          <button className="btn btn-primary" onClick={submit}>Submit refund</button>
          {msg && <div className="text-sm">{msg}</div>}
        </div>
      </div>
    </div>
  )
}
