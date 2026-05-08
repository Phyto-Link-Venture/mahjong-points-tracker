const router = require('express').Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// In-memory emoji reactions (ephemeral — expire after 10s)
const reactionStore = {}; // sessionId -> [{emoji, ts}]

router.post('/:id/react', async (req, res) => {
  const { emoji } = req.body;
  if (!emoji) return res.status(400).json({ error: 'emoji required' });
  const id = req.params.id;
  if (!reactionStore[id]) reactionStore[id] = [];
  reactionStore[id].push({ emoji, ts: Date.now() });
  // Keep only last 30 reactions
  if (reactionStore[id].length > 30) reactionStore[id] = reactionStore[id].slice(-30);
  res.json({ ok: true });
});

// Look up session by short watch code
router.get('/code/:code', async (req, res) => {
  const code = req.params.code.toUpperCase().replace(/[^A-Z]/g, '');
  if (code.length !== 6) return res.status(400).json({ error: 'Invalid code' });
  try {
    const sessions = await prisma.gameSession.findMany({
      where: { settings: { path: ['watchCode'], equals: code } },
    });
    const session = sessions.find(s => s.settings?.shared && s.settings?.watchCode === code);
    if (!session) return res.status(404).json({ error: 'Code not found' });
    res.json({
      session: {
        id: session.id, mode: session.mode, players: session.players,
        rounds: session.rounds, settings: session.settings, startedAt: session.startedAt,
      }
    });
  } catch (e) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Public watch endpoint — returns session if settings.shared === true
router.get('/:id', async (req, res) => {
  try {
    const session = await prisma.gameSession.findFirst({ where: { id: req.params.id } });
    if (!session) return res.status(404).json({ error: 'Not found' });
    if (!session.settings?.shared) return res.status(403).json({ error: 'Not shared' });
    // Include recent reactions (last 10s)
    const now = Date.now();
    const reactions = (reactionStore[session.id] || []).filter(r => now - r.ts < 10000);
    res.json({
      session: {
        id: session.id,
        mode: session.mode,
        players: session.players,
        rounds: session.rounds,
        settings: session.settings,
        startedAt: session.startedAt,
        syncedAt: session.syncedAt,
      },
      reactions,
    });
  } catch (e) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
