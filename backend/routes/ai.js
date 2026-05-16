const router = require('express').Router();
const requireAuth = require('../middleware/requireAuth');

const OLLAMA_HOST = process.env.OLLAMA_HOST || 'http://mahjong-ollama:11434';
const MODEL = process.env.OLLAMA_MODEL || 'qwen2.5:1.5b';

const SEAT_LABELS = {
  3: ['East', 'South', 'West'],
  4: ['East', 'South', 'West', 'North'],
};

router.post('/parse-round', requireAuth, async (req, res) => {
  const { transcript, players, mode } = req.body;
  if (!transcript || !players || !mode) {
    return res.status(400).json({ error: 'Missing fields' });
  }

  const seats = SEAT_LABELS[mode] || SEAT_LABELS[4];
  const playerList = players.map((p, i) => `  ${i}: ${p} (${seats[i]})`).join('\n');
  const bonusNote = mode === 3
    ? 'flowers (花), flies (苍蝇), openKongs (明杠), closedKongs (暗杠)'
    : 'flowers (花), openKongs (明杠), closedKongs (暗杠)';

  const defaultBonuses = players
    .map((_, i) => `{"playerIdx":${i},"flowers":0,"flies":0,"openKongs":0,"closedKongs":0}`)
    .join(',');

  const prompt = `You are a mahjong scorekeeper. Parse this voice transcript into structured data.

Players:
${playerList}

Transcript: "${transcript}"

Definitions:
- "fan" or "fans" = the SCORE/POINTS of the winning hand (a number like 5, 8, 10). NOT a flower tile.
- "flower" or "flowers" = flower bonus tiles (separate from fan score)
- "open kong" / "明杠" = exposed kong bonus
- "closed kong" / "暗杠" = concealed kong bonus
- "fly" / "flies" / "苍蝇" = fly bonus (3-player only)

Extract:
- winnerIdx: index of the winning player (null if unclear)
- fan: the score in fan points, integer 1–${mode === 3 ? 10 : 13} (null if unclear)
- outcome: "self" for self-draw/tsumo/zimo/自摸, "discard" for discard/食/ron/oleh (null if unclear)
- discarderIdx: who discarded the winning tile, null unless outcome is "discard"
- bonuses: flower/kong/fly counts for each player (default 0, set only what is explicitly mentioned)
- "she"/"he" refers to the most recently named player

Return ONLY this JSON, no extra text:
{"winnerIdx":null,"fan":null,"outcome":null,"discarderIdx":null,"bonuses":[${defaultBonuses}]}`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60000);

    const r = await fetch(`${OLLAMA_HOST}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: MODEL, prompt, stream: false, format: 'json' }),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!r.ok) return res.status(503).json({ error: 'Ollama unavailable' });

    const data = await r.json();
    const parsed = JSON.parse(data.response);

    // Validate and sanitise
    const safe = {
      winnerIdx: Number.isInteger(parsed.winnerIdx) && parsed.winnerIdx >= 0 && parsed.winnerIdx < players.length
        ? parsed.winnerIdx : null,
      fan: Number.isInteger(parsed.fan) && parsed.fan >= 1 ? parsed.fan : null,
      outcome: ['self', 'discard'].includes(parsed.outcome) ? parsed.outcome : null,
      discarderIdx: Number.isInteger(parsed.discarderIdx) && parsed.discarderIdx >= 0 && parsed.discarderIdx < players.length
        ? parsed.discarderIdx : null,
      bonuses: players.map((_, i) => {
        const b = (parsed.bonuses || []).find(x => x.playerIdx === i) || {};
        return {
          playerIdx: i,
          flowers: Math.max(0, parseInt(b.flowers) || 0),
          flies: Math.max(0, parseInt(b.flies) || 0),
          openKongs: Math.max(0, parseInt(b.openKongs) || 0),
          closedKongs: Math.max(0, parseInt(b.closedKongs) || 0),
        };
      }),
    };

    res.json({ parsed: safe });
  } catch (e) {
    console.error('[ai] parse-round error:', e.message);
    res.status(503).json({ error: 'AI unavailable: ' + e.message });
  }
});

// Health check — tells frontend if Ollama + model are ready
router.get('/status', async (req, res) => {
  try {
    const r = await fetch(`${OLLAMA_HOST}/api/tags`, { signal: AbortSignal.timeout(3000) });
    if (!r.ok) return res.json({ ready: false });
    const data = await r.json();
    const modelReady = (data.models || []).some(m => m.name.startsWith(MODEL.split(':')[0]));
    res.json({ ready: modelReady, model: MODEL });
  } catch {
    res.json({ ready: false });
  }
});

module.exports = router;
