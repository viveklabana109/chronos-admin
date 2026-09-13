/**
 * The one place that knows how this API answers.
 *
 * Two conventions the rest of the app should never have to remember:
 *  - every success is wrapped as `{ message, data: {...} }`, so callers want
 *    `data` and nothing else;
 *  - tokens are *siblings* of `data`, not inside it (`responses.py:with_tokens`),
 *    which is why `login()` reads them off the root.
 */

const BASE = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/+$/, '');
const TOKEN_KEY = 'chronos.admin.token';

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    // A browser with site data blocked still gets a working (if forgetful) panel.
    return null;
  }
}

export function setToken(token: string | null) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* ignore */
  }
}

/** Fired when a request that carried a token comes back 401. */
export const SESSION_ENDED = 'chronos:session-ended';

/**
 * A 401 on an authenticated request means the session is over — expired,
 * signed out elsewhere, password changed, account suspended. There is nothing
 * the page can do with that except stop pretending.
 *
 * Handled here rather than in each screen because every screen would have to
 * remember, and the one that forgets shows the panel's chrome — sidebar,
 * account name, navigation — wrapped around "Session ended, please sign in
 * again". That reads as a broken app rather than as a sign-out.
 *
 * An event rather than a direct call into the auth context, which would make
 * these two modules import each other. Only 401 does this: a 403 is a live
 * session being refused one thing (a missing permission, or an account that
 * must change its password first), and signing someone out for it would lose
 * them the very screen they need.
 */
function endSession() {
  setToken(null);
  window.dispatchEvent(new CustomEvent(SESSION_ENDED));
}

export class ApiError extends Error {
  status: number;
  /** Per-field messages from `ValidationApiError`, when the failure was one. */
  fields?: Record<string, string[]>;

  constructor(status: number, message: string, fields?: Record<string, string[]>) {
    super(message);
    this.status = status;
    this.fields = fields;
  }
}

/**
 * The server says "this went wrong" in three different shapes depending on
 * which layer refused: `detail` (most routes), `message` (ApiError with a
 * message), and FastAPI's own validation list. Flattening them here keeps
 * every call site down to `err.message`.
 */
function readError(status: number, body: unknown): ApiError {
  if (body && typeof body === 'object') {
    const b = body as Record<string, any>;
    if (b.errors && typeof b.errors === 'object') {
      const first = Object.values(b.errors as Record<string, string[]>)[0]?.[0];
      return new ApiError(status, first ?? b.message ?? 'Request failed', b.errors);
    }
    if (typeof b.detail === 'string') return new ApiError(status, b.detail);
    if (Array.isArray(b.detail)) {
      // FastAPI 422: [{loc: [...], msg: "..."}]
      const msg = b.detail.map((d: any) => d?.msg).filter(Boolean).join('; ');
      return new ApiError(status, msg || 'Validation failed');
    }
    if (typeof b.message === 'string') return new ApiError(status, b.message);
  }
  return new ApiError(status, `Request failed (${status})`);
}

type Options = {
  method?: string;
  body?: unknown;
  /** Send as multipart instead of JSON. */
  form?: FormData;
  /** Skip the Authorization header (login itself). */
  anonymous?: boolean;
};

export async function api<T = any>(path: string, options: Options = {}): Promise<T> {
  const { method = 'GET', body, form, anonymous } = options;
  const headers: Record<string, string> = {};
  const token = getToken();
  if (token && !anonymous) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  let response: Response;
  try {
    response = await fetch(`${BASE}${path}`, {
      method,
      headers,
      body: form ?? (body === undefined ? undefined : JSON.stringify(body)),
    });
  } catch {
    // fetch only rejects on a transport failure, so this is genuinely "could
    // not reach the API" — worth saying plainly, since the usual cause is a
    // wrong VITE_API_BASE_URL or a sleeping free-tier instance.
    throw new ApiError(0, 'Could not reach the API. Check the base URL and that the server is up.');
  }

  if (response.status === 204) return undefined as T;

  const text = await response.text();
  let parsed: unknown = undefined;
  if (text) {
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = undefined;
    }
  }

  if (response.status === 401 && !anonymous && token) endSession();
  if (!response.ok) throw readError(response.status, parsed);

  const root = (parsed ?? {}) as Record<string, any>;
  return (root.data !== undefined ? root.data : root) as T;
}

/** Raw envelope, for the one caller that needs the sibling tokens. */
export async function apiRaw<T = any>(path: string, options: Options = {}): Promise<T> {
  const { method = 'GET', body, anonymous } = options;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const token = getToken();
  if (token && !anonymous) headers.Authorization = `Bearer ${token}`;

  let response: Response;
  try {
    response = await fetch(`${BASE}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, 'Could not reach the API. Check the base URL and that the server is up.');
  }
  const text = await response.text();
  const parsed = text ? JSON.parse(text) : {};
  if (response.status === 401 && !anonymous && token) endSession();
  if (!response.ok) throw readError(response.status, parsed);
  return parsed as T;
}

/** Absolute URL for a private identity document (admin-gated route). */
export function identityFileUrl(fileId: string): string {
  return `${BASE}/admin/identity/files/${fileId}`;
}

export const apiBaseUrl = BASE;
