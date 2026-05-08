// Score progression chart — SVG line chart
function ScoreChart({ players, rounds, settings, playerColors }) {
  if (rounds.length < 2) return null;
  const N = settings.mode;
  const colors = playerColors || MJ.PLAYER_COLORS.slice(0, N);

  // Build running totals per round
  const series = players.map(() => [0]);
  const acc = new Array(N).fill(0);
  rounds.forEach((r, idx) => {
    const d = MJ.computeDeltas(r, settings, MJ.computeDealerIdx(rounds, settings, idx));
    for (let i = 0; i < N; i++) acc[i] += d[i];
    players.forEach((_, i) => series[i].push(acc[i]));
  });

  const W = 340, H = 140, PAD_L = 36, PAD_R = 48, PAD_T = 12, PAD_B = 20;
  const plotW = W - PAD_L - PAD_R;
  const plotH = H - PAD_T - PAD_B;

  const allVals = series.flat();
  const rawMin = Math.min(...allVals);
  const rawMax = Math.max(...allVals);
  const span = rawMax - rawMin || 1;
  const yMin = rawMin - span * 0.08;
  const yMax = rawMax + span * 0.08;
  const zeroFrac = Math.max(0, Math.min(1, (0 - yMin) / (yMax - yMin)));

  function px(xi) { return PAD_L + (xi / (series[0].length - 1)) * plotW; }
  function py(v)  { return PAD_T + (1 - (v - yMin) / (yMax - yMin)) * plotH; }

  const zeroY = PAD_T + (1 - zeroFrac) * plotH;

  // Y axis labels (3-4 ticks)
  const tickCount = 4;
  const ticks = Array.from({ length: tickCount }, (_, i) => {
    const v = yMin + (yMax - yMin) * (i / (tickCount - 1));
    return Math.round(v);
  });

  // Name initials for end labels
  function initials(name) { return name.slice(0, 2); }

  return (
    <div className="chart-wrap">
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ display: 'block', overflow: 'visible' }}>
        {/* Zero line */}
        <line x1={PAD_L} y1={zeroY} x2={PAD_L + plotW} y2={zeroY}
          stroke="rgba(255,255,255,0.15)" strokeWidth={1} strokeDasharray="4 3" />

        {/* Y axis ticks */}
        {ticks.map((v, i) => {
          const y = py(v);
          return (
            <g key={i}>
              <text x={PAD_L - 4} y={y + 4} textAnchor="end" fontSize={8}
                fill="rgba(255,255,255,0.3)" fontFamily="monospace">
                {v > 0 ? '+' : ''}{v}
              </text>
            </g>
          );
        })}

        {/* Player lines */}
        {series.map((pts, pi) => {
          const points = pts.map((v, xi) => `${px(xi)},${py(v)}`).join(' ');
          const lastX = px(pts.length - 1);
          const lastY = py(pts[pts.length - 1]);
          const lastVal = pts[pts.length - 1];
          return (
            <g key={pi}>
              <polyline points={points} fill="none" stroke={colors[pi]}
                strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" opacity={0.9} />
              {/* End dot */}
              <circle cx={lastX} cy={lastY} r={3} fill={colors[pi]} />
              {/* Name + value label */}
              <text x={lastX + 5} y={lastY + 4} fontSize={9} fill={colors[pi]}
                fontFamily="monospace" fontWeight="700">
                {initials(players[pi])}
              </text>
            </g>
          );
        })}

        {/* X axis round numbers — just first and last */}
        <text x={PAD_L} y={H - 4} textAnchor="middle" fontSize={8} fill="rgba(255,255,255,0.25)">1</text>
        <text x={PAD_L + plotW} y={H - 4} textAnchor="middle" fontSize={8} fill="rgba(255,255,255,0.25)">
          {rounds.length}
        </text>
      </svg>
    </div>
  );
}

window.ScoreChart = ScoreChart;
