import { useState } from 'react';
import { useAuth } from '../lib/auth';
import { ApiError, apiBaseUrl } from '../lib/api';
import { Field } from '../components/ui';

export default function Login() {
  const { login } = useAuth();
  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Sign-in failed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login-wrap">
      <div className="card login-card">
        <div className="card-body">
          <h1 className="login-title">Chronos Admin</h1>
          <p className="login-sub">Sign in with your administrator ID.</p>

          {!apiBaseUrl ? (
            <div className="warn-banner">
              VITE_API_BASE_URL is not set, so every request will go to this page's own origin. Copy
              <code> .env.example</code> to <code>.env</code> and set it.
            </div>
          ) : null}

          {error ? <div className="error-banner">{error}</div> : null}

          <form
            onSubmit={(e) => {
              e.preventDefault();
              void run(() => login(loginId.trim(), password));
            }}
          >
            <Field label="Administrator ID" hint="The id you were given when the account was created.">
              <input value={loginId} onChange={(e) => setLoginId(e.target.value)} autoFocus autoComplete="username" />
            </Field>
            <Field label="Password">
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
              />
            </Field>
            <button className="primary" type="submit" disabled={busy || !loginId || !password} style={{ width: '100%' }}>
              {busy ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
