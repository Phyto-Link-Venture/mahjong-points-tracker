// Voice round entry — Whisper (local) for speech-to-text, Gemma (server) for structured parsing
const { useState: useStateVE, useEffect: useEffectVE, useRef: useRefVE } = React;

const WHISPER_MODEL = 'Xenova/whisper-tiny';
const API = '/api';

// Regex fallback parser (used if AI endpoint fails or user not logged in)
function parseRoundFallback(text, players, settings) {
  const lower = text.toLowerCase().replace(/[.,!?。，！？]/g, ' ');
  const sorted = players
    .map((p, i) => ({ name: p.toLowerCase().trim(), i }))
    .filter(x => x.name.length >= 2)
    .sort((a, b) => b.name.length - a.name.length);

  let winnerIdx = null;
  for (const { name, i } of sorted) {
    if (lower.includes(name)) { winnerIdx = i; break; }
  }

  const wordNums = { one:1,two:2,three:3,four:4,five:5,six:6,seven:7,eight:8,nine:9,ten:10,eleven:11,twelve:12,thirteen:13 };
  let fan = null;
  const fanMatch = lower.match(/(\d+)\s*fan/);
  if (fanMatch) fan = parseInt(fanMatch[1]);
  if (!fan) for (const [w, n] of Object.entries(wordNums)) { if (new RegExp('\\b' + w + '\\b').test(lower)) { fan = n; break; } }
  if (!fan) { const m = lower.match(/\b(1[0-3]|[1-9])\b/); if (m) fan = parseInt(m[1]); }
  if (!fan) fan = settings.minFan;
  fan = Math.min(fan, settings.maxFan);

  let outcome = 'self';
  if (/self.?draw|tsumo|zi.?mo|自摸|zimo/.test(lower)) outcome = 'self';
  else if (/discard|食糊|ron|buang|oleh/.test(lower)) outcome = 'discard';

  let discarderIdx = null;
  if (outcome === 'discard') {
    for (const { name, i } of sorted) {
      if (i !== winnerIdx && lower.includes(name)) { discarderIdx = i; break; }
    }
  }

  const N = settings.mode;
  const bonuses = Array(N).fill(null).map((_, i) => ({ playerIdx: i, flowers: 0, flies: 0, openKongs: 0, closedKongs: 0 }));
  return { winnerIdx, fan, outcome, discarderIdx, bonuses };
}

// Map AI response into RoundEntry-compatible bonus format
function toRoundEntryBonuses(aiBonuses, N) {
  return Array(N).fill(null).map((_, i) => {
    const b = (aiBonuses || []).find(x => x.playerIdx === i) || {};
    return { flowers: b.flowers || 0, flies: b.flies || 0, openKongs: b.openKongs || 0, closedKongs: b.closedKongs || 0, fedKongFeeders: {} };
  });
}

