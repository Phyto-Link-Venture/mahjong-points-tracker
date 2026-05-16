// Voice round entry — records speech, transcribes with local Whisper AI, parses round data
const { useState: useStateVE, useEffect: useEffectVE, useRef: useRefVE } = React;

const WHISPER_MODEL = 'Xenova/whisper-tiny';

function parseRoundText(text, players, settings) {
  const lower = text.toLowerCase().replace(/[.,!?。，！？]/g, ' ');

  // Match winner by player name (longest match first to avoid partial hits)
  const sorted = players
    .map((p, i) => ({ name: p.toLowerCase().trim(), i }))
    .filter(x => x.name.length >= 2)
    .sort((a, b) => b.name.length - a.name.length);

  let winnerIdx = null;
  for (const { name, i } of sorted) {
    if (lower.includes(name)) { winnerIdx = i; break; }
  }

  // Fan count — try "X fan(s)", then bare digit 1-13, then English words
  let fan = null;
  const fanMatch = lower.match(/(\d+)\s*fan/);
  if (fanMatch) fan = parseInt(fanMatch[1]);

  if (!fan) {
    const wordNums = {
      one:1, two:2, three:3, four:4, five:5, six:6, seven:7,
      eight:8, nine:9, ten:10, eleven:11, twelve:12, thirteen:13,
    };
    for (const [w, n] of Object.entries(wordNums)) {
      if (new RegExp('\\b' + w + '\\b').test(lower)) { fan = n; break; }
    }
  }

  if (!fan) {
    const m = lower.match(/\b(1[0-3]|[1-9])\b/);
    if (m) fan = parseInt(m[1]);
  }

  if (!fan) fan = settings.minFan;
  fan = Math.min(fan, settings.maxFan);

  // Outcome
  let outcome = 'self';
  if (/self.?draw|tsumo|zi.?mo|自摸|zimo/.test(lower)) outcome = 'self';
  else if (/discard|食糊|ron|buang|oleh/.test(lower)) outcome = 'discard';

  // Discarder — second player name found (skip winner)
  let discarderIdx = null;
  if (outcome === 'discard') {
    for (const { name, i } of sorted) {
      if (i !== winnerIdx && lower.includes(name)) { discarderIdx = i; break; }
    }
  }

  return { winnerIdx, fan, outcome, discarderIdx };
}

