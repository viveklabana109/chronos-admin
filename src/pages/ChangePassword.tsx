import { useState } from 'react';
import { ApiError, apiRaw, setToken } from '../lib/api';
import { useAuth } from '../lib/auth';
import { Field } from '../components/ui';

/**
 * Shown instead of the panel while `mustChangePassword` is set.
 *
 * Not a route and not dismissible: the account can sign in and do exactly this
 * until the handed-over password is replaced, and the server enforces the same
 * thing — so offering a way past it would only produce a shell where every
 * click 403s.
 */
export default function ChangePassword() {
  const { me, logout } = useAuth();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setError(null);
    if (next !== confirm) {
      setError('The two new passwords do not match.');
      return;
    }
    setBusy(true);
    try {
      // Changing the password ends every session, this one included — and the
      // admin route does not hand back a replacement, on purpose: the new
      // password should be typed once before it is relied on. So sign back in
      // rather than pretending the old session survived.
      await apiRaw<any>('/admin/auth/password/change', {
        method: 'POST',
        body: { currentPassword: current, newPassword: next },
      });
      setToken(null);
      logout();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not change the password.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login-wrap">
      <div className="card login-card">
        <div className="card-body">
          <h1 className="login-title">Choose your password</h1>
          <p className="login-sub">
            Signed in as <strong>{me?.loginId}</strong>. The password you were given works once — replace it before
            you can use the panel.
          </p>

          {error ? <div className="error-banner">{error}</div> : null}

          <form
            onSubmit={(e) => {
              e.preventDefault();
              void submit();
            }}
          >
            <Field label="The password you were given">
              <input type="password" value={current} onChange={(e) => setCurrent(e.target.value)} autoFocus />
            </Field>
            <Field
              label="New password"
              hint="At least 8 characters, with an uppercase, a lowercase, a number and a symbol."
            >
              <input
                type="password"
                value={next}
                onChange={(e) => setNext(e.target.value)}
                autoComplete="new-password"
              />
            </Field>
            <Field label="New password again">
              <input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                autoComplete="new-password"
              />
            </Field>
            <button
              className="primary"
              type="submit"
              disabled={busy || !current || !next || !confirm}
              style={{ width: '100%' }}
            >
              {busy ? 'Saving…' : 'Set password and continue'}
            </button>
          </form>

          <button className="link" style={{ marginTop: 14 }} onClick={logout}>
            Sign out instead
          </button>
        </div>
      </div>
    </div>
  );
}
