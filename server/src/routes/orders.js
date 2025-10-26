import { Router } from 'express';
import crypto from 'crypto';
import { prisma } from '../index.js';
import { requireAuth } from '../middleware/auth.js';
import Stripe from 'stripe';
import { sendTicketEmail } from '../utils/mailer.js';

const r = Router();

const USE_STRIPE =
  !!(process.env.STRIPE_SECRET_KEY &&
     process.env.STRIPE_SECRET_KEY.startsWith('sk_') &&
     process.env.PAYMENTS_MODE !== 'stub');

const stripe = USE_STRIPE ? new Stripe(process.env.STRIPE_SECRET_KEY) : null;

const pending = new Map();

function normalizeItems(items) {
  if (!Array.isArray(items)) return [];
  return items
    .map(i => ({
      ticketTypeId: i.ticketTypeId,
      qty: Number(i.qty ?? i.quantity ?? i.count ?? 0)
    }))
    .filter(i => i.ticketTypeId && i.qty > 0);
}

r.post('/checkout', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { eventId, showTimeId } = req.body || {};
    const items = normalizeItems(req.body?.items);
    if (!eventId || !showTimeId || items.length === 0) {
      return res.status(400).json({ error: 'invalid_request' });
    }

    const ids = items.map(i => i.ticketTypeId);
    const tts = await prisma.ticketType.findMany({
      where: { id: { in: ids } },
      select: { id: true, priceCents: true }
    });
    const priceById = Object.fromEntries(tts.map(t => [t.id, t.priceCents]));
    const amountCents = items.reduce(
      (sum, i) => sum + (priceById[i.ticketTypeId] || 0) * i.qty,
      0
    );
    if (amountCents <= 0) return res.status(400).json({ error: 'amount_zero' });

    const status = USE_STRIPE ? 'created' : 'paid';
    const order = await prisma.order.create({
      data: { userId, eventId, showTimeId, amountCents, status },
      select: { id: true }
    });

    pending.set(userId, { orderId: order.id, eventId, showTimeId, items });

    if (!USE_STRIPE) return res.json({ ok: true, mode: 'stub' });

    const pi = await stripe.paymentIntents.create({
      amount: amountCents,
      currency: 'gbp',
      automatic_payment_methods: { enabled: true },
      metadata: { orderId: order.id, userId }
    });

    await prisma.order.update({
      where: { id: order.id },
      data: { paymentRef: pi.id }
    });

    res.json({ ok: true, mode: 'stripe', clientSecret: pi.client_secret });
  } catch (e) {
    console.error('checkout error', e);
    res.status(500).json({ error: 'internal_error' });
  }
});

r.post('/issue', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const stash = pending.get(userId);
    if (!stash) return res.status(400).json({ error: 'no_pending_checkout' });

    const { orderId, eventId, showTimeId, items } = stash;

    await prisma.order.update({ where: { id: orderId }, data: { status: 'paid' } });

    const created = [];
    for (const it of items) {
      for (let i = 0; i < it.qty; i++) {
        const code = crypto.randomBytes(16).toString('hex');
        const tNo = `${it.ticketTypeId.slice(0, 4).toUpperCase()}-${Math.floor(
          Math.random() * 900000 + 100000
        )}`;
        const t = await prisma.ticket.create({
          data: {
            orderId,
            eventId,
            showTimeId,
            ticketTypeId: it.ticketTypeId,
            userId,
            code,
            ticketNumber: tNo
          },
          include: { showTime: true, event: true }
        });
        created.push(t);
      }
    }

    pending.delete(userId);

    // fire-and-forget email (won't fail the API if SMTP fails)
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { email: true }
      });
      const ev = await prisma.event.findUnique({
        where: { id: eventId },
        select: { title: true, location: true }
      });
      const st = await prisma.showTime.findUnique({
        where: { id: showTimeId },
        select: { dateTime: true }
      });
      if (user?.email) {
        await sendTicketEmail(user.email, { event: ev, showTime: st, tickets: created });
      }
    } catch (e) {
      console.error('ticket email failed:', e?.message || e);
    }

    res.json({ ok: true, tickets: created });
  } catch (e) {
    console.error('issue error', e);
    res.status(500).json({ error: 'internal_error' });
  }
});

export default r;
