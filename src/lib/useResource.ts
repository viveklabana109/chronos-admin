import { useCallback, useEffect, useState } from 'react';
import { ApiError, api } from './api';

/**
 * Load one admin list endpoint, and give the page a way to reload it.
 *
 * Every list screen in the panel is the same three states — loading, an error
 * worth showing, or rows — and every write is followed by a reload rather than
 * a local patch. Reloading is the honest option here: an approval changes the
 * user row, the listing row and the account status at once, and re-deriving
 * that in the client is how a panel starts lying about what the server holds.
 */
export function useResource<T>(path: string, pick: (data: any) => T, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    // An empty path means "this caller may not read this" — a permission the
    // account does not hold. Skipping is the point: firing the request anyway
    // would put a 403 on every page load and leave a permanent error banner on
    // a screen the admin is not supposed to care about.
    if (!path) {
      setData(null);
      setLoading(false);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const body = await api<any>(path);
      setData(pick(body));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong.');
    } finally {
      setLoading(false);
    }
    // `pick` is defined inline at every call site, so it is intentionally not a
    // dependency — including it would reload on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, ...deps]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { data, loading, error, reload, setError };
}
