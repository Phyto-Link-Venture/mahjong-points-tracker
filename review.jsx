// Review screen — table + cards
const { useState: useStateRv } = React;

function Review({ t, settings, players, rounds, onEdit, onDelete, onClose }) {
  const [view, setView] = useStateRv('table');
  const N = settings.mode;
  const seatLabels = N === 3 ? [t.east, t.south, t.west] : [t.east, t.south, t.west, t.north];
  const totals = MJ.computeTotals(rounds, settings);

  // Running totals
  const running = [];
  const acc = new Array(N).fill(0);
  rounds.forEach((r, idx) => {
    const dIdx = MJ.computeDealerIdx(rounds, settings, idx);
    const d = MJ.computeDeltas(r, settings, dIdx);
    for (let i = 0; i < N; i++) acc[i] += d[i];
    running.push({ deltas: d, totals: [...acc] });
  });

  return (
    <div className="sheet-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="sheet" onClick={e => e.stopPropagation()}>
        <div className="sheet-header">
          <h2>{t.reviewTitle}</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>
        <div className="sheet-body">
          <div className="view-toggle">
            <button className={view === 'table' ? 'active' : ''} onClick={() => setView('table')}>{t.tableView}</button>
            <button className={view === 'cards' ? 'active' : ''} onClick={() => setView('cards')}>{t.cardsView}</button>
          </div>

          {rounds.length === 0 && (
            <div className="empty-state">
              <div className="icon">麻</div>
              <div>{t.noRoundsYet}</div>
            </div>
          )}

          {view === 'table' && rounds.length > 0 && (
            <div style={{ overflowX: 'auto' }}>
              <table className="history-table">
                <thead>
                  <tr>
                    <th>{t.round}</th>
                    {players.map((p, i) => <th key={i}>{p}<br /><span style={{ color: 'var(--muted)', fontWeight: 400 }}>{seatLabels[i]}</span></th>)}
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {rounds.map((r, idx) => {
                    const d = running[idx].deltas;
                    return (
                      <tr key={r.id}>
                        <td>#{idx + 1}<br /><span style={{ color: 'var(--muted)', fontSize: 10 }}>{summarizeRound(r, players, t)}</span></td>
                        {d.map((v, i) => (
                          <td key={i} className={v > 0 ? 'delta-pos' : v < 0 ? 'delta-neg' : 'delta-zero'}>
                            {v > 0 ? '+' : ''}{v}
                          </td>
                        ))}
                        <td>
                          <span className="row-actions">
                            <button className="icon-btn" title={t.edit} onClick={() => onEdit(idx)}><span className="ico">✎</span>{t.edit}</button>
                            <button className="icon-btn danger" title={t.delete} onClick={() => onDelete(idx)}><span className="ico">×</span>{t.delete}</button>
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                  <tr className="totals">
                    <td>{t.total}</td>
                    {totals.map((v, i) => (
                      <td key={i} className={v > 0 ? 'delta-pos' : v < 0 ? 'delta-neg' : 'delta-zero'}>
                        {v > 0 ? '+' : ''}{v}
                      </td>
                    ))}
                    <td></td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}

          {view === 'cards' && rounds.length > 0 && (
            <div>
              {rounds.map((r, idx) => {
                const d = running[idx].deltas;
                return (
                  <div key={r.id} className="round-card">
                    <div className="round-card-head">
                      <div className="num">#{idx + 1}</div>
                      <div className="summary">{summarizeRound(r, players, t)}</div>
                    </div>
                    <div className="round-card-deltas">
                      {players.map((p, i) => {
                        const v = d[i];
                        const cls = v > 0 ? 'delta-pos' : v < 0 ? 'delta-neg' : 'delta-zero';
                        return (
                          <span key={i} className="delta-chip">
                            <span className="name">{p}</span>
                            <span className={cls}>{v > 0 ? '+' : ''}{v}</span>
                          </span>
                        );
                      })}
                    </div>
                    {r.notes && <div className="round-card-note">"{r.notes}"</div>}
                    <div className="round-card-actions">
                      <button className="icon-btn" onClick={() => onEdit(idx)}><span className="ico">✎</span>{t.edit}</button>
                      <button className="icon-btn danger" onClick={() => onDelete(idx)}><span className="ico">×</span>{t.delete}</button>
                    </div>
                  </div>
                );
              })}
              <div className="section" style={{ marginTop: 16 }}>
                <div className="section-title">{t.runningTotal}</div>
                <div className="round-card-deltas">
                  {players.map((p, i) => {
                    const v = totals[i];
                    const cls = v > 0 ? 'delta-pos' : v < 0 ? 'delta-neg' : 'delta-zero';
                    return (
                      <span key={i} className="delta-chip" style={{ fontSize: 14, padding: '6px 14px' }}>
                        <span className="name">{p}</span>
                        <span className={cls}>{v > 0 ? '+' : ''}{v}</span>
                      </span>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

window.Review = Review;
