import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { requireAuth, requireRole } from '../middleware/auth.js';

const prisma = new PrismaClient();

 
 // Status helpers
 
const STATUS = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
};

//Best-effort profile sync (safe if model exists)
async function upsertOrganizerProfileApproved(userId, decidedById = null) {
  try {
    await prisma.organizerProfile.upsert({
      where: { userId },
      update: {
        approved: true,
        status: 'APPROVED',
        decidedAt: new Date(),
        decidedById,
      },
      create: {
        userId,
        displayName: '',
        approved: true,
        status: 'APPROVED',
        decidedAt: new Date(),
        decidedById,
      },
    });
  } catch {
    /* ignore if OrganizerProfile doesn't exist */
  }
}

async function markOrganizerProfileRejected(userId, decidedById = null) {
  try {
    await prisma.organizerProfile.update({
      where: { userId },
      data: {
        approved: false,
        status: 'REJECTED',
        decidedAt: new Date(),
        decidedById,
      },
    });
  } catch {
    /* ignore if OrganizerProfile doesn't exist */
  }
}

// Public / Customer routes  →  /api/organizers/...
const organizersRouter = Router();

/** POST /api/organizers/requests  (create or return my request) */
organizersRouter.post('/requests', requireAuth, async (req, res) => {
  try {
    const me = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!me) return res.status(401).json({ error: 'unauthenticated' });

    if (me.role === 'OWNER' || me.role === 'ORGANIZER') {
      return res.status(409).json({ error: 'already_organizer' });
    }

    const existing = await prisma.organizerRequest.findUnique({
      where: { userId: me.id },
    });
    if (existing) return res.json({ ok: true, request: existing });

    const created = await prisma.organizerRequest.create({
      data: { userId: me.id, status: STATUS.PENDING },
    });
    res.json({ ok: true, request: created });
  } catch (e) {
    console.error('organizers: create request error', e);
    res.status(500).json({ error: 'internal_error' });
  }
});

/* GET /api/organizers/requests/mine  (my request) */
organizersRouter.get('/requests/mine', requireAuth, async (req, res) => {
  try {
    const row = await prisma.organizerRequest.findUnique({
      where: { userId: req.user.id },
    });
    res.json({ request: row || null });
  } catch (e) {
    console.error('organizers: get mine error', e);
    res.status(500).json({ error: 'internal_error' });
  }
});

/** GET /api/organizers/requests  (OWNER: list pending – legacy path) */
organizersRouter.get(
  '/requests',
  requireAuth,
  requireRole('OWNER'),
  async (_req, res) => {
    try {
      const list = await prisma.organizerRequest.findMany({
        where: { status: STATUS.PENDING },
        include: {
          user: { select: { id: true, email: true, name: true, displayName: true } },
        },
        orderBy: { createdAt: 'asc' },
      });
      res.json({ requests: list });
    } catch (e) {
      console.error('organizers: list pending error', e);
      res.status(500).json({ error: 'internal_error' });
    }
  }
);

/** POST /api/organizers/requests/:id/approve  (OWNER – legacy path) */
organizersRouter.post(
  '/requests/:id/approve',
  requireAuth,
  requireRole('OWNER'),
  async (req, res) => {
    try {
      const r = await prisma.organizerRequest.findUnique({ where: { id: req.params.id } });
      if (!r) return res.status(404).json({ error: 'not_found' });

      await prisma.user.update({ where: { id: r.userId }, data: { role: 'ORGANIZER' } });
      const upd = await prisma.organizerRequest.update({
        where: { id: r.id },
        data: { status: STATUS.APPROVED, decidedAt: new Date() }, // ← no decidedById here
      });

      await upsertOrganizerProfileApproved(r.userId, req.user.id);
      res.json({ ok: true, request: upd });
    } catch (e) {
      console.error('organizers: approve error', e);
      res.status(500).json({ error: 'internal_error' });
    }
  }
);

/** POST /api/organizers/requests/:id/reject  (OWNER – legacy path) */
organizersRouter.post(
  '/requests/:id/reject',
  requireAuth,
  requireRole('OWNER'),
  async (req, res) => {
    try {
      const upd = await prisma.organizerRequest.update({
        where: { id: req.params.id },
        data: {
          status: STATUS.REJECTED,
          decidedAt: new Date(), // ← no decidedById here
          note: req.body?.note || null,
        },
      });

      await markOrganizerProfileRejected(upd.userId, req.user.id);
      res.json({ ok: true, request: upd });
    } catch (e) {
      console.error('organizers: reject error', e);
      res.status(500).json({ error: 'internal_error' });
    }
  }
);

/*
 => Owner routes (what Admin.jsx calls)
 => Mounted at: /api/admin/organizers/...
 */
const adminOrganizersRouter = Router();

// consistent guard signature
adminOrganizersRouter.use(requireAuth, requireRole('OWNER'));

/** GET /api/admin/organizers/pending */
adminOrganizersRouter.get('/pending', async (_req, res) => {
  try {
    const pending = await prisma.organizerRequest.findMany({
      where: { status: STATUS.PENDING },
      include: {
        user: { select: { id: true, email: true, name: true, displayName: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
    res.json({ pending });
  } catch (e) {
    console.error('admin organizers: pending error', e);
    res.status(500).json({ error: 'internal_error' });
  }
});

/** POST /api/admin/organizers/:userId/approve */
adminOrganizersRouter.post('/:userId/approve', async (req, res) => {
  try {
    const { userId } = req.params;

    // find or create request
    let reqRow = await prisma.organizerRequest.findUnique({ where: { userId } });
    if (!reqRow) {
      reqRow = await prisma.organizerRequest.create({
        data: { userId, status: STATUS.PENDING },
      });
    }

    // promote + mark approved (no decidedById on OrganizerRequest)
    await prisma.user.update({ where: { id: userId }, data: { role: 'ORGANIZER' } });
    const upd = await prisma.organizerRequest.update({
      where: { id: reqRow.id },
      data: { status: STATUS.APPROVED, decidedAt: new Date() },
    });

    await upsertOrganizerProfileApproved(userId, req.user.id);
    res.json({ ok: true, request: upd });
  } catch (e) {
    console.error('admin organizers: approve error', e);
    res.status(500).json({ error: 'internal_error' });
  }
});

/** POST /api/admin/organizers/:userId/remove */
adminOrganizersRouter.post('/:userId/remove', async (req, res) => {
  try {
    const { userId } = req.params;

    await prisma.user.update({ where: { id: userId }, data: { role: 'CUSTOMER' } });

    const existing = await prisma.organizerRequest.findUnique({ where: { userId } });
    if (existing) {
      await prisma.organizerRequest.update({
        where: { id: existing.id },
        data: { status: STATUS.REJECTED, decidedAt: new Date() }, // ← no decidedById
      });
    }

    await markOrganizerProfileRejected(userId, req.user.id);
    res.json({ ok: true });
  } catch (e) {
    console.error('admin organizers: remove error', e);
    res.status(500).json({ error: 'internal_error' });
  }
});

export { organizersRouter, adminOrganizersRouter };
