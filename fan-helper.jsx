// Fan calculator helper — tap combinations to tally fan count
const { useState: useStateFH, useMemo: useMemoFH } = React;

function getFanCategories(N, t) {
  return [
    {
      title: t.fhCatHand,
      items: [
        { key: 'selfDraw',     label: t.fhSelfDraw,     fan: 1 },
        { key: 'allSeq',       label: t.fhAllSeq,        fan: 1 },
        { key: 'allTrip',      label: t.fhAllTrip,       fan: 2 },
        { key: 'sevenPairs',   label: t.fhSevenPairs,    fan: 1 },
        { key: 'mixFlush',     label: t.fhMixFlush,      fan: 1 },
        { key: 'pureFlush',    label: t.fhPureFlush,     fan: 3 },
        { key: 'smallDragons', label: t.fhSmallDragons,  fan: 3 },
      ],
    },
    {
      title: t.fhCatHonor,
      items: [
        { key: 'dragonRed',   label: t.fhDragonRed,   fan: 1 },
        { key: 'dragonGreen', label: t.fhDragonGreen, fan: 1 },
        { key: 'dragonWhite', label: t.fhDragonWhite, fan: 1 },
        { key: 'seatWind',    label: t.fhSeatWind,    fan: 1 },
      ],
    },
    {
      title: t.fhCatWin,
      items: [
        { key: 'winByKong',    label: t.fhWinByKong,    fan: 1 },
        { key: 'robbingKong',  label: t.fhRobbingKong,  fan: 1 },
        { key: 'lastTile',     label: t.fhLastTile,     fan: 1 },
      ],
    },
    {
      title: t.fhCatLimit,
      items: [
        { key: 'bigDragons',        label: t.fhBigDragons,        fan: 'limit' },
        { key: 'smallWinds',        label: t.fhSmallWinds,        fan: 'limit' },
        { key: 'bigWinds',          label: t.fhBigWinds,          fan: 'limit' },
        { key: 'allHonors',         label: t.fhAllHonors,         fan: 'limit' },
        { key: 'fourKongs',         label: t.fhFourKongs,         fan: 'limit' },
        { key: 'thirteenOrphans',   label: t.fhThirteenOrphans,   fan: 'limit' },
        { key: 'nineGates',         label: t.fhNineGates,         fan: 'limit' },
        { key: 'heavenly',          label: t.fhHeavenly,          fan: 'limit' },
        { key: 'earthly',           label: t.fhEarthly,           fan: 'limit' },
        ...(N === 3 ? [{ key: 'fourFlies', label: t.fhFourFlies, fan: 'limit' }] : []),
      ],
    },
  ];
}

function FanHelper({ t, settings, onUse, onClose, standalone }) {
  const [selected, setSelected] = useStateFH({});
  const [manualMax, setManualMax] = useStateFH(false);
  const N = settings.mode;
  const categories = getFanCategories(N, t);

  const { total, isLimit } = useMemoFH(() => {
    if (manualMax) return { total: settings.maxFan, isLimit: true };
    let sum = 0;
    let limit = false;
    for (const cat of categories) {
      for (const item of cat.items) {
        if (selected[item.key]) {
          if (item.fan === 'limit') limit = true;
          else sum += item.fan;
        }
      }
    }
    return { total: limit ? settings.maxFan : sum, isLimit: limit };
  }, [selected, manualMax, settings.maxFan]);

  function toggle(key) {
    setManualMax(false);
    setSelected(prev => ({ ...prev, [key]: !prev[key] }));
  }

  return (
    <div className="sheet-backdrop" style={{ zIndex: 300 }} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="sheet" onClick={e => e.stopPropagation()}>
        <div className="sheet-header">
          <h2>{t.fhTitle}</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>
        <div className="sheet-body">

          {/* Running total */}
          <div style={{ marginBottom: 18, padding: '14px 12px', background: 'var(--felt-2)', borderRadius: 12, display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ flex: 1, textAlign: 'center' }}>
              <div style={{ color: 'var(--muted)', fontSize: 11, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{t.fanCount}</div>
              <div style={{ fontSize: 40, fontWeight: 700, lineHeight: 1, color: isLimit ? 'var(--red)' : 'var(--cream)', fontFamily: 'JetBrains Mono, monospace' }}>
                {isLimit ? '爆' : total}
              </div>
              {isLimit && (
                <div style={{ color: 'var(--red)', fontSize: 11, marginTop: 6, fontWeight: 600 }}>{settings.maxFan} {t.fanShort} · {t.limitHandNote.split('·')[0].trim()}</div>
              )}
              {!isLimit && total > 0 && total < settings.minFan && (
                <div style={{ color: 'var(--red)', fontSize: 11, marginTop: 4 }}>{t.minFanWarn}</div>
              )}
              {!isLimit && total >= settings.minFan && total > 0 && (
                <div style={{ color: 'var(--muted)', fontSize: 11, marginTop: 4 }}>min {settings.minFan} · max {settings.maxFan}</div>
              )}
            </div>
            <button
              onClick={() => setManualMax(m => !m)}
              style={{
                background: manualMax ? 'var(--red)' : 'var(--red-dim)',
                border: '1px solid var(--red)',
                color: 'white',
                borderRadius: 10,
                padding: '10px 14px',
                cursor: 'pointer',
                fontSize: 20,
                fontWeight: 700,
                lineHeight: 1,
                flexShrink: 0,
                opacity: manualMax ? 1 : 0.7,
              }}
            >
              爆
            </button>
          </div>

          {categories.map(cat => (
            <div key={cat.title} style={{ marginBottom: 18 }}>
              <div className="section-title">{cat.title}</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {cat.items.map(item => {
                  const on = !!selected[item.key];
                  return (
                    <button
                      key={item.key}
                      onClick={() => toggle(item.key)}
                      style={{
                        padding: '6px 12px',
                        borderRadius: 20,
                        border: '1px solid',
                        borderColor: on ? (item.fan === 'limit' ? 'var(--red)' : 'var(--gold)') : 'var(--felt-line)',
                        background: on ? (item.fan === 'limit' ? 'var(--red-dim)' : 'var(--gold)') : 'var(--felt-2)',
                        color: on ? (item.fan === 'limit' ? 'white' : 'var(--felt-1)') : 'var(--cream)',
                        fontSize: 12,
                        fontWeight: on ? 600 : 400,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 5,
                        transition: 'all 0.15s',
                      }}
                    >
                      <span>{item.label}</span>
                      <span style={{
                        fontSize: 10,
                        fontWeight: 700,
                        color: on ? (item.fan === 'limit' ? 'rgba(255,255,255,0.8)' : 'var(--felt-2)') : 'var(--muted)',
                        fontFamily: 'JetBrains Mono, monospace',
                      }}>
                        {item.fan === 'limit' ? t.fhLimit : `+${item.fan}`}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
        <div className="sheet-footer">
          {standalone ? (
            <button className="btn btn-primary btn-block" onClick={onClose}>
              {total > 0 ? `${t.fanCounterGotIt} · ${total} ${t.fanShort}` : t.fanCounterGotIt}
            </button>
          ) : (
            <>
              <button className="btn btn-secondary" onClick={onClose}>{t.cancel}</button>
              <button
                className="btn btn-primary btn-block"
                onClick={() => onUse(total)}
                disabled={total === 0}
                style={{ opacity: total > 0 ? 1 : 0.5 }}
              >
                {t.fhUse} {total} {t.fanShort}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

window.FanHelper = FanHelper;
