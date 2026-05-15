// Setup screen: configure game mode, players, rules
const { useState } = React;

function CollapsibleSection({ title, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="section" style={{ marginBottom: 16 }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          width: '100%', background: 'transparent', border: 0, padding: 0, cursor: 'pointer',
          color: 'var(--gold)', marginBottom: open ? 12 : 0,
        }}
      >
        <span className="section-title" style={{ margin: 0 }}>{title}</span>
        <span style={{ fontSize: 16, color: 'var(--gold)', transition: 'transform 0.2s', display: 'inline-block', transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}>▾</span>
      </button>
      {open && children}
    </div>
  );
}

function Setup({ t, lang, onStart, initial }) {
  const [mode, setMode] = useState(initial?.mode || 4);
  const seatLabels = (m) => m === 3 ? [t.east, t.south, t.west] : [t.east, t.south, t.west, t.north];
  const [names, setNames] = useState(initial?.names || ["", "", "", ""]);
  const [playerColors, setPlayerColors] = useState(initial?.playerColors || MJ.PLAYER_COLORS.slice(0, 4));
  const [minFan, setMinFan] = useState(initial?.minFan ?? 5);
  const [maxFan, setMaxFan] = useState(initial?.maxFan ?? 10);
  const [basePoint, setBasePoint] = useState(initial?.basePoint ?? 1);
  const [pairwiseLoser, setPairwiseLoser] = useState(initial?.pairwiseLoser ?? true);
  const [discardShare, setDiscardShare] = useState(initial?.discardShare ?? 'shooter_solo');
  const [flowerPts, setFlowerPts] = useState(initial?.flowerPts ?? 1);
  const [flyPts, setFlyPts] = useState(initial?.flyPts ?? 1);
  const [kongOpenPts, setKongOpenPts] = useState(initial?.kongOpenPts ?? 1);
  const [kongClosedPts, setKongClosedPts] = useState(initial?.kongClosedPts ?? 2);
  const [dealerHold, setDealerHold] = useState(initial?.dealerHold ?? false);
  const [pointValue, setPointValue] = useState(initial?.pointValue ?? 0.10);

  const seats = seatLabels(mode);

  function start() {
    const playerNames = seats.map((s, i) => names[i]?.trim() || s);
    onStart({
      mode, names: playerNames,
      playerColors: playerColors.slice(0, mode),
      minFan: Number(minFan), maxFan: Number(maxFan),
      basePoint: Number(basePoint),
      pairwiseLoser, discardShare, dealerHold,
      flowerPts: Number(flowerPts), flyPts: Number(flyPts),
      kongOpenPts: Number(kongOpenPts), kongClosedPts: Number(kongClosedPts),
      pointValue: Number(pointValue) || 0.10,
    });
  }

  return (
    <div>
      <div className="setup-hero">
        <h1>{t.setupTitle}</h1>
        <p>{t.setupSubtitle}</p>
      </div>

      <div className="section">
        <div className="section-title">{t.gameMode}</div>
        <div className="mode-grid">
          <button className={"mode-card " + (mode === 3 ? "active" : "")} onClick={() => setMode(3)}>
            <h3>{t.threePlayer}</h3>
            <p>{t.threeDesc}</p>
          </button>
          <button className={"mode-card " + (mode === 4 ? "active" : "")} onClick={() => setMode(4)}>
            <h3>{t.fourPlayer}</h3>
            <p>{t.fourDesc}</p>
          </button>
        </div>
      </div>

      <div className="section">
        <div className="section-title">{t.players}</div>
        {seats.map((s, i) => (
          <div key={i} style={{ marginBottom: 10 }}>
            <div className="player-input-row" style={{ marginBottom: 6 }}>
              <div className="seat-badge" style={{ borderBottom: `3px solid ${playerColors[i] || MJ.PLAYER_COLORS[i]}` }}>{s}</div>
              <input
                type="text"
                placeholder={`${t.playerName} ${i + 1}`}
                value={names[i] || ""}
                onChange={(e) => { const n = [...names]; n[i] = e.target.value; setNames(n); }}
              />
            </div>
            <div style={{ display: 'flex', gap: 6, paddingLeft: 68 }}>
              {MJ.PLAYER_COLORS.map((c, ci) => (
                <button key={ci} className={"color-dot" + (playerColors[i] === c ? " selected" : "")}
                  style={{ background: c }}
                  onClick={() => { const nc = [...playerColors]; nc[i] = c; setPlayerColors(nc); }}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      <CollapsibleSection title={t.rules}>
        <div className="field-row">
          <div>
            <div className="label">{t.minFan}</div>
          </div>
          <input className="num-input" type="number" value={minFan} onChange={e => setMinFan(e.target.value)} min="1" />
        </div>
        <div className="field-row">
          <div>
            <div className="label">{t.maxFan}</div>
          </div>
          <input className="num-input" type="number" value={maxFan} onChange={e => setMaxFan(e.target.value)} min="1" />
        </div>
        <div className="field-row">
          <div>
            <div className="label">{t.basePoint}</div>
            <div className="hint">{t.basePointHint}{basePoint} {t.pointsLabel}/{t.fan}</div>
          </div>
          <input className="num-input" type="number" value={basePoint} onChange={e => setBasePoint(e.target.value)} min="1" />
        </div>
        <div className="field-row">
          <div>
            <div className="label">{t.pairwiseLoser}</div>
            <div className="hint">{t.pairwiseLoserHint}</div>
          </div>
          <button className={"toggle " + (pairwiseLoser ? "on" : "")} onClick={() => setPairwiseLoser(!pairwiseLoser)} />
        </div>
        <div className="field-row">
          <div>
            <div className="label">{t.dealerHold}</div>
            <div className="hint">{t.dealerHoldHint}</div>
          </div>
          <button className={"toggle " + (dealerHold ? "on" : "")} onClick={() => setDealerHold(!dealerHold)} />
        </div>
        <div className="field-row">
          <div>
            <div className="label">{t.pointValue}</div>
            <div className="hint">{t.pointValueHint}</div>
          </div>
          <input className="num-input" type="number" value={pointValue} onChange={e => setPointValue(e.target.value)} min="0" step="0.01" />
        </div>
      </CollapsibleSection>

      <CollapsibleSection title={t.discardShare}>
        <div className="hint" style={{ color: 'var(--muted)', fontSize: 11, marginBottom: 10 }}>{t.discardShareHint}</div>
        {[
          { k: 'standard', label: t.shareStandard, desc: t.shareStandardDesc },
          { k: 'shooter_solo', label: t.shareShooter15, desc: t.shareShooter15Desc },
        ].map(o => (
          <button
            key={o.k}
            className={"mode-card " + (discardShare === o.k ? "active" : "")}
            onClick={() => setDiscardShare(o.k)}
            style={{ width: '100%', marginBottom: 8 }}
          >
            <h3 style={{ fontSize: 15 }}>{o.label}</h3>
            <p>{o.desc}</p>
          </button>
        ))}
      </CollapsibleSection>

      <CollapsibleSection title={t.bonuses}>
        <div className="field-row">
          <div className="label">{t.flowerOwn}</div>
          <input className="num-input" type="number" value={flowerPts} onChange={e => setFlowerPts(e.target.value)} min="0" />
        </div>
        {mode === 3 && (
          <div className="field-row">
            <div className="label">{t.fly}</div>
            <input className="num-input" type="number" value={flyPts} onChange={e => setFlyPts(e.target.value)} min="0" />
          </div>
        )}
        <div className="field-row">
          <div className="label">{t.kongOpen}</div>
          <input className="num-input" type="number" value={kongOpenPts} onChange={e => setKongOpenPts(e.target.value)} min="0" />
        </div>
        <div className="field-row">
          <div className="label">{t.kongClosed}</div>
          <input className="num-input" type="number" value={kongClosedPts} onChange={e => setKongClosedPts(e.target.value)} min="0" />
        </div>
      </CollapsibleSection>

      <button className="btn btn-primary btn-block btn-lg" onClick={start}>
        {t.startSession} →
      </button>
    </div>
  );
}

window.Setup = Setup;
