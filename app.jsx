// Main app — orchestrates everything
const { useState: useStateA, useEffect: useEffectA, useCallback: useCallbackA } = React;

const STORAGE_KEY = 'mahjong-tracker-v1';
const AUTH_KEY = 'mahjong-auth-v1';
const API = '/api';

function App() {
  const [lang, setLang] = useStateA(() => {
    try { return localStorage.getItem(STORAGE_KEY + ':lang') || 'en'; } catch { return 'en'; }
  });
  const t = window.I18N[lang];

  const [tweaks, setTweak] = useTweaks({
    "simpleMode": false
  });

  const [settings, setSettings] = useStateA(null);
  const [players, setPlayers] = useStateA([]);
  const [rounds, setRounds] = useStateA([]);
  const [backendSessionId, setBackendSessionId] = useStateA(null);

  const [view, setView] = useStateA('setup');
  const [showEntry, setShowEntry] = useStateA(false);
  const [editingIdx, setEditingIdx] = useStateA(null);
  const [showReview, setShowReview] = useStateA(false);
  const [showExport, setShowExport] = useStateA(false);
  const [showFanCounter, setShowFanCounter] = useStateA(false);
  const [confirm, setConfirm] = useStateA(null);

  // Auth state
  const [authUser, setAuthUser] = useStateA(() => {
    try { const s = localStorage.getItem(AUTH_KEY); return s ? JSON.parse(s).user : null; } catch { return null; }
  });
  const [authToken, setAuthToken] = useStateA(() => {
    try { const s = localStorage.getItem(AUTH_KEY); return s ? JSON.parse(s).token : null; } catch { return null; }
  });
  const [showAuth, setShowAuth] = useStateA(false);
  const [showStats, setShowStats] = useStateA(false);
  const [syncing, setSyncing] = useStateA(false);
  const [syncStatus, setSyncStatus] = useStateA(null); // null | 'synced' | 'error'

  // Load session
  useEffectA(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const data = JSON.parse(raw);
        if (data.settings && data.players) {
          setSettings(data.settings);
          setPlayers(data.players);
          setRounds(data.rounds || []);
          setBackendSessionId(data.backendSessionId || null);
          setView('game');
        }
      }
    } catch (e) { console.warn('load failed', e); }
  }, []);

  // Save session
  useEffectA(() => {
    if (!settings) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ settings, players, rounds, backendSessionId }));
    } catch (e) { console.warn('save failed', e); }
  }, [settings, players, rounds, backendSessionId]);

  useEffectA(() => {
    try { localStorage.setItem(STORAGE_KEY + ':lang', lang); } catch {}
  }, [lang]);

  // When rounds change after a sync, mark as unsynced
  useEffectA(() => {
    if (syncStatus === 'synced') setSyncStatus(null);
  }, [rounds]);

  function handleLogin(user, token) {
    setAuthUser(user);
    setAuthToken(token);
    try { localStorage.setItem(AUTH_KEY, JSON.stringify({ user, token })); } catch {}
  }

  function handleLogout() {
    setAuthUser(null);
    setAuthToken(null);
    try { localStorage.removeItem(AUTH_KEY); } catch {}
  }

  async function syncSession() {
    if (!authToken || !settings) return;
    setSyncing(true); setSyncStatus(null);
    try {
      const res = await fetch(`${API}/sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({
          id: backendSessionId,
          mode: settings.mode,
          settings,
          players,
          rounds,
          startedAt: rounds[0]?.ts || Date.now(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Sync failed');
      setBackendSessionId(data.session.id);
      setSyncStatus('synced');
    } catch {
      setSyncStatus('error');
    } finally {
      setSyncing(false);
    }
  }

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
    setBackendSessionId(null);
    setSyncStatus(null);
    setView('game');
  }

  function newSession() {
    setConfirm({
      msg: t.confirmReset,
      onYes: () => {
        setSettings(null); setPlayers([]); setRounds([]);
        setBackendSessionId(null); setSyncStatus(null);
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
      onYes: () => setRounds(rounds.filter((_, i) => i !== idx)),
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
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <LangToggle lang={lang} setLang={setLang} />
            <AuthButton authUser={authUser} onClick={() => setShowAuth(true)} />
          </div>
        </div>
        <div className="content">
          <Setup t={t} lang={lang} onStart={startSession} />
        </div>
        {showAuth && <AuthModal t={t} authUser={authUser} onLogin={handleLogin} onLogout={handleLogout} onClose={() => setShowAuth(false)} />}
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
          {authUser && (
            <button
              onClick={() => setShowStats(true)}
              title={t.statsTitle}
              style={{ background: 'transparent', border: 'none', color: 'var(--gold)', fontSize: 16, cursor: 'pointer', padding: '4px 6px' }}
            >
              📊
            </button>
          )}
          <AuthButton authUser={authUser} onClick={() => setShowAuth(true)} />
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
        {/* Cloud sync row */}
        {authUser && rounds.length > 0 && (
          <div style={{ textAlign: 'center', paddingBottom: 16 }}>
            <button
              onClick={syncSession}
              disabled={syncing}
              style={{
                fontSize: 12, padding: '5px 16px', borderRadius: 20, cursor: syncing ? 'default' : 'pointer',
                background: 'transparent',
                border: '1px solid ' + (syncStatus === 'synced' ? 'var(--gold)' : syncStatus === 'error' ? 'var(--red)' : 'var(--felt-line)'),
                color: syncStatus === 'synced' ? 'var(--gold)' : syncStatus === 'error' ? 'var(--red)' : 'var(--muted)',
              }}
            >
              {syncing ? '...' : syncStatus === 'synced' ? '☁ ' + t.syncDone : syncStatus === 'error' ? t.syncError : '☁ ' + t.syncNow}
            </button>
          </div>
        )}
        {!authUser && rounds.length > 0 && (
          <div style={{ textAlign: 'center', paddingBottom: 16 }}>
            <button
              onClick={() => setShowAuth(true)}
              style={{ fontSize: 11, color: 'var(--muted)', background: 'transparent', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}
            >
              {t.syncLoginPrompt}
            </button>
          </div>
        )}
      </div>
      <div className="bottomnav">
        <button className="nav-icon" title={t.review} onClick={() => setShowReview(true)}>☰</button>
        <button className="fab" onClick={() => { setEditingIdx(null); setShowEntry(true); }}>
          + {t.recordRound}
        </button>
        <button className="nav-icon" title={t.fanCounterBtn} onClick={() => setShowFanCounter(true)} style={{ fontSize: 14, fontFamily: 'var(--serif)' }}>番</button>
        <button className="nav-icon" title={t.export} onClick={() => setShowExport(true)}>↗</button>
        <button className="nav-icon" title={t.newSession} onClick={newSession}>⟲</button>
      </div>

      {showEntry && (
        <RoundEntry
          t={t} settings={settings} players={players}
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
      {showFanCounter && (
        <FanHelper
          t={t}
          settings={settings}
          standalone={true}
          onUse={(f) => {
            setShowFanCounter(false);
          }}
          onClose={() => setShowFanCounter(false)}
        />
      )}
      {showAuth && (
        <AuthModal t={t} authUser={authUser} onLogin={handleLogin} onLogout={handleLogout} onClose={() => setShowAuth(false)} />
      )}
      {showStats && authToken && (
        <StatsView t={t} authToken={authToken} onClose={() => setShowStats(false)} />
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

function AuthButton({ authUser, onClick }) {
  return (
    <button
      onClick={onClick}
      title={authUser ? authUser.name : 'Sign in'}
      style={{
        width: 30, height: 30, borderRadius: '50%',
        background: authUser ? 'var(--gold)' : 'var(--felt-2)',
        border: '1px solid ' + (authUser ? 'var(--gold)' : 'var(--felt-line)'),
        color: authUser ? 'var(--felt-1)' : 'var(--muted)',
        fontSize: 13, fontWeight: 700, cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      {authUser ? authUser.name.charAt(0).toUpperCase() : '👤'}
    </button>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
