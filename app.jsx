// Main app — orchestrates everything
const { useState: useStateA, useEffect: useEffectA, useCallback: useCallbackA } = React;

const STORAGE_KEY = 'mahjong-tracker-v1';
const AUTH_KEY = 'mahjong-auth-v1';
const API = '/api';

// Check if opened as a spectator watch link
const watchMatch = window.location.hash.match(/^#watch\/(.+)$/);
const WATCH_ID = watchMatch ? watchMatch[1] : null;

function App() {
  const [lang, setLang] = useStateA(() => {
    try { return localStorage.getItem(STORAGE_KEY + ':lang') || 'en'; } catch { return 'en'; }
  });
  const t = window.I18N[lang];

  const [tweaks, setTweak] = useTweaks({ simpleMode: false });

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
  const [showSettlement, setShowSettlement] = useStateA(false);
  const [showShare, setShowShare] = useStateA(false);
  const [confirm, setConfirm] = useStateA(null);
  const [sessionNotesOpen, setSessionNotesOpen] = useStateA(false);

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
  const [syncStatus, setSyncStatus] = useStateA(null);
  const [sessionShared, setSessionShared] = useStateA(false);
  const [showOnboarding, setShowOnboarding] = useStateA(() => {
    try { return !localStorage.getItem('mahjong-onboarded'); } catch { return false; }
  });

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
          setSessionShared(data.settings?.shared || false);
          setView('game');
        }
      }
    } catch (e) { console.warn('load failed', e); }
  }, []);

  useEffectA(() => {
    if (!settings) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ settings, players, rounds, backendSessionId }));
    } catch (e) { console.warn('save failed', e); }
  }, [settings, players, rounds, backendSessionId]);

  useEffectA(() => {
    try { localStorage.setItem(STORAGE_KEY + ':lang', lang); } catch {}
  }, [lang]);

  useEffectA(() => {
    if (syncStatus === 'synced') setSyncStatus(null);
  }, [rounds]);

  function dismissOnboarding() {
    setShowOnboarding(false);
    try { localStorage.setItem('mahjong-onboarded', '1'); } catch {}
  }

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

  async function toggleShare(enable) {
    if (!authToken || !backendSessionId) return;
    try {
      const res = await fetch(`${API}/sessions/${backendSessionId}/share`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({ shared: enable }),
      });
      if (res.ok) {
        setSessionShared(enable);
        setSettings(prev => ({ ...prev, shared: enable }));
      }
    } catch {}
  }

  function updateSessionNotes(notes) {
    setSettings(prev => ({ ...prev, sessionNotes: notes }));
  }

  function startSession(cfg) {
    setSettings({
      mode: cfg.mode,
      minFan: cfg.minFan, maxFan: cfg.maxFan,
      basePoint: cfg.basePoint,
      pairwiseLoser: cfg.pairwiseLoser,
      discardShare: cfg.discardShare || 'standard',
      dealerHold: cfg.dealerHold || false,
      flowerPts: cfg.flowerPts, flyPts: cfg.flyPts,
      kongOpenPts: cfg.kongOpenPts, kongClosedPts: cfg.kongClosedPts,
      pointValue: cfg.pointValue || 0.10,
    });
    setPlayers(cfg.names);
    setRounds([]);
    setBackendSessionId(null);
    setSyncStatus(null);
    setSessionShared(false);
    setView('game');
  }

  function newSession() {
    setConfirm({
      msg: t.confirmReset,
      onYes: () => {
        setSettings(null); setPlayers([]); setRounds([]);
        setBackendSessionId(null); setSyncStatus(null); setSessionShared(false);
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

  // Watch mode — spectator view
  if (WATCH_ID) {
    return <WatchView t={t} sessionId={WATCH_ID} lang={lang} setLang={setLang} />;
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
        {showOnboarding && <OnboardingModal t={t} onDone={dismissOnboarding} />}
        <IOSInstallBanner t={t} />
      </div>
    );
  }

  const dealerIdx = MJ.computeDealerIdx(rounds, settings, rounds.length);
  const editingRound = editingIdx != null ? rounds[editingIdx] : null;

  return (
    <div className="app">
      <div className="topbar">
        <div className="brand">
          <div className="brand-mark">麻</div>
          <div>
            <div className="brand-name">{t.appName}</div>
            <div className="brand-tag">{settings.mode === 3 ? t.threePlayer : t.fourPlayer} · {tweaks.simpleMode ? 'simple' : 'fan'}{settings.dealerHold ? ' · hold' : ''}</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <LangToggle lang={lang} setLang={setLang} />
          {authUser && (
            <button onClick={() => setShowStats(true)} title={t.statsTitle}
              style={{ background: 'transparent', border: 'none', color: 'var(--gold)', fontSize: 16, cursor: 'pointer', padding: '4px 6px' }}>
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

        {/* Action row: notes + settle + share */}
        {rounds.length > 0 && (
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center', paddingBottom: 8, flexWrap: 'wrap' }}>
            <button onClick={() => setSessionNotesOpen(true)}
              style={{ fontSize: 11, padding: '4px 12px', borderRadius: 20, background: 'transparent', border: '1px solid var(--felt-line)', color: settings.sessionNotes ? 'var(--cream-dim)' : 'var(--muted)', cursor: 'pointer' }}>
              📝 {settings.sessionNotes ? settings.sessionNotes.slice(0, 20) + (settings.sessionNotes.length > 20 ? '…' : '') : t.sessionNotesBtn}
            </button>
            <button onClick={() => setShowSettlement(true)}
              style={{ fontSize: 11, padding: '4px 12px', borderRadius: 20, background: 'transparent', border: '1px solid var(--felt-line)', color: 'var(--muted)', cursor: 'pointer' }}>
              💰 {t.settlementBtn}
            </button>
            {authUser && backendSessionId && (
              <button onClick={() => setShowShare(true)}
                style={{ fontSize: 11, padding: '4px 12px', borderRadius: 20, background: sessionShared ? 'rgba(200,168,75,0.15)' : 'transparent', border: '1px solid ' + (sessionShared ? 'var(--gold)' : 'var(--felt-line)'), color: sessionShared ? 'var(--gold)' : 'var(--muted)', cursor: 'pointer' }}>
                {sessionShared ? '🔗 ' + t.shareEnable : '🔗 ' + t.shareEnable}
              </button>
            )}
          </div>
        )}

        {/* Cloud sync row */}
        {authUser && rounds.length > 0 && (
          <div style={{ textAlign: 'center', paddingBottom: 16 }}>
            <button onClick={syncSession} disabled={syncing}
              style={{
                fontSize: 12, padding: '5px 16px', borderRadius: 20, cursor: syncing ? 'default' : 'pointer',
                background: 'transparent',
                border: '1px solid ' + (syncStatus === 'synced' ? 'var(--gold)' : syncStatus === 'error' ? 'var(--red)' : 'var(--felt-line)'),
                color: syncStatus === 'synced' ? 'var(--gold)' : syncStatus === 'error' ? 'var(--red)' : 'var(--muted)',
              }}>
              {syncing ? '...' : syncStatus === 'synced' ? '☁ ' + t.syncDone : syncStatus === 'error' ? t.syncError : '☁ ' + t.syncNow}
            </button>
          </div>
        )}
        {!authUser && rounds.length > 0 && (
          <div style={{ textAlign: 'center', paddingBottom: 16 }}>
            <button onClick={() => setShowAuth(true)}
              style={{ fontSize: 11, color: 'var(--muted)', background: 'transparent', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>
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
          dealerIdx={editingIdx != null ? MJ.computeDealerIdx(rounds, settings, editingIdx) : dealerIdx}
          initial={editingRound}
          simpleMode={!!tweaks.simpleMode}
          onSave={saveRound}
          onCancel={() => { setShowEntry(false); setEditingIdx(null); }}
        />
      )}
      {showReview && (
        <Review t={t} settings={settings} players={players} rounds={rounds}
          onEdit={(idx) => { setShowReview(false); editRound(idx); }}
          onDelete={(idx) => deleteRound(idx)}
          onClose={() => setShowReview(false)}
        />
      )}
      {showExport && (
        <ExportSheet t={t} settings={settings} players={players} rounds={rounds}
          onClose={() => setShowExport(false)}
        />
      )}
      {showSettlement && (
        <SettlementSheet t={t} settings={settings} players={players} rounds={rounds}
          onClose={() => setShowSettlement(false)}
        />
      )}
      {showFanCounter && (
        <FanHelper t={t} settings={settings} standalone={true}
          onUse={() => setShowFanCounter(false)}
          onClose={() => setShowFanCounter(false)}
        />
      )}
      {showShare && (
        <ShareSheet t={t} backendSessionId={backendSessionId} authToken={authToken}
          shared={sessionShared} onToggle={toggleShare}
          onClose={() => setShowShare(false)}
        />
      )}
      {sessionNotesOpen && (
        <NotesSheet t={t} value={settings.sessionNotes || ''}
          onChange={updateSessionNotes}
          onClose={() => setSessionNotesOpen(false)}
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
      {showOnboarding && <OnboardingModal t={t} onDone={dismissOnboarding} />}
      <IOSInstallBanner t={t} />
    </div>
  );
}

// ── Share sheet ─────────────────────────────────────────────────────────────
function ShareSheet({ t, backendSessionId, authToken, shared, onToggle, onClose }) {
  const [toast, setToast] = React.useState(null);
  const watchUrl = `${window.location.origin}${window.location.pathname}#watch/${backendSessionId}`;

  function copyLink() {
    navigator.clipboard.writeText(watchUrl).then(() => {
      setToast(t.shareCopied);
      setTimeout(() => setToast(null), 1800);
    });
  }

  return (
    <div className="sheet-backdrop" style={{ zIndex: 300 }} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="sheet" onClick={e => e.stopPropagation()}>
        <div className="sheet-header">
          <h2>{t.shareTitle}</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>
        <div className="sheet-body">
          <p style={{ fontSize: 13, color: 'var(--muted)', marginTop: 0, marginBottom: 20 }}>{t.shareHint}</p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
            <button
              className={"btn btn-block " + (shared ? "btn-secondary" : "btn-primary")}
              onClick={() => onToggle(!shared)}
            >
              {shared ? t.shareDisable : t.shareEnable}
            </button>
          </div>
          {shared && (
            <div>
              <div className="section-title">{t.shareLink}</div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <div style={{ flex: 1, background: 'rgba(0,0,0,0.3)', border: '1px solid var(--felt-line)', borderRadius: 8, padding: '10px 12px', fontSize: 11, color: 'var(--muted)', wordBreak: 'break-all', fontFamily: 'var(--mono)' }}>
                  {watchUrl}
                </div>
                <button className="btn btn-primary" onClick={copyLink} style={{ flexShrink: 0, padding: '10px 16px' }}>
                  📋
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}

// ── Notes sheet ──────────────────────────────────────────────────────────────
function NotesSheet({ t, value, onChange, onClose }) {
  const [draft, setDraft] = React.useState(value);
  function save() { onChange(draft.trim()); onClose(); }
  return (
    <div className="sheet-backdrop" style={{ zIndex: 300 }} onClick={(e) => { if (e.target === e.currentTarget) { save(); } }}>
      <div className="sheet" onClick={e => e.stopPropagation()}>
        <div className="sheet-header">
          <h2>{t.sessionNotesLabel}</h2>
          <button className="close-btn" onClick={() => { save(); }}>×</button>
        </div>
        <div className="sheet-body">
          <input
            type="text"
            value={draft}
            onChange={e => setDraft(e.target.value)}
            placeholder={t.sessionNotesPh}
            autoFocus
            onKeyDown={e => { if (e.key === 'Enter') save(); }}
            style={{ width: '100%' }}
          />
        </div>
        <div className="sheet-footer">
          <button className="btn btn-primary btn-block" onClick={save}>{t.save}</button>
        </div>
      </div>
    </div>
  );
}

// ── Watch view (spectator) ───────────────────────────────────────────────────
function WatchView({ t, sessionId, lang, setLang }) {
  const [session, setSession] = React.useState(null);
  const [error, setError] = React.useState('');
  const [lastUpdate, setLastUpdate] = React.useState(null);

  async function load() {
    try {
      const res = await fetch(`${API}/watch/${sessionId}`);
      if (!res.ok) throw new Error((await res.json()).error || 'Not found');
      const data = await res.json();
      setSession(data.session);
      setLastUpdate(new Date());
      setError('');
    } catch (e) {
      setError(e.message);
    }
  }

  useEffectA(() => {
    load();
    const iv = setInterval(load, 5000);
    return () => clearInterval(iv);
  }, [sessionId]);

  if (error) return (
    <div className="app" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100dvh' }}>
      <div style={{ textAlign: 'center', color: 'var(--muted)', padding: 40 }}>
        <div style={{ fontSize: 32, marginBottom: 12, fontFamily: 'var(--serif)', color: 'var(--gold-deep)' }}>麻</div>
        <div style={{ color: 'var(--red)', marginBottom: 8 }}>{error}</div>
        <button className="btn btn-secondary" onClick={load}>{t.watchRefresh}</button>
      </div>
    </div>
  );

  if (!session) return (
    <div className="app" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100dvh' }}>
      <div style={{ color: 'var(--muted)' }}>...</div>
    </div>
  );

  const { mode, players, rounds, settings } = session;
  const N = mode;
  const totals = MJ.computeTotals(rounds, settings);
  const seatLabels = N === 3 ? [t.east, t.south, t.west] : [t.east, t.south, t.west, t.north];
  const dealerIdx = MJ.computeDealerIdx(rounds, settings, rounds.length);

  return (
    <div className="app">
      <div className="topbar">
        <div className="brand">
          <div className="brand-mark">麻</div>
          <div>
            <div className="brand-name">{t.appName}</div>
            <div className="brand-tag" style={{ color: 'var(--gold)', fontSize: 10 }}>
              ● {t.watchLive} · {t.watchReadOnly}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <LangToggle lang={lang} setLang={setLang} />
          {lastUpdate && <span style={{ fontSize: 10, color: 'var(--muted)' }}>{lastUpdate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>}
        </div>
      </div>
      <div className="content">
        <div className="round-counter">
          <div>
            <div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{t.round}</div>
            <div className="num">#{rounds.length + 1}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{t.dealer}</div>
            <div style={{ color: 'var(--gold)', fontFamily: 'var(--serif)', fontSize: 18 }}>
              {players[dealerIdx]}
            </div>
          </div>
        </div>
        <div className={"scoreboard n" + N}>
          {players.map((p, i) => {
            const v = totals[i];
            return (
              <div key={i} className={"player-tile " + (i === dealerIdx ? 'dealer' : '')}>
                {i === dealerIdx && <span className="pdealer-pin">{t.dealer}</span>}
                <div className="seat">{seatLabels[i]}</div>
                <div className="pname">{p}</div>
                <div className={"ptotal " + (v > 0 ? 'pos' : v < 0 ? 'neg' : '')}>{v > 0 ? '+' : ''}{v}</div>
              </div>
            );
          })}
        </div>
        {settings.sessionNotes && (
          <div style={{ fontSize: 12, color: 'var(--muted)', fontStyle: 'italic', margin: '0 0 12px', padding: '8px 12px', background: 'rgba(0,0,0,0.15)', borderRadius: 8, borderLeft: '2px solid var(--felt-line)' }}>
            {settings.sessionNotes}
          </div>
        )}
        {rounds.length > 0 && (
          <div>
            <div className="section-title">{t.reviewTitle}</div>
            <table className="history-table">
              <thead>
                <tr><th>#</th>{players.map((p, i) => <th key={i}>{p}</th>)}</tr>
              </thead>
              <tbody>
                {rounds.map((r, idx) => {
                  const d = MJ.computeDeltas(r, settings, MJ.computeDealerIdx(rounds, settings, idx));
                  return (
                    <tr key={idx}>
                      <td>{idx + 1}</td>
                      {d.map((v, i) => <td key={i} className={v > 0 ? 'delta-pos' : v < 0 ? 'delta-neg' : 'delta-zero'}>{v > 0 ? '+' : ''}{v}</td>)}
                    </tr>
                  );
                })}
                <tr className="totals">
                  <td>{t.total}</td>
                  {totals.map((v, i) => <td key={i} className={v > 0 ? 'delta-pos' : v < 0 ? 'delta-neg' : 'delta-zero'}>{v > 0 ? '+' : ''}{v}</td>)}
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ── iOS install banner ───────────────────────────────────────────────────────
function IOSInstallBanner({ t }) {
  const [visible, setVisible] = React.useState(() => {
    try {
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
      const isStandalone = window.navigator.standalone;
      const dismissed = localStorage.getItem('pwa-ios-dismissed');
      const isSafari = isIOS && /WebKit/.test(navigator.userAgent) && !/CriOS|FxiOS|OPiOS/.test(navigator.userAgent);
      return isSafari && !isStandalone && !dismissed;
    } catch { return false; }
  });

  if (!visible) return null;

  function dismiss() {
    setVisible(false);
    try { localStorage.setItem('pwa-ios-dismissed', '1'); } catch {}
  }

  return (
    <div style={{
      position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 9999,
      background: 'linear-gradient(180deg,#243d2e 0%,#172b20 100%)',
      borderTop: '1px solid rgba(200,168,75,0.4)',
      padding: '14px 16px 32px',
      display: 'flex', alignItems: 'flex-start', gap: 12,
    }}>
      <div style={{ width: 40, height: 40, borderRadius: 10, background: 'linear-gradient(180deg,#f0e8d5,#ddd0b0)', color: '#2a4038', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--serif)', fontWeight: 700, fontSize: 22, flexShrink: 0 }}>麻</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 700, color: 'var(--gold)', fontSize: 14, marginBottom: 4 }}>{t.iosInstallTitle}</div>
        <div style={{ fontSize: 12, color: 'var(--cream-dim)', lineHeight: 1.6 }}>
          {t.iosInstallHint}
        </div>
        <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 11, color: 'var(--muted)' }}>Safari</span>
          <span style={{ fontSize: 18, color: 'var(--cream-dim)' }}>→</span>
          <span style={{ background: 'rgba(0,122,255,0.2)', border: '1px solid rgba(0,122,255,0.5)', borderRadius: 6, padding: '2px 8px', fontSize: 11, color: '#4da8ff', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <span style={{ fontSize: 14 }}>⬆</span> Share
          </span>
          <span style={{ fontSize: 18, color: 'var(--cream-dim)' }}>→</span>
          <span style={{ background: 'rgba(200,168,75,0.15)', border: '1px solid rgba(200,168,75,0.35)', borderRadius: 6, padding: '2px 8px', fontSize: 11, color: 'var(--gold)' }}>
            Add to Home Screen
          </span>
        </div>
      </div>
      <button onClick={dismiss} style={{ background: 'transparent', border: 'none', color: 'var(--muted)', fontSize: 22, cursor: 'pointer', padding: '0 2px', lineHeight: 1, flexShrink: 0, marginTop: -2 }}>×</button>
    </div>
  );
}

// ── Onboarding modal ─────────────────────────────────────────────────────────
function OnboardingModal({ t, onDone }) {
  const steps = [
    { icon: '⚙', text: t.onboardStep1 },
    { icon: '+', text: t.onboardStep2 },
    { icon: '💰', text: t.onboardStep3 },
    { icon: '👤', text: t.onboardStep4 },
  ];
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9998, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'flex-end' }}>
      <div style={{ width: '100%', background: 'linear-gradient(180deg,#243d2e 0%,#172b20 100%)', borderRadius: '20px 20px 0 0', padding: '28px 20px 40px', borderTop: '1px solid rgba(200,168,75,0.35)' }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ fontSize: 36, fontFamily: 'var(--serif)', color: 'var(--gold)', marginBottom: 10 }}>麻</div>
          <h2 style={{ margin: 0, color: 'var(--cream)', fontSize: 19, fontFamily: 'var(--serif)' }}>{t.onboardTitle}</h2>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 28 }}>
          {steps.map((s, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(200,168,75,0.12)', border: '1px solid rgba(200,168,75,0.3)', color: 'var(--gold)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>{s.icon}</div>
              <div style={{ fontSize: 13, color: 'var(--cream-dim)', lineHeight: 1.55 }}>{s.text}</div>
            </div>
          ))}
        </div>
        <button className="btn btn-primary btn-block btn-lg" onClick={onDone}>{t.onboardGotIt}</button>
      </div>
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
    <button onClick={onClick} title={authUser ? authUser.name : 'Sign in'}
      style={{
        width: 30, height: 30, borderRadius: '50%',
        background: authUser ? 'var(--gold)' : 'var(--felt-2)',
        border: '1px solid ' + (authUser ? 'var(--gold)' : 'var(--felt-line)'),
        color: authUser ? 'var(--felt-1)' : 'var(--muted)',
        fontSize: 13, fontWeight: 700, cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
      {authUser ? authUser.name.charAt(0).toUpperCase() : '👤'}
    </button>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
