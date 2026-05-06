// Main app — orchestrates everything
const { useState: useStateA, useEffect: useEffectA } = React;

const STORAGE_KEY = 'mahjong-tracker-v1';

function App() {
  const [lang, setLang] = useStateA(() => {
    try { return localStorage.getItem(STORAGE_KEY + ':lang') || 'en'; } catch { return 'en'; }
  });
  const t = window.I18N[lang];

  const [tweaks, setTweak] = useTweaks(/*EDITMODE-BEGIN*/{
    "simpleMode": false
  }/*EDITMODE-END*/);

  const [settings, setSettings] = useStateA(null);
  const [players, setPlayers] = useStateA([]);
  const [rounds, setRounds] = useStateA([]);

  const [view, setView] = useStateA('setup'); // setup | game
  const [showEntry, setShowEntry] = useStateA(false);
  const [editingIdx, setEditingIdx] = useStateA(null);
  const [showReview, setShowReview] = useStateA(false);
  const [showExport, setShowExport] = useStateA(false);
  const [confirm, setConfirm] = useStateA(null); // { msg, onYes }

  // Load
  useEffectA(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const data = JSON.parse(raw);
        if (data.settings && data.players) {
          setSettings(data.settings);
          setPlayers(data.players);
          setRounds(data.rounds || []);
          setView('game');
        }
      }
    } catch (e) { console.warn('load failed', e); }
  }, []);

  // Save
  useEffectA(() => {
    if (!settings) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ settings, players, rounds }));
    } catch (e) { console.warn('save failed', e); }
  }, [settings, players, rounds]);

  useEffectA(() => {
    try { localStorage.setItem(STORAGE_KEY + ':lang', lang); } catch {}
  }, [lang]);

  function startSession(cfg) {
    setSettings({
      mode: cfg.mode,
      minFan: cfg.minFan, maxFan: cfg.maxFan,
      basePoint: cfg.basePoint,
      pairwiseLoser: cfg.pairwiseLoser,
      discardShare: cfg.discardShare || 'standard',
      flowerPts: cfg.flowerPts, flyPts: cfg.flyPts,
      kongOpenPts: cfg.kongOpenPts, kongClosedPts: cfg.kongClosedPts,
    });
    setPlayers(cfg.names);
    setRounds([]);
    setView('game');
  }

  function newSession() {
    setConfirm({
      msg: t.confirmReset,
      onYes: () => {
        setSettings(null); setPlayers([]); setRounds([]);
        setView('setup');
        try { localStorage.removeItem(STORAGE_KEY); } catch {}
      },
    });
  }

  function saveRound(r) {
    const stamped = { ...r, id: editingIdx != null ? rounds[editingIdx].id : 'r' + Date.now(), ts: Date.now() };
    if (editingIdx != null) {
      const next = [...rounds]; next[editingIdx] = { ...next[editingIdx], ...stamped }; setRounds(next);
    } else {
      setRounds([...rounds, stamped]);
    }
    setShowEntry(false); setEditingIdx(null);
  }

  function editRound(idx) {
    setConfirm({
      msg: t.editConfirm,
      onYes: () => { setEditingIdx(idx); setShowEntry(true); },
    });
  }

  function deleteRound(idx) {
    setConfirm({
      msg: t.deleteConfirm,
      onYes: () => {
        const next = rounds.filter((_, i) => i !== idx);
        setRounds(next);
      },
    });
  }

  if (view === 'setup' || !settings) {
    return (
      <div className="app">
        <div className="topbar">
          <div className="brand">
            <div className="brand-mark">麻</div>
            <div>
              <div className="brand-name">{t.appName}</div>
              <div className="brand-tag">{t.appTagline}</div>
            </div>
          </div>
          <LangToggle lang={lang} setLang={setLang} />
        </div>
        <div className="content">
          <Setup t={t} lang={lang} onStart={startSession} />
        </div>
      </div>
    );
  }

  const dealerIdx = MJ.dealerForRound(rounds.length + 1, settings.mode);
  const editingRound = editingIdx != null ? rounds[editingIdx] : null;

  return (
    <div className="app">
      <div className="topbar">
        <div className="brand">
          <div className="brand-mark">麻</div>
          <div>
            <div className="brand-name">{t.appName}</div>
            <div className="brand-tag">{settings.mode === 3 ? t.threePlayer : t.fourPlayer} · {tweaks.simpleMode ? 'simple' : 'fan'}</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <LangToggle lang={lang} setLang={setLang} />
        </div>
      </div>
      <div className="content">
        <Game
          t={t} settings={settings} players={players} rounds={rounds}
          onAddRound={() => { setEditingIdx(null); setShowEntry(true); }}
          onShowReview={() => setShowReview(true)}
          onShowExport={() => setShowExport(true)}
          onNewSession={newSession}
          lang={lang}
        />
      </div>
      <div className="bottomnav">
        <button className="nav-icon" title={t.review} onClick={() => setShowReview(true)}>☰</button>
        <button className="fab" onClick={() => { setEditingIdx(null); setShowEntry(true); }}>
          + {t.recordRound}
        </button>
        <button className="nav-icon" title={t.export} onClick={() => setShowExport(true)}>↗</button>
        <button className="nav-icon" title={t.newSession} onClick={newSession}>⟲</button>
      </div>

      {showEntry && (
        <RoundEntry
          t={t}
          settings={settings}
          players={players}
          dealerIdx={editingIdx != null ? MJ.dealerForRound(editingIdx + 1, settings.mode) : dealerIdx}
          initial={editingRound}
          simpleMode={!!tweaks.simpleMode}
          onSave={saveRound}
          onCancel={() => { setShowEntry(false); setEditingIdx(null); }}
        />
      )}
      {showReview && (
        <Review
          t={t} settings={settings} players={players} rounds={rounds}
          onEdit={(idx) => { setShowReview(false); editRound(idx); }}
          onDelete={(idx) => deleteRound(idx)}
          onClose={() => setShowReview(false)}
        />
      )}
      {showExport && (
        <ExportSheet
          t={t} settings={settings} players={players} rounds={rounds}
          onClose={() => setShowExport(false)}
        />
      )}
      {confirm && (
        <div className="sheet-backdrop" style={{ alignItems: 'center' }} onClick={(e) => { if (e.target === e.currentTarget) setConfirm(null); }}>
          <div className="confirm">
            <h3>{t.appName}</h3>
            <p>{confirm.msg}</p>
            <div className="confirm-actions">
              <button className="btn btn-secondary" onClick={() => setConfirm(null)}>{t.no}</button>
              <button className="btn btn-primary" onClick={() => { confirm.onYes(); setConfirm(null); }}>{t.yes}</button>
            </div>
          </div>
        </div>
      )}

      <TweaksPanel title="Tweaks">
        <TweakSection title="Mode">
          <TweakRadio
            label="Scoring"
            value={tweaks.simpleMode ? 'simple' : 'detailed'}
            options={[{ value: 'detailed', label: 'Fan-based' }, { value: 'simple', label: 'Simple' }]}
            onChange={(v) => setTweak('simpleMode', v === 'simple')}
          />
        </TweakSection>
      </TweaksPanel>
    </div>
  );
}

function LangToggle({ lang, setLang }) {
  return (
    <div className="lang-toggle">
      <button className={lang === 'en' ? 'active' : ''} onClick={() => setLang('en')}>EN</button>
      <button className={lang === 'zh' ? 'active' : ''} onClick={() => setLang('zh')}>中</button>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
