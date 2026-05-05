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
      const dIdx = MJ.dealerForRound(idx + 1, N);
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
    // Render the export-preview to canvas using html2canvas-style approach via SVG foreignObject
    const node = document.getElementById('export-preview-node');
    if (!node) return;
    const rect = node.getBoundingClientRect();
    const w = Math.ceil(rect.width), h = Math.ceil(rect.height);
    const data = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><foreignObject width="100%" height="100%"><div xmlns="http://www.w3.org/1999/xhtml">${node.outerHTML}</div></foreignObject></svg>`;
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = w * 2; canvas.height = h * 2;
      const ctx = canvas.getContext('2d');
      ctx.scale(2, 2);
      ctx.drawImage(img, 0, 0);
      canvas.toBlob(blob => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `mahjong-${Date.now()}.png`;
        a.click();
        URL.revokeObjectURL(url);
      });
    };
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(data);
  }

  return (
    <div className="sheet-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="sheet" onClick={e => e.stopPropagation()}>
        <div className="sheet-header">
          <h2>{t.exportTitle}</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>
        <div className="sheet-body">
          <div id="export-preview-node" className="export-preview">
            <h2>{t.appName}</h2>
            <div className="ts">{new Date().toLocaleString()} · {N === 3 ? t.threePlayer : t.fourPlayer}</div>
            <table className="history-table" style={{ background: 'transparent' }}>
              <thead>
                <tr>
                  <th>#</th>
                  {players.map((p, i) => <th key={i}>{p}</th>)}
                </tr>
              </thead>
              <tbody>
                {rounds.map((r, idx) => {
                  const dIdx = MJ.dealerForRound(idx + 1, N);
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
          <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
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
