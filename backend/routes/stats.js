const router = require('express').Router();
const { PrismaClient } = require('@prisma/client');
const requireAuth = require('../middleware/requireAuth');

const prisma = new PrismaClient();

router.get('/', requireAuth, async (req, res) => {
  const sessions = await prisma.gameSession.findMany({
    where: { userId: req.user.id },
    select: { mode: true, players: true, rounds: true, settings: true },
  });

  const map = {};

  function init(name) {
    if (!map[name]) map[name] = {
      name,
      gamesPlayed: 0,
      totalRounds: 0,
      decidedRounds: 0,
      wins: 0,
      selfDrawWins: 0,
      discardWins: 0,
      totalFan: 0,
      limitHands: 0,
    };
  }

  for (const session of sessions) {
    const players = session.players;
    const rounds = session.rounds;
    const maxFan = session.settings?.maxFan ?? 10;

    for (const name of players) {
      init(name);
      map[name].gamesPlayed++;
    }

    for (const round of rounds) {
      const decided = round.outcome === 'self' || round.outcome === 'discard';
      for (let pi = 0; pi < players.length; pi++) {
        const name = players[pi];
        map[name].totalRounds++;
        if (decided) map[name].decidedRounds++;
        if (decided && round.winnerIdx === pi) {
          map[name].wins++;
          if (round.outcome === 'self') map[name].selfDrawWins++;
          if (round.outcome === 'discard') map[name].discardWins++;
          map[name].totalFan += round.fan || 0;
          if ((round.fan || 0) >= maxFan) map[name].limitHands++;
        }
      }
    }
  }

  const stats = Object.values(map).map(s => ({
    ...s,
    winRate: s.decidedRounds > 0 ? +(s.wins / s.decidedRounds * 100).toFixed(1) : 0,
    avgFan: s.wins > 0 ? +(s.totalFan / s.wins).toFixed(1) : 0,
  })).sort((a, b) => b.winRate - a.winRate || b.wins - a.wins);

  res.json({ stats, sessionCount: sessions.length });
});

module.exports = router;
