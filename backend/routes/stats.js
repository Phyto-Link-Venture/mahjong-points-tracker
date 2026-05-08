const router = require('express').Router();
const { PrismaClient } = require('@prisma/client');
const requireAuth = require('../middleware/requireAuth');

const prisma = new PrismaClient();

router.get('/', requireAuth, async (req, res) => {
  const sessions = await prisma.gameSession.findMany({
    where: { userId: req.user.id },
    select: { mode: true, players: true, rounds: true, settings: true, startedAt: true },
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

  // Build per-player recent sessions list (sorted by startedAt desc)
  const playerSessions = {}; // name -> [{startedAt, won}]
  for (const session of sessions.sort((a, b) => new Date(b.startedAt || 0) - new Date(a.startedAt || 0))) {
    const players = session.players;
    const rounds = session.rounds;
    for (let pi = 0; pi < players.length; pi++) {
      const name = players[pi];
      if (!playerSessions[name]) playerSessions[name] = [];
      if (playerSessions[name].length >= 5) continue;
      // Count wins for this player in this session
      const wins = rounds.filter(r => (r.outcome === 'self' || r.outcome === 'discard') && r.winnerIdx === pi).length;
      const losses = rounds.filter(r => (r.outcome === 'self' || r.outcome === 'discard') && r.winnerIdx !== pi).length;
      playerSessions[name].push(wins > losses ? 'W' : wins < losses ? 'L' : 'D');
    }
  }

  const stats = Object.values(map).map(s => ({
    ...s,
    winRate: s.decidedRounds > 0 ? +(s.wins / s.decidedRounds * 100).toFixed(1) : 0,
    avgFan: s.wins > 0 ? +(s.totalFan / s.wins).toFixed(1) : 0,
    recentForm: playerSessions[s.name] || [],
  })).sort((a, b) => b.winRate - a.winRate || b.wins - a.wins);

  res.json({ stats, sessionCount: sessions.length });
});

module.exports = router;
