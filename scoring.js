// Scoring engine for Malaysian Mahjong (3P + 4P)
// Computes per-player point deltas for a round.
//
// A round = {
//   id, ts,
//   outcome: 'self' | 'discard' | 'draw' | 'penalty',
//   winnerIdx: number | null,
//   discarderIdx: number | null,
//   loserFans: { [idx]: number }   // for pairwise rule (detailed mode)
//   fan: number,                    // winner's fan
//   bonuses: [ {
//     flowers, flies,
//     openKongs,            // pong→kong, each other pays kongOpenPts
//     fedKongs,             // exposed kong completed by a feeder's discard
//     fedKongFeeder,        // idx of feeder (pays kongOpenPts*2); others pay kongOpenPts
//     closedKongs,          // concealed kong, each other pays kongClosedPts
//   } ]
//   penaltyIdx, penaltyPoints,
//   simple: { winnerPays?: { [idx]: pts } } // simple mode override
//   notes
// }
//
// Settings = {
//   mode: 3 | 4,
//   minFan, maxFan,
//   basePoint,             // points per fan
//   dealerDouble: bool,
//   pairwiseLoser: bool,
//   kongOpenPts, kongClosedPts,
//   flowerPts, flyPts,
// }

window.MJ = (function () {
  function effectiveFan(fan, settings) {
    return Math.min(Math.max(0, fan), settings.maxFan);
  }

  // Hand-points for a given fan count
  function fanToPoints(fan, settings) {
    const f = effectiveFan(fan, settings);
    return f * settings.basePoint;
  }

  // Returns deltas array (length = mode players)
  function computeDeltas(round, settings, dealerIdx) {
    const N = settings.mode;
    const deltas = new Array(N).fill(0);

    if (round.outcome === 'draw') {
      // Bonus tiles still settle on a draw (flies, kongs, flowers — these are
      // in-game value that already happened regardless of who won).
      applyBonuses(deltas, round, settings, N);
      return deltas;
    }

    if (round.outcome === 'penalty') {
      // penaltyIdx pays each other player penaltyPoints
      const pIdx = round.penaltyIdx;
      const pts = round.penaltyPoints || 0;
      if (pIdx == null) return deltas;
      for (let i = 0; i < N; i++) {
        if (i === pIdx) continue;
        deltas[pIdx] -= pts;
        deltas[i] += pts;
      }
      return deltas;
    }

    // Win
    const w = round.winnerIdx;
    if (w == null) return deltas;

    if (round.simpleMode && round.simple) {
      // Simple mode: directly use winnerPays values
      const wp = round.simple.winnerPays || {};
      for (let i = 0; i < N; i++) {
        if (i === w) continue;
        const v = Number(wp[i] || 0);
        deltas[i] -= v;
        deltas[w] += v;
      }
      return deltas;
    }

    // Detailed (fan-based)
    let basePts = fanToPoints(round.fan, settings);
    if (settings.dealerDouble && w === dealerIdx) basePts *= 2;
    // Limit hand (winner reached maxFan) → payout doubles
    const isLimit = Number(round.fan) >= settings.maxFan;
    if (isLimit) basePts *= 2;

    if (round.outcome === 'self') {
      // All others pay basePts (some rules pay double on self-draw; we treat basePts as final per loser)
      for (let i = 0; i < N; i++) {
        if (i === w) continue;
        deltas[i] -= basePts;
        deltas[w] += basePts;
      }
    } else if (round.outcome === 'discard') {
      const d = round.discarderIdx;
      // Discarder share rules (basePts = points-per-loser baseline):
      //  - 'standard'      : discarder 2× · others 1× each
      //                       (4P total to winner = 2+1+1 = 4×; 3P = 2+1 = 3×)
      //  - 'helper'        : discarder 1.5× · each other loser 0.5×
      //                       (4P total = 2.5×; 3P = 2×)
      //  - 'shooter_solo'  : discarder pays alone, equal to standard discarder share
      //                       (3× in 4P / 2× in 3P) · others 0
      //  - 'shooter_full'  : discarder absorbs everything (full standard total alone)
      //                       (4P = 4× alone; 3P = 3× alone)
      const share = settings.discardShare || 'standard';
      const others = N - 1;
      for (let i = 0; i < N; i++) {
        if (i === w) continue;
        let pay;
        if (share === 'shooter_full') {
          const fullTotal = (others + 1) * basePts;
          pay = (i === d) ? fullTotal : 0;
        } else if (share === 'shooter_solo') {
          // Discarder pays alone; others pay 0
          // 4P: 3× basePts; 3P: 1.5× basePts
          const soloTotal = (N === 3 ? 1.5 : 3) * basePts;
          pay = (i === d) ? soloTotal : 0;
        } else if (share === 'helper') {
          pay = (i === d) ? basePts * 1.5 : basePts * 0.5;
        } else {
          pay = (i === d) ? basePts * 2 : basePts;
        }
        deltas[i] -= pay;
        deltas[w] += pay;
      }
    }

    // Pairwise loser fan compare (detailed only)
    // Rules:
    //  - At least ONE of the two losers must meet minFan for the compare to happen
    //    (if both fall short, neither owes the other — both are "non-paying")
    //  - Limit hand (winner at maxFan) skips pairwise — already getting double payout
    const winnerFan = Number(round.fan);
    if (settings.pairwiseLoser && round.loserFans && winnerFan < settings.maxFan) {
      const losers = [];
      for (let i = 0; i < N; i++) if (i !== w) losers.push(i);
      for (let a = 0; a < losers.length; a++) {
        for (let b = a + 1; b < losers.length; b++) {
          const i = losers[a], j = losers[b];
          const rawI = round.loserFans[i] || 0;
          const rawJ = round.loserFans[j] || 0;
          // Need at least one qualifying loser
          if (rawI < settings.minFan && rawJ < settings.minFan) continue;
          const fi = effectiveFan(rawI, settings);
          const fj = effectiveFan(rawJ, settings);
          if (fi === fj) continue;
          const diffPts = Math.abs(fi - fj) * settings.basePoint;
          if (fi > fj) { deltas[j] -= diffPts; deltas[i] += diffPts; }
          else        { deltas[i] -= diffPts; deltas[j] += diffPts; }
        }
      }
    }

    // Bonus payouts
    applyBonuses(deltas, round, settings, N);

    return deltas;
  }

  // Bonus tile payouts (extracted so draws can use them too)
  // flowers + flies + open kongs + closed kongs (flat, paid by every other player)
  // Fed kongs: feeder pays 2× kongOpenPts, every OTHER non-kong-holder pays 1× kongOpenPts.
  function applyBonuses(deltas, round, settings, N) {
    if (!round.bonuses) return;
    for (let i = 0; i < N; i++) {
      const b = round.bonuses[i] || {};
      const flatPts =
        (b.flowers || 0) * settings.flowerPts +
        (b.flies || 0) * settings.flyPts +
        (b.openKongs || 0) * settings.kongOpenPts +
        (b.closedKongs || 0) * settings.kongClosedPts;
      if (flatPts > 0) {
        for (let j = 0; j < N; j++) {
          if (j === i) continue;
          deltas[i] += flatPts;
          deltas[j] -= flatPts;
        }
      }
      const fedCount = b.fedKongs || 0;
      const feeder = b.fedKongFeeder;
      if (fedCount > 0 && feeder != null && feeder !== i) {
        // Feeder pays 2× kongOpenPts per fed kong; other players pay nothing
        const pay = 2 * settings.kongOpenPts * fedCount;
        deltas[i] += pay;
        deltas[feeder] -= pay;
      }
    }
  }

  // Dealer rotates each round, starting with index 0 = East
  // In Malaysian, dealership changes every hand regardless.
  function dealerForRound(roundNumber, mode) {
    return ((roundNumber - 1) % mode + mode) % mode;
  }

  function computeTotals(rounds, settings) {
    const N = settings.mode;
    const totals = new Array(N).fill(0);
    rounds.forEach((r, idx) => {
      const dealerIdx = dealerForRound(idx + 1, N);
      const d = computeDeltas(r, settings, dealerIdx);
      for (let i = 0; i < N; i++) totals[i] += d[i];
    });
    return totals;
  }

  return { computeDeltas, computeTotals, dealerForRound, fanToPoints, effectiveFan };
})();
