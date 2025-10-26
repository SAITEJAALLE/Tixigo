import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

/**
 * POST /v1/refunds/request
 * Body: { ticketId, reason? }
 * - Creates a RefundRequest with status PENDING; does NOT mark ticket refunded yet.
 */
export async function requestRefund(req, res) {
  try {
    const { ticketId, reason } = req.body;
    if (!ticketId) return res.status(400).json({ error: 'ticketId is required' });

    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
      include: { ticketType: true, order: true },
    });
    if (!ticket) return res.status(404).json({ error: 'ticket_not_found' });
    if (ticket.refunded) return res.status(400).json({ error: 'already_refunded' });

    // Use ticketType.priceCents as refund amount base (GBP cents)
    const amountPence = ticket.ticketType.priceCents;

    const rr = await prisma.refundRequest.create({
      data: {
        orderId: ticket.orderId,
        ticketId: ticket.id,
        reason: reason || null,
        requestedBy: req.user?.email || 'staff',
        status: 'PENDING',
        amountPence,
      },
    });

    return res.json({ ok: true, refundRequest: rr });
  } catch (e) {
    console.error('requestRefund error', e);
    return res.status(500).json({ error: 'internal_error' });
  }
}

/**
 * POST /v1/refunds/approve
 * Body: { refundRequestId }
 * - Marks request APPROVED and sets ticket.refunded=true. (Stripe integration can be added here.)
 */
export async function approveRefund(req, res) {
  try {
    const { refundRequestId } = req.body;
    if (!refundRequestId) return res.status(400).json({ error: 'refundRequestId is required' });

    const rr = await prisma.refundRequest.findUnique({ where: { id: refundRequestId } });
    if (!rr) return res.status(404).json({ error: 'refund_request_not_found' });
    if (rr.status === 'APPROVED') return res.json({ ok: true, refundRequest: rr });

    await prisma.$transaction([
      prisma.refundRequest.update({
        where: { id: refundRequestId },
        data: { status: 'APPROVED', approvedBy: req.user?.email || 'organizer' },
      }),
      prisma.ticket.update({
        where: { id: rr.ticketId },
        data: { refunded: true },
      }),
    ]);

    const updated = await prisma.refundRequest.findUnique({ where: { id: refundRequestId } });
    return res.json({ ok: true, refundRequest: updated });
  } catch (e) {
    console.error('approveRefund error', e);
    return res.status(500).json({ error: 'internal_error' });
  }
}

/**
 * GET /v1/refunds/summary?eventId=...
 * - Returns counts and reasons grouped for organizer/owner dashboards.
 */
export async function summary(req, res) {
  try {
    const { eventId } = req.query;

    const whereTicket = eventId ? { eventId: String(eventId) } : {};
    const requests = await prisma.refundRequest.findMany({
      where: eventId
        ? { ticket: { eventId: String(eventId) } }
        : {},
      include: { ticket: true },
      orderBy: { createdAt: 'desc' },
    });

    const total = requests.length;
    const byStatus = requests.reduce((acc, r) => {
      acc[r.status] = (acc[r.status] || 0) + 1;
      return acc;
    }, {});
    const reasons = requests
      .filter(r => r.reason)
      .map(r => r.reason);

    return res.json({ total, byStatus, reasons, eventId: eventId || null });
  } catch (e) {
    console.error('refunds summary error', e);
    return res.status(500).json({ error: 'internal_error' });
  }
}
