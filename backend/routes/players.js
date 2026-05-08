const router = require('express').Router();
const { PrismaClient } = require('@prisma/client');
const requireAuth = require('../middleware/requireAuth');

const prisma = new PrismaClient();

// Rename a player name across all user sessions
router.post('/rename', requireAuth, async (req, res) => {
  const { from, to } = req.body;
  if (!from || !to || typeof from !== 'string' || typeof to !== 'string') {
    return res.status(400).json({ error: 'from and to are required strings' });
  }
  const fromTrimmed = from.trim();
  const toTrimmed = to.trim();
  if (!fromTrimmed || !toTrimmed) return res.status(400).json({ error: 'Names cannot be empty' });
  if (fromTrimmed === toTrimmed) return res.status(400).json({ error: 'Names are the same' });

  try {
    const sessions = await prisma.gameSession.findMany({
      where: { userId: req.user.id },
      select: { id: true, players: true },
    });

    let updated = 0;
    for (const session of sessions) {
      const players = session.players;
      if (!Array.isArray(players) || !players.includes(fromTrimmed)) continue;
      const newPlayers = players.map(p => p === fromTrimmed ? toTrimmed : p);
      await prisma.gameSession.update({
        where: { id: session.id },
        data: { players: newPlayers },
      });
      updated++;
    }

    res.json({ ok: true, updated });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  }
});

// List all unique player names for the user
router.get('/', requireAuth, async (req, res) => {
  try {
    const sessions = await prisma.gameSession.findMany({
      where: { userId: req.user.id },
      select: { players: true },
    });
    const nameSet = new Set();
    for (const s of sessions) {
      if (Array.isArray(s.players)) s.players.forEach(p => nameSet.add(p));
    }
    res.json({ players: Array.from(nameSet).sort() });
  } catch (e) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
