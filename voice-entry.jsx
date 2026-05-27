// Voice round entry — Whisper (local STT) + Ollama (AI parse) + editable transcript
const { useState: useStateVE, useEffect: useEffectVE, useRef: useRefVE } = React;

const API = '/api';
const WHISPER_MODEL = 'Xenova/whisper-tiny';
const VOICE_LANG_KEY = 'mahjong-voice-lang';

const LANG_OPTIONS = [
  { code: 'zh-CN', whisper: 'chinese', label: '中文' },
  { code: 'en-US', whisper: 'english', label: 'English' },
  { code: 'ms-MY', whisper: 'malay',   label: 'Melayu' },
];

function toRoundEntryBonuses(aiBonuses, N) {
  return Array(N).fill(null).map((_, i) => {
    const b = (aiBonuses || []).find(x => x.playerIdx === i) || {};
    return { flowers: b.flowers || 0, flies: b.flies || 0, openKongs: b.openKongs || 0, closedKongs: b.closedKongs || 0, fedKongFeeders: {} };
  });
}

function waitForHF() {
  return new Promise((resolve, reject) => {
    if (window.HFTransformers) { resolve(window.HFTransformers); return; }
    const onReady = () => {
      document.removeEventListener('hf-ready', onReady);
      if (window.HFTransformers) resolve(window.HFTransformers);
      else reject(new Error('transformers.js failed to load'));
    };
    document.addEventListener('hf-ready', onReady);
    setTimeout(() => {
      document.removeEventListener('hf-ready', onReady);
      reject(new Error('Timeout waiting for transformers.js'));
    }, 30000);
  });
}

