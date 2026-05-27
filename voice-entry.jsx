// Voice round entry — Web Speech API (browser STT) + Ollama server for structured parsing
const { useState: useStateVE, useEffect: useEffectVE, useRef: useRefVE } = React;

const API = '/api';

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

  const wordNums = { one:1,two:2,three:3,four:4,five:5,six:6,seven:7,eight:8,nine:9,ten:10,eleven:11,twelve:12,thirteen:13,
    一:1,两:2,二:2,三:3,四:4,五:5,六:6,七:7,八:8,九:9,十:10,十一:11,十二:12,十三:13 };
  let fan = null;
  const fanMatch = lower.match(/(\d+)\s*(?:fan|番|翻)/);
  if (fanMatch) fan = parseInt(fanMatch[1]);
  if (!fan) for (const [w, n] of Object.entries(wordNums)) { if (lower.includes(w)) { fan = n; break; } }
  if (!fan) { const m = lower.match(/\b(1[0-3]|[1-9])\b/); if (m) fan = parseInt(m[1]); }
  if (!fan) fan = settings.minFan;
  fan = Math.min(fan, settings.maxFan);

  let outcome = 'self';
  if (/self.?draw|tsumo|zi.?mo|自摸|zimo/.test(lower)) outcome = 'self';
  else if (/discard|食糊|ron|buang|oleh|打出|放炮/.test(lower)) outcome = 'discard';

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

function toRoundEntryBonuses(aiBonuses, N) {
  return Array(N).fill(null).map((_, i) => {
    const b = (aiBonuses || []).find(x => x.playerIdx === i) || {};
    return { flowers: b.flowers || 0, flies: b.flies || 0, openKongs: b.openKongs || 0, closedKongs: b.closedKongs || 0, fedKongFeeders: {} };
  });
}

const VOICE_LANG_KEY = 'mahjong-voice-lang';
const LANG_OPTIONS = [
  { code: 'zh-CN', label: '中文' },
  { code: 'en-US', label: 'English' },
  { code: 'ms-MY', label: 'Melayu' },
];

