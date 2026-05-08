const router = require('express').Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { OAuth2Client } = require('google-auth-library');
const { PrismaClient } = require('@prisma/client');
const { body, validationResult } = require('express-validator');
let nodemailer;
try { nodemailer = require('nodemailer'); } catch { nodemailer = null; }

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
  return { id: u.id, email: u.email, name: u.name, createdAt: u.createdAt, emailVerified: u.emailVerified };
}

function makeVerifyToken() {
  return crypto.randomBytes(32).toString('hex');
}

async function sendVerifyEmail(email, name, token) {
  if (!process.env.SMTP_HOST || !nodemailer) return; // silently skip if not configured
  try {
    const transport = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_PORT === '465',
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
    const appUrl = process.env.APP_URL || 'https://mahjong.phytolink.io';
    const link = `${appUrl}/api/auth/verify-email?token=${token}`;
    await transport.sendMail({
      from: process.env.SMTP_FROM || `Mahjong Points <${process.env.SMTP_USER}>`,
      to: email,
      subject: 'Verify your Mahjong Points account',
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
          <h2 style="color:#1e3028;margin-bottom:8px">麻将计分 · Mahjong Points</h2>
          <p>Hi ${name},</p>
          <p>Click the button below to verify your email address.</p>
          <a href="${link}" style="display:inline-block;background:#c8a84b;color:#1e3028;font-weight:700;padding:12px 28px;border-radius:8px;text-decoration:none;margin:16px 0">
            Verify Email
          </a>
          <p style="color:#888;font-size:12px">If you didn't create an account, you can ignore this email.</p>
        </div>
      `,
    });
  } catch (e) {
    console.error('Email send failed:', e.message);
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

// Google Sign-In (verifies credential token from GSI client)
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
    if (user && !user.emailVerified && email_verified) {
      user = await prisma.user.update({ where: { id: user.id }, data: { emailVerified: true } });
    } else if (!user) {
      const byEmail = await prisma.user.findUnique({ where: { email } });
      if (byEmail) {
        user = await prisma.user.update({
          where: { id: byEmail.id },
          data: { googleId, emailVerified: byEmail.emailVerified || !!email_verified },
        });
      } else {
        user = await prisma.user.create({
          data: { email, name, googleId, emailVerified: !!email_verified },
        });
      }
    }
    res.json({ token: makeToken(user), user: safeUser(user) });
  } catch (e) {
    console.error(e);
    res.status(400).json({ error: 'Invalid Google credential' });
  }
});

// Verify email via link
router.get('/verify-email', async (req, res) => {
  const { token } = req.query;
  if (!token) return res.status(400).send('Missing token');
  try {
    const user = await prisma.user.findUnique({ where: { emailVerifyToken: token } });
    if (!user) return res.redirect((process.env.APP_URL || '') + '/#verified=fail');
    await prisma.user.update({
      where: { id: user.id },
      data: { emailVerified: true, emailVerifyToken: null },
    });
    res.redirect((process.env.APP_URL || '') + '/#verified=1');
  } catch (e) {
    console.error(e);
    res.status(500).send('Server error');
  }
});

// Resend verification email
router.post('/resend-verify', require('../middleware/requireAuth'), async (req, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (user.emailVerified) return res.json({ ok: true, already: true });
    if (!user.passwordHash) return res.json({ ok: true, googleOnly: true }); // Google users auto-verified

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
