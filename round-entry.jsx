// Round entry sheet
const { useState: useStateRE, useMemo: useMemoRE } = React;

function RoundEntry({ t, settings, players, dealerIdx, initial, onSave, onCancel, simpleMode }) {
  const N = settings.mode;
  const [outcome, setOutcome] = useStateRE(initial?.outcome || 'self');
  const [winnerIdx, setWinnerIdx] = useStateRE(initial?.winnerIdx ?? null);
  const [discarderIdx, setDiscarderIdx] = useStateRE(initial?.discarderIdx ?? null);
  const [fan, setFan] = useStateRE(initial?.fan ?? settings.minFan);
  const [loserFans, setLoserFans] = useStateRE(initial?.loserFans || {});
  const [bonuses, setBonuses] = useStateRE(initial?.bonuses || Array(N).fill(null).map(() => ({ flowers: 0, flies: 0, openKongs: 0, fedKongs: 0, fedKongFeeder: null, closedKongs: 0 })));
  const [penaltyIdx, setPenaltyIdx] = useStateRE(initial?.penaltyIdx ?? null);
  const [penaltyPoints, setPenaltyPoints] = useStateRE(initial?.penaltyPoints ?? 10);
  const [notes, setNotes] = useStateRE(initial?.notes || "");
  const [simplePays, setSimplePays] = useStateRE(initial?.simple?.winnerPays || {});
  const [showFanHelper, setShowFanHelper] = useStateRE(false);

  const seatLabels = N === 3 ? [t.east, t.south, t.west] : [t.east, t.south, t.west, t.north];

  function bonusStep(i, key, delta) {
    const next = bonuses.map(b => ({ ...b }));
    next[i][key] = Math.max(0, (next[i][key] || 0) + delta);
    setBonuses(next);
  }
  function setBonusField(i, key, value) {
    const next = bonuses.map(b => ({ ...b }));
    next[i][key] = value;
    setBonuses(next);
  }

  const previewDeltas = useMemoRE(() => {
    const round = {
      outcome, winnerIdx, discarderIdx, fan: Number(fan),
      loserFans, bonuses,
      penaltyIdx, penaltyPoints: Number(penaltyPoints),
      simpleMode, simple: { winnerPays: simplePays },
    };
    return MJ.computeDeltas(round, settings, dealerIdx);
  }, [outcome, winnerIdx, discarderIdx, fan, loserFans, bonuses, penaltyIdx, penaltyPoints, simpleMode, simplePays, settings, dealerIdx]);

  const canSave = (() => {
    if (outcome === 'draw') return true;
    if (outcome === 'penalty') return penaltyIdx != null;
    if (winnerIdx == null) return false;
    if (outcome === 'discard' && discarderIdx == null) return false;
    return true;
  })();

  function save() {
    onSave({
      outcome,
      winnerIdx: outcome === 'draw' || outcome === 'penalty' ? null : winnerIdx,
      discarderIdx: outcome === 'discard' ? discarderIdx : null,
      fan: Number(fan),
      loserFans,
      bonuses,
      penaltyIdx: outcome === 'penalty' ? penaltyIdx : null,
      penaltyPoints: Number(penaltyPoints),
      simpleMode,
      simple: simpleMode ? { winnerPays: simplePays } : null,
      notes,
    });
  }

  return (
    <div className="sheet-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}>
      <div className="sheet" onClick={e => e.stopPropagation()}>
        <div className="sheet-header">
          <h2>{t.recordRound}</h2>
          <button className="close-btn" onClick={onCancel}>×</button>
        </div>
        <div className="sheet-body">
          {/* Outcome */}
          <div className="section-title">{t.outcome}</div>
          <div className="outcome-grid" style={{ marginBottom: 18 }}>
            {[
              { k: 'self', label: t.selfDraw },
              { k: 'discard', label: t.discard },
              { k: 'draw', label: t.drawHand },
              { k: 'penalty', label: t.penalty },
            ].map(o => (
              <button key={o.k} className={"outcome-btn " + (outcome === o.k ? "active" : "")} onClick={() => setOutcome(o.k)}>
                {o.label}
              </button>
            ))}
          </div>

          {/* Winner */}
          {(outcome === 'self' || outcome === 'discard') && (
            <div style={{ marginBottom: 18 }}>
              <div className="section-title">{t.winner}</div>
              <div className={"player-pick n" + N}>
                {players.map((p, i) => (
                  <button
                    key={i}
                    className={winnerIdx === i ? "active" : ""}
                    onClick={() => setWinnerIdx(i)}
                  >
                    <span className="seat-mini">{seatLabels[i]}{i === dealerIdx ? " · " + t.dealer : ""}</span>
                    <span>{p}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Discarder */}
          {outcome === 'discard' && (
            <div style={{ marginBottom: 18 }}>
              <div className="section-title">{t.discarder}</div>
              <div className={"player-pick n" + N}>
                {players.map((p, i) => (
                  <button
                    key={i}
                    disabled={i === winnerIdx}
                    className={(discarderIdx === i ? "active " : "") + (i === winnerIdx ? "disabled" : "")}
                    onClick={() => i !== winnerIdx && setDiscarderIdx(i)}
                  >
                    <span className="seat-mini">{seatLabels[i]}</span>
                    <span>{p}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Fan / simple winner pays */}
          {(outcome === 'self' || outcome === 'discard') && !simpleMode && (
            <div style={{ marginBottom: 18 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <div className="section-title" style={{ margin: 0 }}>{t.fanCount}</div>
                <button
                  onClick={() => setShowFanHelper(true)}
                  style={{ fontSize: 11, color: 'var(--gold)', background: 'transparent', border: '1px solid var(--gold)', borderRadius: 12, padding: '3px 10px', cursor: 'pointer' }}
                >
                  {t.fhTitle} ↗
                </button>
              </div>
              <div className="fan-stepper">
                <div className="fan-pill">
                  <button onClick={() => setFan(Math.max(0, Number(fan) - 1))}>−</button>
                  <span className="val">{fan}</span>
                  <button onClick={() => setFan(Number(fan) + 1)}>+</button>
                </div>
                {fan < settings.minFan && <span className="fan-warn">{t.minFanWarn}</span>}
                {fan > settings.maxFan && <span className="fan-warn cap">{t.capped} {settings.maxFan}</span>}
              </div>
              {settings.pairwiseLoser && (
                <div style={{ marginTop: 12 }}>
                  <div className="hint" style={{ color: 'var(--muted)', fontSize: 11, marginBottom: 6 }}>
                    {t.pairwiseLoserHint}
                  </div>
                  {Number(fan) >= settings.maxFan ? (
                    <div className="hint" style={{ color: 'var(--gold)', fontSize: 11, fontStyle: 'italic' }}>
                      {t.limitHandNote}
                    </div>
                  ) : (
                    players.map((p, i) => {
                      if (i === winnerIdx) return null;
                      const lf = loserFans[i] || 0;
                      const tooLow = lf > 0 && lf < settings.minFan;
                      return (
                        <div key={i} className="field-row">
                          <div className="label">
                            {p} <span style={{ color: 'var(--muted)', fontSize: 11 }}>({seatLabels[i]})</span>
                            {tooLow && <span style={{ color: 'var(--red)', fontSize: 10, marginLeft: 6 }}>· {t.minFanWarn}</span>}
                          </div>
                          <div className="fan-pill">
                            <button onClick={() => setLoserFans({ ...loserFans, [i]: Math.max(0, (loserFans[i] || 0) - 1) })}>−</button>
                            <span className="val">{lf}</span>
                            <button onClick={() => setLoserFans({ ...loserFans, [i]: (loserFans[i] || 0) + 1 })}>+</button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </div>
          )}

          {/* Simple-mode: winner pays direct */}
          {(outcome === 'self' || outcome === 'discard') && simpleMode && winnerIdx != null && (
            <div style={{ marginBottom: 18 }}>
              <div className="section-title">{t.pointsLabel} ({t.winner})</div>
              {players.map((p, i) => i === winnerIdx ? null : (
                <div key={i} className="field-row">
                  <div className="label">{p} <span style={{ color: 'var(--muted)', fontSize: 11 }}>({seatLabels[i]})</span></div>
                  <input
                    className="num-input"
                    type="number"
                    value={simplePays[i] ?? 0}
                    onChange={e => setSimplePays({ ...simplePays, [i]: Number(e.target.value) })}
                  />
                </div>
              ))}
            </div>
          )}

          {/* Penalty */}
          {outcome === 'penalty' && (
            <div style={{ marginBottom: 18 }}>
              <div className="section-title">{t.penaltyOn}</div>
              <div className={"player-pick n" + N} style={{ marginBottom: 12 }}>
                {players.map((p, i) => (
                  <button key={i} className={penaltyIdx === i ? "active" : ""} onClick={() => setPenaltyIdx(i)}>
                    <span className="seat-mini">{seatLabels[i]}</span>
                    <span>{p}</span>
                  </button>
                ))}
              </div>
              <div className="field-row">
                <div className="label">{t.pointsLabel}</div>
                <input className="num-input" type="number" value={penaltyPoints} onChange={e => setPenaltyPoints(e.target.value)} />
              </div>
            </div>
          )}

          {/* Bonuses (also on draw — flies, kongs etc are in-game value) */}
          {outcome !== 'penalty' && (
            <div style={{ marginBottom: 18 }}>
              <div className="section-title">{t.bonuses}</div>
              <table className="bonus-table">
                <thead>
                  <tr>
                    <th></th>
                    <th>{t.flowers}</th>
                    {N === 3 && <th>{t.flies}</th>}
                    <th>{t.openKongs}</th>
                    <th>{t.fedKongsCol}</th>
                    <th>{t.closedKongs}</th>
                  </tr>
                </thead>
                <tbody>
                  {players.map((p, i) => (
                    <React.Fragment key={i}>
                      <tr>
                        <td>{p}</td>
                        {['flowers', N === 3 ? 'flies' : null, 'openKongs', 'fedKongs', 'closedKongs'].filter(Boolean).map(k => (
                          <td key={k}>
                            <div className="bonus-stepper">
                              <button onClick={() => bonusStep(i, k, -1)}>−</button>
                              <span className="v">{bonuses[i]?.[k] || 0}</span>
                              <button onClick={() => bonusStep(i, k, +1)}>+</button>
                            </div>
                          </td>
                        ))}
                      </tr>
                      {(bonuses[i]?.fedKongs || 0) > 0 && (
                        <tr>
                          <td colSpan={N === 3 ? 5 : 5} style={{ paddingTop: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0 8px', flexWrap: 'wrap' }}>
                              <span style={{ color: 'var(--muted)', fontSize: 11 }}>↳ {t.feeder}:</span>
                              {players.map((pp, j) => j === i ? null : (
                                <button
                                  key={j}
                                  className={"feeder-chip" + (bonuses[i]?.fedKongFeeder === j ? " active" : "")}
                                  onClick={() => setBonusField(i, 'fedKongFeeder', bonuses[i]?.fedKongFeeder === j ? null : j)}
                                >
                                  {pp}
                                </button>
                              ))}
                              {bonuses[i]?.fedKongFeeder == null && (
                                <span style={{ color: 'var(--red)', fontSize: 10 }}>· {t.pickFeeder}</span>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Notes */}
          <div className="field" style={{ marginBottom: 0 }}>
            <label>{t.notes}</label>
            <input type="text" placeholder={t.notesPh} value={notes} onChange={e => setNotes(e.target.value)} />
          </div>

          {/* Preview */}
          <div style={{ marginTop: 18, paddingTop: 14, borderTop: '1px solid var(--felt-line)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
              <span className="section-title" style={{ margin: 0 }}>{t.delta}</span>
              {(outcome === 'self' || outcome === 'discard') && !simpleMode && Number(fan) >= settings.maxFan && (
                <span style={{ background: 'var(--red-dim)', color: 'white', fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 999, letterSpacing: '0.06em' }}>
                  {t.limitHandNote.split('·')[0].trim()} ×2
                </span>
              )}
            </div>
            <div className="round-card-deltas">
              {players.map((p, i) => {
                const v = previewDeltas[i];
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
        </div>
        <div className="sheet-footer">
          <button className="btn btn-secondary" onClick={onCancel}>{t.cancel}</button>
          <button className="btn btn-primary btn-block" onClick={save} disabled={!canSave} style={{ opacity: canSave ? 1 : 0.5 }}>
            {t.save}
          </button>
        </div>
      </div>

      {showFanHelper && (
        <FanHelper
          t={t}
          settings={settings}
          onUse={(f) => { setFan(f); setShowFanHelper(false); }}
          onClose={() => setShowFanHelper(false)}
        />
      )}
    </div>
  );
}

window.RoundEntry = RoundEntry;
