// Auth modal — login, register, profile, Google Sign-In
const { useState: useStateAuth, useEffect: useEffectAuth } = React;

const API = '/api';

function AuthModal({ t, onLogin, onLogout, authUser, onClose }) {
  const [tab, setTab] = useStateAuth(authUser ? 'profile' : 'login');
  const [name, setName] = useStateAuth('');
  const [email, setEmail] = useStateAuth('');
  const [password, setPassword] = useStateAuth('');
  const [loading, setLoading] = useStateAuth(false);
  const [error, setError] = useStateAuth('');

  const googleClientId = window.MAHJONG_CONFIG?.googleClientId || '';

  // Render Google Sign-In button when tab switches to login/register
  useEffectAuth(() => {
    if (authUser || !googleClientId || !window.google?.accounts?.id) return;
    const el = document.getElementById('gsi-btn');
    if (!el) return;
    window.google.accounts.id.initialize({
      client_id: googleClientId,
      callback: async ({ credential }) => {
        setLoading(true); setError('');
        try {
          const res = await fetch(`${API}/auth/google`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ credential }),
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || 'Google login failed');
          onLogin(data.user, data.token);
          onClose();
        } catch (e) {
          setError(e.message);
        } finally {
          setLoading(false);
        }
      },
    });
    el.innerHTML = '';
    window.google.accounts.id.renderButton(el, { theme: 'outline', size: 'large', width: Math.min(el.offsetWidth || 300, 340) });
  }, [tab, authUser]);

  async function submit(e) {
    e.preventDefault();
    setLoading(true); setError('');
    const endpoint = tab === 'login' ? '/auth/login' : '/auth/register';
    const body = tab === 'login' ? { email, password } : { email, password, name };
    try {
      const res = await fetch(`${API}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Request failed');
      onLogin(data.user, data.token);
      onClose();
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="sheet-backdrop" style={{ zIndex: 400 }} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="sheet" onClick={e => e.stopPropagation()}>
        <div className="sheet-header">
          <h2>{authUser ? t.authProfile : t.authTitle}</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>
        <div className="sheet-body">

          {/* Logged-in profile view */}
          {authUser ? (
            <div>
              <div style={{ textAlign: 'center', padding: '20px 0 24px' }}>
                <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--gold)', color: 'var(--felt-1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, fontWeight: 700, margin: '0 auto 12px' }}>
                  {authUser.name.charAt(0).toUpperCase()}
                </div>
                <div style={{ fontSize: 18, fontWeight: 600, color: 'var(--cream)' }}>{authUser.name}</div>
                <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>{authUser.email}</div>
              </div>
              <div style={{ display: 'flex', gap: 10, flexDirection: 'column' }}>
                <button className="btn btn-primary btn-block" onClick={() => { onLogout(); onClose(); }}>
                  {t.authSignOut}
                </button>
              </div>
            </div>
          ) : (
            <div>
              {/* Tabs */}
              <div style={{ display: 'flex', gap: 0, marginBottom: 20, borderBottom: '1px solid var(--felt-line)' }}>
                {[{ k: 'login', l: t.authSignIn }, { k: 'register', l: t.authRegister }].map(item => (
                  <button
                    key={item.k}
                    onClick={() => { setTab(item.k); setError(''); }}
                    style={{
                      flex: 1, padding: '10px 0', background: 'transparent', border: 'none',
                      borderBottom: tab === item.k ? '2px solid var(--gold)' : '2px solid transparent',
                      color: tab === item.k ? 'var(--gold)' : 'var(--muted)',
                      fontWeight: tab === item.k ? 600 : 400,
                      cursor: 'pointer', fontSize: 14, marginBottom: -1,
                    }}
                  >
                    {item.l}
                  </button>
                ))}
              </div>

              {/* Form */}
              <form onSubmit={submit}>
                {tab === 'register' && (
                  <div className="field" style={{ marginBottom: 12 }}>
                    <label>{t.authName}</label>
                    <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder={t.authNamePh} required />
                  </div>
                )}
                <div className="field" style={{ marginBottom: 12 }}>
                  <label>{t.authEmail}</label>
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" required />
                </div>
                <div className="field" style={{ marginBottom: 16 }}>
                  <label>{t.authPassword}</label>
                  <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder={tab === 'register' ? t.authPasswordPh : '••••••••'} required minLength={tab === 'register' ? 6 : 1} />
                </div>
                {error && <div style={{ color: 'var(--red)', fontSize: 12, marginBottom: 12 }}>{error}</div>}
                <button className="btn btn-primary btn-block" type="submit" disabled={loading} style={{ opacity: loading ? 0.6 : 1 }}>
                  {loading ? '...' : tab === 'login' ? t.authSignIn : t.authRegister}
                </button>
              </form>

              {/* Google Sign-In */}
              {googleClientId && (
                <div style={{ marginTop: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                    <div style={{ flex: 1, height: 1, background: 'var(--felt-line)' }} />
                    <span style={{ color: 'var(--muted)', fontSize: 12 }}>{t.authOr}</span>
                    <div style={{ flex: 1, height: 1, background: 'var(--felt-line)' }} />
                  </div>
                  <div id="gsi-btn" style={{ display: 'flex', justifyContent: 'center' }} />
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

window.AuthModal = AuthModal;
