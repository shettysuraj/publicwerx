export const AUTH_BASE = 'https://auth.publicwerx.org';
export const APP_ID = 'publicwerx-admin';
export const REFRESH_KEY = 'publicwerx-admin:refreshToken';
export const SSO_STATE_KEY = 'publicwerx-admin:ssoState';
export const SSO_BOUNCED_KEY = 'publicwerx-admin:ssoBounced';
export const USER_KEY = 'publicwerx-admin:user';

let accessToken = null;
export const setAccessToken = (t) => { accessToken = t; };
export const getAccessToken = () => accessToken;

export function getCachedUser() {
  try {
    const raw = localStorage.getItem(USER_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    return parsed;
  } catch { return null; }
}
export function setCachedUser(user) {
  if (!user || typeof user !== 'object') return;
  try { localStorage.setItem(USER_KEY, JSON.stringify(user)); } catch {}
}
export function clearCachedUser() {
  try { localStorage.removeItem(USER_KEY); } catch {}
}

function decodeJwtPayload(token) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  try {
    const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = b64 + '==='.slice((b64.length + 3) % 4);
    const json = atob(padded);
    return JSON.parse(json);
  } catch { return null; }
}

function cacheUserFromToken(token) {
  const payload = decodeJwtPayload(token);
  if (!payload) return;
  const email = payload.email ? String(payload.email).toLowerCase() : null;
  const sub = payload.sub ? String(payload.sub) : null;
  if (!email && !sub) return;
  setCachedUser({ email, sub });
}

export function consumeSsoFragment() {
  if (typeof window === 'undefined') return false;
  if (!window.location.hash || window.location.hash.length < 2) return false;
  const params = new URLSearchParams(window.location.hash.slice(1));
  const at = params.get('accessToken');
  const rt = params.get('refreshToken');
  const state = params.get('state');
  if (!at || !rt) return false;
  const expected = sessionStorage.getItem(SSO_STATE_KEY);
  sessionStorage.removeItem(SSO_STATE_KEY);
  if (!expected || state !== expected) {
    console.warn('[sso] state mismatch, ignoring fragment');
    history.replaceState(null, '', window.location.pathname + window.location.search);
    return false;
  }
  setAccessToken(at);
  localStorage.setItem(REFRESH_KEY, rt);
  cacheUserFromToken(at);
  history.replaceState(null, '', window.location.pathname + window.location.search);
  return true;
}

export function redirectToAuthorize() {
  const nonce = Array.from(crypto.getRandomValues(new Uint8Array(16)))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
  sessionStorage.setItem(SSO_STATE_KEY, nonce);
  const returnTo = window.location.origin + window.location.pathname;
  const url = `${AUTH_BASE}/authorize?app=${APP_ID}` +
              `&return_to=${encodeURIComponent(returnTo)}` +
              `&state=${nonce}`;
  window.location.assign(url);
}

let refreshInFlight = null;
export async function tryRefresh() {
  if (refreshInFlight) return refreshInFlight;
  refreshInFlight = (async () => {
    const refreshToken = localStorage.getItem(REFRESH_KEY);
    if (!refreshToken) return false;
    try {
      const r = await fetch(`${AUTH_BASE}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });
      if (!r.ok) {
        localStorage.removeItem(REFRESH_KEY);
        clearCachedUser();
        setAccessToken(null);
        return false;
      }
      const data = await r.json();
      setAccessToken(data.accessToken);
      localStorage.setItem(REFRESH_KEY, data.refreshToken);
      cacheUserFromToken(data.accessToken);
      return true;
    } catch {
      return false;
    }
  })();
  try {
    return await refreshInFlight;
  } finally {
    refreshInFlight = null;
  }
}

export async function authFetch(url, options = {}) {
  const withAuth = (token) => ({
    ...options,
    headers: { ...(options.headers || {}), Authorization: `Bearer ${token}` },
  });
  let res = await fetch(url, withAuth(getAccessToken()));
  if (res.status === 401) {
    const refreshed = await tryRefresh();
    if (!refreshed) return res;
    res = await fetch(url, withAuth(getAccessToken()));
  }
  return res;
}
