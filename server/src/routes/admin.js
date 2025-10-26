import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { stripe } from '../lib/stripe.js';
import { sendMail } from '../utils/mailer.js';

const prisma = new PrismaClient();
const router = Router();

/** KPIs (owner) */
router.get('/kpis', requireAuth, requireRole('OWNER'), async (_req, res) => {
  try {
    const totalRevenue = await prisma.order.aggregate({
      _sum: { amountCents: true },
      where: { status: 'paid' },
    });
    const events = await prisma.event.count();
    const tickets = await prisma.ticket.count();
    res.json({
      totalRevenueCents: totalRevenue._sum.amountCents || 0,
      events,
      tickets,
    });
  } catch (e) {
    console.error('kpis error', e);
    res.status(500).json({ error: 'internal_error' });
  }
});

/** Customer:- request/ensure organizer profile (legacy OrganizerProfile flow) */

router.post('/become-organizer', requireAuth, async (req, res) => {
  try {
    // if a profile already exists, just return it (idempotent)
    const existing = await prisma.organizerProfile.findFirst({
      where: { userId: req.user.id },
    });
    if (existing) return res.json(existing);

    // load user to derive a display name
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { name: true, email: true },
    });

    // fallbacks for displayName (required by your schema)
    const displayName =
      (user?.name && user.name.trim()) ||
      (user?.email ? user.email.split('@')[0] : 'organizer');

    // optional: a simple slug (only if your schema requires/has it)
    const slugify = (s) =>
      String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

    const data = {
      userId: req.user.id,
      approved: false,
      displayName,
    };

    const created = await prisma.organizerProfile.create({ data });
    res.json(created);
  } catch (e) {
    console.error('become-organizer error', e);
    res.status(500).json({ error: 'internal_error' });
  }
});


/** Segmented events for owner */
router.get('/events', requireAuth, requireRole('OWNER'), async (req, res) => {
  try {
    const seg = String(req.query.segment || 'upcoming');
    const now = new Date();
    let where = {};
    if (seg === 'today') {
      const s = new Date(now); s.setHours(0, 0, 0, 0);
      const e = new Date(now); e.setHours(23, 59, 59, 999);
      where = { startDate: { lte: e }, endDate: { gte: s } };
    } else if (seg === 'past') {
      where = { endDate: { lt: now } };
    } else {
      where = { startDate: { gt: now } };
    }

    const events = await prisma.event.findMany({ where, orderBy: { startDate: 'asc' } });

    // enrich with stats
    const enriched = [];
    for (const ev of events) {
      const showTimes = await prisma.showTime.findMany({ where: { eventId: ev.id } });
      const capacity = showTimes.reduce((s, st) => s + (st.capacity || 0), 0);
      const sold = await prisma.ticket.count({ where: { eventId: ev.id } });
      const refunded = await prisma.ticket.count({ where: { eventId: ev.id, refunded: true } });
      const admitted = await prisma.ticket.count({ where: { eventId: ev.id, admitted: true } });
      const left = Math.max(0, capacity - (sold - refunded));
      enriched.push({ ev, stats: { capacity, sold, left, admitted, refunded } });
    }
    res.json({ events: enriched });
  } catch (e) {
    console.error('owner events error', e);
    res.status(500).json({ error: 'internal_error' });
  }
});

/** Owner cancels event → soft refund + best-effort emails */
router.post('/event/:id/cancel', requireAuth, requireRole('OWNER'), async (req, res) => {
  try {
    const id = req.params.id;
    const { reason } = req.body;

    const ev = await prisma.event.update({ where: { id }, data: { isActive: false } });
    const tickets = await prisma.ticket.findMany({
      where: { eventId: id, refunded: false },
      include: { order: { include: { user: true } }, ticketType: true },
    });

    for (const t of tickets) {
      await prisma.ticket.update({ where: { id: t.id }, data: { refunded: true } });
      await prisma.refundRequest.create({
        data: {
          orderId: t.orderId,
          ticketId: t.id,
          reason: reason || 'Event cancelled',
          approvedBy: req.user.id,
          amountPence: t.ticketType.priceCents,
          status: 'COMPLETED',
        },
      });

      if (t.order.paymentRef && (process.env.STRIPE_SECRET_KEY || '').length > 0) {
        try {
          await stripe.refunds.create({
            payment_intent: t.order.paymentRef,
            amount: t.ticketType.priceCents,
          });
        } catch {
          /* ignore Stripe errors */
        }
      }

      // email (best-effort)
      try {
        if (t.order?.user?.email) {
          await sendMail({
            to: t.order.user.email,
            subject: `Event cancelled: ${ev.title}`,
            html: `<p>Your ticket ${t.ticketNumber} for <b>${ev.title}</b> has been refunded due to cancellation.</p>
                   <p>Reason: ${reason || 'Event cancelled'}</p>`,
          });
        }
      } catch {}
    }

    res.json({ ok: true });
  } catch (e) {
    console.error('cancel event error', e);
    res.status(500).json({ error: 'internal_error' });
  }
});

