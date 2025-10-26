// client/src/pages/Calendar.jsx
import { useEffect, useMemo, useState } from 'react'
import api from '../lib/api'

// --- small date helpers ---
const startOfMonth = (d) => {
  const x = new Date(d)
  x.setDate(1)
  x.setHours(0, 0, 0, 0)
  return x
}
const endOfMonth = (d) => {
  const x = new Date(d.getFullYear(), d.getMonth() + 1, 0)
  x.setHours(23, 59, 59, 999)
  return x
}
const addDays = (d, n) => {
  const x = new Date(d)
  x.setDate(x.getDate() + n)
  return x
}
const isoDate = (d) => d.toISOString().slice(0, 10)

// --- page ---
export default function Calendar() {
  const [cursor, setCursor] = useState(new Date())
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)

  // fetch events once
  useEffect(() => {
    let cancel = false
    ;(async () => {
      try {
        // Get all public events (server already filters inactive)
        const r = await api.get('/v1/events')
        if (!cancel) {
          setEvents(r.data?.events || [])
          setLoading(false)
        }
      } catch (e) {
        console.error('calendar fetch error', e)
        if (!cancel) setLoading(false)
      }
    })()
    return () => {
      cancel = true
    }
  }, [])

  // 6-week grid for the visible month
  const grid = useMemo(() => {
    const start = startOfMonth(cursor)
    const end = endOfMonth(cursor)

    // Start grid on Sunday; pad back from the 1st
    const padStart = start.getDay() // 0..6
    const gridStart = addDays(start, -padStart)

    const days = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i))
    return { start, end, days }
  }, [cursor])

  // group events by day so we can render inside cells
  const byDate = useMemo(() => {
    const map = new Map()
    for (const ev of events) {
      const st = new Date(ev.startDate)
      const ed = new Date(ev.endDate)

      // put the event on each day it spans
      for (let d = new Date(st); d <= ed; d = addDays(d, 1)) {
        const key = isoDate(d)
        if (!map.has(key)) map.set(key, [])
        map.get(key).push(ev)
      }
    }
    return map
  }, [events])

  const goPrevMonth = () =>
    setCursor(addDays(new Date(cursor.getFullYear(), cursor.getMonth(), 1), -1))
  const goNextMonth = () =>
    setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="flex items-center justify-between mb-4">
        <button
          className="px-3 py-1 rounded border"
          onClick={goPrevMonth}
          aria-label="Previous month"
        >
          Prev
        </button>
        <h1 className="text-2xl font-bold">
          {cursor.toLocaleString(undefined, { month: 'long', year: 'numeric' })}
        </h1>
        <button
          className="px-3 py-1 rounded border"
          onClick={goNextMonth}
          aria-label="Next month"
        >
          Next
        </button>
      </div>

      <div className="grid grid-cols-7 gap-3">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
          <div key={d} className="text-sm font-medium opacity-70">
            {d}
          </div>
        ))}

        {grid.days.map((d, i) => {
          const key = isoDate(d)
          const inMonth = d.getMonth() === cursor.getMonth()
          const items = byDate.get(key) || []

          return (
            <div
              key={i}
              className={`min-h-[120px] rounded-lg border p-2 ${
                inMonth
                  ? 'bg-white dark:bg-zinc-900'
                  : 'bg-zinc-50 dark:bg-zinc-800 opacity-70'
              }`}
            >
              <div className="text-xs mb-1 opacity-70">
                {d.toLocaleDateString(undefined, { day: '2-digit', month: 'short' })}
              </div>

              <div className="space-y-1">
                {items.slice(0, 3).map((ev) => (
                  <a
                    key={ev.id}
                    href={`/event/${ev.id}`}
                    className="block text-xs truncate rounded bg-indigo-50 dark:bg-indigo-950 px-2 py-1"
                    title={ev.title}
                  >
                    {ev.title}
                  </a>
                ))}
                {items.length > 3 && (
                  <div className="text-[11px] opacity-60 mt-1">
                    +{items.length - 3} more
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {loading && <div className="mt-4">Loading…</div>}
    </div>
  )
}
