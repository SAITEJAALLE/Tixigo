import { Router } from 'express';
import * as discovery from '../controllers/discoveryController.js';
import * as staff from '../controllers/staffController.js';
import * as refunds from '../controllers/refundsController.js';
import * as reviews from '../controllers/reviewsController.js';
import * as checkin from '../controllers/checkinController.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { prisma } from '../index.js';

const r = Router();

// Discovery & public
r.get('/v1/events', discovery.listEvents);
r.get('/v1/events/:eventId/recommendations', discovery.recommendations);
r.get('/v1/events/:eventId/reviews', reviews.listReviews);

// Staff lifecycle
r.post('/v1/staff/invite',  requireAuth, requireRole('ORGANIZER','OWNER'), staff.inviteStaff);
r.post('/v1/staff/accept',  staff.acceptInvite);
r.post('/v1/staff/approve', requireAuth, requireRole('ORGANIZER','OWNER'), staff.approveStaffByEmail);
r.post('/v1/staff/assign',  requireAuth, requireRole('ORGANIZER','OWNER'), staff.assignStaffToEvent);

// Refunds
r.post('/v1/refunds/request', requireAuth, requireRole('STAFF','ORGANIZER','OWNER'), refunds.requestRefund);
r.post('/v1/refunds/approve', requireAuth, requireRole('ORGANIZER','OWNER'), refunds.approveRefund);
r.get('/v1/refunds/summary',  requireAuth, requireRole('ORGANIZER','OWNER'), refunds.summary);

// Reviews
r.post('/v1/reviews', requireAuth, reviews.addReview);
r.post('/v1/reviews/moderate', requireAuth, requireRole('ORGANIZER','OWNER'), reviews.moderateReview);

// Check-in fallback
r.post('/v1/checkin/fallback', requireAuth, requireRole('STAFF','ORGANIZER','OWNER'), checkin.fallbackCheckIn);

// My tickets
r.get('/v1/me/tickets', requireAuth, async (req, res) => {
  try {
    const tickets = await prisma.ticket.findMany({
      where: { userId: req.user.id },
      include: {
        event: { select: { title: true } },
        showTime: true
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json({ tickets });
  } catch (e) {
    console.error('my tickets error', e);
    res.status(500).json({ error: 'internal_error' });
  }
});

export default r;
