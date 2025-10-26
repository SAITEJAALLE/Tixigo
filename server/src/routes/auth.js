import { Router } from 'express';
import { prisma } from '../index.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { sendMail } from '../utils/mailer.js';
import { requireAuth } from '../middleware/auth.js';

const r = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';
const APP_BASE_URL = process.env.APP_BASE_URL || 'http://localhost:5173';

// Helpers
function signToken(user) {
  const payload = { id: user.id, email: user.email, role: user.role, name: user.name || null };
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
}
function verifyEmailHtml(link) {
  return `
    <div style="font-family:system-ui;margin:20px;">
      <h2>Verify your email</h2>
      <p>Thanks for joining Tixigo! Click the button below to verify your email.</p>
      <p><a href="${link}" style="display:inline-block;background:#4F46E5;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none;">Verify email</a></p>
      <p>Or paste this link in your browser:<br>${link}</p>
    </div>`;
}
function resetEmailHtml(link) {
  return `
    <div style="font-family:system-ui;margin:20px;">
      <h2>Reset your password</h2>
      <p>Click the button below to set a new password.</p>
      <p><a href="${link}" style="display:inline-block;background:#4F46E5;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none;">Set new password</a></p>
      <p>Or paste this link in your browser:<br>${link}</p>
    </div>`;
}

// REGISTER (creates user + sends verification)
r.post('/register', async (req, res) => {
  try {
    let { name, email, password } = req.body || {};
    if (!email || !password) return res.status(400).json({ error: 'email and password required' });
    email = String(email).trim().toLowerCase();

    const exists = await prisma.user.findUnique({ where: { email } });
    if (exists) return res.status(409).json({ error: 'email already registered' });

    const hash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash: hash,
        name: name || null,
        displayName: name || null,
        isEmailVerified: false,
      },
      select: { id: true, email: true, name: true },
    });

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await prisma.emailVerification.create({ data: { userId: user.id, token, expiresAt } });

    const link = `${APP_BASE_URL}/verify?token=${token}`;
    const mail = await sendMail({
      to: user.email,
      subject: 'Verify your Tixigo account',
      html: `
        <div style="font-family:system-ui;margin:20px;">
          <h2>Verify your email</h2>
          <p>Hello ${user.name || 'there'}, click the button below to verify your email.</p>
          <p><a href="${link}" style="display:inline-block;background:#4F46E5;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none;">Verify email</a></p>
          <p>Or paste this link:<br>${link}</p>
        </div>`,
      text: `Verify your account: ${link}`,
    });

    if (!mail.ok) {
      console.warn('register: mail failed ->', mail.error);
      // still succeed in DEV so you can continue
    }

    // Helpful in dev if email doesn’t arrive
    const devLink = process.env.NODE_ENV === 'development' ? link : undefined;

    return res.status(201).json({ ok: true, message: 'verification_sent', devLink });
  } catch (e) {
    console.error('register error', e);
    return res.status(500).json({ error: 'internal_error' });
  }
});

// RESEND verification
r.post('/request-verify', async (req, res) => {
  try {
    let { email } = req.body || {};
    if (!email) return res.status(400).json({ error: 'email required' });
    email = String(email).trim().toLowerCase();

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.json({ ok: true }); // no user leak
    if (user.isEmailVerified) return res.json({ ok: true, message: 'already_verified' });

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await prisma.emailVerification.create({ data: { userId: user.id, token, expiresAt } });

    const link = `${APP_BASE_URL}/verify?token=${token}`;
    const mail = await sendMail({
      to: user.email,
      subject: 'Verify your Tixigo account',
      html: `<p>Verify: <a href="${link}">${link}</a></p>`,
      text: `Verify your account: ${link}`,
    });

    if (!mail.ok) console.warn('request-verify: mail failed ->', mail.error);

    const devLink = process.env.NODE_ENV === 'development' ? link : undefined;
    return res.json({ ok: true, message: 'verification_sent', devLink });
  } catch (e) {
    console.error('request-verify error', e);
    return res.status(500).json({ error: 'internal_error' });
  }
});

r.get('/me', requireAuth, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        email: true,
        role: true,
        name: true,
        displayName: true,
        phone: true,
        gender: true,
        bio: true,
        photoUrl: true,
        isEmailVerified: true,
      },
    });
    if (!user) return res.status(404).json({ error: 'not_found' });
    res.json({ user });
  } catch (e) {
    console.error('me error', e);
    res.status(500).json({ error: 'internal_error' });
  }
});

