// Cash settlement sheet
const { useState: useStateSett, useCallback: useCallbackSett } = React;

function SettlementSheet({ t, players, rounds, settings, onClose }) {
  const totals = MJ.computeTotals(rounds, settings);
  const [pointValue, setPointValue] = useStateSett(settings.pointValue ?? 0.10);
  const [toast, setToast] = useStateSett(null);

  const txns = MJ.calcSettlement(totals, pointValue);
  const currency = t.settlementCurrency;

  function fmt(n) {
    return currency + ' ' + n.toFixed(2);
  }

  return (
    <div className="sheet-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="sheet" onClick={e => e.stopPropagation()}>
        <div className="sheet-header">
          <h2>{t.settlementTitle}</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>
        <div className="sheet-body">

          {/* Point value input */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20, padding: '12px 16px', background: 'rgba(0,0,0,0.2)', borderRadius: 10, border: '1px solid var(--felt-line)' }}>
            <span style={{ fontSize: 13, color: 'var(--cream-dim)', flex: 1 }}>{t.settlementPointValue}</span>
            <input
              className="num-input"
              type="number"
              value={pointValue}
              onChange={e => setPointValue(Number(e.target.value) || 0)}
              min="0" step="0.01"
              style={{ width: 80 }}
            />
            <span style={{ fontSize: 13, color: 'var(--muted)' }}>{currency}</span>
          </div>

          {/* Score summary */}
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${settings.mode}, 1fr)`, gap: 8, marginBottom: 20 }}>
            {players.map((p, i) => {
              const pts = totals[i];
              const cash = Math.round(pts * pointValue * 100) / 100;
              return (
                <div key={i} style={{ background: 'var(--felt-2)', borderRadius: 10, padding: '10px 8px', textAlign: 'center' }}>
                  <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p}</div>
                  <div style={{ fontFamily: 'var(--mono)', fontWeight: 700, fontSize: 15, color: pts > 0 ? 'var(--green-pos)' : pts < 0 ? 'var(--red)' : 'var(--muted)' }}>
                    {pts > 0 ? '+' : ''}{pts}
                  </div>
                  <div style={{ fontSize: 11, marginTop: 2, color: cash > 0 ? 'var(--green-pos)' : cash < 0 ? 'var(--red)' : 'var(--muted)', fontFamily: 'var(--mono)' }}>
                    {cash > 0 ? '+' : ''}{currency}{Math.abs(cash).toFixed(2)}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Transactions */}
          <div className="section-title">{t.settlementTitle}</div>
          {txns.length === 0 ? (
            <div style={{ textAlign: 'center', color: 'var(--gold)', fontSize: 14, padding: '20px 0', fontFamily: 'var(--serif)' }}>
              {t.settlementAllSquare}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {txns.map((tx, idx) => (
                <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'var(--felt-2)', borderRadius: 10, padding: '12px 16px' }}>
                  <div style={{ flex: 1 }}>
                    <span style={{ fontWeight: 600, color: 'var(--red)' }}>{players[tx.from]}</span>
                    <span style={{ color: 'var(--muted)', fontSize: 12, margin: '0 8px' }}>{t.settlementPays}</span>
                    <span style={{ fontWeight: 600, color: 'var(--green-pos)' }}>{players[tx.to]}</span>
                  </div>
                  <div style={{ fontFamily: 'var(--mono)', fontWeight: 700, fontSize: 18, color: 'var(--gold)' }}>
                    {fmt(tx.amount)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}

window.SettlementSheet = SettlementSheet;