function VoiceEntry({ t, settings, players, dealerIdx, authToken, onParsed, onClose }) {
  const [phase, setPhase] = useStateVE('idle'); // idle|recording|parsing|review
  const [transcript, setTranscript] = useStateVE('');
  const [interim, setInterim] = useStateVE('');
  const [parsed, setParsed] = useStateVE(null);
  const [aiUsed, setAiUsed] = useStateVE(false);
  const [errMsg, setErrMsg] = useStateVE(null);
  const [seconds, setSeconds] = useStateVE(0);
  const [lang, setLangState] = useStateVE(() => localStorage.getItem(VOICE_LANG_KEY) || 'zh-CN');

  function setLang(l) {
    localStorage.setItem(VOICE_LANG_KEY, l);
    setLangState(l);
  }

  const recogRef = useRefVE(null);
  const timerRef = useRefVE(null);
  const finalTextRef = useRefVE('');

  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const supported = !!SpeechRecognition;

  useEffectVE(() => {
    return () => {
      stopTimer();
      try { recogRef.current?.abort(); } catch {}
    };
  }, []);

  function stopTimer() {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  }

  function startRecording() {
    if (!supported) {
      setErrMsg('Speech recognition requires Chrome or Edge browser.');
      return;
    }
    setErrMsg(null);
    setInterim('');
    finalTextRef.current = '';

    const recognition = new SpeechRecognition();
    recognition.lang = lang;
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setPhase('recording');
      setSeconds(0);
      timerRef.current = setInterval(() => setSeconds(s => s + 1), 1000);
    };

    recognition.onresult = (event) => {
      let accFinal = '';
      let accInterim = '';
      for (let i = 0; i < event.results.length; i++) {
        if (event.results[i].isFinal) accFinal += event.results[i][0].transcript + ' ';
        else accInterim += event.results[i][0].transcript;
      }
      finalTextRef.current = accFinal.trim();
      setInterim(accInterim || accFinal.trim());
    };

    recognition.onerror = (event) => {
      stopTimer();
      if (event.error === 'not-allowed') {
        setErrMsg('Microphone access denied — please allow mic permission.');
      } else if (event.error !== 'aborted' && event.error !== 'no-speech') {
        setErrMsg('Recording error: ' + event.error);
      }
      setPhase('idle');
    };

    recogRef.current = recognition;
    recognition.start();
  }

  function stopRecording() {
    stopTimer();
    setInterim('');
    try { recogRef.current?.stop(); } catch {}

    const text = finalTextRef.current.trim();
    if (!text) {
      setErrMsg('Nothing detected — try speaking closer to the mic.');
      setPhase('idle');
      return;
    }
    setTranscript(text);
    setPhase('parsing');
    doParse(text);
  }

  async function doParse(text) {
    if (authToken) {
      try {
        const r = await fetch(`${API}/ai/parse-round`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
          body: JSON.stringify({ transcript: text, players, mode: settings.mode }),
          signal: AbortSignal.timeout(65000),
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

    const fallback = parseRoundFallback(text, players, settings);
    setParsed({ ...fallback, bonuses: toRoundEntryBonuses(fallback.bonuses, settings.mode) });
    setAiUsed(false);
    setPhase('review');
  }

  function retry() {
    setPhase('idle');
    setTranscript('');
    setInterim('');
    setParsed(null);
    setErrMsg(null);
    setAiUsed(false);
    finalTextRef.current = '';
  }

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

          {/* Idle */}
          {phase === 'idle' && (
            <div style={{ textAlign: 'center', padding: '16px 0' }}>
              {/* Language selector */}
              <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginBottom: 18 }}>
                {LANG_OPTIONS.map(l => (
                  <button
                    key={l.code}
                    onClick={() => setLang(l.code)}
                    style={{
                      padding: '5px 14px', borderRadius: 16, fontSize: 12, cursor: 'pointer',
                      background: lang === l.code ? 'var(--gold)' : 'var(--felt-2)',
                      color: lang === l.code ? 'var(--felt-1)' : 'var(--muted)',
                      border: '1px solid ' + (lang === l.code ? 'var(--gold)' : 'var(--felt-line)'),
                      fontWeight: lang === l.code ? 700 : 400,
                    }}
                  >{l.label}</button>
                ))}
              </div>
              <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 6, lineHeight: 1.7 }}>
                {lang === 'zh-CN'
                  ? '说出赢家、番数和结果'
                  : lang === 'ms-MY'
                  ? 'Sebut pemenang, fan, dan hasilnya'
                  : 'Say who won, fans, and outcome'}
              </div>
              <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 28, opacity: 0.65, lineHeight: 1.7 }}>
                {lang === 'zh-CN'
                  ? <>「Alice赢了8番自摸」<br />「Bob赢了5番，Carol打出」</>
                  : <>「Alice won 8 fans self draw」<br />「Bob wins 5 fans, discard by Carol」</>}
              </div>
              <button
                className="voice-mic-btn"
                onClick={supported ? startRecording : undefined}
                disabled={!supported}
              >🎙</button>
              <div style={{ marginTop: 14, fontSize: 12, color: 'var(--muted)' }}>
                {supported ? (lang === 'zh-CN' ? '点击录音' : 'Tap to record') : 'Use Chrome or Edge'}
              </div>
              {authToken && (
                <div style={{ marginTop: 10, fontSize: 11, color: 'var(--gold)', opacity: 0.8 }}>✦ AI parsing active</div>
              )}
            </div>
          )}

          {/* Recording */}
          {phase === 'recording' && (
            <div style={{ textAlign: 'center', padding: '16px 0' }}>
              <div style={{ fontSize: 13, color: 'var(--red)', fontWeight: 700, marginBottom: 12, letterSpacing: '0.04em' }}>
                ● REC · {seconds}s
              </div>
              {interim && (
                <div style={{ fontSize: 12, color: 'var(--cream-dim)', fontStyle: 'italic', marginBottom: 18, minHeight: 36, lineHeight: 1.5, padding: '0 16px' }}>
                  "{interim}"
                </div>
              )}
              <button className="voice-mic-btn recording" onClick={stopRecording}>⏹</button>
              <div style={{ marginTop: 14, fontSize: 12, color: 'var(--muted)' }}>Tap to stop</div>
            </div>
          )}

          {/* Parsing */}
          {phase === 'parsing' && (
            <div style={{ textAlign: 'center', padding: '36px 0' }}>
              <div style={{ fontSize: 38, marginBottom: 14 }}>📝→🧠</div>
              <div style={{ fontSize: 14, color: 'var(--muted)', marginBottom: 8 }}>Parsing round…</div>
              <div style={{ fontSize: 11, color: 'var(--muted)', opacity: 0.6 }}>"{transcript}"</div>
            </div>
          )}

          {/* Review */}
          {phase === 'review' && parsed && (
            <div>
              <div style={{ background: 'var(--felt-2)', borderRadius: 8, padding: '10px 14px', marginBottom: 4, fontSize: 12, color: 'var(--cream-dim)', fontStyle: 'italic', lineHeight: 1.5 }}>
                "{transcript}"
              </div>
              <div style={{ fontSize: 10, color: aiUsed ? 'var(--gold)' : 'var(--muted)', marginBottom: 18, textAlign: 'right', opacity: 0.8 }}>
                {aiUsed ? '✦ AI parsed' : '⚙ Regex fallback'}
              </div>

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
