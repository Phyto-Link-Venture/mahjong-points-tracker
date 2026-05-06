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
    select: { id: true, mode: true, players: true, startedAt: true, syncedAt: true },
  });
  res.json({ sessions });
});

// Delete a session
router.delete('/:id', requireAuth, async (req, res) => {
  await prisma.gameSession.deleteMany({ where: { id: req.params.id, userId: req.user.id } });
  res.json({ ok: true });
});

module.exports = router;
