const router = require('express').Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { OAuth2Client } = require('google-auth-library');
const { PrismaClient } = require('@prisma/client');
const { body, validationResult } = require('express-validator');

const prisma = new PrismaClient();
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

function makeToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, name: user.name },
    process.env.JWT_SECRET,
    { expiresIn: '30d' }
  );
}

function safeUser(u) {
  return { id: u.id, email: u.email, name: u.name, createdAt: u.createdAt, emailVerified: u.emailVerified ?? true };
}

function makeVerifyToken() {
  return crypto.randomBytes(32).toString('hex');
}

async function sendVerifyEmail(email, name, token) {
  const appUrl = process.env.APP_URL || 'https://mahjong.phytolink-venture.com';
  const link = `${appUrl}/api/auth/verify-email?token=${token}`;

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    // No email service — log the link so it's visible in docker logs
    console.log(`[verify-link] ${email} → ${link}`);
    return;
  }

  try {
    const from = process.env.EMAIL_FROM || 'Mahjong Points <noreply@phytolink-venture.com>';
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from,
        to: [email],
        subject: 'Verify your Mahjong Points account',
        html: `<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;background:#f9f6f0;border-radius:12px">
  <div style="text-align:center;margin-bottom:24px">
    <div style="display:inline-block;width:52px;height:52px;background:#1e3028;border-radius:12px;line-height:52px;font-size:28px;font-family:serif;color:#f0e8d5;text-align:center">麻</div>
  </div>
  <h2 style="color:#1e3028;margin:0 0 8px;text-align:center">麻将计分 · Mahjong Points</h2>
  <p style="color:#555;text-align:center;margin:0 0 28px">Hi ${name}, please verify your email address to activate your account.</p>
  <div style="text-align:center;margin-bottom:28px">
    <a href="${link}" style="display:inline-block;background:#c8a84b;color:#1e3028;font-weight:700;padding:14px 32px;border-radius:8px;text-decoration:none;font-size:16px">
      Verify Email
    </a>
  </div>
  <p style="color:#999;font-size:12px;text-align:center;margin:0">If you didn't create an account, you can safely ignore this email.</p>
</div>`,
      }),
    });
    if (!r.ok) {
      const err = await r.text().catch(() => '');
      console.error(`[email] Resend error ${r.status}:`, err);
    }
  } catch (e) {
    console.error('[email] send failed:', e.message);
  }
}

// Register
router.post('/register', [
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('name').trim().isLength({ min: 1 }).withMessage('Name is required'),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ error: errors.array()[0].msg });

  const { email, password, name } = req.body;
  try {
    if (await prisma.user.findUnique({ where: { email } })) {
      return res.status(400).json({ error: 'Email already registered' });
    }
    const passwordHash = await bcrypt.hash(password, 10);
    const emailVerifyToken = makeVerifyToken();
    const user = await prisma.user.create({
      data: { email, name, passwordHash, emailVerified: false, emailVerifyToken },
    });
    await sendVerifyEmail(email, name, emailVerifyToken);
    res.json({ token: makeToken(user), user: safeUser(user) });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  }
});

// Login
router.post('/login', [
  body('email').isEmail().normalizeEmail(),
  body('password').exists(),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ error: errors.array()[0].msg });

  const { email, password } = req.body;
  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.passwordHash) return res.status(400).json({ error: 'Invalid credentials' });
    if (!await bcrypt.compare(password, user.passwordHash)) return res.status(400).json({ error: 'Invalid credentials' });
    res.json({ token: makeToken(user), user: safeUser(user) });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// Google Sign-In
router.post('/google', async (req, res) => {
  const { credential } = req.body;
  if (!credential) return res.status(400).json({ error: 'Missing credential' });
  if (!process.env.GOOGLE_CLIENT_ID) return res.status(503).json({ error: 'Google login not configured' });

  try {
    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    const { sub: googleId, email, name, email_verified } = ticket.getPayload();

    let user = await prisma.user.findUnique({ where: { googleId } });
    if (!user) {
      const byEmail = await prisma.user.findUnique({ where: { email } });
      if (byEmail) {
        user = await prisma.user.update({
          where: { id: byEmail.id },
          data: { googleId, emailVerified: byEmail.emailVerified || !!email_verified },
        });
      } else {
        // Google accounts are always verified
        user = await prisma.user.create({ data: { email, name, googleId, emailVerified: true } });
      }
    } else if (!user.emailVerified && email_verified) {
      user = await prisma.user.update({ where: { id: user.id }, data: { emailVerified: true } });
    }
    res.json({ token: makeToken(user), user: safeUser(user) });
  } catch (e) {
    console.error(e);
    res.status(400).json({ error: 'Invalid Google credential' });
  }
});

// Verify email via link (clicked in email)
router.get('/verify-email', async (req, res) => {
  const { token } = req.query;
  const appUrl = process.env.APP_URL || 'https://mahjong.phytolink-venture.com';
  if (!token) return res.redirect(`${appUrl}/#verified=fail`);
  try {
    const user = await prisma.user.findUnique({ where: { emailVerifyToken: token } });
    if (!user) return res.redirect(`${appUrl}/#verified=fail`);
    await prisma.user.update({
      where: { id: user.id },
      data: { emailVerified: true, emailVerifyToken: null },
    });
    res.redirect(`${appUrl}/#verified=1`);
  } catch (e) {
    console.error(e);
    res.redirect(`${appUrl}/#verified=fail`);
  }
});

// Resend verification email
router.post('/resend-verify', require('../middleware/requireAuth'), async (req, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (user.emailVerified) return res.json({ ok: true });
    if (!user.passwordHash) return res.json({ ok: true }); // Google users always verified

    const emailVerifyToken = makeVerifyToken();
    await prisma.user.update({ where: { id: user.id }, data: { emailVerifyToken } });
    await sendVerifyEmail(user.email, user.name, emailVerifyToken);
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get current user
router.get('/me', require('../middleware/requireAuth'), async (req, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ user: safeUser(user) });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
