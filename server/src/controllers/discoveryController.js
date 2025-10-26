import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

/**
 * GET /v1/events
 * Query:
 *  - when: 'today' | 'tomorrow' | 'weekend' | 'upcoming'
 *  - category: comma-separated (e.g., "Concert,Circus")
 *  - q: text search
 *  - city: matches Event.location contains (case-insensitive)
 */
export async function listEvents(req, res) {
  try {
    const { when, category, q, city } = req.query;

    const where = { isActive: true };

    if (category) {
      const cats = String(category).split(',').map(s => s.trim()).filter(Boolean);
      if (cats.length) where.category = { in: cats };
    }

    if (q) {
      where.OR = [
        { title: { contains: String(q), mode: 'insensitive' } },
        { description: { contains: String(q), mode: 'insensitive' } },
        { location: { contains: String(q), mode: 'insensitive' } },
      ];
    }

    if (city) {
      // your Explore page has a "City" input; support it by matching location
      where.location = { contains: String(city), mode: 'insensitive' };
    }

    // date window
    const now = new Date();
    const day = new Date(now); day.setHours(0, 0, 0, 0);
    let start = null, end = null;

    if (when === 'today') {
      start = new Date(day);
      end = new Date(day); end.setDate(end.getDate() + 1);
    } else if (when === 'tomorrow') {
      start = new Date(day); start.setDate(start.getDate() + 1);
      end = new Date(day);   end.setDate(end.getDate() + 2);
    } else if (when === 'weekend') {
      const dow = day.getDay();                    // 0 Sun .. 6 Sat
      const toSat = (6 - dow + 7) % 7;             // days to next Saturday
      start = new Date(day); start.setDate(start.getDate() + toSat);
      end = new Date(start); end.setDate(end.getDate() + 2); // Sat..Mon
    } else if (when === 'upcoming') {
      start = day;
    }

    if (start && end) {
      where.AND = [{ endDate: { gte: start } }, { startDate: { lt: end } }];
    } else if (start) {
      where.endDate = { gte: start };
    }

    const events = await prisma.event.findMany({
      where,
      include: {
        showTimes: { include: { tickets: { where: { refunded: false } } } },
        ticketTypes: true,
        reviews: true,
      },
      orderBy: { startDate: 'asc' },
      take: 50,
    });

    const enriched = events.map(ev => {
      const capacity = ev.showTimes.reduce((acc, s) => acc + s.capacity, 0);
      const sold = ev.showTimes.reduce((acc, s) => acc + s.tickets.length, 0);
      const left = capacity - sold;
      const ratingCount = ev.reviews.length;
      const avgRating = ratingCount
        ? Math.round((ev.reviews.reduce((a, r) => a + r.rating, 0) / ratingCount) * 10) / 10
        : null;
      return { ...ev, capacity, sold, left, ratingCount, avgRating };
    });

    res.json({ events: enriched });
  } catch (e) {
    console.error('listEvents error', e);
    res.status(500).json({ error: 'internal_error' });
  }
}

/**
 * GET /v1/events/:eventId/recommendations
 */
export async function recommendations(req, res) {
  try {
    const { eventId } = req.params;
    const cur = await prisma.event.findUnique({ where: { id: eventId } });
    if (!cur) return res.json({ events: [] });

    const recs = await prisma.event.findMany({
      where: {
        id: { not: eventId },
        category: cur.category,
        isActive: true,
      },
      orderBy: { startDate: 'asc' },
      take: 6,
    });

    res.json({ events: recs });
  } catch (e) {
    console.error('recommendations error', e);
    res.status(500).json({ error: 'internal_error' });
  }
}