/** Segmented events (variant) */
router.get('/events/segments', requireAuth, requireRole('OWNER'), async (req, res) => {
  try {
    const { segment = 'upcoming' } = req.query;
    const now = new Date();
    const start = new Date(now); start.setHours(0, 0, 0, 0);
    const end = new Date(now);   end.setHours(23, 59, 59, 999);

    let where = {};
    if (segment === 'today') where = { startDate: { lte: end }, endDate: { gte: start } };
    else if (segment === 'past') where = { endDate: { lt: start } };
    else where = { startDate: { gt: end } };

    const events = await prisma.event.findMany({ where, orderBy: { startDate: 'asc' } });
    const ids = events.map(e => e.id);
    const showTimes = await prisma.showTime.findMany({ where: { eventId: { in: ids } } });
    const tickets = await prisma.ticket.findMany({ where: { eventId: { in: ids } } });

    const byEvent = {};
    for (const e of events) {
      const st = showTimes.filter(s => s.eventId === e.id);
      const cap = st.reduce((a, s) => a + (s.capacity || 0), 0);
      const tix = tickets.filter(t => t.eventId === e.id);
      byEvent[e.id] = { capacity: cap, sold: tix.length, left: Math.max(0, cap - tix.length) };
    }

    res.json({ events: events.map(e => ({ ...e, stats: byEvent[e.id] })) });
  } catch (e) {
    console.error('events/segments error', e);
    res.status(500).json({ error: 'internal_error' });
  }
});

/** Organizer requests (new flow) */
// list
router.get('/organizer-requests', requireAuth, requireRole('OWNER'), async (_req, res) => {
  try {
    const rows = await prisma.organizerRequest.findMany({
      orderBy: { createdAt: 'desc' },
      include: { user: { select: { id: true, email: true, name: true } } },
    });
    res.json({ requests: rows });
  } catch (e) {
    console.error('organizer-requests list error', e);
    res.status(500).json({ error: 'internal_error' });
  }
});

// approve
router.post('/organizer-requests/:id/approve', requireAuth, requireRole('OWNER'), async (req, res) => {
  try {
    const id = req.params.id;
    const row = await prisma.organizerRequest.findUnique({ where: { id } });
    if (!row || row.status !== 'pending') return res.status(404).json({ error: 'not_found' });

    await prisma.$transaction([
      prisma.user.update({ where: { id: row.userId }, data: { role: 'ORGANIZER' } }),
      prisma.organizerRequest.update({ where: { id }, data: { status: 'approved', decidedAt: new Date() } }),
    ]);

    res.json({ ok: true });
  } catch (e) {
    console.error('organizer-requests approve error', e);
    res.status(500).json({ error: 'internal_error' });
  }
});

// reject
router.post('/organizer-requests/:id/reject', requireAuth, requireRole('OWNER'), async (req, res) => {
  try {
    const id = req.params.id;
    await prisma.organizerRequest.update({
      where: { id },
      data: { status: 'rejected', decidedAt: new Date(), note: req.body?.note ?? null },
    });
    res.json({ ok: true });
  } catch (e) {
    console.error('organizer-requests reject error', e);
    res.status(500).json({ error: 'internal_error' });
  }
});

/** Pending organizers (legacy OrganizerProfile) */
router.get('/organizers/pending', requireAuth, requireRole('OWNER'), async (_req, res) => {
  try {
    const pending = await prisma.organizerProfile.findMany({
      where: { approved: false },
      include: { user: { select: { id: true, email: true, name: true, role: true } } },
      orderBy: { createdAt: 'asc' },
    });
    res.json({ pending });
  } catch (e) {
    console.error('pending organizers error', e);
    res.status(500).json({ error: 'internal_error' });
  }
});

// approve a pending organizer profile (legacy path)
router.post('/organizers/:userId/approve', requireAuth, requireRole('OWNER'), async (req, res) => {
  try {
    const userId = req.params.userId;
    const prof = await prisma.organizerProfile.findFirst({ where: { userId } });
    if (!prof) return res.status(404).json({ error: 'PROFILE_NOT_FOUND' });

    await prisma.$transaction([
      prisma.organizerProfile.update({ where: { id: prof.id }, data: { approved: true } }),
      prisma.user.update({ where: { id: userId }, data: { role: 'ORGANIZER' } }),
    ]);

    res.json({ ok: true });
  } catch (e) {
    console.error('approve organizer profile error', e);
    res.status(500).json({ error: 'internal_error' });
  }
});

export default router;
