import type { User } from '@jo/schemas';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';

/**
 * The short-lived access token lives in memory only (never localStorage, so
 * it can't be stolen by a stored-XSS payload). It is lost on full page
 * reload, which is fine: AuthProvider re-derives it by calling /auth/refresh
 * using the httpOnly refresh cookie on mount.
 */
let accessToken: string | null = null;
export function setAccessToken(token: string | null) {
  accessToken = token;
}

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public fieldErrors?: Record<string, string[] | undefined>,
  ) {
    super(message);
  }
}

async function parseErrorBody(res: Response): Promise<{ message: string; errors?: Record<string, string[]> }> {
  try {
    const body = await res.json();
    return { message: body.message ?? res.statusText, errors: body.errors };
  } catch {
    return { message: res.statusText };
  }
}

async function rawFetch(path: string, init?: RequestInit): Promise<Response> {
  return fetch(`${API_URL}${path}`, {
    ...init,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...init?.headers,
    },
  });
}

/**
 * Attempts to mint a fresh access token from the httpOnly refresh cookie.
 * Never throws - a network error (e.g. the API is unreachable) is treated
 * the same as "not signed in" so the app can still render.
 */
export async function refreshSession(): Promise<boolean> {
  let res: Response;
  try {
    res = await rawFetch('/auth/refresh', { method: 'POST' });
  } catch {
    setAccessToken(null);
    return false;
  }
  if (!res.ok) {
    setAccessToken(null);
    return false;
  }
  const data = await res.json();
  setAccessToken(data.accessToken);
  return true;
}

/** Authenticated fetch: retries once after a silent refresh on a 401. */
export async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  let res = await rawFetch(path, init);
  if (res.status === 401 && path !== '/auth/refresh') {
    const refreshed = await refreshSession();
    if (refreshed) res = await rawFetch(path, init);
  }
  return res;
}

export async function login(email: string, password: string): Promise<User> {
  const res = await rawFetch('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
  if (!res.ok) {
    const { message, errors } = await parseErrorBody(res);
    throw new ApiError(message, res.status, errors);
  }
  const data = await res.json();
  setAccessToken(data.accessToken);
  return data.user;
}

export async function register(input: {
  fullName: string;
  email: string;
  password: string;
  phone?: string;
}): Promise<User> {
  const res = await rawFetch('/auth/register', { method: 'POST', body: JSON.stringify(input) });
  if (!res.ok) {
    const { message, errors } = await parseErrorBody(res);
    throw new ApiError(message, res.status, errors);
  }
  const data = await res.json();
  setAccessToken(data.accessToken);
  return data.user;
}

export async function logout(): Promise<void> {
  await rawFetch('/auth/logout', { method: 'POST' });
  setAccessToken(null);
}

export async function fetchMe(): Promise<User | null> {
  const res = await apiFetch('/auth/me');
  if (!res.ok) return null;
  return res.json();
}
