import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

/**
 * POST /v1/checkin/fallback
 * Body: { eventId, name?, email }
 * - If scan glitches, staff can look up by email (+ optional name) and admit.
 */
export async function fallbackCheckIn(req, res) {
  try {
    const { eventId, email, name } = req.body;
    if (!eventId || !email) return res.status(400).json({ error: 'eventId and email are required' });

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.status(404).json({ error: 'user_not_found' });
    if (name && user.name && user.name.toLowerCase().trim() !== String(name).toLowerCase().trim()) {
      // optional strict match if name provided
      return res.status(400).json({ error: 'name_email_mismatch' });
    }

    // find the most recent, not-refunded ticket for this user & event
    const ticket = await prisma.ticket.findFirst({
      where: { eventId, userId: user.id, refunded: false },
      orderBy: { createdAt: 'desc' },
      include: { event: true, showTime: true, ticketType: true },
    });

    if (!ticket) return res.status(404).json({ error: 'no_valid_ticket_found' });
    if (ticket.admitted) return res.status(400).json({ error: 'already_admitted' });

    await prisma.ticket.update({
      where: { id: ticket.id },
      data: { admitted: true },
    });

    return res.json({ ok: true, ticketId: ticket.id });
  } catch (e) {
    console.error('fallbackCheckIn error', e);
    res.status(500).json({ error: 'internal_error' });
  }
}
