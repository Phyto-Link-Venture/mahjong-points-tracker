// Player stats view — stats, history, player management
const { useState: useStateSV, useEffect: useEffectSV, useCallback: useCallbackSV } = React;

const API = '/api';

function StatsView({ t, authToken, onClose }) {
  const [activeTab, setActiveTab] = useStateSV('stats');

  return (
    <div className="sheet-backdrop" style={{ zIndex: 400 }} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="sheet" onClick={e => e.stopPropagation()}>
        <div className="sheet-header">
          <h2>{t.statsTitle}</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        {/* Tab bar */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--felt-line)', background: 'var(--felt-2)', position: 'sticky', top: 53, zIndex: 1 }}>
          {[
            { k: 'stats', l: t.tabStats },
            { k: 'history', l: t.tabHistory },
            { k: 'players', l: t.tabPlayers },
          ].map(tab => (
            <button
              key={tab.k}
              onClick={() => setActiveTab(tab.k)}
              style={{
                flex: 1, padding: '10px 0', background: 'transparent', border: 'none',
                borderBottom: activeTab === tab.k ? '2px solid var(--gold)' : '2px solid transparent',
                color: activeTab === tab.k ? 'var(--gold)' : 'var(--muted)',
                fontWeight: activeTab === tab.k ? 600 : 400,
                cursor: 'pointer', fontSize: 13, marginBottom: -1,
              }}
            >
              {tab.l}
            </button>
          ))}
        </div>

        <div className="sheet-body">
          {activeTab === 'stats' && <StatsTab t={t} authToken={authToken} />}
          {activeTab === 'history' && <HistoryTab t={t} authToken={authToken} />}
          {activeTab === 'players' && <PlayersTab t={t} authToken={authToken} />}
        </div>
      </div>
    </div>
  );
}

// ── Stats Tab ───────────────────────────────────────────────────────────────

