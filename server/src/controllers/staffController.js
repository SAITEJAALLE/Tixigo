import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';

const prisma = new PrismaClient();

/**
 * POST /v1/staff/invite
 * Body: { organizerId?, email, name? }
 * - If organizerId is missing and requester is ORGANIZER, use req.user.id
 */
export async function inviteStaff(req, res) {
  try {
    const { email, name } = req.body;
    let { organizerId } = req.body;

    if (!email) return res.status(400).json({ error: 'email is required' });

    // Derive organizerId if caller is an organizer
    if (!organizerId && req.user?.role === 'ORGANIZER') organizerId = req.user.id;
    if (!organizerId) return res.status(400).json({ error: 'organizerId is required' });

    // ensure organizer exists
    const org = await prisma.user.findUnique({ where: { id: organizerId } });
    if (!org || (org.role !== 'ORGANIZER' && org.role !== 'OWNER')) {
      return res.status(404).json({ error: 'organizer_not_found' });
    }

    const token = crypto.randomUUID();
    const invite = await prisma.staffInvite.create({
      data: {
        organizerId,
        email,
        name: name || null,
        token,
        status: 'PENDING',
      },
    });

    // TODO: send real email with token URL (e.g. /staff/accept?token=...)
    return res.json({ ok: true, invite });
  } catch (e) {
    console.error('inviteStaff error', e);
    return res.status(500).json({ error: 'internal_error' });
  }
}

/**
 * POST /v1/staff/accept
 * Body: { token }
 * - Public endpoint hit via emailed token
 */
export async function acceptInvite(req, res) {
  try {
    const { token } = req.body;
    if (!token) return res.status(400).json({ error: 'token is required' });

    const invite = await prisma.staffInvite.findUnique({ where: { token } });
    if (!invite) return res.status(404).json({ error: 'invalid_token' });
    if (invite.status !== 'PENDING') {
      return res.status(400).json({ error: `invite_already_${invite.status.toLowerCase()}` });
    }

    // Make or promote user
    let user = await prisma.user.findUnique({ where: { email: invite.email } });
    if (!user) {
      user = await prisma.user.create({
        data: { email: invite.email, name: invite.name || null, role: 'STAFF' },
      });
    } else if (user.role === 'CUSTOMER') {
      await prisma.user.update({ where: { id: user.id }, data: { role: 'STAFF' } });
    }

    await prisma.staffInvite.update({
      where: { id: invite.id },
      data: { status: 'ACCEPTED', respondedAt: new Date() },
    });

    return res.json({ ok: true, userId: user.id });
  } catch (e) {
    console.error('acceptInvite error', e);
    return res.status(500).json({ error: 'internal_error' });
  }
}

/**
 * POST /v1/staff/approve
 * Body: { email }
 * - Organizer/Owner approves a staffer by email (marks latest PENDING invite as ACCEPTED and promotes role)
 */
export async function approveStaffByEmail(req, res) {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'email is required' });

    // promote / ensure staff role
    let user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      user = await prisma.user.create({ data: { email, role: 'STAFF' } });
    } else if (user.role === 'CUSTOMER') {
      await prisma.user.update({ where: { id: user.id }, data: { role: 'STAFF' } });
    }

    // mark latest invite as accepted if one exists
    const latestInvite = await prisma.staffInvite.findFirst({
      where: { email, status: 'PENDING' },
      orderBy: { createdAt: 'desc' },
    });
    if (latestInvite) {
      await prisma.staffInvite.update({
        where: { id: latestInvite.id },
        data: { status: 'ACCEPTED', respondedAt: new Date() },
      });
    }

    return res.json({ ok: true, userId: user.id });
  } catch (e) {
    console.error('approveStaffByEmail error', e);
    return res.status(500).json({ error: 'internal_error' });
  }
}

/**
 * POST /v1/staff/assign
 * Body: { staffEmail, eventId }
 */
export async function assignStaffToEvent(req, res) {
  try {
    const { staffEmail, eventId } = req.body;
    if (!staffEmail || !eventId) {
      return res.status(400).json({ error: 'staffEmail and eventId are required' });
    }

    const staff = await prisma.user.findUnique({ where: { email: staffEmail } });
    if (!staff) return res.status(404).json({ error: 'staff_user_not_found' });
    if (staff.role !== 'STAFF' && staff.role !== 'ORGANIZER' && staff.role !== 'OWNER') {
      return res.status(400).json({ error: 'user_is_not_staff' });
    }

    await prisma.staffAssignment.create({ data: { staffId: staff.id, eventId } });
    return res.json({ ok: true });
  } catch (e) {
    if (e.code === 'P2002') return res.status(409).json({ error: 'already_assigned' });
    console.error('assignStaffToEvent error', e);
    return res.status(500).json({ error: 'internal_error' });
  }
}

/**
 * GET /v1/me/tickets
 * - Requires auth. Lists current user's tickets.
 */
export async function myTickets(req, res) {
  try {
    if (!req.user?.id) return res.status(401).json({ error: 'unauthorized' });

    const tickets = await prisma.ticket.findMany({
      where: { userId: req.user.id },
      include: {
        event: { select: { id: true, title: true, location: true, startDate: true, endDate: true } },
        showTime: true,
        ticketType: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return res.json({ tickets });
  } catch (e) {
    console.error('myTickets error', e);
    return res.status(500).json({ error: 'internal_error' });
  }
}
