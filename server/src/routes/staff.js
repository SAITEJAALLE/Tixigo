import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { requireAuth, requireRole } from '../middleware/auth.js';

const prisma = new PrismaClient();
const router = Router();

/*
   Helpers
*/
function randToken(len = 64) {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let s = '';
  for (let i = 0; i < len; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}
const ORIGIN = process.env.CLIENT_ORIGIN || 'http://localhost:5173';

/** Extract a likely ticket token from arbitrary QR text / URL. */
function extractToken(raw) {
  if (!raw || typeof raw !== 'string') return '';
  const s = raw.trim();
  try {
    if (s.includes('://')) {
      const u = new URL(s);
      const qp =
        u.searchParams.get('code') ||
        u.searchParams.get('t') ||
        u.searchParams.get('ticket');
      if (qp) return qp.trim();
      const segs = u.pathname.split('/').filter(Boolean);
      if (segs.length) return segs[segs.length - 1].trim();
    }
  } catch { /* not a URL */ }
  return s;
}

/** Find a ticket by any common token: code, ticketNumber, or id. */
async function findTicketByAny(token) {
  if (!token) return null;
  return prisma.ticket.findFirst({
    where: { OR: [{ code: token }, { ticketNumber: token }, { id: token }] },
    include: {
      event: { select: { id: true, title: true, organizerId: true } },
      showTime: true,
      ticketType: true,
      order: { select: { status: true, user: { select: { name: true, email: true } } } },
    },
  });
}

/** Does user have rights to scan for eventId */
async function canScanEvent(user, eventId) {
  if (!user) return false;
  if (user.role === 'OWNER') return true;

  // Organizer of the event?
  const ev = await prisma.event.findUnique({
    where: { id: eventId },
    select: { organizerId: true },
  });
  if (ev && ev.organizerId === user.id) return true;

  // Approved staff assignment?
  const a = await prisma.staffAssignment.findFirst({
    where: { userId: user.id, eventId, approved: true },
    select: { id: true },
  });
  return !!a;
}

/*  Invite flows */
// POST /api/staff/invite  { email, name?, eventId, role? }
router.post('/invite', requireAuth, requireRole(['ORGANIZER','OWNER']), async (req, res) => {
  try {
    const { email, name = '', eventId, role = 'SCANNER' } = req.body || {};
    if (!email || !eventId) return res.status(400).json({ error: 'invalid_request' });

    // If organizer, ensure it's their event
    if (req.user.role !== 'OWNER') {
      const ev = await prisma.event.findUnique({ where: { id: eventId }, select: { organizerId: true } });
      if (!ev) return res.status(404).json({ error: 'event_not_found' });
      if (ev.organizerId !== req.user.id) return res.status(403).json({ error: 'forbidden' });
    }

    const token = randToken();
    const invite = await prisma.staffInvite.create({
      data: {
        organizerId: req.user.id,
        email,
        name,
        eventId,
        role,
        createdById: req.user.id,
        status: 'PENDING',
        token,
      }
    });

    const link = `${ORIGIN}/invite/staff/${token}`;
    console.log(`[staff] invite link for ${email}: ${link}`); // send email in your mailer
    res.json({ ok: true, inviteId: invite.id, link });
  } catch (e) {
    console.error('staff invite error', e);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /api/staff/accept  { token }
router.post('/accept', requireAuth, async (req, res) => {
  try {
    const { token } = req.body || {};
    if (!token) return res.status(400).json({ error: 'missing_token' });

    const invite = await prisma.staffInvite.findUnique({
      where: { token },
      include: { event: { select: { id: true, title: true, organizerId: true } } },
    });
    if (!invite) return res.status(404).json({ error: 'invite_not_found' });

    // Already used?
    if (invite.status === 'ACCEPTED') {
      if (invite.acceptedById === req.user.id) return res.json({ ok: true, alreadyAccepted: true });
      return res.status(409).json({ error: 'invite_used' });
    }

    // Create/update pending assignment (idempotent)
    await prisma.staffAssignment.upsert({
      where: { userId_eventId: { userId: req.user.id, eventId: invite.eventId } },
      update: { role: invite.role },
      create: { userId: req.user.id, eventId: invite.eventId, role: invite.role, approved: false },
    });

    await prisma.staffInvite.update({
      where: { id: invite.id },
      data: { status: 'ACCEPTED', acceptedById: req.user.id, acceptedAt: new Date() },
    });

    res.json({ ok: true });
  } catch (e) {
    if (e?.code === 'P2002') return res.json({ ok: true, dedup: true });
    console.error('staff accept error', e);
    res.status(500).json({ error: 'internal_error' });
  }
});

/* Requests / approvals*/
router.get('/mine', requireAuth, async (req, res) => {
  const list = await prisma.staffAssignment.findMany({
    where: { userId: req.user.id },
    include: { event: { select: { id: true, title: true, startDate: true } } },
    orderBy: { createdAt: 'desc' },
  });
  res.json({ assignments: list });
});

// All pending requests across organizer's events (or all if OWNER)
router.get('/requests', requireAuth, requireRole(['ORGANIZER','OWNER']), async (req, res) => {
  try {
    let where = { approved: false };
    if (req.user.role !== 'OWNER') where = { ...where, event: { organizerId: req.user.id } };

    const rows = await prisma.staffAssignment.findMany({
      where,
      include: {
        user: { select: { id: true, name: true, email: true } },
        event: { select: { id: true, title: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ requests: rows });
  } catch (e) {
    console.error('staff requests error', e);
    res.status(500).json({ error: 'internal_error' });
  }
});

// ✅ This is the missing endpoint your organizer dashboard calls
// GET /api/staff/event/:eventId/assignments?approved=false|true|all
router.get('/event/:eventId/assignments', requireAuth, requireRole(['ORGANIZER','OWNER']), async (req, res) => {
  try {
    const { eventId } = req.params;
    const q = (req.query.approved || 'false').toString().toLowerCase(); // default: pending
    let approved;
    if (q === 'true') approved = true;
    else if (q === 'all') approved = undefined;   // no filter
    else approved = false;

    // permission: organizers must own the event
    if (req.user.role !== 'OWNER') {
      const ev = await prisma.event.findUnique({ where: { id: eventId }, select: { organizerId: true } });
      if (!ev) return res.status(404).json({ error: 'event_not_found' });
      if (ev.organizerId !== req.user.id) return res.status(403).json({ error: 'forbidden' });
    }

    const rows = await prisma.staffAssignment.findMany({
      where: { eventId, approved },
      include: { user: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ assignments: rows });
  } catch (e) {
    console.error('event assignments error', e);
    res.status(500).json({ error: 'internal_error' });
  }
});

async function assertCanModifyAssignment(user, assignmentId) {
  const a = await prisma.staffAssignment.findUnique({
    where: { id: assignmentId },
    include: { event: { select: { organizerId: true } } },
  });
  if (!a) throw new Error('not_found');
  if (user.role !== 'OWNER' && a.event.organizerId !== user.id) throw new Error('forbidden');
  return a;
}

router.post('/assignments/:id/approve', requireAuth, requireRole(['ORGANIZER','OWNER']), async (req, res) => {
  try {
    await assertCanModifyAssignment(req.user, req.params.id);
    const a = await prisma.staffAssignment.update({ where: { id: req.params.id }, data: { approved: true } });
    res.json({ ok: true, assignment: a });
  } catch (e) {
    if (e.message === 'not_found') return res.status(404).json({ error: 'not_found' });
    if (e.message === 'forbidden') return res.status(403).json({ error: 'forbidden' });
    console.error('approve error', e);
    res.status(500).json({ error: 'internal_error' });
  }
});

router.post('/assignments/:id/reject', requireAuth, requireRole(['ORGANIZER','OWNER']), async (req, res) => {
  try {
    await assertCanModifyAssignment(req.user, req.params.id);
    await prisma.staffAssignment.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (e) {
    if (e.message === 'not_found') return res.status(404).json({ error: 'not_found' });
    if (e.message === 'forbidden') return res.status(403).json({ error: 'forbidden' });
    console.error('reject error', e);
    res.status(500).json({ error: 'internal_error' });
  }
});

// Approved assignments for the logged-in staff (used by StaffScan page)
router.get('/my-assignments', requireAuth, async (req, res) => {
  try {
    const rows = await prisma.staffAssignment.findMany({
      where: { userId: req.user.id, approved: true },
      include: { event: { select: { id: true, title: true, startDate: true, endDate: true } } },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ assignments: rows });
  } catch (e) {
    console.error('my assignments error', e);
    res.status(500).json({ error: 'internal_error' });
  }
});

/* ---------------------------------------
   Scan endpoints
--------------------------------------- */
async function handleScan(req, res) {
  try {
    const raw = req.body?.payload || req.body?.code || req.body?.text || req.query?.q || '';
    const token = extractToken(raw);
    if (!token) return res.status(400).json({ error: 'invalid_payload' });

    let ticket = await findTicketByAny(token);
    if (!ticket && raw && raw !== token) ticket = await findTicketByAny(raw.trim());
    if (!ticket) return res.status(404).json({ error: 'ticket_not_found' });

    // permission
    const allowed = await canScanEvent(req.user, ticket.eventId);
    if (!allowed) {
      return res.status(403).json({ error: 'forbidden', detail: { eventId: ticket.eventId } });
    }

    // refunded?
    if (ticket.refunded || ticket.order?.status === 'refunded') {
      return res.status(409).json({ error: 'ticket_refunded', ticket });
    }

    // admit
    if (!ticket.admitted) {
      const updated = await prisma.ticket.update({
        where: { id: ticket.id },
        data: { admitted: true },
        include: {
          event: { select: { id: true, title: true } },
          showTime: true,
          ticketType: true,
          order: { select: { status: true, user: { select: { name: true, email: true } } } },
        },
      });
      return res.json({ ok: true, admitted: true, alreadyAdmitted: false, ticket: updated });
    }
    return res.json({ ok: true, admitted: false, alreadyAdmitted: true, ticket });
  } catch (e) {
    console.error('scan error', e);
    res.status(500).json({ error: 'internal_error' });
  }
}
router.post('/scan', requireAuth, handleScan);
router.get('/scan', requireAuth, handleScan);

/* ---------------------------------------
   Refund flow (optional staff action)
--------------------------------------- */
// Staff (approved), Organizer, or Owner can lodge a refund request
router.post('/refunds/request', requireAuth, async (req, res) => {
  try {
    const { ticketId, reason = '' } = req.body || {};
    if (!ticketId) return res.status(400).json({ error: 'invalid_request' });

    const t = await prisma.ticket.findUnique({
      where: { id: ticketId },
      include: { event: true, order: true, ticketType: true },
    });
    if (!t) return res.status(404).json({ error: 'ticket_not_found' });

    const allowed =
      req.user.role === 'OWNER' ||
      (req.user.role === 'ORGANIZER' && t.event.organizerId === req.user.id) ||
      (await prisma.staffAssignment.findFirst({
        where: { userId: req.user.id, eventId: t.eventId, approved: true },
      }));

    if (!allowed) return res.status(403).json({ error: 'forbidden' });

    const rr = await prisma.refundRequest.create({
      data: {
        orderId: t.orderId,
        ticketId,
        reason,
        requestedBy: req.user.id,
        amountPence: t.ticketType ? t.ticketType.priceCents : t.order.amountCents,
        status: 'PENDING',
      },
    });

    res.json({ ok: true, refund: rr });
  } catch (e) {
    console.error('refund request error', e);
    res.status(500).json({ error: 'internal_error' });
  }
});

// Resolve refund (Organizer/Owner or Staff ADMIN for that event)
async function canResolveRefund(user, eventId) {
  if (user.role === 'OWNER') return true;
  if (user.role === 'ORGANIZER') {
    const ev = await prisma.event.findUnique({ where: { id: eventId }, select: { organizerId: true } });
    return !!ev && ev.organizerId === user.id;
  }
  const staff = await prisma.staffAssignment.findFirst({
    where: { userId: user.id, eventId, approved: true, role: 'ADMIN' },
    select: { id: true },
  });
  return !!staff;
}

router.post('/refunds/:id/approve', requireAuth, async (req, res) => {
  try {
    const rr = await prisma.refundRequest.findUnique({
      where: { id: req.params.id },
      include: { ticket: true },
    });
    if (!rr) return res.status(404).json({ error: 'not_found' });
    if (!(await canResolveRefund(req.user, rr.ticket.eventId))) return res.status(403).json({ error: 'forbidden' });

    const upd = await prisma.refundRequest.update({
      where: { id: rr.id },
      data: { status: 'APPROVED', approvedBy: req.user.id },
    });
    res.json({ ok: true, refund: upd });
  } catch (e) {
    console.error('refund approve error', e);
    res.status(500).json({ error: 'internal_error' });
  }
});

router.post('/refunds/:id/reject', requireAuth, async (req, res) => {
  try {
    const rr = await prisma.refundRequest.findUnique({
      where: { id: req.params.id },
      include: { ticket: true },
    });
    if (!rr) return res.status(404).json({ error: 'not_found' });
    if (!(await canResolveRefund(req.user, rr.ticket.eventId))) return res.status(403).json({ error: 'forbidden' });

    const upd = await prisma.refundRequest.update({
      where: { id: rr.id },
      data: { status: 'REJECTED', approvedBy: req.user.id },
    });
    res.json({ ok: true, refund: upd });
  } catch (e) {
    console.error('refund reject error', e);
    res.status(500).json({ error: 'internal_error' });
  }
});

export default router;
