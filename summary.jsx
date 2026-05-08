// End-game summary sheet
const { useState: useStateSumm } = React;

function SummarySheet({ t, settings, players, rounds, onRematch, onClose }) {
  const N = settings.mode;
  const totals = MJ.computeTotals(rounds, settings);
  const colors = settings.playerColors || MJ.PLAYER_COLORS.slice(0, N);
  const pointValue = settings.pointValue ?? 0.10;
  const txns = MJ.calcSettlement(totals, pointValue);
  const currency = t.settlementCurrency;

  // Ranked order
  const ranked = totals
    .map((v, i) => ({ i, v, name: players[i], color: colors[i] }))
    .sort((a, b) => b.v - a.v);

  // Per-player stats
  function playerStats(idx) {
    const decided = rounds.filter(r => r.outcome === 'self' || r.outcome === 'discard');
    const wins = decided.filter(r => r.winnerIdx === idx);
    const maxFan = wins.length ? Math.max(...wins.map(r => r.fan || 0)) : 0;
    const avgFan = wins.length ? (wins.reduce((s, r) => s + (r.fan || 0), 0) / wins.length).toFixed(1) : '-';
    return { wins: wins.length, maxFan, avgFan };
  }

  const medals = ['🥇', '🥈', '🥉'];

  return (
    <div className="sheet-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="sheet" onClick={e => e.stopPropagation()}>
        <div className="sheet-header">
          <h2>{t.summaryTitle}</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>
        <div className="sheet-body">

          {/* Podium */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 20, alignItems: 'flex-end' }}>
            {ranked.map((p, rank) => {
              const stats = playerStats(p.i);
              const cash = Math.round(p.v * pointValue * 100) / 100;
              return (
                <div key={p.i} style={{
                  flex: 1, background: 'var(--felt-2)', borderRadius: 12,
                  padding: '12px 8px', textAlign: 'center',
                  border: `1px solid ${rank === 0 ? p.color : 'var(--felt-line)'}`,
                  boxShadow: rank === 0 ? `0 0 16px ${p.color}30` : 'none',
                  order: rank === 1 ? -1 : rank === 2 ? 1 : 0,
                  marginBottom: rank === 0 ? 0 : rank === 1 ? 0 : 8,
                }}>
                  <div style={{ fontSize: rank === 0 ? 28 : 20, marginBottom: 4 }}>{medals[rank] || ''}</div>
                  <div style={{ width: 28, height: 28, borderRadius: '50%', background: p.color, margin: '0 auto 6px' }} />
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--cream)', marginBottom: 4,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</div>
                  <div style={{
                    fontFamily: 'var(--mono)', fontSize: rank === 0 ? 22 : 18, fontWeight: 700,
                    color: p.v > 0 ? 'var(--green-pos)' : p.v < 0 ? 'var(--red)' : 'var(--muted)',
                  }}>{p.v > 0 ? '+' : ''}{p.v}</div>
                  <div style={{ fontSize: 10, color: cash > 0 ? 'var(--green-pos)' : cash < 0 ? 'var(--red)' : 'var(--muted)',
                    fontFamily: 'var(--mono)', marginTop: 2 }}>
                    {cash > 0 ? '+' : ''}{currency}{Math.abs(cash).toFixed(2)}
                  </div>
                  <div style={{ marginTop: 8, display: 'flex', gap: 4, justifyContent: 'center' }}>
                    <span style={{ fontSize: 9, background: 'rgba(255,255,255,0.06)', borderRadius: 6, padding: '2px 5px', color: 'var(--muted)' }}>
                      {stats.wins}W
                    </span>
                    {stats.maxFan > 0 && (
                      <span style={{ fontSize: 9, background: 'rgba(200,168,75,0.1)', borderRadius: 6, padding: '2px 5px', color: 'var(--gold)' }}>
                        {t.summaryBest} {stats.maxFan}{t.fanShort}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Settlement */}
          {txns.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <div className="section-title">{t.settlementTitle}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {txns.map((tx, idx) => (
                  <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 10,
                    background: 'var(--felt-2)', borderRadius: 10, padding: '10px 14px' }}>
                    <div style={{ width: 10, height: 10, borderRadius: '50%', background: colors[tx.from], flexShrink: 0 }} />
                    <span style={{ fontWeight: 600, color: 'var(--red)', fontSize: 13 }}>{players[tx.from]}</span>
                    <span style={{ color: 'var(--muted)', fontSize: 12 }}>{t.settlementPays}</span>
                    <div style={{ width: 10, height: 10, borderRadius: '50%', background: colors[tx.to], flexShrink: 0 }} />
                    <span style={{ fontWeight: 600, color: 'var(--green-pos)', fontSize: 13 }}>{players[tx.to]}</span>
                    <span style={{ fontFamily: 'var(--mono)', fontWeight: 700, fontSize: 16, color: 'var(--gold)', marginLeft: 'auto' }}>
                      {currency} {tx.amount.toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {txns.length === 0 && (
            <div style={{ textAlign: 'center', color: 'var(--gold)', fontSize: 14, padding: '12px 0 20px', fontFamily: 'var(--serif)' }}>
              {t.settlementAllSquare}
            </div>
          )}

          {/* Session info */}
          <div style={{ textAlign: 'center', fontSize: 11, color: 'var(--muted)', marginBottom: 20 }}>
            {rounds.length} {t.historyRounds} · {new Date().toLocaleString()}
          </div>

          {/* Action buttons */}
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn btn-secondary btn-block" onClick={onClose}>{t.summaryKeepViewing}</button>
            <button className="btn btn-primary btn-block" onClick={onRematch}>🔄 {t.summaryRematch}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

window.SummarySheet = SummarySheet;