function StatsTab({ t, authToken }) {
  const [stats, setStats] = useStateSV(null);
  const [sessionCount, setSessionCount] = useStateSV(0);
  const [loading, setLoading] = useStateSV(true);
  const [error, setError] = useStateSV('');
  const [sort, setSort] = useStateSV('winRate');
  const [search, setSearch] = useStateSV('');

  useEffectSV(() => {
    async function load() {
      try {
        const res = await fetch(`${API}/stats`, {
          headers: { Authorization: `Bearer ${authToken}` },
        });
        if (!res.ok) throw new Error('Failed to load stats');
        const data = await res.json();
        setStats(data.stats);
        setSessionCount(data.sessionCount);
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [authToken]);

  const sorted = (stats || [])
    .filter(s => !search || s.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      if (sort === 'winRate') return b.winRate - a.winRate || b.wins - a.wins;
      if (sort === 'wins') return b.wins - a.wins;
      if (sort === 'games') return b.gamesPlayed - a.gamesPlayed;
      return 0;
    });

  if (loading) return <div style={{ textAlign: 'center', padding: 40, color: 'var(--muted)' }}>...</div>;
  if (error) return <div style={{ color: 'var(--red)', fontSize: 13, textAlign: 'center', padding: 20 }}>{error}</div>;
  if (!stats) return null;

  return (
    <div>
      <div style={{ display: 'flex', gap: 10, marginBottom: 18 }}>
        <div style={{ flex: 1, background: 'var(--felt-2)', borderRadius: 10, padding: '12px', textAlign: 'center' }}>
          <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--gold)', fontFamily: 'JetBrains Mono, monospace' }}>{sessionCount}</div>
          <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>{t.statsSessions}</div>
        </div>
        <div style={{ flex: 1, background: 'var(--felt-2)', borderRadius: 10, padding: '12px', textAlign: 'center' }}>
          <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--gold)', fontFamily: 'JetBrains Mono, monospace' }}>{stats.length}</div>
          <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>{t.statsPlayers}</div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
        <input
          type="text"
          placeholder={t.statsSearch}
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ flex: 1, minWidth: 120 }}
        />
        <div style={{ display: 'flex', gap: 4 }}>
          {[
            { k: 'winRate', l: t.statsWinRate },
            { k: 'wins', l: t.statsWins },
            { k: 'games', l: t.statsGames },
          ].map(s => (
            <button
              key={s.k}
              onClick={() => setSort(s.k)}
              style={{
                padding: '5px 10px', borderRadius: 12, fontSize: 11,
                background: sort === s.k ? 'var(--gold)' : 'var(--felt-2)',
                color: sort === s.k ? 'var(--felt-1)' : 'var(--muted)',
                border: '1px solid ' + (sort === s.k ? 'var(--gold)' : 'var(--felt-line)'),
                cursor: 'pointer', fontWeight: sort === s.k ? 600 : 400,
              }}
            >
              {s.l}
            </button>
          ))}
        </div>
      </div>

      {sorted.length === 0 ? (
        <div style={{ textAlign: 'center', color: 'var(--muted)', padding: '30px 0', fontSize: 13 }}>
          {search ? t.statsNoMatch : t.statsEmpty}
        </div>
      ) : sorted.map((s, idx) => (
        <div key={s.name} style={{ background: 'var(--felt-2)', borderRadius: 12, padding: '14px', marginBottom: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{
                width: 28, height: 28, borderRadius: '50%',
                background: idx === 0 ? 'var(--gold)' : 'var(--felt-3)',
                color: idx === 0 ? 'var(--felt-1)' : 'var(--muted)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 11, fontWeight: 700,
              }}>
                #{idx + 1}
              </div>
              <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--cream)' }}>{s.name}</span>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--gold)', fontFamily: 'JetBrains Mono, monospace' }}>
                {s.winRate}%
              </div>
              <div style={{ fontSize: 10, color: 'var(--muted)' }}>{t.statsWinRate}</div>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
            {[
              { label: t.statsWins, value: s.wins },
              { label: t.statsDecided, value: s.decidedRounds },
              { label: t.statsAvgFan, value: s.avgFan },
              { label: t.statsLimit, value: s.limitHands },
            ].map(cell => (
              <div key={cell.label} style={{ background: 'var(--felt-3)', borderRadius: 8, padding: '6px 8px', textAlign: 'center' }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--cream)', fontFamily: 'JetBrains Mono, monospace' }}>{cell.value}</div>
                <div style={{ fontSize: 9, color: 'var(--muted)', marginTop: 1 }}>{cell.label}</div>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
            {s.selfDrawWins > 0 && (
              <span style={{ fontSize: 10, background: 'rgba(212,175,55,0.15)', color: 'var(--gold)', padding: '2px 8px', borderRadius: 10 }}>
                {t.selfDraw.split(' ')[0]} ×{s.selfDrawWins}
              </span>
            )}
            {s.discardWins > 0 && (
              <span style={{ fontSize: 10, background: 'rgba(255,255,255,0.05)', color: 'var(--muted)', padding: '2px 8px', borderRadius: 10 }}>
                {t.discard.split(' ')[0]} ×{s.discardWins}
              </span>
            )}
            {s.recentForm && s.recentForm.length > 0 && (
              <span style={{ display: 'flex', gap: 3, marginLeft: 2 }}>
                {s.recentForm.map((result, ri) => (
                  <span key={ri} style={{
                    width: 16, height: 16, borderRadius: '50%', fontSize: 9, fontWeight: 700,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: result === 'W' ? 'var(--green-pos)' : result === 'L' ? 'var(--red)' : 'var(--felt-3)',
                    color: result === 'W' ? '#0a1f14' : result === 'L' ? '#1f0a0a' : 'var(--muted)',
                  }}>{result}</span>
                ))}
              </span>
            )}
            <span style={{ fontSize: 10, color: 'var(--muted)', marginLeft: 'auto' }}>
              {s.gamesPlayed} {t.statsGamesSuffix}
            </span>
          </div>
        </div>
      ))}

      {sessionCount === 0 && (
        <div style={{ textAlign: 'center', color: 'var(--muted)', fontSize: 13, marginTop: 10 }}>
          {t.statsSyncHint}
        </div>
      )}
    </div>
  );
}

// ── History Tab ─────────────────────────────────────────────────────────────