function VoiceEntry({ t, settings, players, dealerIdx, authToken, onParsed, onClose }) {
  // phases: init | loading | ready | recording | transcribing | edit | parsing | review | error
  const [phase, setPhase] = useStateVE('init');
  const [progress, setProgress] = useStateVE(0);
  const [progressFile, setProgressFile] = useStateVE('');
  const [transcript, setTranscript] = useStateVE('');
  const [parsed, setParsed] = useStateVE(null);
  const [errMsg, setErrMsg] = useStateVE('');
  const [seconds, setSeconds] = useStateVE(0);
  const [lang, setLangState] = useStateVE(() => localStorage.getItem(VOICE_LANG_KEY) || 'zh-CN');

  const pipeRef   = useRefVE(null);
  const recRef    = useRefVE(null);   // MediaRecorder
  const streamRef = useRefVE(null);
  const chunksRef = useRefVE([]);
  const timerRef  = useRefVE(null);

  function setLang(l) { localStorage.setItem(VOICE_LANG_KEY, l); setLangState(l); }

  useEffectVE(() => {
    loadWhisper();
    return () => {
      stopTimer();
      streamRef.current?.getTracks().forEach(t => t.stop());
    };
  }, []);

  async function loadWhisper() {
    try {
      setPhase('loading');
      const mod = await waitForHF();
      pipeRef.current = await mod.pipeline(
        'automatic-speech-recognition',
        WHISPER_MODEL,
        {
          dtype: 'fp32', // Q4/NBits not supported in browser WASM ONNX runtime
          progress_callback: (p) => {
            if (p.status === 'progress' && p.progress != null) {
              setProgress(Math.round(p.progress));
              setProgressFile(p.file || '');
            }
          },
        }
      );
      setPhase('ready');
    } catch (e) {
      setErrMsg(e.message);
      setPhase('error');
    }
  }

  function stopTimer() {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  }

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];
      const rec = new MediaRecorder(stream);
      recRef.current = rec;
      rec.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      rec.onstop = handleRecordingStop;
      rec.start(200);
      setPhase('recording');
      setSeconds(0);
      timerRef.current = setInterval(() => setSeconds(s => s + 1), 1000);
    } catch (e) {
      setErrMsg('Microphone access denied — please allow mic permission.');
    }
  }

  function stopRecording() {
    stopTimer();
    streamRef.current?.getTracks().forEach(t => t.stop());
    recRef.current?.stop();
    setPhase('transcribing');
  }

  async function handleRecordingStop() {
    try {
      const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
      const arrayBuffer = await blob.arrayBuffer();
      const audioCtx = new AudioContext({ sampleRate: 16000 });
      const decoded = await audioCtx.decodeAudioData(arrayBuffer);
      await audioCtx.close();
      const float32 = decoded.getChannelData(0);

      const whisperLang = LANG_OPTIONS.find(l => l.code === lang)?.whisper || 'chinese';
      const result = await pipeRef.current(float32, {
        language: whisperLang,
        task: 'transcribe',
        return_timestamps: false,
      });
      const text = (result.text || '').trim();
      if (!text) {
        setErrMsg('Nothing detected — try again.');
        setPhase('ready');
        return;
      }
      setTranscript(text);
      setPhase('edit');
    } catch (e) {
      setErrMsg('Transcription failed: ' + e.message);
      setPhase('ready');
    }
  }

  async function doParse() {
    setPhase('parsing');
    try {
      const r = await fetch(`${API}/ai/parse-round`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({ transcript, players, mode: settings.mode }),
        signal: AbortSignal.timeout(65000),
      });
      if (!r.ok) throw new Error('AI unavailable');
      const { parsed: aiParsed } = await r.json();
      setParsed({
        winnerIdx:    aiParsed.winnerIdx ?? null,
        fan:          aiParsed.fan ?? settings.minFan,
        outcome:      aiParsed.outcome || 'self',
        discarderIdx: aiParsed.discarderIdx ?? null,
        bonuses:      toRoundEntryBonuses(aiParsed.bonuses, settings.mode),
      });
      setPhase('review');
    } catch (e) {
      setErrMsg('AI parse failed: ' + e.message + ' — edit the transcript and try again.');
      setPhase('edit');
    }
  }

  function retry() {
    setTranscript('');
    setParsed(null);
    setErrMsg('');
    setPhase('ready');
  }

  const seatLabels = settings.mode === 3
    ? [t.east, t.south, t.west]
    : [t.east, t.south, t.west, t.north];

  const hasAnyStat = parsed?.bonuses?.some(b => b.flowers || b.flies || b.openKongs || b.closedKongs);

  const langLabel = LANG_OPTIONS.find(l => l.code === lang)?.label || '中文';

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

          {/* Loading Whisper */}
          {(phase === 'init' || phase === 'loading') && (
            <div style={{ textAlign: 'center', padding: '32px 0' }}>
              <div style={{ fontSize: 32, marginBottom: 14 }}>🧠</div>
              <div style={{ fontSize: 14, color: 'var(--cream)', marginBottom: 6 }}>Loading Whisper…</div>
              {progress > 0 && (
                <>
                  <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 10 }}>
                    {progressFile && <span>{progressFile.split('/').pop()} · </span>}
                    {progress}%
                  </div>
                  <div style={{ background: 'var(--felt-3)', borderRadius: 4, height: 6, width: '80%', margin: '0 auto' }}>
                    <div style={{ background: 'var(--gold)', height: '100%', borderRadius: 4, width: progress + '%', transition: 'width 0.3s' }} />
                  </div>
                </>
              )}
              <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 14 }}>
                First load ~160MB — cached after that
              </div>
            </div>
          )}

          {/* Ready */}
          {phase === 'ready' && (
            <div style={{ textAlign: 'center', padding: '16px 0' }}>
              <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginBottom: 20 }}>
                {LANG_OPTIONS.map(l => (
                  <button key={l.code} onClick={() => setLang(l.code)} style={{
                    padding: '5px 14px', borderRadius: 16, fontSize: 12, cursor: 'pointer',
                    background: lang === l.code ? 'var(--gold)' : 'var(--felt-2)',
                    color: lang === l.code ? 'var(--felt-1)' : 'var(--muted)',
                    border: '1px solid ' + (lang === l.code ? 'var(--gold)' : 'var(--felt-line)'),
                    fontWeight: lang === l.code ? 700 : 400,
                  }}>{l.label}</button>
                ))}
              </div>
              <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 24, opacity: 0.7, lineHeight: 1.7 }}>
                {lang === 'zh-CN'
                  ? <>「Alice赢了8番自摸，Bob有2朵花」<br />「Bob赢5番，Carol打出」</>
                  : <>「Alice won 8 fans self draw, Bob 2 flowers」<br />「Bob wins 5 fans, discard by Carol」</>}
              </div>
              <button className="voice-mic-btn" onClick={startRecording}>🎙</button>
              <div style={{ marginTop: 14, fontSize: 12, color: 'var(--muted)' }}>
                {lang === 'zh-CN' ? '点击录音' : 'Tap to record'}
              </div>
            </div>
          )}

          {/* Recording */}
          {phase === 'recording' && (
            <div style={{ textAlign: 'center', padding: '24px 0' }}>
              <div style={{ fontSize: 13, color: 'var(--red)', fontWeight: 700, marginBottom: 16, letterSpacing: '0.06em' }}>
                ● REC · {seconds}s
              </div>
              <button className="voice-mic-btn recording" onClick={stopRecording}>⏹</button>
              <div style={{ marginTop: 14, fontSize: 12, color: 'var(--muted)' }}>
                {lang === 'zh-CN' ? '点击停止' : 'Tap to stop'}
              </div>
            </div>
          )}

          {/* Transcribing */}
          {phase === 'transcribing' && (
            <div style={{ textAlign: 'center', padding: '36px 0' }}>
              <div style={{ fontSize: 32, marginBottom: 14 }}>🎙→📝</div>
              <div style={{ fontSize: 14, color: 'var(--muted)' }}>
                {lang === 'zh-CN' ? '转录中…' : 'Transcribing…'}
              </div>
            </div>
          )}

          {/* Edit transcript */}
          {phase === 'edit' && (
            <div>
              <div className="section-title" style={{ marginBottom: 8 }}>
                {lang === 'zh-CN' ? '听到的内容 — 可以修改' : 'Transcript — edit if needed'}
              </div>
              <textarea
                value={transcript}
                onChange={e => setTranscript(e.target.value)}
                rows={4}
                autoFocus
                style={{
                  width: '100%', boxSizing: 'border-box',
                  background: 'var(--felt-2)', color: 'var(--cream)',
                  border: '1px solid var(--felt-line)', borderRadius: 10,
                  padding: '10px 12px', fontSize: 15, lineHeight: 1.6,
                  resize: 'none', fontFamily: 'inherit',
                }}
              />
              <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 8, lineHeight: 1.5 }}>
                {lang === 'zh-CN'
                  ? '修正任何错误，然后点击解析。'
                  : 'Correct any errors above, then tap Parse.'}
              </div>
            </div>
          )}

          {/* Parsing */}
          {phase === 'parsing' && (
            <div style={{ textAlign: 'center', padding: '36px 0' }}>
              <div style={{ fontSize: 32, marginBottom: 14 }}>📝→🧠</div>
              <div style={{ fontSize: 14, color: 'var(--muted)', marginBottom: 8 }}>
                {lang === 'zh-CN' ? 'AI解析中…' : 'AI parsing…'}
              </div>
              <div style={{ fontSize: 11, color: 'var(--muted)', opacity: 0.6, padding: '0 16px' }}>"{transcript}"</div>
            </div>
          )}

          {/* Review */}
          {phase === 'review' && parsed && (
            <div>
              <div style={{ background: 'var(--felt-2)', borderRadius: 8, padding: '10px 14px', marginBottom: 4, fontSize: 12, color: 'var(--cream-dim)', fontStyle: 'italic', lineHeight: 1.5 }}>
                "{transcript}"
              </div>
              <div style={{ fontSize: 10, color: 'var(--gold)', marginBottom: 18, textAlign: 'right', opacity: 0.8 }}>✦ AI parsed</div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 18 }}>
                <div className="field-row">
                  <div className="label">{lang === 'zh-CN' ? '赢家' : 'Winner'}</div>
                  <div style={{ fontWeight: 600, color: parsed.winnerIdx != null ? 'var(--cream)' : 'var(--red)' }}>
                    {parsed.winnerIdx != null ? `${players[parsed.winnerIdx]} (${seatLabels[parsed.winnerIdx]})` : '⚠ Not detected'}
                  </div>
                </div>
                <div className="field-row">
                  <div className="label">{lang === 'zh-CN' ? '番数' : 'Fan'}</div>
                  <div style={{ fontWeight: 700, fontFamily: 'var(--mono)', fontSize: 17, color: parsed.fan >= settings.maxFan ? 'var(--red)' : 'var(--gold)' }}>
                    {parsed.fan >= settings.maxFan ? `爆 (${parsed.fan})` : parsed.fan}
                  </div>
                </div>
                <div className="field-row">
                  <div className="label">{lang === 'zh-CN' ? '结果' : 'Outcome'}</div>
                  <div style={{ color: 'var(--cream)' }}>{parsed.outcome === 'self' ? t.selfDraw : t.discard}</div>
                </div>
                {parsed.outcome === 'discard' && (
                  <div className="field-row">
                    <div className="label">{lang === 'zh-CN' ? '放炮' : 'Discarder'}</div>
                    <div style={{ color: parsed.discarderIdx != null ? 'var(--cream)' : 'var(--red)' }}>
                      {parsed.discarderIdx != null ? `${players[parsed.discarderIdx]} (${seatLabels[parsed.discarderIdx]})` : '⚠ Not detected'}
                    </div>
                  </div>
                )}
              </div>

              {hasAnyStat && (
                <div>
                  <div className="section-title" style={{ marginBottom: 10 }}>{lang === 'zh-CN' ? '奖励' : 'Detected bonuses'}</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {parsed.bonuses.map((b, i) => {
                      const bits = [];
                      if (b.flowers)    bits.push(`${b.flowers} 🌸`);
                      if (b.flies)      bits.push(`${b.flies} 苍蝇`);
                      if (b.openKongs)  bits.push(`${b.openKongs} 明杠`);
                      if (b.closedKongs) bits.push(`${b.closedKongs} 暗杠`);
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
                {lang === 'zh-CN'
                  ? '下一屏可以再调整后保存。'
                  : 'You can adjust anything on the next screen before saving.'}
              </div>
            </div>
          )}

          {/* Error */}
          {phase === 'error' && (
            <div style={{ textAlign: 'center', padding: '32px 0' }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>⚠️</div>
              <div style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.6 }}>
                {errMsg || 'Something went wrong.'}
              </div>
            </div>
          )}

        </div>

        <div className="sheet-footer">
          {phase === 'edit' && (
            <>
              <button className="btn btn-secondary" onClick={retry}>Re-record</button>
              <button
                className="btn btn-primary btn-block"
                onClick={doParse}
                disabled={!transcript.trim()}
                style={{ opacity: transcript.trim() ? 1 : 0.5 }}
              >
                {lang === 'zh-CN' ? 'AI解析 →' : 'Parse with AI →'}
              </button>
            </>
          )}
          {phase === 'review' && (
            <>
              <button className="btn btn-secondary" onClick={retry}>Retry</button>
              <button className="btn btn-primary btn-block" onClick={() => onParsed(parsed)}>
                {lang === 'zh-CN' ? '填写详情 →' : 'Fill in details →'}
              </button>
            </>
          )}
          {!['edit', 'review'].includes(phase) && (
            <button className="btn btn-secondary btn-block" onClick={onClose}>{t.cancel}</button>
          )}
        </div>
      </div>
    </div>
  );
}

window.VoiceEntry = VoiceEntry;
