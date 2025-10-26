import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { requireAuth, requireRole } from '../middleware/auth.js';

const prisma = new PrismaClient();
const router = Router();

/* helpers */
function parseMaybeDMY(s) {
  if (!s) return null;
  if (s instanceof Date) return s;
  if (typeof s !== 'string') return new Date(s);

  // ISO / RFC – let Date handle it
  if (/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(s) || /\d{4}-\d{2}-\d{2}/.test(s)) {
    return new Date(s);
  }

  // support "dd-mm-yyyy hh:mm"
  const m = s.match(/^(\d{2})-(\d{2})-(\d{4})(?:\s+(\d{2}):(\d{2}))?$/);
  if (m) {
    const [, dd, mm, yyyy, HH = '00', MM = '00'] = m;
    return new Date(Number(yyyy), Number(mm) - 1, Number(dd), Number(HH), Number(MM));
  }
  // last resort
  return new Date(s);
}
const okDate = (d) => d instanceof Date && !isNaN(d.valueOf());


// Public list (basic search)
router.get('/', async (req, res) => {
  const q = req.query.q ? String(req.query.q) : undefined;
  const events = await prisma.event.findMany({
    where: {
      isActive: true,
      OR: q
        ? [
            { title: { contains: q, mode: 'insensitive' } },
            { description: { contains: q, mode: 'insensitive' } },
          ]
        : undefined,
    },
    orderBy: { startDate: 'asc' },
    select: {
      id: true,
      title: true,
      description: true,
      category: true,
      location: true,
      startDate: true,
      endDate: true,
      photos: true,
    },
  });
  res.json(events);
});

/* AUTH: “mine” must be BEFORE any `/:id` routes  */

// My events (organizer or owner)
router.get('/mine', requireAuth, requireRole(['ORGANIZER', 'OWNER']), async (req, res) => {
  try {
    const me = req.user.id;

    const where =
      req.user.role === 'OWNER'
        ? {} // owners see all events
        : { organizerId: me }; // organizers see only their events

    const events = await prisma.event.findMany({
      where,
      orderBy: { startDate: 'asc' },
      select: { id: true, title: true, startDate: true, endDate: true },
    });

    res.json({ events });
  } catch (e) {
    console.error('events/mine error', e);
    res.status(500).json({ error: 'internal_error' });
  }
});

/* AUTH: create/update/toggle */

// Create event (organizer/owner)
router.post('/', requireAuth, requireRole(['ORGANIZER', 'OWNER']), async (req, res) => {
  try {
    const {
      title,
      description = '',
      category = 'General',
      location,
      startDate,
      endDate,
      photo,           // optional single string
      photos = [],     // optional array of strings
      showTimes = [],  // [{ dateTime, capacity }]
      ticketTypes = [] // [{ name, priceCents, currency?, includesDrink?, includesMeal? }]
    } = req.body || {};

    if (!title || !location || !startDate || !endDate || !showTimes.length || !ticketTypes.length) {
      return res.status(400).json({ error: 'invalid_request' });
    }

    const start = parseMaybeDMY(startDate);
    const end = parseMaybeDMY(endDate);
    if (!okDate(start) || !okDate(end)) {
      return res.status(400).json({ error: 'invalid_dates' });
    }

    const photoArray = photos?.length ? photos : (photo ? [photo] : []);

    const showTimeCreates = showTimes.map((st, i) => {
      const dt = parseMaybeDMY(st.dateTime);
      if (!okDate(dt)) throw new Error(`invalid_showtime_${i}`);
      return { dateTime: dt, capacity: Number(st.capacity || 0) };
    });

    const ticketTypeCreates = ticketTypes.map((tt, i) => {
      const price = Number(tt.priceCents);
      if (!Number.isFinite(price) || price < 0) throw new Error(`invalid_price_${i}`);
      return {
        name: String(tt.name || `Type ${i + 1}`),
        priceCents: Math.round(price),
        currency: tt.currency || 'GBP',
        includesDrink: !!tt.includesDrink,
        includesMeal: !!tt.includesMeal,
      };
    });

    // If OWNER posts and passes an explicit organizerId, honour it; else link to the current user.
    const organizerId = req.user.role === 'OWNER' && req.body.organizerId
      ? String(req.body.organizerId)
      : req.user.id;

    const data = {
      title,
      description,
      category,
      location,
      startDate: start,
      endDate: end,
      isActive: true,
      organizerId,
      showTimes: { create: showTimeCreates },
      ticketTypes: { create: ticketTypeCreates },
    };
    if (photoArray.length) data.photos = photoArray;

    const ev = await prisma.event.create({
      data,
      select: { id: true, title: true },
    });

    res.json({ ok: true, id: ev.id, title: ev.title });
  } catch (e) {
    console.error('create event error:', e?.message || e);
    res.status(500).json({ error: 'internal_error', detail: String(e?.message || e) });
  }
});

