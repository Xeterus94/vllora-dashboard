import { useCallback, useEffect, useState } from 'react';
import { AuthScreens } from './components/AuthScreens';
import { MasterDashboard } from './components/MasterDashboard';
import { PortalDashboard } from './components/PortalDashboard';
import { Alert } from './components/PortalUI';
import { ApiError, message, request, type Identity } from './lib/api';

function takeResetToken() {
  const token = new URLSearchParams(location.hash.slice(1)).get('reset') ?? '';
  if (token)
    history.replaceState(null, '', `${location.pathname}${location.search}`);
  return token;
}
const resetToken = takeResetToken();
export default function App() {
  const [identity, setIdentity] = useState<Identity | null>(null),
    [loading, setLoading] = useState(!resetToken),
    [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0),
    [reset, setReset] = useState(resetToken);
  useEffect(() => {
    if (resetToken && attempt === 0) return;
    let active = true;
    request<Identity>('/auth/me')
      .then(
        (v) => {
          if (active) setIdentity(v);
        },
        (e) => {
          if (active && (!(e instanceof ApiError) || e.status !== 401))
            setError(message(e));
        },
      )
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [attempt]);
  useEffect(() => {
    const update = () => {
      const token = takeResetToken();
      if (token) {
        setReset(token);
        setLoading(false);
        setError('');
      }
    };
    window.addEventListener('hashchange', update);
    return () => window.removeEventListener('hashchange', update);
  }, []);
  const signedOut = useCallback(() => {
    setIdentity(null);
    setReset('');
  }, []);
  if (loading)
    return (
      <main className="auth-shell">
        <p role="status">Se încarcă portalul…</p>
      </main>
    );
  if (error)
    return (
      <main className="auth-shell">
        <div className="auth-card">
          <Alert>{error}</Alert>
          <button
            className="button primary"
            onClick={() => {
              setLoading(true);
              setError('');
              setAttempt((v) => v + 1);
            }}
          >
            Reîncearcă
          </button>
        </div>
      </main>
    );
  if (!identity || identity.must_change_password || reset)
    return (
      <AuthScreens
        identity={identity}
        resetToken={reset}
        onLogin={(v) => {
          setIdentity(v);
          setReset('');
        }}
        onLogout={signedOut}
        onDismissReset={() => setReset('')}
      />
    );
  if (identity.user.role === 'super_admin')
    return <MasterDashboard user={identity.user} onLogout={signedOut} />;
  return identity.site ? (
    <PortalDashboard identity={identity} onLogout={signedOut} />
  ) : null;
}
