// Player stats view — win rates, fan averages, game history
const { useState: useStateSV, useEffect: useEffectSV } = React;

const API = '/api';

function StatsView({ t, authToken, onClose }) {
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

  return (
    <div className="sheet-backdrop" style={{ zIndex: 400 }} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="sheet" onClick={e => e.stopPropagation()}>
        <div className="sheet-header">
          <h2>{t.statsTitle}</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>
        <div className="sheet-body">

          {loading && (
            <div style={{ textAlign: 'center', padding: 40, color: 'var(--muted)' }}>...</div>
          )}

          {error && (
            <div style={{ color: 'var(--red)', fontSize: 13, textAlign: 'center', padding: 20 }}>{error}</div>
          )}

          {!loading && !error && stats !== null && (
            <div>
              {/* Summary */}
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

              {/* Search + Sort */}
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

              {/* Player cards */}
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
                  <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
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
                    <span style={{ fontSize: 10, color: 'var(--muted)', marginLeft: 'auto' }}>
                      {s.gamesPlayed} {t.statsGamesSuffix}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {!loading && !error && stats !== null && sessionCount === 0 && (
            <div style={{ textAlign: 'center', color: 'var(--muted)', fontSize: 13, marginTop: 10 }}>
              {t.statsSyncHint}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

window.StatsView = StatsView;
