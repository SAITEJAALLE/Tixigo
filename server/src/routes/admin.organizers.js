import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { requireAuth, requireRole } from '../middleware/auth.js';

const prisma = new PrismaClient();
const router = Router();
const S = { PENDING: 'pending', APPROVED: 'approved', REJECTED: 'rejected' };

async function upsertApprovedOrganizerProfile(user) {
  try {
    await prisma.organizerProfile.upsert({
      where: { userId: user.id },
      update: {
        displayName: user.displayName || user.name || user.email,
        approved: true,
        status: 'APPROVED',
        decidedAt: new Date(),
      },
      create: {
        userId: user.id,
        displayName: user.displayName || user.name || user.email,
        approved: true,
        status: 'APPROVED',
        decidedAt: new Date(),
      },
    });
  } catch {}
}

async function markProfileRejected(user) {
  try {
    await prisma.organizerProfile.update({
      where: { userId: user.id },
      data: { approved: false, status: 'REJECTED', decidedAt: new Date() },
    });
  } catch {}
}

/* GET /api/admin/organizers/pending */
router.get('/pending', requireAuth, requireRole(['OWNER']), async (_req, res) => {
  try {
    const pending = await prisma.organizerRequest.findMany({
      where: { status: S.PENDING },
      include: {
        user: { select: { id: true, email: true, name: true, displayName: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
    res.json({ pending });
  } catch (e) {
    console.error('admin.organizers.pending error', e);
    res.status(500).json({ error: 'internal_error' });
  }
});

/* POST /api/admin/organizers/:userId/approve */
router.post('/:userId/approve', requireAuth, requireRole(['OWNER']), async (req, res) => {
  try {
    const { userId } = req.params;

    // find or create request
    let reqRow = await prisma.organizerRequest.findUnique({ where: { userId } });
    if (!reqRow) reqRow = await prisma.organizerRequest.create({ data: { userId, status: S.PENDING } });

    // promote user
    const user = await prisma.user.update({ where: { id: userId }, data: { role: 'ORGANIZER' } });

    // mark request approved
    const upd = await prisma.organizerRequest.update({
      where: { id: reqRow.id },
      data: { status: S.APPROVED, decidedAt: new Date() },
    });

    await upsertApprovedOrganizerProfile(user);
    res.json({ ok: true, request: upd });
  } catch (e) {
    console.error('admin.organizers.approve error', e);
    res.status(500).json({ error: 'internal_error' });
  }
});

/*POST /api/admin/organizers/:userId/remove */
router.post('/:userId/remove', requireAuth, requireRole(['OWNER']), async (req, res) => {
  try {
    const { userId } = req.params;
    const user = await prisma.user.update({ where: { id: userId }, data: { role: 'CUSTOMER' } });

    const existing = await prisma.organizerRequest.findUnique({ where: { userId } });
    if (existing) {
      await prisma.organizerRequest.update({
        where: { id: existing.id },
        data: { status: S.REJECTED, decidedAt: new Date() },
      });
    }

    await markProfileRejected(user);
    res.json({ ok: true });
  } catch (e) {
    console.error('admin.organizers.remove error', e);
    res.status(500).json({ error: 'internal_error' });
  }
});

export default router;
