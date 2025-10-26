import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

/**
 * GET /v1/events/:eventId/reviews
 */
export async function listReviews(req, res) {
  try {
    const { eventId } = req.params;
    const reviews = await prisma.review.findMany({
      where: { eventId, visible: true },
      include: { user: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ reviews });
  } catch (e) {
    console.error('listReviews error', e);
    res.status(500).json({ error: 'internal_error' });
  }
}

/**
 * POST /v1/reviews
 * Body: { eventId, rating (1-5), comment }
 * - Only allow if user has an admitted (checked-in) ticket for the event.
 */
export async function addReview(req, res) {
  try {
    const { eventId, rating, comment } = req.body;
    if (!req.user?.id) return res.status(401).json({ error: 'unauthorized' });
    if (!eventId || !rating) return res.status(400).json({ error: 'eventId and rating are required' });

    const attended = await prisma.ticket.findFirst({
      where: {
        eventId,
        userId: req.user.id,
        admitted: true,
        refunded: false,
      },
      select: { id: true },
    });
    if (!attended) return res.status(400).json({ error: 'not_eligible_no_checked_in_ticket' });

    const existing = await prisma.review.findFirst({
      where: { eventId, userId: req.user.id },
    });

    const review = existing
      ? await prisma.review.update({
          where: { id: existing.id },
          data: { rating, comment: comment || '' },
        })
      : await prisma.review.create({
          data: { eventId, userId: req.user.id, rating, comment: comment || '' },
        });

    res.json({ ok: true, review });
  } catch (e) {
    console.error('addReview error', e);
    res.status(500).json({ error: 'internal_error' });
  }
}

/**
 * POST /v1/reviews/moderate
 * Body: { reviewId, visible }
 */
export async function moderateReview(req, res) {
  try {
    const { reviewId, visible } = req.body;
    if (!reviewId || typeof visible !== 'boolean') {
      return res.status(400).json({ error: 'reviewId and visible are required' });
    }
    const review = await prisma.review.update({
      where: { id: reviewId },
      data: { visible },
    });
    res.json({ ok: true, review });
  } catch (e) {
    console.error('moderateReview error', e);
    res.status(500).json({ error: 'internal_error' });
  }
}