// VERIFY{ returns JSON (no redirect)}
r.get('/verify', async (req, res) => {
  try {
    const token = String(req.query.token || '');
    if (!token) return res.status(400).json({ error: 'token required' });

    const rec = await prisma.emailVerification.findUnique({ where: { token } });
    if (!rec) return res.status(400).json({ error: 'invalid token' });
    if (rec.consumedAt) return res.status(400).json({ error: 'token already used' });
    if (rec.expiresAt < new Date()) return res.status(400).json({ error: 'token expired' });

    await prisma.$transaction([
      prisma.user.update({ where: { id: rec.userId }, data: { isEmailVerified: true } }),
      prisma.emailVerification.update({ where: { token }, data: { consumedAt: new Date() } }),
    ]);

    res.json({ ok: true });
  } catch (e) {
    console.error('verify error', e);
    res.status(500).json({ error: 'internal_error' });
  }
});

r.put('/me', requireAuth, async (req, res) => {
  try {
    const allowed = ['name', 'displayName', 'phone', 'gender', 'bio', 'photoUrl'];
    const data = {};
    for (const k of allowed) {
      if (typeof req.body?.[k] === 'string') data[k] = req.body[k];
    }
    const user = await prisma.user.update({
      where: { id: req.user.id },
      data,
      select: {
        id: true,
        email: true,
        role: true,
        name: true,
        displayName: true,
        phone: true,
        gender: true,
        bio: true,
        photoUrl: true,
      },
    });
    res.json({ user });
  } catch (e) {
    console.error('update me error', e);
    res.status(500).json({ error: 'internal_error' });
  }
});

// LOGIN {blocks unverified}
r.post('/login', async (req, res) => {
  try {
    let { email, password } = req.body || {};
    if (!email || !password) return res.status(400).json({ error: 'email and password required' });
    email = String(email).trim().toLowerCase();

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.passwordHash) return res.status(401).json({ error: 'invalid credentials' });

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return res.status(401).json({ error: 'invalid credentials' });
    if (!user.isEmailVerified) return res.status(403).json({ error: 'email_not_verified' });

    const slim = { id: user.id, email: user.email, role: user.role, name: user.name };
    const token = signToken(slim);
    res.json({ token, user: slim });
  } catch (e) {
    console.error('login error', e);
    res.status(500).json({ error: 'internal_error' });
  }
});

// PASSWORD RESET rquest
r.post('/request-reset', async (req, res) => {
  try {
    let { email } = req.body || {};
    if (!email) return res.status(400).json({ error: 'email required' });
    email = String(email).trim().toLowerCase();

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.json({ ok: true }); // do not leak

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1h
    await prisma.passwordReset.create({ data: { userId: user.id, token, expiresAt } });

    const link = `${APP_BASE_URL}/reset-password?token=${token}`;
    await sendMail({ to: user.email, subject: 'Reset your Tixigo password', html: resetEmailHtml(link) });

    res.json({ ok: true });
  } catch (e) {
    console.error('request-reset error', e);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /api/auth/request-organizer
r.post('/request-organizer', async (req, res) => {
  try {
    const userId = req.user?.id; // requireAuth if preferred
    if (!userId) return res.status(401).json({ error: 'unauthorized' });

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return res.status(404).json({ error: 'not_found' });
    if (user.role === 'ORGANIZER' || user.role === 'OWNER')
      return res.json({ ok: true, message: 'already_organizer' });

    // create or return existing pending
    const existing = await prisma.organizerRequest.findUnique({
      where: { userId }
    });
    if (existing && existing.status === 'pending') {
      return res.json({ ok: true, message: 'already_pending' });
    }

    await prisma.organizerRequest.upsert({
      where: { userId },
      create: { userId },
      update: { status: 'pending', decidedAt: null, note: null }
    });

    res.json({ ok: true });
  } catch (e) {
    console.error('request-organizer error', e);
    res.status(500).json({ error: 'internal_error' });
  }
});


// PASSWORD RESET consume
r.post('/reset', async (req, res) => {
  try {
    const { token, password } = req.body || {};
    if (!token || !password) return res.status(400).json({ error: 'invalid_request' });

    const rec = await prisma.passwordReset.findUnique({ where: { token } });
    if (!rec || rec.consumedAt || rec.expiresAt < new Date()) {
      return res.status(400).json({ error: 'invalid_or_expired' });
    }

    const hash = await bcrypt.hash(password, 10);
    await prisma.$transaction([
      prisma.user.update({ where: { id: rec.userId }, data: { passwordHash: hash } }),
      prisma.passwordReset.update({ where: { token }, data: { consumedAt: new Date() } }),
    ]);

    res.json({ ok: true });
  } catch (e) {
    console.error('reset error', e);
    res.status(500).json({ error: 'internal_error' });
  }
});

export default r;
