// Voice round entry — Gemini API handles audio STT + AI parse in one step
const { useState: useStateVE, useEffect: useEffectVE, useRef: useRefVE } = React;

const GEMINI_MODEL = 'gemini-2.0-flash';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

function toRoundEntryBonuses(aiBonuses, N) {
  return Array(N).fill(null).map((_, i) => {
    const b = (aiBonuses || []).find(x => x.playerIdx === i) || {};
    return { flowers: b.flowers || 0, flies: b.flies || 0, openKongs: b.openKongs || 0, closedKongs: b.closedKongs || 0, fedKongFeeders: {} };
  });
}

function VoiceEntry({ t, settings, players, dealerIdx, authToken, onParsed, onClose }) {
  // phases: idle | recording | processing | review | error
  const [phase, setPhase] = useStateVE('idle');
  const [parsed, setParsed] = useStateVE(null);
  const [errMsg, setErrMsg] = useStateVE('');
  const [seconds, setSeconds] = useStateVE(0);

  const recRef    = useRefVE(null);
  const streamRef = useRefVE(null);
  const chunksRef = useRefVE([]);
  const mimeRef   = useRefVE('audio/webm');
  const timerRef  = useRefVE(null);

  useEffectVE(() => {
    return () => {
      stopTimer();
      streamRef.current?.getTracks().forEach(tr => tr.stop());
    };
  }, []);

  function stopTimer() {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  }

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];

      const mimeType = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4']
        .find(m => MediaRecorder.isTypeSupported(m)) || '';
      mimeRef.current = mimeType ? mimeType.split(';')[0] : 'audio/webm';

      const rec = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      recRef.current = rec;
      rec.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      rec.onstop = handleRecordingStop;
      rec.start(200);
      setPhase('recording');
      setSeconds(0);
      setErrMsg('');
      timerRef.current = setInterval(() => setSeconds(s => s + 1), 1000);
    } catch (e) {
      setErrMsg('Microphone access denied — please allow mic permission.');
    }
  }

  function stopRecording() {
    stopTimer();
    streamRef.current?.getTracks().forEach(tr => tr.stop());
    recRef.current?.stop();
    setPhase('processing');
  }

  async function handleRecordingStop() {
    try {
      const blob = new Blob(chunksRef.current, { type: mimeRef.current });
      await parseWithGemini(blob);
    } catch (e) {
      setErrMsg(e.message || 'Processing failed.');
      setPhase('error');
    }
  }

  async function parseWithGemini(audioBlob) {
    const apiKey = window.MAHJONG_CONFIG?.geminiApiKey;
    if (!apiKey) throw new Error('Gemini API key not configured in config.js.');

    const arrayBuffer = await audioBlob.arrayBuffer();
    const uint8 = new Uint8Array(arrayBuffer);
    let binary = '';
    const chunk = 8192;
    for (let i = 0; i < uint8.length; i += chunk) {
      binary += String.fromCharCode(...uint8.subarray(i, i + chunk));
    }
    const base64Audio = btoa(binary);

    const seatNames = settings.mode === 3
      ? ['East', 'South', 'West']
      : ['East', 'South', 'West', 'North'];
    const playerList = players.map((name, i) => `${i}: ${name} (${seatNames[i]})`).join(', ');

    const prompt = `You are a mahjong scorekeeper. Listen to this audio and extract the round result.

Players: ${playerList}
Mode: ${settings.mode}-player mahjong
Fan range: ${settings.minFan}–${settings.maxFan} (${settings.maxFan}+ = max/爆)

The speaker will say who won (赢/win), how many fans (番), and whether it was self-draw (自摸) or discard (放炮/打出). They may also mention bonuses: flowers (花), flies (苍蝇), open kongs (明杠), closed kongs (暗杠).

Match player names even if pronunciation varies. Return ONLY valid JSON, no explanation:
{
  "outcome": "self" | "discard" | "draw",
  "winnerIdx": <0-${settings.mode - 1} or null if draw>,
  "fan": <integer ${settings.minFan}-${settings.maxFan}>,
  "discarderIdx": <0-${settings.mode - 1} or null>,
  "bonuses": [{"playerIdx":0,"flowers":0,"flies":0,"openKongs":0,"closedKongs":0}]
}`;

    const resp = await fetch(`${GEMINI_URL}?key=${encodeURIComponent(apiKey)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [
          { inline_data: { mime_type: mimeRef.current, data: base64Audio } },
          { text: prompt },
        ]}],
        generationConfig: { responseMimeType: 'application/json', temperature: 0.1 },
      }),
      signal: AbortSignal.timeout(30000),
    });

    if (!resp.ok) {
      const errText = await resp.text().catch(() => resp.statusText);
      throw new Error(`Gemini ${resp.status}: ${errText.slice(0, 200)}`);
    }

    const data = await resp.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    if (!text) throw new Error('Empty response from Gemini.');

    let aiParsed;
    try { aiParsed = JSON.parse(text); }
    catch { throw new Error('Could not parse AI response. Try speaking more clearly.'); }

    setParsed({
      winnerIdx:    aiParsed.winnerIdx ?? null,
      fan:          aiParsed.fan ?? settings.minFan,
      outcome:      aiParsed.outcome || 'self',
      discarderIdx: aiParsed.discarderIdx ?? null,
      bonuses:      toRoundEntryBonuses(aiParsed.bonuses, settings.mode),
    });
    setPhase('review');
  }

  function retry() {
    setParsed(null);
    setErrMsg('');
    setPhase('idle');
  }

  const seatLabels = settings.mode === 3
    ? [t.east, t.south, t.west]
    : [t.east, t.south, t.west, t.north];

  const hasAnyStat = parsed?.bonuses?.some(b => b.flowers || b.flies || b.openKongs || b.closedKongs);

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

          {phase === 'idle' && (
            <div style={{ textAlign: 'center', padding: '24px 0' }}>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 24, lineHeight: 1.8 }}>
                Say who won, how many fans, and self-draw or discard.<br />
                例：「Alice 赢了 8 番自摸，Bob 2 朵花」
              </div>
              <button className="voice-mic-btn" onClick={startRecording}>🎙</button>
              <div style={{ marginTop: 14, fontSize: 12, color: 'var(--muted)' }}>Tap to record</div>
            </div>
          )}

          {phase === 'recording' && (
            <div style={{ textAlign: 'center', padding: '24px 0' }}>
              <div style={{ fontSize: 13, color: 'var(--red)', fontWeight: 700, marginBottom: 16, letterSpacing: '0.06em' }}>
                ● REC · {seconds}s
              </div>
              <button className="voice-mic-btn recording" onClick={stopRecording}>⏹</button>
              <div style={{ marginTop: 14, fontSize: 12, color: 'var(--muted)' }}>Tap to stop</div>
            </div>
          )}

          {phase === 'processing' && (
            <div style={{ textAlign: 'center', padding: '36px 0' }}>
              <div style={{ fontSize: 32, marginBottom: 14 }}>🎙→🧠</div>
              <div style={{ fontSize: 14, color: 'var(--muted)' }}>Gemini is listening…</div>
            </div>
          )}

          {phase === 'review' && parsed && (
            <div>
              <div style={{ fontSize: 10, color: 'var(--gold)', marginBottom: 18, textAlign: 'right', opacity: 0.8 }}>✦ Gemini parsed</div>

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
                  <div style={{ color: 'var(--cream)' }}>
                    {parsed.outcome === 'self' ? t.selfDraw : parsed.outcome === 'draw' ? t.draw : t.discard}
                  </div>
                </div>
                {parsed.outcome === 'discard' && (
                  <div className="field-row">
                    <div className="label">Discarder</div>
                    <div style={{ color: parsed.discarderIdx != null ? 'var(--cream)' : 'var(--red)' }}>
                      {parsed.discarderIdx != null
                        ? `${players[parsed.discarderIdx]} (${seatLabels[parsed.discarderIdx]})`
                        : '⚠ Not detected'}
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
                      if (b.flowers)     bits.push(`${b.flowers} 🌸`);
                      if (b.flies)       bits.push(`${b.flies} 苍蝇`);
                      if (b.openKongs)   bits.push(`${b.openKongs} 明杠`);
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
                You can adjust anything on the next screen before saving.
              </div>
            </div>
          )}

          {phase === 'error' && (
            <div style={{ textAlign: 'center', padding: '32px 0' }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>⚠️</div>
              <div style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.6, padding: '0 16px' }}>
                {errMsg || 'Something went wrong.'}
              </div>
              <button className="btn btn-secondary" style={{ marginTop: 20 }} onClick={retry}>Try again</button>
            </div>
          )}

        </div>

        <div className="sheet-footer">
          {phase === 'review' && (
            <>
              <button className="btn btn-secondary" onClick={retry}>Retry</button>
              <button className="btn btn-primary btn-block" onClick={() => onParsed(parsed)}>
                Fill in details →
              </button>
            </>
          )}
          {phase !== 'review' && (
            <button className="btn btn-secondary btn-block" onClick={onClose}>{t.cancel}</button>
          )}
        </div>
      </div>
    </div>
  );
}

window.VoiceEntry = VoiceEntry;
