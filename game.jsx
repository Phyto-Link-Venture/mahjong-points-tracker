// Game screen: scoreboard + round counter + bottom nav
const { useState: useStateGS } = React;

function Game({ t, settings, players, rounds, onAddRound, onShowReview, onShowExport, onShowSettings, onNewSession, onLangToggle, lang }) {
  const N = settings.mode;
  const totals = MJ.computeTotals(rounds, settings);
  const seatLabels = N === 3 ? [t.east, t.south, t.west] : [t.east, t.south, t.west, t.north];
  const nextRoundIdx = rounds.length + 1;
  const dealerIdx = MJ.dealerForRound(nextRoundIdx, N);

  return (
    <div>
      <div className="round-counter">
        <div>
          <div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{t.round}</div>
          <div className="num">#{nextRoundIdx}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{t.dealer}</div>
          <div style={{ color: 'var(--gold)', fontFamily: 'var(--serif)', fontSize: 18 }}>
            {players[dealerIdx]} <span style={{ fontSize: 12, opacity: 0.7 }}>({seatLabels[dealerIdx]})</span>
          </div>
        </div>
      </div>

      <div className={"scoreboard n" + N}>
        {players.map((p, i) => {
          const v = totals[i];
          const cls = v > 0 ? 'pos' : v < 0 ? 'neg' : '';
          return (
            <div key={i} className={"player-tile " + (i === dealerIdx ? 'dealer' : '')}>
              {i === dealerIdx && <span className="pdealer-pin">{t.dealer}</span>}
              <div className="seat">{seatLabels[i]}</div>
              <div className="pname">{p}</div>
              <div className={"ptotal " + cls}>{v > 0 ? '+' : ''}{v}</div>
            </div>
          );
        })}
      </div>

      {rounds.length === 0 ? (
        <div className="empty-state">
          <div className="icon">麻</div>
          <div>{t.noRoundsYet}</div>
          <div style={{ fontSize: 12, marginTop: 6, opacity: 0.7 }}>{t.noRoundsHint}</div>
        </div>
      ) : (
        <div>
          <div className="section-title">{t.review}</div>
          {rounds.slice(-3).reverse().map((r, idx) => {
            const realIdx = rounds.length - 1 - idx;
            const dIdx = MJ.dealerForRound(realIdx + 1, N);
            const deltas = MJ.computeDeltas(r, settings, dIdx);
            return (
              <div key={r.id} className="round-card">
                <div className="round-card-head">
                  <div className="num">#{realIdx + 1}</div>
                  <div className="summary">{summarize(r, players, t)}</div>
                </div>
                <div className="round-card-deltas">
                  {players.map((p, i) => {
                    const v = deltas[i];
                    const cls = v > 0 ? 'delta-pos' : v < 0 ? 'delta-neg' : 'delta-zero';
                    return (
                      <span key={i} className="delta-chip">
                        <span className="name">{p}</span>
                        <span className={cls}>{v > 0 ? '+' : ''}{v}</span>
                      </span>
                    );
                  })}
                </div>
              </div>
            );
          })}
          {rounds.length > 3 && (
            <button className="btn btn-ghost btn-block" onClick={onShowReview} style={{ marginTop: 4 }}>
              {t.review} ({rounds.length}) →
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function summarize(r, players, t) {
  if (r.outcome === 'draw') return t.drawAll;
  if (r.outcome === 'penalty') return `${t.penaltyOn}: ${players[r.penaltyIdx]}`;
  if (r.outcome === 'self') return `${players[r.winnerIdx]} · ${t.selfDraw} · ${r.fan}${t.fanShort}`;
  if (r.outcome === 'discard') return `${players[r.winnerIdx]} ← ${players[r.discarderIdx]} · ${r.fan}${t.fanShort}`;
  return '';
}

window.Game = Game;
window.summarizeRound = summarize;