function HistoryTab({ t, authToken }) {
  const [sessions, setSessions] = useStateSV(null);
  const [loading, setLoading] = useStateSV(true);
  const [error, setError] = useStateSV('');
  const [expandedId, setExpandedId] = useStateSV(null);
  const [confirm, setConfirm] = useStateSV(null);

  useEffectSV(() => {
    loadSessions();
  }, [authToken]);

  async function loadSessions() {
    setLoading(true);
    try {
      const res = await fetch(`${API}/sessions`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (!res.ok) throw new Error('Failed to load history');
      const data = await res.json();
      setSessions(data.sessions);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function deleteSession(id) {
    try {
      await fetch(`${API}/sessions/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${authToken}` },
      });
      setSessions(prev => prev.filter(s => s.id !== id));
      if (expandedId === id) setExpandedId(null);
    } catch {}
    setConfirm(null);
  }

  if (loading) return <div style={{ textAlign: 'center', padding: 40, color: 'var(--muted)' }}>...</div>;
  if (error) return <div style={{ color: 'var(--red)', fontSize: 13, textAlign: 'center', padding: 20 }}>{error}</div>;
  if (!sessions || sessions.length === 0) {
    return <div style={{ textAlign: 'center', color: 'var(--muted)', padding: '40px 0', fontSize: 13 }}>{t.historyEmpty}</div>;
  }

  return (
    <div>
      {sessions.map(session => {
        const players = Array.isArray(session.players) ? session.players : [];
        const rounds = Array.isArray(session.rounds) ? session.rounds : [];
        const settings = session.settings || {};
        const N = session.mode;
        const isExpanded = expandedId === session.id;
        const date = new Date(session.startedAt);

        return (
          <div key={session.id} style={{ background: 'var(--felt-2)', borderRadius: 12, marginBottom: 10, overflow: 'hidden' }}>
            {/* Session header row */}
            <div style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--cream)', marginBottom: 3 }}>
                  {players.join(' · ') || '—'}
                </div>
                <div style={{ fontSize: 11, color: 'var(--muted)' }}>
                  {date.toLocaleDateString()} {date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  &nbsp;·&nbsp;{N === 3 ? t.threePlayer : t.fourPlayer}
                  &nbsp;·&nbsp;{rounds.length} {t.historyRounds}
                </div>
              </div>
              <button
                onClick={() => setExpandedId(isExpanded ? null : session.id)}
                style={{ fontSize: 11, padding: '5px 10px', borderRadius: 10, background: isExpanded ? 'var(--gold)' : 'rgba(255,255,255,0.08)', border: '1px solid ' + (isExpanded ? 'var(--gold)' : 'var(--felt-line)'), color: isExpanded ? 'var(--felt-1)' : 'var(--cream-dim)', cursor: 'pointer', fontWeight: 500, whiteSpace: 'nowrap' }}
              >
                {isExpanded ? t.historyCollapse : t.historyView}
              </button>
              <button
                onClick={() => setConfirm(session.id)}
                style={{ fontSize: 11, padding: '5px 10px', borderRadius: 10, background: 'transparent', border: '1px solid var(--felt-line)', color: 'var(--red)', cursor: 'pointer', whiteSpace: 'nowrap' }}
              >
                {t.historyDelete}
              </button>
            </div>

            {/* Expanded score table */}
            {isExpanded && rounds.length > 0 && settings.mode && (
              <div style={{ borderTop: '1px solid var(--felt-line)', padding: '0 0 14px', overflowX: 'auto' }}>
                <table className="history-table" style={{ margin: '12px 14px 0', width: 'calc(100% - 28px)' }}>
                  <thead>
                    <tr>
                      <th>#</th>
                      {players.map((p, i) => <th key={i}>{p}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {rounds.map((r, idx) => {
                      const dIdx = MJ.computeDealerIdx(rounds, settings, idx);
                      const d = MJ.computeDeltas(r, settings, dIdx);
                      return (
                        <tr key={idx}>
                          <td>{idx + 1}</td>
                          {d.map((v, i) => (
                            <td key={i} className={v > 0 ? 'delta-pos' : v < 0 ? 'delta-neg' : 'delta-zero'}>
                              {v > 0 ? '+' : ''}{v}
                            </td>
                          ))}
                        </tr>
                      );
                    })}
                    <tr className="totals">
                      <td>{t.total}</td>
                      {MJ.computeTotals(rounds, settings).map((v, i) => (
                        <td key={i} className={v > 0 ? 'delta-pos' : v < 0 ? 'delta-neg' : 'delta-zero'}>
                          {v > 0 ? '+' : ''}{v}
                        </td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );
      })}

      {/* Delete confirmation */}
      {confirm && (
        <div className="sheet-backdrop" style={{ zIndex: 500, alignItems: 'center' }} onClick={(e) => { if (e.target === e.currentTarget) setConfirm(null); }}>
          <div className="confirm">
            <h3>{t.appName}</h3>
            <p>{t.historyDeleteConfirm}</p>
            <div className="confirm-actions">
              <button className="btn btn-secondary" onClick={() => setConfirm(null)}>{t.no}</button>
              <button className="btn btn-danger" onClick={() => deleteSession(confirm)}>{t.historyDelete}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Players Tab ─────────────────────────────────────────────────────────────

function PlayersTab({ t, authToken }) {
  const [players, setPlayers] = useStateSV(null);
  const [loading, setLoading] = useStateSV(true);
  const [error, setError] = useStateSV('');
  const [renamingName, setRenamingName] = useStateSV(null);
  const [newName, setNewName] = useStateSV('');
  const [renaming, setRenaming] = useStateSV(false);
  const [toast, setToast] = useStateSV(null);

  useEffectSV(() => {
    loadPlayers();
  }, [authToken]);

  async function loadPlayers() {
    setLoading(true);
    try {
      const res = await fetch(`${API}/players`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (!res.ok) throw new Error('Failed to load players');
      const data = await res.json();
      setPlayers(data.players);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function doRename() {
    if (!newName.trim() || newName.trim() === renamingName) return;
    setRenaming(true);
    try {
      const res = await fetch(`${API}/players/rename`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({ from: renamingName, to: newName.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Rename failed');
      setToast(t.playerRenameSuccess);
      setTimeout(() => setToast(null), 2000);
      setRenamingName(null);
      setNewName('');
      loadPlayers();
    } catch (e) {
      setError(e.message);
    } finally {
      setRenaming(false);
    }
  }

  if (loading) return <div style={{ textAlign: 'center', padding: 40, color: 'var(--muted)' }}>...</div>;
  if (error) return <div style={{ color: 'var(--red)', fontSize: 13, textAlign: 'center', padding: 20 }}>{error}</div>;

  return (
    <div>
      <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 16, lineHeight: 1.5 }}>
        {t.playerMgmtHint}
      </div>

      {(!players || players.length === 0) ? (
        <div style={{ textAlign: 'center', color: 'var(--muted)', padding: '30px 0', fontSize: 13 }}>{t.historyEmpty}</div>
      ) : players.map(name => (
        <div key={name} style={{ background: 'var(--felt-2)', borderRadius: 10, padding: '12px 14px', marginBottom: 8 }}>
          {renamingName === name ? (
            <div>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 8 }}>
                {name} →
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  type="text"
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  placeholder={t.playerRenameTo}
                  autoFocus
                  onKeyDown={e => { if (e.key === 'Enter') doRename(); if (e.key === 'Escape') { setRenamingName(null); setNewName(''); } }}
                  style={{ flex: 1 }}
                />
                <button
                  className="btn btn-primary"
                  onClick={doRename}
                  disabled={renaming || !newName.trim() || newName.trim() === name}
                  style={{ padding: '8px 14px', opacity: (renaming || !newName.trim() || newName.trim() === name) ? 0.5 : 1 }}
                >
                  {renaming ? '...' : t.playerRenameConfirm}
                </button>
                <button
                  className="btn btn-secondary"
                  onClick={() => { setRenamingName(null); setNewName(''); }}
                  style={{ padding: '8px 14px' }}
                >
                  {t.playerRenameCancel}
                </button>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 15, fontWeight: 500, color: 'var(--cream)' }}>{name}</span>
              <button
                onClick={() => { setRenamingName(name); setNewName(name); }}
                style={{ fontSize: 12, padding: '5px 12px', borderRadius: 10, background: 'transparent', border: '1px solid var(--felt-line)', color: 'var(--cream-dim)', cursor: 'pointer' }}
              >
                {t.playerRenameBtn} ✏
              </button>
            </div>
          )}
        </div>
      ))}

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}

window.StatsView = StatsView;