function VoiceEntry({ t, settings, players, dealerIdx, authToken, onParsed, onClose }) {
  const [phase, setPhase] = useStateVE('init'); // init|loading|ready|recording|transcribing|parsing|review|error
  const [progress, setProgress] = useStateVE(0);
  const [transcript, setTranscript] = useStateVE('');
  const [parsed, setParsed] = useStateVE(null);
  const [aiUsed, setAiUsed] = useStateVE(false);
  const [errMsg, setErrMsg] = useStateVE(null);
  const [seconds, setSeconds] = useStateVE(0);

  const pipeRef = useRefVE(null);
  const mrRef = useRefVE(null);
  const chunksRef = useRefVE([]);
  const timerRef = useRefVE(null);

  useEffectVE(() => {
    loadWhisper();
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      try { if (mrRef.current?.state === 'recording') mrRef.current.stop(); } catch {}
    };
  }, []);

  async function loadWhisper() {
    if (pipeRef.current) { setPhase('ready'); return; }
    let mod = window.XenovaTransformers;
    if (!mod) {
      await new Promise((resolve, reject) => {
        const t = setTimeout(() => reject(), 8000);
        document.addEventListener('xenova-ready', () => { clearTimeout(t); resolve(); }, { once: true });
      }).catch(() => {});
      mod = window.XenovaTransformers;
    }
    if (!mod) { setPhase('error'); setErrMsg('Whisper AI unavailable. Please refresh.'); return; }

    setPhase('loading');
    try {
      pipeRef.current = await mod.pipeline('automatic-speech-recognition', WHISPER_MODEL, {
        progress_callback: p => { if (p.status === 'downloading' && p.total > 0) setProgress(Math.round(p.loaded / p.total * 100)); },
      });
      setPhase('ready');
    } catch (e) {
      setPhase('error');
      setErrMsg('Could not load Whisper: ' + (e.message || 'unknown'));
    }
  }

  async function startRecording() {
    setErrMsg(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      const mr = new MediaRecorder(stream);
      mrRef.current = mr;
      chunksRef.current = [];
      mr.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mr.onstop = () => { stream.getTracks().forEach(tr => tr.stop()); doTranscribe(); };
      mr.start(100);
      setPhase('recording');
      setSeconds(0);
      timerRef.current = setInterval(() => setSeconds(s => s + 1), 1000);
    } catch (e) {
      setErrMsg('Microphone access denied — please allow mic permission.');
    }
  }

  function stopRecording() {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    try { if (mrRef.current?.state !== 'inactive') mrRef.current.stop(); } catch {}
    setPhase('transcribing');
  }

  async function doTranscribe() {
    try {
      const blob = new Blob(chunksRef.current, { type: chunksRef.current[0]?.type || 'audio/webm' });
      const arrayBuffer = await blob.arrayBuffer();
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });
      let decoded;
      try { decoded = await audioCtx.decodeAudioData(arrayBuffer); } finally { audioCtx.close(); }

      const result = await pipeRef.current(decoded.getChannelData(0), { language: null, task: 'transcribe', return_timestamps: false });
      const text = (result.text || '').trim();

      if (!text) {
        setErrMsg('Nothing detected — try speaking closer to the mic.');
        setPhase('ready');
        return;
      }

      setTranscript(text);
      setPhase('parsing');
      await doParse(text);
    } catch (e) {
      setErrMsg('Transcription failed: ' + (e.message || 'unknown'));
      setPhase('ready');
    }
  }

  async function doParse(text) {
    // Try Gemma on server first
    if (authToken) {
      try {
        const r = await fetch(`${API}/ai/parse-round`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
          body: JSON.stringify({ transcript: text, players, mode: settings.mode }),
          signal: AbortSignal.timeout(50000),
        });
        if (r.ok) {
          const { parsed: aiParsed } = await r.json();
          const bonuses = toRoundEntryBonuses(aiParsed.bonuses, settings.mode);
          setParsed({
            winnerIdx: aiParsed.winnerIdx ?? null,
            fan: aiParsed.fan ?? settings.minFan,
            outcome: aiParsed.outcome || 'self',
            discarderIdx: aiParsed.discarderIdx ?? null,
            bonuses,
          });
          setAiUsed(true);
          setPhase('review');
          return;
        }
      } catch {}
    }

    // Fallback to regex
    const fallback = parseRoundFallback(text, players, settings);
    setParsed({ ...fallback, bonuses: toRoundEntryBonuses(fallback.bonuses, settings.mode) });
    setAiUsed(false);
    setPhase('review');
  }

  function retry() { setPhase('ready'); setTranscript(''); setParsed(null); setErrMsg(null); setAiUsed(false); }

  const seatLabels = settings.mode === 3
    ? [t.east, t.south, t.west]
    : [t.east, t.south, t.west, t.north];

  const hasAnyStat = parsed && parsed.bonuses && parsed.bonuses.some(b => b.flowers || b.flies || b.openKongs || b.closedKongs);

  return (
    <div className="sheet-backdrop" style={{ zIndex: 200 }} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="sheet" onClick={e => e.stopPropagation()}>
        <div className="sheet-header">
          <h2>🎙 Voice Round</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>
        <div className="sheet-body">

          {errMsg && (
            <div style={{ background: 'var(--red-dim)', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 13, color: 'var(--cream)', lineHeight: 1.5 }}>
              {errMsg}
            </div>
          )}

          {/* Downloading Whisper */}
          {phase === 'loading' && (
            <div style={{ textAlign: 'center', padding: '24px 0' }}>
              <div style={{ fontSize: 40, marginBottom: 14 }}>🧠</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--cream)', marginBottom: 6 }}>Downloading Whisper AI</div>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 18 }}>~77 MB · cached after first download</div>
              <div style={{ background: 'var(--felt-line)', borderRadius: 4, height: 8, overflow: 'hidden', marginBottom: 8 }}>
                <div style={{ background: 'var(--gold)', height: '100%', width: progress + '%', transition: 'width 0.3s', borderRadius: 4 }} />
              </div>
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>{progress}%</div>
            </div>
          )}

          {/* Ready */}
          {(phase === 'ready' || phase === 'init') && (
            <div style={{ textAlign: 'center', padding: '16px 0' }}>
              <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 6, lineHeight: 1.7 }}>
                Say who won, fans, outcome, and any bonuses.
              </div>
              <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 28, opacity: 0.65, lineHeight: 1.7 }}>
                "Alice won 8 fans self draw, 2 flowers, Bob has 1 open kong"<br />
                "Bob menang 5 fan, discard oleh Carol, Bob ada 1 flower"
              </div>
              <button
                className={'voice-mic-btn' + (phase === 'init' ? ' loading' : '')}
                onClick={phase === 'ready' ? startRecording : undefined}
                disabled={phase === 'init'}
              >🎙</button>
              <div style={{ marginTop: 14, fontSize: 12, color: 'var(--muted)' }}>
                {phase === 'init' ? 'Loading Whisper…' : 'Tap to record'}
              </div>
              {authToken && (
                <div style={{ marginTop: 10, fontSize: 11, color: 'var(--gold)', opacity: 0.8 }}>✦ Gemma AI parsing active</div>
              )}
            </div>
          )}

          {/* Recording */}
          {phase === 'recording' && (
            <div style={{ textAlign: 'center', padding: '16px 0' }}>
              <div style={{ fontSize: 13, color: 'var(--red)', fontWeight: 700, marginBottom: 24, letterSpacing: '0.04em' }}>
                ● REC · {seconds}s
              </div>
              <button className="voice-mic-btn recording" onClick={stopRecording}>⏹</button>
              <div style={{ marginTop: 14, fontSize: 12, color: 'var(--muted)' }}>Tap to stop</div>
            </div>
          )}

          {/* Transcribing */}
          {phase === 'transcribing' && (
            <div style={{ textAlign: 'center', padding: '36px 0' }}>
              <div style={{ fontSize: 38, marginBottom: 14 }}>🎙→📝</div>
              <div style={{ fontSize: 14, color: 'var(--muted)' }}>Transcribing with Whisper…</div>
            </div>
          )}

          {/* AI Parsing */}
          {phase === 'parsing' && (
            <div style={{ textAlign: 'center', padding: '36px 0' }}>
              <div style={{ fontSize: 38, marginBottom: 14 }}>📝→🧠</div>
              <div style={{ fontSize: 14, color: 'var(--muted)', marginBottom: 8 }}>Gemma is reading the round…</div>
              <div style={{ fontSize: 11, color: 'var(--muted)', opacity: 0.6 }}>
                "{transcript}"
              </div>
            </div>
          )}

          {/* Review */}
          {phase === 'review' && parsed && (
            <div>
              {/* Transcript */}
              <div style={{ background: 'var(--felt-2)', borderRadius: 8, padding: '10px 14px', marginBottom: 4, fontSize: 12, color: 'var(--cream-dim)', fontStyle: 'italic', lineHeight: 1.5 }}>
                "{transcript}"
              </div>
              <div style={{ fontSize: 10, color: aiUsed ? 'var(--gold)' : 'var(--muted)', marginBottom: 18, textAlign: 'right', opacity: 0.8 }}>
                {aiUsed ? '✦ Gemma AI' : '⚙ Regex fallback'}
              </div>

              {/* Core round info */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 18 }}>
                <div className="field-row">
                  <div className="label">Winner</div>
                  <div style={{ fontWeight: 600, color: parsed.winnerIdx != null ? 'var(--cream)' : 'var(--red)' }}>
                    {parsed.winnerIdx != null ? `${players[parsed.winnerIdx]} (${seatLabels[parsed.winnerIdx]})` : '⚠ Not detected'}
                  </div>
                </div>
                <div className="field-row">
                  <div className="label">Fan</div>
                  <div style={{ fontWeight: 700, fontFamily: 'var(--mono)', fontSize: 17, color: parsed.fan >= settings.maxFan ? 'var(--red)' : 'var(--gold)' }}>
                    {parsed.fan >= settings.maxFan ? `爆 (${parsed.fan})` : parsed.fan}
                  </div>
                </div>
                <div className="field-row">
                  <div className="label">Outcome</div>
                  <div style={{ color: 'var(--cream)' }}>{parsed.outcome === 'self' ? t.selfDraw : t.discard}</div>
                </div>
                {parsed.outcome === 'discard' && (
                  <div className="field-row">
                    <div className="label">Discarder</div>
                    <div style={{ fontWeight: parsed.discarderIdx == null ? 600 : 400, color: parsed.discarderIdx != null ? 'var(--cream)' : 'var(--red)' }}>
                      {parsed.discarderIdx != null ? `${players[parsed.discarderIdx]} (${seatLabels[parsed.discarderIdx]})` : '⚠ Not detected'}
                    </div>
                  </div>
                )}
              </div>

              {/* Bonuses (only show if any detected) */}
              {hasAnyStat && (
                <div>
                  <div className="section-title" style={{ marginBottom: 10 }}>Detected bonuses</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {parsed.bonuses.map((b, i) => {
                      const bits = [];
                      if (b.flowers) bits.push(`${b.flowers} 🌸`);
                      if (b.flies) bits.push(`${b.flies} fly`);
                      if (b.openKongs) bits.push(`${b.openKongs} open kong`);
                      if (b.closedKongs) bits.push(`${b.closedKongs} closed kong`);
                      if (!bits.length) return null;
                      return (
                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                          <span style={{ color: 'var(--cream-dim)' }}>{players[i]}</span>
                          <span style={{ color: 'var(--gold)' }}>{bits.join(' · ')}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div style={{ marginTop: 14, fontSize: 12, color: 'var(--muted)', lineHeight: 1.5 }}>
                Review and adjust anything on the next screen before saving.
              </div>
            </div>
          )}

          {/* Hard error */}
          {phase === 'error' && (
            <div style={{ textAlign: 'center', padding: '32px 0' }}>
              <div style={{ fontSize: 40, marginBottom: 14 }}>⚠️</div>
              <div style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.6 }}>
                AI unavailable.<br />Refresh and try again.
              </div>
            </div>
          )}

        </div>
        <div className="sheet-footer">
          {phase === 'review' ? (
            <>
              <button className="btn btn-secondary" onClick={retry}>Retry</button>
              <button className="btn btn-primary btn-block" onClick={() => onParsed(parsed)}>
                Fill in details →
              </button>
            </>
          ) : (
            <button className="btn btn-secondary btn-block" onClick={onClose}>{t.cancel}</button>
          )}
        </div>
      </div>
    </div>
  );
}

window.VoiceEntry = VoiceEntry;
