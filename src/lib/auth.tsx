import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { SESSION_ENDED, api, apiRaw, getToken, setToken } from './api';

/**
 * Sign-in against the admin store.
 *
 * This used to be two calls: `/auth/login` proved the password, then
 * `/auth/me` said whether the account was an administrator — because both
 * lived on the same `users` row and one of them was a flag on it.
 *
 * Neither is true now. Administrators are their own accounts in their own
 * database, behind their own door: `POST /admin/auth/login` either returns an
 * admin session or it does not. There is no non-admin who can sign in here, so
 * there is nothing to check afterwards.
 *
 * Two things follow, and both are deliberate:
 *
 * - **No OTP step.** Admin sign-in never had one and now cannot: the OTP
 *   machinery belongs to the marketplace, where `CHRONOS_DEV_STATIC_OTP` pins
 *   every code to a fixed value on non-production deployments.
 * - **No self-service reset.** An admin password is issued by another
 *   administrator and replaced by its owner. A "forgot password" flow reachable
 *   from the internet would be a way into this store that does not require it.
 */

export type Me = {
  id: string;
  loginId: string;
  name?: string;
  email?: string;
  isSuperAdmin: boolean;
  /** Signed in with a password somebody else chose. Panel is locked until false. */
  mustChangePassword: boolean;
  /**
   * What this account may do, as the server resolved it.
   *
   * Advisory only. It decides what the panel *shows*; every route re-checks on
   * the way in, so a stale list costs a 403 and never access.
   */
  permissions: string[];
  /** CHRONOS_ADMIN_AUTH_DISABLED — local testing, every route open. */
  authDisabled: boolean;
};

type AuthState = {
  me: Me | null;
  loading: boolean;
  login: (loginId: string, password: string) => Promise<void>;
  logout: () => void;
  /** Re-read /admin/auth/me — used after a password change clears the lock. */
  refresh: () => Promise<void>;
};

const Ctx = createContext<AuthState | null>(null);

async function loadMe(): Promise<Me> {
  const body = await api<any>('/admin/auth/me');
  const admin = body.administrator ?? {};
  return {
    id: admin.id ?? '',
    loginId: admin.loginId ?? '',
    name: admin.fullName,
    email: admin.email,
    isSuperAdmin: Boolean(admin.isSuperAdmin),
    mustChangePassword: Boolean(admin.mustChangePassword),
    permissions: Array.isArray(admin.permissions) ? admin.permissions : [],
    authDisabled: Boolean(body.authDisabled),
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);

  // Restore a session on reload. A dead token must not strand the panel on a
  // spinner, so any failure here simply means "signed out".
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!getToken()) {
        setLoading(false);
        return;
      }
      try {
        const next = await loadMe();
        if (!cancelled) setMe(next);
      } catch {
        setToken(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Any authenticated request that comes back 401 ends the session, wherever in
  // the app it was made. Without this the token is gone but `me` is not, so the
  // panel keeps rendering its sidebar and account name around pages that all
  // say "Session ended" — which looks like a broken app rather than a sign-out.
  useEffect(() => {
    const onEnded = () => setMe(null);
    window.addEventListener(SESSION_ENDED, onEnded);
    return () => window.removeEventListener(SESSION_ENDED, onEnded);
  }, []);

  const refresh = useCallback(async () => {
    setMe(await loadMe());
  }, []);

  const login = useCallback(async (loginId: string, password: string) => {
    // Tokens sit beside `data`, so this one call reads the raw envelope.
    const body = await apiRaw<any>('/admin/auth/login', {
      method: 'POST',
      body: { loginId, password },
      anonymous: true,
    });
    setToken(body.accessToken);
    setMe(await loadMe());
  }, []);

  const logout = useCallback(() => {
    // Best-effort: tell the server so the session dies there too, then drop the
    // token locally whatever happens. A failed logout must still sign you out
    // of this browser.
    void apiRaw('/admin/auth/logout', { method: 'POST', body: {} }).catch(() => undefined);
    setToken(null);
    setMe(null);
  }, []);

  const value = useMemo(
    () => ({ me, loading, login, logout, refresh }),
    [me, loading, login, logout, refresh],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}

/**
 * Does the signed-in account hold *any* of these?
 *
 * Any, not all, because it mirrors the server: several screens are reachable
 * by more than one permission, and demanding all of them would hide a page
 * from the specialist it was meant for.
 */
export function useCan(): (...permissions: string[]) => boolean {
  const { me } = useAuth();
  return (...permissions: string[]) => {
    if (!me) return false;
    if (me.isSuperAdmin) return true;
    return permissions.some((p) => me.permissions.includes(p));
  };
}
