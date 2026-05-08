// Export sheet
const { useState: useStateEx } = React;

function ExportSheet({ t, settings, players, rounds, onClose }) {
  const [toast, setToast] = useStateEx(null);
  const N = settings.mode;
  const seatLabels = N === 3 ? [t.east, t.south, t.west] : [t.east, t.south, t.west, t.north];
  const totals = MJ.computeTotals(rounds, settings);

  function buildText() {
    const lines = [];
    lines.push(`${t.appName} — ${N === 3 ? t.threePlayer : t.fourPlayer}`);
    lines.push(new Date().toLocaleString());
    lines.push("");
    lines.push(t.players + ":");
    players.forEach((p, i) => lines.push(`  ${seatLabels[i]} · ${p}`));
    lines.push("");
    lines.push(t.reviewTitle + ":");
    rounds.forEach((r, idx) => {
      const dIdx = MJ.computeDealerIdx(rounds, settings, idx);
      const d = MJ.computeDeltas(r, settings, dIdx);
      const sum = window.summarizeRound(r, players, t);
      lines.push(`#${idx + 1} ${sum}`);
      const parts = players.map((p, i) => `${p}: ${d[i] > 0 ? '+' : ''}${d[i]}`);
      lines.push("  " + parts.join("  "));
    });
    lines.push("");
    lines.push(t.total + ":");
    players.forEach((p, i) => lines.push(`  ${p}: ${totals[i] > 0 ? '+' : ''}${totals[i]}`));
    return lines.join("\n");
  }

  function copyText() {
    const txt = buildText();
    navigator.clipboard.writeText(txt).then(() => {
      setToast(t.copied);
      setTimeout(() => setToast(null), 1500);
    });
  }

  function saveImage() {
    const SCALE = 2;
    const PAD = 32;
    const ROUND_COL = 52;
    const COL_W = N === 3 ? 148 : 120;
    const W = PAD * 2 + ROUND_COL + N * COL_W;
    const HEADER_H = 82;
    const COL_HDR_H = 42;
    const ROW_H = 44;
    const FOOTER_H = 36;
    const H = HEADER_H + COL_HDR_H + (rounds.length + 1) * ROW_H + FOOTER_H;

    const canvas = document.createElement('canvas');
    canvas.width = W * SCALE;
    canvas.height = H * SCALE;
    const ctx = canvas.getContext('2d');
    ctx.scale(SCALE, SCALE);

    function rr(x, y, w, h, r) {
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.lineTo(x + w - r, y);
      ctx.arcTo(x + w, y, x + w, y + r, r);
      ctx.lineTo(x + w, y + h - r);
      ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
      ctx.lineTo(x + r, y + h);
      ctx.arcTo(x, y + h, x, y + h - r, r);
      ctx.lineTo(x, y + r);
      ctx.arcTo(x, y, x + r, y, r);
      ctx.closePath();
    }

    // Felt background gradient
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#334d3c');
    bg.addColorStop(1, '#1c2f25');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    // Subtle grid texture
    ctx.strokeStyle = 'rgba(255,255,255,0.022)';
    ctx.lineWidth = 0.5;
    for (let x = 0; x < W; x += 22) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
    }
    for (let y = 0; y < H; y += 22) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    }

    // Header background
    ctx.fillStyle = 'rgba(0,0,0,0.24)';
    ctx.fillRect(0, 0, W, HEADER_H);

    // Brand tile (麻 character on ivory tile)
    rr(PAD, 18, 40, 40, 7);
    ctx.fillStyle = '#f0e8d0';
    ctx.fill();
    ctx.shadowColor = 'rgba(0,0,0,0.3)';
    ctx.shadowBlur = 4;
    ctx.shadowOffsetY = 2;
    ctx.fillStyle = '#2a4038';
    ctx.font = 'bold 24px serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('麻', PAD + 20, 18 + 21);
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;

    // App name
    ctx.fillStyle = '#c8a84b';
    ctx.font = 'bold 17px Georgia, serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText('Mahjong Points', PAD + 52, 36);

    // Date + mode tagline
    ctx.fillStyle = 'rgba(255,255,255,0.42)';
    ctx.font = '12px Arial, sans-serif';
    ctx.fillText(new Date().toLocaleString() + '   ·   ' + (N === 3 ? t.threePlayer : t.fourPlayer), PAD + 52, 55);

    // Gold gradient divider
    const divGrad = ctx.createLinearGradient(PAD, 0, W - PAD, 0);
    divGrad.addColorStop(0, 'rgba(200,168,75,0)');
    divGrad.addColorStop(0.12, 'rgba(200,168,75,0.9)');
    divGrad.addColorStop(0.88, 'rgba(200,168,75,0.9)');
    divGrad.addColorStop(1, 'rgba(200,168,75,0)');
    ctx.strokeStyle = divGrad;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(PAD, HEADER_H - 8);
    ctx.lineTo(W - PAD, HEADER_H - 8);
    ctx.stroke();

    // Column header background
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.fillRect(0, HEADER_H, W, COL_HDR_H);

    // '#' label
    ctx.fillStyle = 'rgba(255,255,255,0.28)';
    ctx.font = '500 11px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('#', PAD + ROUND_COL / 2, HEADER_H + COL_HDR_H / 2);

    // Player name + seat headers
    for (let i = 0; i < N; i++) {
      const cx = PAD + ROUND_COL + i * COL_W + COL_W / 2;
      const cy = HEADER_H + COL_HDR_H / 2;

      let name = players[i];
      ctx.font = 'bold 13px Arial, sans-serif';
      while (ctx.measureText(name).width > COL_W - 16 && name.length > 2) name = name.slice(0, -1);
      if (name !== players[i]) name += '…';

      ctx.fillStyle = '#c8a84b';
      ctx.font = 'bold 13px Arial, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(name, cx, cy - 6);

      ctx.fillStyle = 'rgba(200,168,75,0.55)';
      ctx.font = '10px Arial, sans-serif';
      ctx.fillText(seatLabels[i], cx, cy + 9);
    }

    // Column dividers in header
    ctx.strokeStyle = 'rgba(255,255,255,0.07)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= N; i++) {
      const lx = PAD + ROUND_COL + i * COL_W;
      ctx.beginPath(); ctx.moveTo(lx, HEADER_H); ctx.lineTo(lx, HEADER_H + COL_HDR_H); ctx.stroke();
    }

    // Round rows
    const rowsY = HEADER_H + COL_HDR_H;
    rounds.forEach((r, idx) => {
      const dIdx = MJ.computeDealerIdx(rounds, settings, idx);
      const d = MJ.computeDeltas(r, settings, dIdx);
      const ry = rowsY + idx * ROW_H;

      if (idx % 2 === 1) {
        ctx.fillStyle = 'rgba(0,0,0,0.09)';
        ctx.fillRect(0, ry, W, ROW_H);
      }

      // Round number
      ctx.fillStyle = 'rgba(255,255,255,0.28)';
      ctx.font = '12px "Courier New", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(idx + 1), PAD + ROUND_COL / 2, ry + ROW_H / 2);

      // Deltas
      for (let i = 0; i < N; i++) {
        const v = d[i];
        const cx = PAD + ROUND_COL + i * COL_W + COL_W / 2;
        const cy = ry + ROW_H / 2;
        if (v > 0) ctx.fillStyle = '#68c492';
        else if (v < 0) ctx.fillStyle = '#d97272';
        else ctx.fillStyle = 'rgba(255,255,255,0.2)';
        ctx.font = '600 14px "Courier New", monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText((v > 0 ? '+' : '') + v, cx, cy);
      }

      // Row bottom + column dividers
      ctx.strokeStyle = 'rgba(255,255,255,0.05)';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(0, ry + ROW_H); ctx.lineTo(W, ry + ROW_H); ctx.stroke();
      for (let i = 0; i <= N; i++) {
        const lx = PAD + ROUND_COL + i * COL_W;
        ctx.beginPath(); ctx.moveTo(lx, ry); ctx.lineTo(lx, ry + ROW_H); ctx.stroke();
      }
    });

    // Totals row
    const totY = rowsY + rounds.length * ROW_H;
    ctx.fillStyle = 'rgba(200,168,75,0.12)';
    ctx.fillRect(0, totY, W, ROW_H);

    const totLineGrad = ctx.createLinearGradient(0, 0, W, 0);
    totLineGrad.addColorStop(0, 'rgba(200,168,75,0)');
    totLineGrad.addColorStop(0.08, 'rgba(200,168,75,0.7)');
    totLineGrad.addColorStop(0.92, 'rgba(200,168,75,0.7)');
    totLineGrad.addColorStop(1, 'rgba(200,168,75,0)');
    ctx.strokeStyle = totLineGrad;
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, totY); ctx.lineTo(W, totY); ctx.stroke();

    ctx.fillStyle = '#c8a84b';
    ctx.font = 'bold 10px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(t.total.toUpperCase(), PAD + ROUND_COL / 2, totY + ROW_H / 2);

    for (let i = 0; i < N; i++) {
      const v = totals[i];
      const cx = PAD + ROUND_COL + i * COL_W + COL_W / 2;
      const cy = totY + ROW_H / 2;
      if (v > 0) ctx.fillStyle = '#68c492';
      else if (v < 0) ctx.fillStyle = '#d97272';
      else ctx.fillStyle = 'rgba(255,255,255,0.3)';
      ctx.font = 'bold 16px "Courier New", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText((v > 0 ? '+' : '') + v, cx, cy);
    }

    ctx.strokeStyle = 'rgba(200,168,75,0.2)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= N; i++) {
      const lx = PAD + ROUND_COL + i * COL_W;
      ctx.beginPath(); ctx.moveTo(lx, totY); ctx.lineTo(lx, totY + ROW_H); ctx.stroke();
    }

    // Footer
    ctx.fillStyle = 'rgba(255,255,255,0.16)';
    ctx.font = '10px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Malaysian Mahjong · mahjongpoints.app', W / 2, totY + ROW_H + 16);

    // Outer gold border
    const borderGrad = ctx.createLinearGradient(0, 0, W, H);
    borderGrad.addColorStop(0, 'rgba(200,168,75,0.55)');
    borderGrad.addColorStop(0.5, 'rgba(200,168,75,0.3)');
    borderGrad.addColorStop(1, 'rgba(200,168,75,0.55)');
    ctx.strokeStyle = borderGrad;
    ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, W - 2, H - 2);

    canvas.toBlob(blob => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `mahjong-${Date.now()}.png`;
      a.click();
      URL.revokeObjectURL(url);
    }, 'image/png');

    setToast(t.exportImageSaved);
    setTimeout(() => setToast(null), 1800);
  }

  return (
    <div className="sheet-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="sheet" onClick={e => e.stopPropagation()}>
        <div className="sheet-header">
          <h2>{t.exportTitle}</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>
        <div className="sheet-body">
          {/* Preview table */}
          <div className="export-preview">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <div style={{ width: 32, height: 32, borderRadius: 6, background: 'linear-gradient(180deg, #f0e8d5, #ddd0b0)', color: 'var(--felt-1)', display: 'grid', placeItems: 'center', fontFamily: 'var(--serif)', fontWeight: 700, fontSize: 18, flexShrink: 0 }}>麻</div>
              <div>
                <div style={{ fontFamily: 'var(--serif)', fontSize: 16, color: 'var(--gold)', fontWeight: 700 }}>{t.appName}</div>
                <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 1 }}>{new Date().toLocaleString()} · {N === 3 ? t.threePlayer : t.fourPlayer}</div>
              </div>
            </div>
            <table className="history-table" style={{ background: 'transparent' }}>
              <thead>
                <tr>
                  <th>#</th>
                  {players.map((p, i) => <th key={i}><div style={{ fontSize: 11 }}>{p}</div><div style={{ fontSize: 9, color: 'rgba(200,168,75,0.6)', fontWeight: 400 }}>{seatLabels[i]}</div></th>)}
                </tr>
              </thead>
              <tbody>
                {rounds.map((r, idx) => {
                  const dIdx = MJ.computeDealerIdx(rounds, settings, idx);
                  const d = MJ.computeDeltas(r, settings, dIdx);
                  return (
                    <tr key={r.id}>
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
                  {totals.map((v, i) => (
                    <td key={i} className={v > 0 ? 'delta-pos' : v < 0 ? 'delta-neg' : 'delta-zero'}>
                      {v > 0 ? '+' : ''}{v}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
            <button className="btn btn-secondary btn-block" onClick={copyText}>📋 {t.exportText}</button>
            <button className="btn btn-primary btn-block" onClick={saveImage}>🖼 {t.exportImage}</button>
          </div>
        </div>
      </div>
      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}

window.ExportSheet = ExportSheet;
