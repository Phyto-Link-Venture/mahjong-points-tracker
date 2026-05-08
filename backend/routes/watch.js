const router = require('express').Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Public watch endpoint — returns session if settings.shared === true
router.get('/:id', async (req, res) => {
  try {
    const session = await prisma.gameSession.findFirst({ where: { id: req.params.id } });
    if (!session) return res.status(404).json({ error: 'Not found' });
    if (!session.settings?.shared) return res.status(403).json({ error: 'Not shared' });
    res.json({
      session: {
        id: session.id,
        mode: session.mode,
        players: session.players,
        rounds: session.rounds,
        settings: session.settings,
        startedAt: session.startedAt,
        syncedAt: session.syncedAt,
      }
    });
  } catch (e) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
