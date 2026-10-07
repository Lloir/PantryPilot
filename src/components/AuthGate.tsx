import React, { useCallback, useEffect, useState } from 'react';
import { Refrigerator, Lock } from 'lucide-react';

type AuthState = 'checking' | 'signedOut' | 'signedIn';

// Any API call that comes back 401 (e.g. the session expired) sends the user back to the login screen.
let fetchPatched = false;
function patchFetchFor401() {
  if (fetchPatched) return;
  fetchPatched = true;
  const original = window.fetch.bind(window);
  window.fetch = async (...args) => {
    const response = await original(...args);
    const url = typeof args[0] === 'string' ? args[0] : (args[0] as Request).url;
    if (response.status === 401 && url.includes('/api/') && !url.includes('/api/auth/')) {
      window.dispatchEvent(new Event('pantrypal:unauthorized'));
    }
    return response;
  };
}

export const AuthGate: React.FC<{ children: (logout: () => void) => React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<AuthState>('checking');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    patchFetchFor401();
    const onUnauthorized = () => setState('signedOut');
    window.addEventListener('pantrypal:unauthorized', onUnauthorized);

    fetch('/api/auth/me')
      .then(res => res.json())
      .then(data => setState(data.authenticated ? 'signedIn' : 'signedOut'))
      // Server unreachable: let the app run in its local-only mode
      .catch(() => setState('signedIn'));

    return () => window.removeEventListener('pantrypal:unauthorized', onUnauthorized);
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      if (res.ok) {
        setPassword('');
        setState('signedIn');
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.error || 'Could not sign in');
      }
    } catch {
      setError('Could not reach the server');
    } finally {
      setBusy(false);
    }
  };

  const logout = useCallback(() => {
    fetch('/api/auth/logout', { method: 'POST' }).finally(() => setState('signedOut'));
  }, []);

  if (state === 'checking') {
    return <div className="min-h-screen bg-stone-100/60" />;
  }

  if (state === 'signedIn') {
    return <>{children(logout)}</>;
  }

  return (
    <div className="min-h-screen bg-stone-100/60 flex items-center justify-center p-4 font-sans">
      <form
        onSubmit={handleLogin}
        className="bg-white w-full max-w-sm rounded-2xl border border-stone-200 shadow-xl p-6 space-y-4"
      >
        <div className="flex items-center space-x-3">
          <div className="w-11 h-11 rounded-xl bg-emerald-600 flex items-center justify-center text-white shadow-md shadow-emerald-600/20">
            <Refrigerator className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-stone-900 leading-tight">PantryPal</h1>
            <p className="text-xs text-stone-500">Sign in to continue</p>
          </div>
        </div>

        <div>
          <label htmlFor="pp-user" className="block text-xs font-semibold text-stone-700 mb-1">Username</label>
          <input
            id="pp-user"
            type="text"
            autoComplete="username"
            autoCapitalize="none"
            autoFocus
            required
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm"
          />
        </div>

        <div>
          <label htmlFor="pp-pass" className="block text-xs font-semibold text-stone-700 mb-1">Password</label>
          <input
            id="pp-pass"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm"
          />
        </div>

        {error && (
          <p role="alert" className="text-xs font-medium text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={busy}
          className="w-full inline-flex items-center justify-center space-x-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white rounded-xl text-sm font-bold shadow-md"
        >
          <Lock className="w-4 h-4" />
          <span>{busy ? 'Signing in...' : 'Sign in'}</span>
        </button>
      </form>
    </div>
  );
};
