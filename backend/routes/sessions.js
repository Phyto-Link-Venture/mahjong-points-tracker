const router = require('express').Router();
const { PrismaClient } = require('@prisma/client');
const requireAuth = require('../middleware/requireAuth');

const prisma = new PrismaClient();

// Sync (create or update) a session
router.post('/', requireAuth, async (req, res) => {
  const { id, mode, settings, players, rounds, startedAt } = req.body;
  try {
    let session;
    if (id) {
      const existing = await prisma.gameSession.findFirst({ where: { id, userId: req.user.id } });
      if (existing) {
        session = await prisma.gameSession.update({
          where: { id },
          data: { mode, settings, players, rounds, syncedAt: new Date() },
        });
      } else {
        session = await prisma.gameSession.create({
          data: { id, userId: req.user.id, mode, settings, players, rounds, startedAt: startedAt ? new Date(startedAt) : new Date() },
        });
      }
    } else {
      session = await prisma.gameSession.create({
        data: { userId: req.user.id, mode, settings, players, rounds, startedAt: startedAt ? new Date(startedAt) : new Date() },
      });
    }
    res.json({ session: { id: session.id, syncedAt: session.syncedAt } });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  }
});

// List sessions (summary only)
router.get('/', requireAuth, async (req, res) => {
  const sessions = await prisma.gameSession.findMany({
    where: { userId: req.user.id },
    orderBy: { startedAt: 'desc' },
    take: 100,
    select: { id: true, mode: true, players: true, rounds: true, settings: true, startedAt: true, syncedAt: true },
  });
  res.json({ sessions });
});

// Get single session (full detail)
router.get('/:id', requireAuth, async (req, res) => {
  const session = await prisma.gameSession.findFirst({
    where: { id: req.params.id, userId: req.user.id },
  });
  if (!session) return res.status(404).json({ error: 'Not found' });
  res.json({ session });
});

// Delete a session
router.delete('/:id', requireAuth, async (req, res) => {
  await prisma.gameSession.deleteMany({ where: { id: req.params.id, userId: req.user.id } });
  res.json({ ok: true });
});

function generateWatchCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; // no I, O to avoid confusion
  let code = '';
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

// Toggle sharing on a session
router.patch('/:id/share', requireAuth, async (req, res) => {
  const { shared } = req.body;
  try {
    const session = await prisma.gameSession.findFirst({ where: { id: req.params.id, userId: req.user.id } });
    if (!session) return res.status(404).json({ error: 'Not found' });
    const existing = session.settings || {};
    const watchCode = (shared && !existing.watchCode) ? generateWatchCode() : (existing.watchCode || null);
    const updatedSettings = { ...existing, shared: !!shared, ...(watchCode ? { watchCode } : {}) };
    await prisma.gameSession.update({ where: { id: req.params.id }, data: { settings: updatedSettings } });
    res.json({ ok: true, shared: !!shared, watchCode: watchCode || null });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