// Update event (only owner or the event organizer)
router.put('/:id', requireAuth, requireRole(['ORGANIZER', 'OWNER']), async (req, res) => {
  const ev = await prisma.event.findUnique({ where: { id: req.params.id } });
  if (!ev) return res.status(404).json({ error: 'NOT_FOUND' });
  if (req.user.role !== 'OWNER' && req.user.id !== ev.organizerId) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  const updated = await prisma.event.update({ where: { id: ev.id }, data: req.body });
  res.json(updated);
});

// Toggle active/cancel (only owner or the event organizer)
router.post('/:id/toggle', requireAuth, requireRole(['ORGANIZER', 'OWNER']), async (req, res) => {
  const ev = await prisma.event.findUnique({ where: { id: req.params.id } });
  if (!ev) return res.status(404).json({ error: 'NOT_FOUND' });
  if (req.user.role !== 'OWNER' && req.user.id !== ev.organizerId) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  const updated = await prisma.event.update({
    where: { id: ev.id },
    data: { isActive: !!req.body.isActive },
  });
  res.json(updated);
});

/*AUTH: insights & tickets (declare before simple `/:id`) */

// Insights (alias `stats` kept for compatibility)
async function buildInsights(eventId) {
  const showTimes = await prisma.showTime.findMany({ where: { eventId } });
  const capacity = showTimes.reduce((acc, s) => acc + (s.capacity || 0), 0);

  const tickets = await prisma.ticket.findMany({ where: { eventId } });
  const sold = tickets.length;
  const left = Math.max(0, capacity - sold);
  const admitted = tickets.filter((t) => t.admitted).length;
  const refunded = tickets.filter((t) => t.refunded).length;
  const perksUsed = tickets.filter((t) => t.perksUsed).length;

  const perShow = {};
  for (const s of showTimes) {
    const ts = tickets.filter((t) => t.showTimeId === s.id);
    perShow[s.id] = {
      dateTime: s.dateTime,
      capacity: s.capacity || 0,
      sold: ts.length,
      left: Math.max(0, (s.capacity || 0) - ts.length),
      checkedIn: ts.filter((t) => t.admitted).length,
      refunded: ts.filter((t) => t.refunded).length,
    };
  }
  return { capacity, sold, left, admitted, refunded, perksUsed, perShow };
}

router.get('/:id/insights', requireAuth, requireRole(['ORGANIZER', 'OWNER']), async (req, res) => {
  const ev = await prisma.event.findUnique({ where: { id: req.params.id } });
  if (!ev) return res.status(404).json({ error: 'NOT_FOUND' });
  if (req.user.role !== 'OWNER' && req.user.id !== ev.organizerId) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  res.json(await buildInsights(ev.id));
});

router.get('/:id/stats', requireAuth, requireRole(['ORGANIZER', 'OWNER']), async (req, res) => {
  const ev = await prisma.event.findUnique({ where: { id: req.params.id } });
  if (!ev) return res.status(404).json({ error: 'NOT_FOUND' });
  if (req.user.role !== 'OWNER' && req.user.id !== ev.organizerId) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  res.json(await buildInsights(ev.id));
});

// Tickets by event
router.get('/:id/tickets', requireAuth, requireRole(['ORGANIZER', 'OWNER']), async (req, res) => {
  const ev = await prisma.event.findUnique({ where: { id: req.params.id } });
  if (!ev) return res.status(404).json({ error: 'NOT_FOUND' });
  if (req.user.role !== 'OWNER' && req.user.id !== ev.organizerId) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const tickets = await prisma.ticket.findMany({
    where: { eventId: ev.id },
    include: {
      ticketType: true,
      showTime: true,
      order: { include: { user: { select: { name: true, email: true } } } },
    },
    orderBy: { createdAt: 'asc' },
  });
  res.json({ tickets });
});

/*PUBLIC detail LAST (to not shadow the dynamic routes above) */

// Public detail
router.get('/:id', async (req, res) => {
  const e = await prisma.event.findUnique({
    where: { id: req.params.id },
    include: { showTimes: true, ticketTypes: true },
  });
  if (!e) return res.status(404).json({ error: 'NOT_FOUND' });
  res.json(e);
});

export default router;