function VoiceEntry({ t, settings, players, dealerIdx, onParsed, onClose }) {
  const [phase, setPhase] = useStateVE('init'); // init|loading|ready|recording|transcribing|review|error
  const [progress, setProgress] = useStateVE(0);
  const [transcript, setTranscript] = useStateVE('');
  const [parsed, setParsed] = useStateVE(null);
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

    // Wait up to 5s for the module to load
    let mod = window.XenovaTransformers;
    if (!mod) {
      await new Promise((resolve, reject) => {
        const t = setTimeout(() => reject(new Error('timeout')), 5000);
        document.addEventListener('xenova-ready', () => { clearTimeout(t); resolve(); }, { once: true });
      }).catch(() => {});
      mod = window.XenovaTransformers;
    }

    if (!mod) {
      setPhase('error');
      setErrMsg('AI module unavailable. Please refresh the page and try again.');
      return;
    }

    setPhase('loading');
    setProgress(0);

    try {
      pipeRef.current = await mod.pipeline(
        'automatic-speech-recognition',
        WHISPER_MODEL,
        {
          progress_callback: (p) => {
            if (p.status === 'downloading' && p.total > 0) {
              setProgress(Math.round((p.loaded / p.total) * 100));
            }
          },
        }
      );
      setPhase('ready');
    } catch (e) {
      setPhase('error');
      setErrMsg('Could not load AI model: ' + (e.message || 'unknown error'));
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
      setErrMsg('Microphone access denied. Please allow mic permission and try again.');
    }
  }

  function stopRecording() {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    try { if (mrRef.current?.state !== 'inactive') mrRef.current.stop(); } catch {}
    setPhase('transcribing');
  }

  async function doTranscribe() {
    try {
      const mimeType = chunksRef.current[0]?.type || 'audio/webm';
      const blob = new Blob(chunksRef.current, { type: mimeType });
      const arrayBuffer = await blob.arrayBuffer();

      const audioCtx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });
      let decoded;
      try {
        decoded = await audioCtx.decodeAudioData(arrayBuffer);
      } finally {
        audioCtx.close();
      }

      const audioData = decoded.getChannelData(0); // mono Float32Array at 16kHz
      const result = await pipeRef.current(audioData, {
        language: null,
        task: 'transcribe',
        return_timestamps: false,
      });

      const text = (result.text || '').trim();
      if (!text) {
        setErrMsg('Nothing detected — try speaking closer to the microphone.');
        setPhase('ready');
        return;
      }

      setTranscript(text);
      setParsed(parseRoundText(text, players, settings));
      setPhase('review');
    } catch (e) {
      setErrMsg('Transcription failed: ' + (e.message || 'unknown error'));
      setPhase('ready');
    }
  }

  function retry() {
    setPhase('ready');
    setTranscript('');
    setParsed(null);
    setErrMsg(null);
  }

  const seatLabels = settings.mode === 3
    ? [t.east, t.south, t.west]
    : [t.east, t.south, t.west, t.north];

  const missing = parsed && (
    parsed.winnerIdx == null ||
    (parsed.outcome === 'discard' && parsed.discarderIdx == null)
  );

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

          {/* Downloading model */}
          {phase === 'loading' && (
            <div style={{ textAlign: 'center', padding: '24px 0' }}>
              <div style={{ fontSize: 40, marginBottom: 14 }}>🧠</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--cream)', marginBottom: 6 }}>Downloading Whisper AI</div>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 18 }}>~77 MB · first time only, cached after</div>
              <div style={{ background: 'var(--felt-line)', borderRadius: 4, height: 8, overflow: 'hidden', marginBottom: 8 }}>
                <div style={{ background: 'var(--gold)', height: '100%', width: progress + '%', transition: 'width 0.3s', borderRadius: 4 }} />
              </div>
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>{progress}%</div>
            </div>
          )}

          {/* Ready / Init */}
          {(phase === 'ready' || phase === 'init') && (
            <div style={{ textAlign: 'center', padding: '16px 0' }}>
              <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 28, lineHeight: 1.7 }}>
                Say who won, how many fans, and self-draw or discard.<br />
                <span style={{ fontSize: 11, opacity: 0.65 }}>
                  "Alice won 8 fans self draw"<br />
                  "Bob menang 5 fan, discard oleh Carol"
                </span>
              </div>
              <button
                className={'voice-mic-btn' + (phase === 'init' ? ' loading' : '')}
                onClick={phase === 'ready' ? startRecording : undefined}
                disabled={phase === 'init'}
              >
                🎙
              </button>
              <div style={{ marginTop: 14, fontSize: 12, color: 'var(--muted)' }}>
                {phase === 'init' ? 'Loading AI…' : 'Tap to record'}
              </div>
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
            <div style={{ textAlign: 'center', padding: '40px 0' }}>
              <div style={{ fontSize: 40, marginBottom: 16 }}>⏳</div>
              <div style={{ fontSize: 14, color: 'var(--muted)' }}>Transcribing…</div>
              <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 6, opacity: 0.6 }}>may take a few seconds</div>
            </div>
          )}

          {/* Review parsed result */}
          {phase === 'review' && parsed && (
            <div>
              <div style={{ background: 'var(--felt-2)', borderRadius: 8, padding: '10px 14px', marginBottom: 20, fontSize: 13, color: 'var(--cream-dim)', fontStyle: 'italic', lineHeight: 1.6 }}>
                "{transcript}"
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div className="field-row">
                  <div className="label">Winner</div>
                  <div style={{ fontWeight: 600, color: parsed.winnerIdx != null ? 'var(--cream)' : 'var(--red)', fontSize: 14 }}>
                    {parsed.winnerIdx != null
                      ? `${players[parsed.winnerIdx]} (${seatLabels[parsed.winnerIdx]})`
                      : '⚠ Not detected'}
                  </div>
                </div>

                <div className="field-row">
                  <div className="label">Fan</div>
                  <div style={{ fontWeight: 700, color: parsed.fan >= settings.maxFan ? 'var(--red)' : 'var(--gold)', fontFamily: 'var(--mono)', fontSize: 18 }}>
                    {parsed.fan >= settings.maxFan ? `爆 (${parsed.fan})` : parsed.fan}
                  </div>
                </div>

                <div className="field-row">
                  <div className="label">Outcome</div>
                  <div style={{ color: 'var(--cream)' }}>
                    {parsed.outcome === 'self' ? t.selfDraw : t.discard}
                  </div>
                </div>

                {parsed.outcome === 'discard' && (
                  <div className="field-row">
                    <div className="label">Discarder</div>
                    <div style={{ fontWeight: parsed.discarderIdx == null ? 600 : 400, color: parsed.discarderIdx != null ? 'var(--cream)' : 'var(--red)' }}>
                      {parsed.discarderIdx != null
                        ? `${players[parsed.discarderIdx]} (${seatLabels[parsed.discarderIdx]})`
                        : '⚠ Not detected'}
                    </div>
                  </div>
                )}
              </div>

              {missing && (
                <div style={{ marginTop: 16, fontSize: 12, color: 'var(--muted)', lineHeight: 1.5 }}>
                  Missing fields will be highlighted in the next screen for you to fill in.
                </div>
              )}
            </div>
          )}

          {/* Hard error */}
          {phase === 'error' && (
            <div style={{ textAlign: 'center', padding: '32px 0' }}>
              <div style={{ fontSize: 40, marginBottom: 14 }}>⚠️</div>
              <div style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.6 }}>
                AI model unavailable.<br />Check connection and refresh the page.
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
