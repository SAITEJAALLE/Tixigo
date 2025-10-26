import { useEffect, useState } from 'react'
import { api } from '../lib/api.js'

export default function Reviews({ eventId }){
  const [list, setList] = useState([])
  const [rating, setRating] = useState(5)
  const [comment, setComment] = useState('')
  const [msg, setMsg] = useState('')

  useEffect(()=>{ if(eventId) load() },[eventId])
  async function load(){
    const r = await api.get(`/api/v1/events/${eventId}/reviews`)
    setList(r.data.reviews||[])
  }

  async function submit(){
    try{
      const t = localStorage.getItem('token')||''
      await api.post('/api/v1/reviews', { eventId, rating, comment }, { headers: { Authorization: `Bearer ${t}` } })
      setComment(''); setRating(5); setMsg('Thanks for your review!'); load()
    }catch(e){
      setMsg(e?.response?.data?.error || 'Could not post review')
    }
  }

  return (
    <div className="mt-8">
      <h3 className="font-bold text-xl">Reviews</h3>
      <div className="grid gap-2 mt-2">
        {list.map((r,i)=>(
          <div key={i} className="p-3 rounded-xl bg-white/70 dark:bg-white/5">
            <div className="text-yellow-500">{'★'.repeat(r.rating)}{'☆'.repeat(5-r.rating)}</div>
            <div className="opacity-80 text-sm">{r.comment}</div>
          </div>
        ))}
        {list.length===0 && <div className="opacity-60">No reviews yet.</div>}
      </div>

      <div className="card mt-4">
        <div className="text-sm opacity-70 mb-1">Leave a review (only if you attended)</div>
        <div className="flex gap-2 items-center">
          <select className="input" value={rating} onChange={e=>setRating(Number(e.target.value))}>
            {[1,2,3,4,5].map(n=><option key={n} value={n}>{n}★</option>)}
          </select>
          <input className="input flex-1" placeholder="Your thoughts" value={comment} onChange={e=>setComment(e.target.value)}/>
          <button className="btn btn-primary" onClick={submit}>Post</button>
        </div>
        {msg && <div className="text-sm mt-2">{msg}</div>}
      </div>
    </div>
  )
}
