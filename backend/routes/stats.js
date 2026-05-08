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

  // Head-to-head: for each pair (A,B), count wins when both in same session
  const h2h = {}; // h2h[A][B] = { sessions, aWins, bWins }
  for (const session of sessions) {
    const players = session.players;
    const rounds = session.rounds;
    const winsByIdx = {};
    for (const r of rounds) {
      if ((r.outcome === 'self' || r.outcome === 'discard') && r.winnerIdx != null)
        winsByIdx[r.winnerIdx] = (winsByIdx[r.winnerIdx] || 0) + 1;
    }
    for (let a = 0; a < players.length; a++) {
      for (let b = a + 1; b < players.length; b++) {
        const na = players[a], nb = players[b];
        if (!h2h[na]) h2h[na] = {};
        if (!h2h[nb]) h2h[nb] = {};
        if (!h2h[na][nb]) h2h[na][nb] = { sessions: 0, aWins: 0, bWins: 0 };
        if (!h2h[nb][na]) h2h[nb][na] = { sessions: 0, aWins: 0, bWins: 0 };
        h2h[na][nb].sessions++;
        h2h[na][nb].aWins += winsByIdx[a] || 0;
        h2h[na][nb].bWins += winsByIdx[b] || 0;
        h2h[nb][na].sessions++;
        h2h[nb][na].aWins += winsByIdx[b] || 0;
        h2h[nb][na].bWins += winsByIdx[a] || 0;
      }
    }
  }

  const stats = Object.values(map).map(s => ({
    ...s,
    winRate: s.decidedRounds > 0 ? +(s.wins / s.decidedRounds * 100).toFixed(1) : 0,
    avgFan: s.wins > 0 ? +(s.totalFan / s.wins).toFixed(1) : 0,
    recentForm: playerSessions[s.name] || [],
    h2h: h2h[s.name] || {},
  })).sort((a, b) => b.winRate - a.winRate || b.wins - a.wins);

  res.json({ stats, sessionCount: sessions.length });
});

module.exports = router;
